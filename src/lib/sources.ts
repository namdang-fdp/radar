import type { Source } from './types';

export const TOPICS = [
  { id: 'architecture', label: 'Kiến trúc hệ thống' },
  { id: 'ai', label: 'AI & Machine Learning' },
  { id: 'data', label: 'Dữ liệu & Cơ sở dữ liệu' },
  { id: 'infrastructure', label: 'Cloud & Hạ tầng' },
  { id: 'security', label: 'Bảo mật' },
  { id: 'engineering', label: 'Kỹ thuật phần mềm' },
];

export const SOURCES: Source[] = [
  { id: 'netflix', name: 'Netflix', url: 'https://netflixtechblog.com/', feed: 'https://netflixtechblog.com/feed', mark: 'N', color: '#b72c34', hosts: ['netflixtechblog.com', 'medium.com'], description: 'Hệ thống phân tán, streaming và quy mô lớn.' },
  { id: 'uber', name: 'Uber', url: 'https://www.uber.com/us/en/blog/engineering/', mark: 'U', color: '#252725', hosts: ['uber.com'], articlePath: '/blog/', excludePaths: ['advertising', 'earn', 'ride', 'eat', 'merchants', 'business', 'health', 'higher-education', 'transit', 'community-support', 'engineering'].map((category) => `/us/en/blog/${category}/`), description: 'Backend, dữ liệu thời gian thực và logistics.' },
  { id: 'meta', name: 'Meta', url: 'https://engineering.fb.com/', feed: 'https://engineering.fb.com/feed/', mark: 'M', color: '#2465b4', hosts: ['engineering.fb.com'], description: 'Hạ tầng, AI và sản phẩm cho hàng tỷ người.' },
  { id: 'google', name: 'Google Research', url: 'https://research.google/blog/', feed: 'https://research.google/blog/rss/', mark: 'G', color: '#3d765a', hosts: ['research.google', 'research.google.com'], description: 'Nghiên cứu AI, mô hình và các hệ thống mới.' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/blog/engineering', mark: 'in', color: '#256da1', hosts: ['linkedin.com'], articlePath: '/blog/engineering/', description: 'Data, search và kiến trúc nền tảng nghề nghiệp.' },
  { id: 'cloudflare', name: 'Cloudflare', url: 'https://blog.cloudflare.com/', feed: 'https://blog.cloudflare.com/rss/', mark: 'C', color: '#b96728', hosts: ['blog.cloudflare.com'], description: 'Mạng, bảo mật và điện toán biên.' },
  { id: 'aws', name: 'AWS Architecture', url: 'https://aws.amazon.com/blogs/architecture/', feed: 'https://aws.amazon.com/blogs/architecture/feed/', mark: 'aws', color: '#955a20', hosts: ['aws.amazon.com'], description: 'Cloud architecture và các hệ thống serverless.' },
  { id: 'datadog', name: 'Datadog', url: 'https://www.datadoghq.com/blog/engineering/', feed: 'https://www.datadoghq.com/blog/engineering/index.xml', mark: 'D', color: '#7454a0', hosts: ['datadoghq.com'], description: 'Observability, hiệu năng và xử lý dữ liệu.' },
  { id: 'stripe', name: 'Stripe', url: 'https://stripe.dev/blog/topic/engineering', feed: 'https://stripe.dev/blog/feed', mark: 'S', color: '#6654a3', hosts: ['stripe.dev', 'stripe.com'], engineeringOnly: true, description: 'API, hạ tầng tài chính và độ tin cậy.' },
  { id: 'discord', name: 'Discord', url: 'https://discord.com/category/engineering', mark: 'Di', color: '#5867a3', hosts: ['discord.com'], articlePath: '/blog/', discoverySelector: 'a.cms_article,a.featured_main-card', description: 'Real-time, Rust và hệ thống giao tiếp.' },
  { id: 'slack', name: 'Slack', url: 'https://slack.engineering/', feed: 'https://slack.engineering/feed/', mark: '#', color: '#7d4167', hosts: ['slack.engineering'], description: 'Messaging, nền tảng và trải nghiệm lập trình.' },
  { id: 'airbnb', name: 'Airbnb', url: 'https://medium.com/airbnb-engineering', feed: 'https://medium.com/feed/airbnb-engineering', mark: 'A', color: '#bc5860', hosts: ['medium.com', 'airbnb.io'], description: 'Search, data science và hạ tầng sản phẩm.' },
  { id: 'spotify', name: 'Spotify', url: 'https://engineering.atspotify.com/', feed: 'https://engineering.atspotify.com/feed/', mark: 'Sp', color: '#367451', hosts: ['engineering.atspotify.com'], description: 'Streaming, cá nhân hóa và developer experience.' },
  { id: 'shopify', name: 'Shopify', url: 'https://shopify.engineering/', feed: 'https://shopify.engineering/blog.atom', mark: 'Sh', color: '#5a7334', hosts: ['shopify.engineering', 'shopify.com'], description: 'E-commerce, Ruby và kỹ thuật ở quy mô lớn.' },
  { id: 'doordash', name: 'DoorDash', url: 'https://careersatdoordash.com/engineering-blog/', mark: 'Dd', color: '#a53e2a', hosts: ['careersatdoordash.com', 'doordash.engineering'], articlePath: '/blog/', description: 'Logistics, nền tảng dữ liệu và hệ thống phân phối.' },
  { id: 'grab', name: 'Grab', url: 'https://engineering.grab.com/', feed: 'https://engineering.grab.com/feed.xml', mark: 'Gr', color: '#2d7953', hosts: ['engineering.grab.com'], description: 'Super app, bản đồ và kỹ thuật ở Đông Nam Á.' },
  { id: 'lyft', name: 'Lyft', url: 'https://eng.lyft.com/', feed: 'https://eng.lyft.com/feed', mark: 'Ly', color: '#a44a86', hosts: ['eng.lyft.com', 'medium.com'], description: 'Microservices, Envoy và nền tảng vận hành.' },
  { id: 'github', name: 'GitHub', url: 'https://github.blog/engineering/', feed: 'https://github.blog/engineering/feed/', mark: 'Gh', color: '#353d48', hosts: ['github.blog'], description: 'Cơ sở dữ liệu, hạ tầng và công cụ cho developer.' },
  { id: 'dropbox', name: 'Dropbox', url: 'https://dropbox.tech/', feed: 'https://dropbox.tech/feed', mark: 'Db', color: '#3564ba', hosts: ['dropbox.tech'], description: 'Lưu trữ, đồng bộ dữ liệu và tối ưu hạ tầng.' },
  { id: 'pinterest', name: 'Pinterest', url: 'https://medium.com/@Pinterest_Engineering', feed: 'https://medium.com/feed/@Pinterest_Engineering', mark: 'P', color: '#ad3b44', hosts: ['medium.com', 'pinterest.engineering'], description: 'Khám phá nội dung, graph và machine learning.' },
];

export const sourceById = (id: string) => SOURCES.find((source) => source.id === id);
export const topicLabel = (id: string) => TOPICS.find((topic) => topic.id === id)?.label ?? 'Kỹ thuật phần mềm';
