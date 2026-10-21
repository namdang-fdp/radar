import { describe, expect, it } from 'vitest';
import { recommend } from '../src/lib/recommendations';
import type { Article } from '../src/lib/types';
const now = new Date('2026-10-21T00:00:00Z');
const article = (id: string, overrides: Partial<Article> = {}): Article => ({
  id, sourceId: id, title: id, url: `https://example.com/${id}`, topic: 'data', excerpt: '',
  publishedAt: now, discoveredAt: now, author: null, contentHtml: null, contentStatus: 'full',
  readingMinutes: 5, isRead: false, isSaved: false, ...overrides,
});
describe('personal reading recommendations', () => {
  it('starts with fresh unread articles and never repeats a source', () => {
    const picks = recommend([article('old', { publishedAt: new Date('2020-01-01') }), article('read', { isRead: true }), article('a'), article('b', { sourceId: 'a' }), article('c')], [], now);
    expect(picks.map((pick) => pick.article.id)).toEqual(['a', 'c', 'old']);
    expect(picks[0].reason).toBe('Một góc đọc để bắt đầu');
  });
  it('uses saved topics more strongly than read topics and explains the choice', () => {
    const picks = recommend([article('a', { topic: 'cloud' }), article('b', { topic: 'ai' }), article('c')], [{ topic: 'ai', saved: 1, read: 0 }, { topic: 'cloud', saved: 0, read: 1 }], now);
    expect(picks.map((pick) => pick.article.id)).toEqual(['b', 'a', 'c']);
    expect(picks.map((pick) => pick.reason)).toEqual(['Cùng chủ đề bạn đã lưu', 'Tiếp nối chủ đề bạn đã đọc', 'Khám phá chủ đề mới']);
  });
  it('balances topics without allowing old history to dominate indefinitely', () => {
    const picks = recommend([article('a'), article('b'), article('c', { topic: 'ai' }), article('old', { publishedAt: new Date('2020-01-01'), topic: 'cloud' })], [{ topic: 'cloud', saved: 999, read: 999 }], now);
    expect(picks.map((pick) => pick.article.id)).toEqual(['a', 'c', 'b']);
  });
  it('handles missing publication dates, empty libraries and fewer sources', () => {
    expect(recommend([], [], now)).toEqual([]);
    expect(recommend([article('a', { publishedAt: null }), article('b', { sourceId: 'a' })], [], now)).toHaveLength(1);
    expect(recommend([article('a', { isRead: true })], [], now)).toEqual([]);
  });
});
