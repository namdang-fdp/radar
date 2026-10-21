import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { getStore } from '../../lib/store';
export const GET: APIRoute = async () => {
  try { return json({ recommendations: await getStore().recommendations() }); }
  catch { return json({ error: 'Chưa tải được gợi ý.' }, 503); }
};
