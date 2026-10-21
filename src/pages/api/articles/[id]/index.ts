import type { APIRoute } from 'astro';
import { json, validId } from '../../../../lib/http';
import { getStore } from '../../../../lib/store';
import { sanitizeArticle } from '../../../../lib/content';
export const GET: APIRoute = async ({ params }) => {
  if (!validId(params.id)) return json({ error: 'Không tìm thấy bài viết.' }, 404);
  try {
    const article = await getStore().getArticle(params.id);
    return article ? json({ article: { ...article, contentHtml: article.contentHtml ? sanitizeArticle(article.contentHtml) : null } }) : json({ error: 'Không tìm thấy bài viết.' }, 404);
  } catch { return json({ error: 'Chưa tải được bài viết.' }, 503); }
};
