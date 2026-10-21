import { startCrawl } from '../src/lib/collector';
import { getPool } from '../src/lib/store';

const sourceId = process.argv.find((arg) => arg.startsWith('--source='))?.split('=')[1];
try {
  const run = await startCrawl({ sourceId });
  if (!run) console.info('A collector is already running.');
  else console.info('Collection completed:', await run.completion);
} catch (error) {
  console.error('Collection failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally { await getPool().end(); }
