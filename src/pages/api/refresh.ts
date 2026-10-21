import type { APIRoute } from 'astro';
import { getStore } from '../../lib/store';
import { json, sameOrigin } from '../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  try {
    const previous = await getStore().latestRun();
    if (previous?.finishedAt && Date.now() - previous.finishedAt.getTime() < 60000) return json({ error: 'Vừa cập nhật xong. Bạn thử lại sau một phút nhé.' }, 429);
    const { startCrawl } = await import('../../lib/collector');
    const run = await startCrawl();
    if (!run) return json({ error: 'Một lượt cập nhật đang chạy.' }, 409);
    // The standalone Node server remains alive after this response. Failures are recorded in crawl_runs.
    void run.completion.catch(() => {});
    return json({ runId: run.runId }, 202);
  } catch { return json({ error: 'Chưa bắt đầu được lượt cập nhật.' }, 503); }
};
