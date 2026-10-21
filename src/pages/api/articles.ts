import type { APIRoute } from 'astro';
import { filtersFrom, json } from '../../lib/http';
import { getStore } from '../../lib/store';
export const GET: APIRoute = async ({ url }) => {
  try {
    const result = await getStore().listArticles(filtersFrom(url));
    return json({ ...result, articles: result.articles.map(({ contentHtml, ...article }) => article) });
  } catch { return json({ error: 'Chưa tải được bài viết.' }, 503); }
};
