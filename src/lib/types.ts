export interface Source {
  id: string;
  name: string;
  url: string;
  feed?: string;
  mark: string;
  color: string;
  description: string;
  hosts: string[];
  articlePath?: string;
  excludePaths?: string[];
  discoverySelector?: string;
  engineeringOnly?: boolean;
}

export interface DiscoveredArticle {
  sourceId: string;
  url: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  author: string | null;
  contentHtml: string | null;
}

export interface Article extends DiscoveredArticle {
  id: string;
  topic: string;
  readingMinutes: number;
  contentStatus: 'full' | 'feed' | 'unavailable';
  discoveredAt: Date;
  isRead: boolean;
  isSaved: boolean;
}

export interface SourceState extends Source {
  articleCount: number;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
}

export interface ReaderFilters {
  q: string;
  source: string;
  topic: string;
  view: 'all' | 'unread' | 'saved';
  page: number;
}

export interface CrawlRun {
  id: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: 'running' | 'completed' | 'failed';
  discovered: number;
  extracted: number;
  failedSources: number;
}
