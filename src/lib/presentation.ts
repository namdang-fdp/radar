import { getStore } from './store';
import { SOURCES } from './sources';
import type { SourceState, CrawlRun } from './types';

const dayFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
export const dateLabel = (date: Date | null) => date ? dayFormat.format(date) : 'Chưa rõ ngày đăng';
export const timeLabel = (date: Date | null) => date ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date) : 'Chưa cập nhật';
export async function overview() {
  try {
    const [sources, stats, run] = await Promise.all([getStore().listSources(), getStore().stats(), getStore().latestRun()]);
    return { sources, stats, run, error: false };
  } catch {
    return {
      sources: SOURCES.map((source) => ({ ...source, articleCount: 0, lastCheckedAt: null, lastSuccessAt: null, lastError: null })) as SourceState[],
      stats: { total: 0, unread: 0, saved: 0, added_today: 0 }, run: null as CrawlRun | null, error: true,
    };
  }
}
export type Overview = Awaited<ReturnType<typeof overview>>;
