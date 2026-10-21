import { BasicCrawler, Configuration } from '@crawlee/jsdom';
import { JSDOM, VirtualConsole } from 'jsdom';
import { acquireCrawlLock, releaseCrawlLock } from './crawl-lock';
import { discoverPageArticles, extractDocument, parseFeedArticles } from './content';
import { fetchSourceText } from './network';
import { SOURCES, sourceById } from './sources';
import { getStore, type Store } from './store';
import type { Source } from './types';

type CrawlOptions = { sourceId?: string; perSource?: number; extractPerSource?: number };
const safeError = (error: unknown) => error instanceof Error && /^HTTP \d+$/.test(error.message) ? error.message : error instanceof Error && /timeout|abort/i.test(error.name + error.message) ? 'Hết thời gian kết nối' : 'Không thể lấy nội dung từ nguồn';

async function discover(source: Source) {
  if (source.engineeringOnly) {
    // A general company feed can contain marketing posts. Only use links on its engineering index.
    const page = await fetchSourceText(source.url, source);
    const links = discoverPageArticles(page.text, { ...source, articlePath: '/blog/' });
    if (!links.length) throw new Error('Engineering index has no article links');
    if (!source.feed) return links;
    const allowed = new Map(links.map((article) => [article.url.replace(/\/$/, ''), article]));
    const feed = await parseFeedArticles((await fetchSourceText(source.feed, source)).text, source);
    for (const article of feed) if (allowed.has(article.url.replace(/\/$/, ''))) allowed.set(article.url.replace(/\/$/, ''), article);
    return [...allowed.values()];
  }
  const response = await fetchSourceText(source.feed ?? source.url, source);
  return source.feed ? parseFeedArticles(response.text, source) : discoverPageArticles(response.text, source);
}

async function collect(store: Store, runId: string, options: CrawlOptions) {
  const sources = options.sourceId ? SOURCES.filter((source) => source.id === options.sourceId) : SOURCES;
  let discovered = 0, extracted = 0, failedSources = 0;
  const progress = () => store.db.query('UPDATE crawl_runs SET discovered=$2,extracted=$3,failed_sources=$4 WHERE id=$1', [runId, discovered, extracted, failedSources]);
  const configuration = new Configuration({ persistStorage: false });
  const discovery = new BasicCrawler({
    maxConcurrency: 3, maxRequestRetries: 0, requestHandlerTimeoutSecs: 55,
    async requestHandler({ request }) {
      const source = sourceById(request.userData.sourceId)!;
      try {
        const articles = (await discover(source)).slice(0, options.perSource ?? 30);
        if (!articles.length) throw new Error('No articles found');
        // Indexes list newest first. Insert backwards to preserve that order for undated articles.
        for (const article of [...articles].reverse()) await store.upsertArticle(article);
        discovered += articles.length;
        await store.setSourceResult(source.id, null);
        console.info(`[crawl] ${source.name}: ${articles.length} articles`);
      } catch (error) {
        failedSources++;
        await store.setSourceResult(source.id, safeError(error));
        console.warn(`[crawl] ${source.name}: ${safeError(error)}`);
      }
      await progress();
    },
  }, configuration);
  await discovery.run(sources.map((source) => ({ url: source.url, uniqueKey: `${runId}:source:${source.id}`, userData: { sourceId: source.id } })));

  const candidates = (await store.extractionCandidates(options.extractPerSource ?? 2)).filter((article) => !options.sourceId || article.sourceId === options.sourceId);
  if (candidates.length) {
    const extraction = new BasicCrawler({
      maxConcurrency: 3, maxRequestRetries: 0, requestHandlerTimeoutSecs: 40,
      async requestHandler({ request }) {
        const { id, sourceId } = request.userData;
        await store.markExtractionAttempt(id);
        try {
          const response = await fetchSourceText(request.url, sourceById(sourceId)!);
          // No scripts or subresources are executed. Crawlee controls concurrency; our fetch limits bytes and redirects.
          const dom = new JSDOM(response.text, { url: response.url, virtualConsole: new VirtualConsole() });
          try {
            const content = extractDocument(dom.window.document);
            if (content) { await store.saveExtracted(id, content); extracted++; await progress(); }
          } finally { dom.window.close(); }
        } catch { /* Keep the feed content and original URL available when extraction is blocked. */ }
      },
    }, new Configuration({ persistStorage: false }));
    await extraction.run(candidates.map((article) => ({ url: article.url, uniqueKey: `${runId}:article:${article.id}`, userData: { id: article.id, sourceId: article.sourceId } })));
  }
  await store.db.query("UPDATE crawl_runs SET status='completed',finished_at=now(),discovered=$2,extracted=$3,failed_sources=$4 WHERE id=$1", [runId, discovered, extracted, failedSources]);
  return { discovered, extracted, failedSources };
}

export async function startCrawl(options: CrawlOptions = {}, store = getStore()) {
  if (options.sourceId && !sourceById(options.sourceId)) throw new Error('Unknown source');
  const lock = await acquireCrawlLock(store.db);
  if (!lock) return null;
  let runId: string;
  try {
    await lock.query("UPDATE crawl_runs SET status='failed',finished_at=now() WHERE status='running'");
    runId = (await lock.query('INSERT INTO crawl_runs DEFAULT VALUES RETURNING id')).rows[0].id;
  } catch (error) { await releaseCrawlLock(lock); throw error; }
  const completion = collect(store, runId, options).catch(async (error) => {
    await store.db.query("UPDATE crawl_runs SET status='failed',finished_at=now() WHERE id=$1", [runId]);
    console.error('[crawl] Collection failed:', error instanceof Error ? error.name : 'Unknown error');
    throw error;
  }).finally(() => releaseCrawlLock(lock));
  return { runId, completion };
}
