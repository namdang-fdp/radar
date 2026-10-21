// Deterministic CI fixtures; never crawls publishers or calls AI.
import { getStore, getPool } from '../src/lib/store';
if (process.env.RADAR_CI_FIXTURES !== '1') throw new Error('Fixtures are restricted to CI test databases.');
try {
  const store = getStore();
  await store.migrate();
  for (const [sourceId, title] of [['netflix', 'Testing distributed systems with small experiments'], ['meta', 'Designing a readable engineering library'], ['cloudflare', 'Understanding network latency']] as const) {
    const id = await store.upsertArticle({ sourceId, url: `https://example.com/radar-ci/${sourceId}`, title, excerpt: 'An original test fixture for Radar browser checks.', publishedAt: new Date(), author: 'Radar test', contentHtml: '<p>A small, deterministic engineering article for testing the reader.</p>' });
    await store.saveExtracted(id, { contentHtml: '<h2>Read, learn, repeat</h2><p>A small, deterministic engineering article for testing the reader.</p>', excerpt: 'An original test fixture for Radar browser checks.', author: 'Radar test', publishedAt: new Date(), readingMinutes: 1 });
  }
} finally { await getPool().end(); }
