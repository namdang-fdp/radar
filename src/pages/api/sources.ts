import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { getStore } from '../../lib/store';
import { TOPICS } from '../../lib/sources';
export const GET: APIRoute = async () => {
  try { return json({ sources: (await getStore().listSources()).map(({ id, name, color, mark, articleCount, lastError }) => ({ id, name, color, mark, articleCount, lastError })), topics: TOPICS }); }
  catch { return json({ error: 'Chưa tải được nguồn đọc.' }, 503); }
};
