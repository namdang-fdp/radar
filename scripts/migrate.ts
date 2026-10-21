import { getStore, getPool } from '../src/lib/store';

try {
  await getStore().migrate();
  console.log('PostgreSQL schema ready; 20 sources registered.');
} finally { await getPool().end(); }
