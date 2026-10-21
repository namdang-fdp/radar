import { describe, it, expect, vi } from 'vitest';
import { fetchSourceText } from '../src/lib/network';
import { SOURCES } from '../src/lib/sources';

describe('bounded publisher requests', () => {
  const source = SOURCES[0];
  it('rejects redirects outside the publisher allowlist before fetching them', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
    await expect(fetchSourceText(source.url, source, request)).rejects.toThrow('Redirect');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized responses and upstream errors', async () => {
    await expect(fetchSourceText(source.url, source, vi.fn().mockResolvedValue(new Response('x', { headers: { 'content-length': '9000000' } })))).rejects.toThrow('too large');
    await expect(fetchSourceText(source.url, source, vi.fn().mockResolvedValue(new Response('', { status: 403 })))).rejects.toThrow('HTTP 403');
  });
  it('follows a bounded redirect on the allowed publisher', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/article' } })).mockResolvedValueOnce(new Response('article'));
    expect(await fetchSourceText(source.url, source, request)).toMatchObject({ text: 'article', url: 'https://netflixtechblog.com/article' });
  });
});
