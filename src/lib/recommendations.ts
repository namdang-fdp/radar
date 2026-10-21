import type { Article } from './types';

export interface TopicInterest { topic: string; saved: number; read: number }
export interface Recommendation { article: Article; reason: string }

/** Small, deterministic personal-library ranking. No external services or tracking. */
export function recommend(articles: Article[], interests: TopicInterest[], now = new Date(), limit = 3): Recommendation[] {
  const preferences = new Map(interests.map((item) => [item.topic, item]));
  const hasHistory = interests.some((item) => item.saved > 0 || item.read > 0);
  const candidates = articles.filter((article) => !article.isRead).map((article) => {
    const interest = preferences.get(article.topic);
    const age = Math.max(0, (now.getTime() - (article.publishedAt ?? article.discoveredAt).getTime()) / 86400000);
    const affinity = Math.min(6, (interest?.saved ?? 0) * 2 + (interest?.read ?? 0) * .5);
    const score = 10 / (1 + age / 7) + affinity + (article.contentStatus === 'full' ? 1 : 0);
    const reason = interest?.saved ? 'Cùng chủ đề bạn đã lưu' : interest?.read ? 'Tiếp nối chủ đề bạn đã đọc' : hasHistory ? 'Khám phá chủ đề mới' : 'Một góc đọc để bắt đầu';
    return { article, reason, score };
  });
  const selected: Recommendation[] = [];
  const sources = new Set<string>();
  const topics = new Set<string>();
  while (selected.length < limit) {
    const next = candidates.filter(({ article }) => !sources.has(article.sourceId))
      .sort((a, b) => (b.score - (topics.has(b.article.topic) ? 3 : 0)) - (a.score - (topics.has(a.article.topic) ? 3 : 0)) || a.article.id.localeCompare(b.article.id))[0];
    if (!next) break;
    selected.push({ article: next.article, reason: next.reason });
    sources.add(next.article.sourceId);
    topics.add(next.article.topic);
  }
  return selected;
}
