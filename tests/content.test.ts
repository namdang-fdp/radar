import { describe, expect, it } from 'vitest';
import { canonicalUrl, publicationDate, sanitizeArticle, topicFor, parseFeedArticles, discoverPageArticles } from '../src/lib/content';
import { SOURCES } from '../src/lib/sources';

const netflix = SOURCES.find((source) => source.id === 'netflix')!;

describe('trusted article discovery', () => {
  it('removes tracking without dropping meaningful query parameters', () => {
    expect(canonicalUrl('https://netflixtechblog.com/post?utm_source=rss&version=2#section', netflix)).toBe('https://netflixtechblog.com/post?version=2');
  });
  it('rejects arbitrary hosts, userinfo, non-web schemes, and private addresses', () => {
    for (const url of ['http://127.0.0.1/post', 'https://example.org/post', 'javascript:alert(1)', 'https://u:p@netflixtechblog.com/post', 'https://netflixtechblog.com:8080/post']) {
      expect(canonicalUrl(url, netflix)).toBeNull();
    }
  });
  it('keeps missing and invalid publication dates unknown', () => {
    expect(publicationDate()).toBeNull();
    expect(publicationDate('not a date')).toBeNull();
    expect(publicationDate('2026-10-20T08:00:00Z')?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
  });
  it('parses RSS, deduplicates tracked URLs, and does not invent publication dates', async () => {
    const xml = '<rss version="2.0"><channel><title>Netflix</title><item><title>Scaling databases</title><link>https://netflixtechblog.com/db?utm_source=a</link><description>Database lessons</description></item><item><title>Scaling databases</title><link>https://netflixtechblog.com/db</link></item></channel></rss>';
    const articles = await parseFeedArticles(xml, netflix);
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({ title: 'Scaling databases', url: 'https://netflixtechblog.com/db', publishedAt: null });
  });
  it('accepts Atom alternate links', async () => {
    const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><title>Netflix</title><entry><title>Building a reliable service</title><link rel="alternate" href="https://netflixtechblog.com/service"/><updated>2026-10-20T08:00:00Z</updated></entry></feed>';
    expect((await parseFeedArticles(xml, netflix))[0]?.url).toBe('https://netflixtechblog.com/service');
  });
  it('discovers article headings without importing navigation links', () => {
    const source = SOURCES.find((item) => item.id === 'uber')!;
    const html = '<nav><a href="/us/en/blog/earn/">Earn and find more opportunities today</a></nav><main><article><a href="/us/en/blog/retries/"><h3>How Uber protects services from retry storms</h3></a></article></main>';
    expect(discoverPageArticles(html, source).map((item) => item.title)).toEqual(['How Uber protects services from retry storms']);
  });
  it('finds plain article links even when unrelated navigation has headings', () => {
    const source = SOURCES.find((item) => item.id === 'uber')!;
    const html = '<main><a href="/us/en/blog/earn/"><h3>Earn</h3>Resources for driving and delivering</a><div><a href="/us/en/blog/retries/">How Uber protects services from retry storms</a></div></main>';
    expect(discoverPageArticles(html, source).map((item) => item.title)).toEqual(['How Uber protects services from retry storms']);
  });
});

describe('reader content', () => {
  it('removes executable content and unsafe links while retaining code and tables', () => {
    const safe = sanitizeArticle('<script>alert(1)</script><p onclick="x()">Hello <a href="javascript:alert(1)">world</a></p><iframe src="https://evil.test"></iframe><pre><code>SELECT 1 &lt; 2;</code></pre><table><tr><td>Data</td></tr></table>');
    expect(safe).not.toMatch(/script|onclick|javascript:|iframe/);
    expect(safe).toContain('<code>SELECT 1 &lt; 2;</code>');
    expect(safe).toContain('<td>Data</td>');
  });
  it('classifies whole words rather than matching AI inside unrelated words', () => {
    expect(topicFor('Scaling an LLM inference platform')).toBe('ai');
    expect(topicFor('What we said about our platform')).not.toBe('ai');
    expect(topicFor('A distributed database migration')).toBe('data');
  });
});
