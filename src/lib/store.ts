import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { recommend, type TopicInterest } from './recommendations';
import { SCHEMA_SQL } from './schema';
import { SOURCES } from './sources';
import { readingMinutes, topicFor } from './content';
import { acquireCrawlLock, releaseCrawlLock } from './crawl-lock';
import type { Article, CrawlRun, DiscoveredArticle, ReaderFilters, SourceState } from './types';

const runtime = globalThis as typeof globalThis & { radarPool?: Pool };
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  return runtime.radarPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
}

const hash = (html: string) => createHash('sha256').update(html).digest('hex');
const toArticle = (row: Record<string, unknown>): Article => ({
  id: String(row.id), sourceId: String(row.source_id), url: String(row.url), title: String(row.title),
  excerpt: String(row.excerpt), author: row.author as string | null, publishedAt: row.published_at as Date | null,
  discoveredAt: row.discovered_at as Date, contentHtml: row.content_html as string | null,
  contentStatus: row.content_status as Article['contentStatus'], topic: String(row.topic),
  readingMinutes: Number(row.reading_minutes), isRead: Boolean(row.is_read), isSaved: Boolean(row.is_saved),
});

export class Store {
  constructor(readonly db: Pool) {}

  async migrate() {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(81457201)');
      await client.query(SCHEMA_SQL);
      for (const source of SOURCES) await client.query(
        'INSERT INTO sources(id,name,url,feed_url) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,url=EXCLUDED.url,feed_url=EXCLUDED.feed_url',
        [source.id, source.name, source.url, source.feed ?? null],
      );
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async upsertArticle(article: DiscoveredArticle): Promise<string> {
    const result = await this.db.query(`
      INSERT INTO articles(source_id,url,title,excerpt,author,published_at,content_html,content_hash,content_status,reading_minutes,topic)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(url) DO UPDATE SET title=EXCLUDED.title,
        excerpt=CASE WHEN articles.content_status='full' THEN articles.excerpt ELSE EXCLUDED.excerpt END,
        author=COALESCE(EXCLUDED.author,articles.author), published_at=COALESCE(EXCLUDED.published_at,articles.published_at),
        content_html=CASE WHEN articles.content_status='full' THEN articles.content_html ELSE COALESCE(EXCLUDED.content_html,articles.content_html) END,
        content_hash=CASE WHEN articles.content_status='full' THEN articles.content_hash ELSE COALESCE(EXCLUDED.content_hash,articles.content_hash) END,
        content_status=CASE WHEN articles.content_status='full' THEN 'full' WHEN COALESCE(EXCLUDED.content_html,articles.content_html) IS NOT NULL THEN 'feed' ELSE 'unavailable' END,
        reading_minutes=CASE WHEN articles.content_status='full' THEN articles.reading_minutes ELSE EXCLUDED.reading_minutes END,
        topic=EXCLUDED.topic RETURNING id`,
    [article.sourceId, article.url, article.title, article.excerpt, article.author, article.publishedAt,
      article.contentHtml, article.contentHtml ? hash(article.contentHtml) : null, article.contentHtml ? 'feed' : 'unavailable',
      readingMinutes(article.contentHtml || article.excerpt), topicFor(article.title + ' ' + article.excerpt)]);
    return String(result.rows[0].id);
  }

  async saveExtracted(id: string, content: { contentHtml: string; excerpt: string; author: string | null; publishedAt: Date | null; readingMinutes: number }) {
    await this.db.query(`UPDATE articles SET content_html=$2,content_hash=$3,content_status='full',excerpt=$4,
      author=COALESCE(author,$5),published_at=COALESCE(published_at,$6),reading_minutes=$7,content_attempted_at=now() WHERE id=$1`,
    [id, content.contentHtml, hash(content.contentHtml), content.excerpt, content.author, content.publishedAt, content.readingMinutes]);
  }

  async extractionCandidates(perSource = 3): Promise<Article[]> {
    const result = await this.db.query(`SELECT * FROM (
      SELECT *,row_number() OVER(PARTITION BY source_id ORDER BY published_at DESC NULLS LAST,discovered_at DESC,id) AS position
      FROM articles WHERE content_status != 'full' AND (content_attempted_at IS NULL OR content_attempted_at < now()-interval '1 day')
    ) candidates WHERE position <= $1 ORDER BY position,source_id`, [perSource]);
    return result.rows.map(toArticle);
  }

  async markExtractionAttempt(id: string) { await this.db.query('UPDATE articles SET content_attempted_at=now() WHERE id=$1', [id]); }

  async getArticle(id: string): Promise<Article | null> {
    const result = await this.db.query('SELECT * FROM articles WHERE id=$1', [id]);
    return result.rows[0] ? toArticle(result.rows[0]) : null;
  }

  async setState(id: string, state: 'saved' | 'read', value: boolean): Promise<boolean> {
    const column = state === 'saved' ? 'is_saved' : 'is_read';
    const result = await this.db.query(`UPDATE articles SET ${column}=$2 WHERE id=$1`, [id, value]);
    return result.rowCount === 1;
  }

  async listArticles(filters: ReaderFilters, pageSize = 12) {
    const values: unknown[] = [];
    const clauses: string[] = [];
    const condition = (sql: string, value: unknown) => { values.push(value); clauses.push(sql.replaceAll('?', `$${values.length}`)); };
    if (filters.q) condition("(title ILIKE '%' || ? || '%' OR excerpt ILIKE '%' || ? || '%')", filters.q);
    if (filters.source) condition('source_id=?', filters.source);
    if (filters.topic) condition('topic=?', filters.topic);
    if (filters.view === 'saved') clauses.push('is_saved');
    if (filters.view === 'unread') clauses.push('NOT is_read');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const totalResult = await this.db.query(`SELECT count(*)::int AS total FROM articles ${where}`, values);
    const total = Number(totalResult.rows[0].total);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(filters.page, pageCount);
    const rows = await this.db.query(`SELECT * FROM articles ${where} ORDER BY published_at DESC NULLS LAST,discovered_at DESC,id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, (page - 1) * pageSize]);
    return { articles: rows.rows.map(toArticle), total, page, pageCount };
  }

  async recommendations() {
    const [candidates, history] = await Promise.all([
      this.db.query(`SELECT id,source_id,url,title,excerpt,author,published_at,discovered_at,
        NULL AS content_html,content_status,topic,reading_minutes,is_read,is_saved FROM (
          SELECT *,row_number() OVER(PARTITION BY source_id ORDER BY published_at DESC NULLS LAST,discovered_at DESC,id) AS position
          FROM articles WHERE NOT is_read
        ) recent WHERE position <= 15`),
      this.db.query(`SELECT topic,count(*) FILTER(WHERE is_saved)::int AS saved,
        count(*) FILTER(WHERE is_read)::int AS read FROM articles WHERE is_saved OR is_read GROUP BY topic`),
    ]);
    return recommend(candidates.rows.map(toArticle), history.rows as TopicInterest[]);
  }

  async listSources(): Promise<SourceState[]> {
    const result = await this.db.query('SELECT sources.*,count(articles.id)::int AS article_count FROM sources LEFT JOIN articles ON articles.source_id=sources.id GROUP BY sources.id');
    const states = new Map(result.rows.map((row) => [row.id, row]));
    return SOURCES.map((source) => {
      const row = states.get(source.id);
      return { ...source, articleCount: row?.article_count ?? 0, lastCheckedAt: row?.last_checked_at ?? null, lastSuccessAt: row?.last_success_at ?? null, lastError: row?.last_error ?? null };
    });
  }

  async setSourceResult(id: string, error: string | null) {
    await this.db.query('UPDATE sources SET last_checked_at=now(),last_success_at=CASE WHEN $2::text IS NULL THEN now() ELSE last_success_at END,last_error=$2 WHERE id=$1', [id, error]);
  }

  async stats() {
    const result = await this.db.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE NOT is_read)::int AS unread,
      count(*) FILTER(WHERE is_saved)::int AS saved,count(*) FILTER(WHERE (discovered_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::int AS added_today FROM articles`);
    return result.rows[0] as { total: number; unread: number; saved: number; added_today: number };
  }

  async latestRun(): Promise<CrawlRun | null> {
    let row = (await this.db.query('SELECT * FROM crawl_runs ORDER BY started_at DESC LIMIT 1')).rows[0];
    if (row?.status === 'running') {
      const lock = await acquireCrawlLock(this.db);
      if (lock) {
        try {
          // A running collector holds this session lock. If it is free, the previous process stopped.
          const recovered = await lock.query("UPDATE crawl_runs SET status='failed',finished_at=now() WHERE id=$1 AND status='running' RETURNING *", [row.id]);
          row = recovered.rows[0] ?? row;
        } finally { await releaseCrawlLock(lock); }
      }
    }
    return row ? { id: row.id, startedAt: row.started_at, finishedAt: row.finished_at, status: row.status, discovered: row.discovered, extracted: row.extracted, failedSources: row.failed_sources } : null;
  }
}

export const getStore = () => new Store(getPool());
