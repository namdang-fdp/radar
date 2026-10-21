import { canonicalUrl } from './content';
import type { Source } from './types';

const MAX_BYTES = 5 * 1024 * 1024;
export async function fetchSourceText(raw: string, source: Source, request: typeof fetch = fetch): Promise<{ text: string; url: string }> {
  const initial = canonicalUrl(raw, source);
  if (!initial || new URL(initial).protocol !== 'https:') throw new Error('Publisher URL is not allowed');
  let url: string = initial;
  const signal = AbortSignal.timeout(20000);
  for (let hop = 0; hop < 5; hop++) {
    const response = await request(url, {
      redirect: 'manual', signal,
      headers: { 'user-agent': 'DorrissRadar/0.1 (personal engineering blog reader)', accept: 'application/rss+xml, application/atom+xml, text/html, application/xml;q=0.9, */*;q=0.5' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      const next = location ? canonicalUrl(new URL(location, url).toString(), source) : null;
      if (!next || new URL(next).protocol !== 'https:') throw new Error('Redirect outside allowed publisher');
      url = next;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('Response too large'); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) throw new Error('Response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return { text: Buffer.concat(chunks).toString('utf8'), url };
  }
  throw new Error('Too many redirects');
}
