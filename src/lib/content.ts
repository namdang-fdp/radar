import Parser from 'rss-parser';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sanitizeHtml from 'sanitize-html';
import type { DiscoveredArticle, Source } from './types';

const parser = new Parser({ customFields: { item: ['content:encoded', 'author'] } });
const tracking = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

export function canonicalUrl(raw: string, source: Source): string | null {
  try {
    const url = new URL(raw, source.url);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !source.hosts.includes(host)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}

export function publicationDate(raw?: string | null): Date | null {
  if (!raw?.trim()) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function sanitizeArticle(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'a', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'figure', 'figcaption', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'br', 'hr', 'sup', 'sub', 'details', 'summary'],
    allowedAttributes: { a: ['href', 'title', 'rel', 'target'], img: ['src', 'alt', 'width', 'height', 'loading'], code: ['class'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'], ol: ['start'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
      h1: 'h2',
    },
  });
}

export function plainText(html: string): string {
  const clean = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return (JSDOM.fragment(clean).textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function topicFor(text: string): string {
  if (/\b(ai|llms?|machine learning|inference|generative|neural|rag|models?)\b/i.test(text)) return 'ai';
  if (/\b(security|vulnerab\w*|authentication|privacy|fraud|encryption|passkeys?)\b/i.test(text)) return 'security';
  if (/\b(data|databases?|sql|postgres\w*|kafka|spark|flink|storage|scylla\w*|shuffle)\b/i.test(text)) return 'data';
  if (/\b(kubernetes|cloud|infrastructure|network\w*|observability|ec2|containers?|linux|gpu|edge)\b/i.test(text)) return 'infrastructure';
  if (/\b(distributed|architecture|microservices?|scale|scaling|reliab\w*|resilien\w*|mesh|cache|proxy)\b/i.test(text)) return 'architecture';
  return 'engineering';
}

export const readingMinutes = (text: string) => Math.max(1, Math.ceil(plainText(text).split(/\s+/).length / 220));

export async function parseFeedArticles(xml: string, source: Source): Promise<DiscoveredArticle[]> {
  const feed = await parser.parseString(xml);
  const articles = new Map<string, DiscoveredArticle>();
  for (const item of feed.items.slice(0, 40)) {
    const url = item.link ? canonicalUrl(item.link, source) : null;
    const title = plainText(item.title ?? '').slice(0, 500);
    if (!url || !title || articles.has(url)) continue;
    const encoded = item['content:encoded'] || item.content || '';
    const excerpt = plainText(item.contentSnippet || item.summary || encoded).slice(0, 500);
    articles.set(url, {
      sourceId: source.id, url, title, excerpt,
      publishedAt: publicationDate(item.isoDate || item.pubDate),
      author: plainText(item.creator || item.author || '').slice(0, 200) || null,
      contentHtml: encoded && plainText(encoded).length > 250 ? sanitizeArticle(encoded) : null,
    });
  }
  return [...articles.values()];
}

export function discoverPageArticles(html: string, source: Source): DiscoveredArticle[] {
  const dom = new JSDOM(html, { url: source.url, virtualConsole: new VirtualConsole() });
  const document = dom.window.document;
  document.querySelectorAll('nav,header,footer').forEach((node) => node.remove());
  const root = document.querySelector('main') ?? document.body;
  const anchors = [...root.querySelectorAll<HTMLAnchorElement>(source.discoverySelector ?? 'a[href]')];
  const articles = new Map<string, DiscoveredArticle>();
  for (const anchor of anchors) {
    const url = canonicalUrl(anchor.href, source);
    const title = plainText(anchor.getAttribute('aria-label') ?? anchor.querySelector('h1,h2,h3,h4,h5,h6')?.textContent ?? anchor.textContent ?? '').replace(/^Engineering\s*&\s*Developers\s*/i, '').trim();
    if (!url || title.length < 24 || title.length > 350 || articles.has(url)) continue;
    const path = new URL(url).pathname;
    if (source.articlePath && !path.includes(source.articlePath)) continue;
    if (source.excludePaths?.includes(path)) continue;
    if (url.replace(/\/$/, '') === source.url.replace(/\/$/, '') || /\/(category|tag|topic|page|author)\//.test(path)) continue;
    if (/^(see more|learn more|read more|next|previous)/i.test(title)) continue;
    const card = anchor.closest('article') ?? anchor.parentElement;
    articles.set(url, {
      sourceId: source.id, url, title, excerpt: '', author: null, contentHtml: null,
      publishedAt: publicationDate(card?.querySelector('time')?.getAttribute('datetime')),
    });
    if (articles.size >= 30) break;
  }
  dom.window.close();
  return [...articles.values()];
}

export function extractDocument(document: Document) {
  const parsed = new Readability(document.cloneNode(true) as Document, { maxElemsToParse: 30000 }).parse();
  if (!parsed?.content || (parsed.textContent?.trim().length ?? 0) < 250) return null;
  return {
    contentHtml: sanitizeArticle(parsed.content),
    excerpt: plainText(parsed.excerpt || parsed.textContent || '').slice(0, 500),
    author: parsed.byline?.slice(0, 200) || null,
    publishedAt: publicationDate(parsed.publishedTime),
    readingMinutes: readingMinutes(parsed.textContent || ''),
  };
}
