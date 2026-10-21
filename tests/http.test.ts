import { describe, expect, it } from 'vitest';
import { filtersFrom, readStateChange, sameOrigin } from '../src/lib/http';

describe('reader HTTP boundaries', () => {
  it('normalizes unknown filters, caps search and never accepts a negative page', () => {
    expect(filtersFrom(new URL('http://localhost/?page=-3&view=admin&source=unknown&topic=sql'))).toEqual({ q: '', page: 1, view: 'all', source: '', topic: '' });
    expect(filtersFrom(new URL('http://localhost/?page=999999999&q=' + 'x'.repeat(300))).q).toHaveLength(200);
  });
  it('rejects cross-origin writes and missing origin', () => {
    expect(sameOrigin(new Request('http://localhost/api', { headers: { origin: 'https://evil.example' } }))).toBe(false);
    expect(sameOrigin(new Request('http://localhost/api'))).toBe(false);
    expect(sameOrigin(new Request('http://localhost/api', { headers: { origin: 'http://localhost' } }))).toBe(true);
  });
  it('accepts only a boolean read/saved state with a bounded JSON body', async () => {
    const req = (value: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    expect(await readStateChange(req({ state: 'saved', value: true }))).toEqual({ state: 'saved', value: true });
    await expect(readStateChange(req({ state: 'saved', value: 'true' }))).rejects.toThrow();
    await expect(readStateChange(req({ state: 'admin', value: true }))).rejects.toThrow();
    await expect(readStateChange(req({ state: 'read', value: true, extra: 'x'.repeat(2000) }))).rejects.toThrow();
  });
});
