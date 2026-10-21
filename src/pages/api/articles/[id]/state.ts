import type { APIRoute } from 'astro';
import { json, readStateChange, sameOrigin, validId } from '../../../../lib/http';
import { getStore } from '../../../../lib/store';

export const POST: APIRoute = async ({ request, params }) => {
  if (!sameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  if (!validId(params.id)) return json({ error: 'Không tìm thấy bài viết.' }, 404);
  let body;
  try { body = await readStateChange(request); } catch { return json({ error: 'Trạng thái không hợp lệ.' }, 422); }
  try {
    const found = await getStore().setState(params.id, body.state, body.value);
    return found ? json({ ok: true, ...body }) : json({ error: 'Không tìm thấy bài viết.' }, 404);
  } catch { return json({ error: 'Chưa lưu được. Vui lòng thử lại.' }, 503); }
};
