import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Store } from '../src/lib/store';
import { acquireCrawlLock, releaseCrawlLock } from '../src/lib/crawl-lock';

const schema = `radar_test_${randomBytes(6).toString('hex')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
const db = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, connectionTimeoutMillis: 3000 });
const store = new Store(db);

beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await store.migrate(); });
afterAll(async () => { await db.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });

describe('PostgreSQL reader state', () => {
  it('allows only one collector across independent connections', async () => {
    const lock = await acquireCrawlLock(db);
    expect(lock).not.toBeNull();
    expect(await acquireCrawlLock(db)).toBeNull();
    await releaseCrawlLock(lock!);
    const next = await acquireCrawlLock(db);
    expect(next).not.toBeNull();
    await releaseCrawlLock(next!);
  });
  it('recovers an interrupted run without failing a collector that still holds the lock', async () => {
    await db.query('INSERT INTO crawl_runs DEFAULT VALUES');
    expect(await store.latestRun()).toMatchObject({ status: 'failed' });
    const lock = await acquireCrawlLock(db);
    try {
      await db.query('INSERT INTO crawl_runs DEFAULT VALUES');
      expect(await store.latestRun()).toMatchObject({ status: 'running' });
    } finally { await releaseCrawlLock(lock!); }
  });
  const input = { sourceId: 'netflix', url: 'https://netflixtechblog.com/test-database', title: 'A distributed database', excerpt: 'Lessons from a migration', publishedAt: null, author: null, contentHtml: '<p>Source provided article content.</p>' };
  it('upserts without duplicating articles or resetting saved and read state', async () => {
    const id = await store.upsertArticle(input);
    await store.setState(id, 'saved', true);
    await store.setState(id, 'read', true);
    const sameId = await store.upsertArticle({ ...input, title: 'A distributed database, updated' });
    expect(sameId).toBe(id);
    expect(await store.getArticle(id)).toMatchObject({ title: 'A distributed database, updated', isSaved: true, isRead: true, publishedAt: null });
    const result = await store.listArticles({ q: '', source: 'netflix', topic: '', view: 'all', page: 1 });
    expect(result.total).toBe(1);
  });
  it('does not replace extracted full content with a feed excerpt on the next crawl', async () => {
    const id = await store.upsertArticle(input);
    await store.saveExtracted(id, { contentHtml: '<p>Complete engineering article.</p>', excerpt: 'Complete article', author: 'Engineer', publishedAt: new Date('2026-10-20'), readingMinutes: 5 });
    await store.upsertArticle({ ...input, contentHtml: '<p>A short feed.</p>' });
    expect(await store.getArticle(id)).toMatchObject({ contentHtml: '<p>Complete engineering article.</p>', contentStatus: 'full', readingMinutes: 5 });
  });
  it('filters saved/unread state and safely handles search punctuation', async () => {
    await store.upsertArticle({ ...input, url: 'https://netflixtechblog.com/test-security', title: "Engineer's security notes" });
    expect((await store.listArticles({ q: "Engineer's", source: '', topic: '', view: 'unread', page: 1 })).total).toBe(1);
    expect((await store.listArticles({ q: '', source: '', topic: '', view: 'saved', page: 1 })).total).toBe(1);
  });
  it('recommends unread articles using saved topic history without loading full content', async () => {
    const picks = await store.recommendations();
    expect(picks).toHaveLength(1);
    expect(picks[0].article.isRead).toBe(false);
    expect(picks[0].article.contentHtml).toBeNull();
    expect(picks[0].article.title).toBe("Engineer's security notes");
  });
  it('records independent source failures without removing existing articles', async () => {
    await store.setSourceResult('netflix', 'HTTP 503');
    const source = (await store.listSources()).find((item) => item.id === 'netflix');
    expect(source).toMatchObject({ articleCount: 2, lastError: 'HTTP 503' });
    await store.setSourceResult('netflix', null);
    expect((await store.listSources()).find((item) => item.id === 'netflix')?.lastError).toBeNull();
  });
});
