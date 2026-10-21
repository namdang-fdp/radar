import { writeFileSync } from 'node:fs';
import { Cron } from 'croner';
import { startCrawl } from '../src/lib/collector';
import { getPool } from '../src/lib/store';

try { await getPool().query('SELECT 1 FROM sources LIMIT 1'); }
catch {
  console.error('[worker] PostgreSQL is unavailable or not migrated. Run npm run db:migrate first.');
  await getPool().end();
  process.exit(1);
}

const job = new Cron('15 7 * * *', { timezone: 'Asia/Ho_Chi_Minh', protect: true }, async () => {
  try {
    const run = await startCrawl();
    if (run) console.info('[worker]', await run.completion);
    else console.info('[worker] Another collector is running; skipped.');
  } catch { console.error('[worker] Collection failed. Check source status on the website.'); }
});
const beat = () => writeFileSync('/tmp/radar-worker-heartbeat', String(Date.now()));
beat();
const heartbeat = setInterval(beat, 30000);
heartbeat.unref();
console.info('Daily collection: 07:15 Asia/Ho_Chi_Minh. Next:', job.nextRun()?.toISOString());
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { job.stop(); clearInterval(heartbeat); await getPool().end(); process.exit(0); });
