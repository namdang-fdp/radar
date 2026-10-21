import type { APIRoute } from 'astro';
import { getStore } from '../../lib/store';
import { json } from '../../lib/http';
export const GET: APIRoute = async () => {
  try {
    const [run, stats] = await Promise.all([getStore().latestRun(), getStore().stats()]);
    return json({ run, stats });
  } catch { return json({ error: 'Chưa kết nối được dữ liệu.' }, 503); }
};
