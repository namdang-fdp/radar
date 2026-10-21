import { SOURCES, TOPICS } from './sources';
import type { ReaderFilters } from './types';

export const validId = (value: string | undefined): value is string => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function filtersFrom(url: URL): ReaderFilters {
  const p = url.searchParams;
  const view = p.get('view');
  return {
    q: (p.get('q') ?? '').trim().slice(0, 200),
    source: SOURCES.some((source) => source.id === p.get('source')) ? p.get('source')! : '',
    topic: TOPICS.some((topic) => topic.id === p.get('topic')) ? p.get('topic')! : '',
    view: view === 'unread' || view === 'saved' ? view : 'all',
    page: Math.max(1, Math.min(100000, Number.parseInt(p.get('page') ?? '1', 10) || 1)),
  };
}
export function readerUrl(filters: Partial<ReaderFilters> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && !(key === 'page' && value === 1) && !(key === 'view' && value === 'all')) params.set(key, String(value));
  return '/' + (params.size ? '?' + params.toString() : '');
}
export const sameOrigin = (request: Request) => request.headers.get('origin') === new URL(request.url).origin;
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export async function readStateChange(request: Request): Promise<{ state: 'saved' | 'read'; value: boolean }> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON required');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Body required');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) throw new Error('Body too large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || !['saved', 'read'].includes(body.state) || typeof body.value !== 'boolean') throw new Error('Invalid state');
  return { state: body.state, value: body.value };
}
