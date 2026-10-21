export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  feed_url text,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text
);
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES sources(id),
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  author text,
  published_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  content_html text,
  content_hash text,
  content_status text NOT NULL DEFAULT 'unavailable' CHECK (content_status IN ('full','feed','unavailable')),
  content_attempted_at timestamptz,
  reading_minutes integer NOT NULL DEFAULT 1 CHECK (reading_minutes > 0),
  topic text NOT NULL DEFAULT 'engineering',
  is_read boolean NOT NULL DEFAULT false,
  is_saved boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS articles_source_date ON articles(source_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS articles_reader_order ON articles((COALESCE(published_at,discovered_at)) DESC, id);
CREATE INDEX IF NOT EXISTS articles_published_order ON articles(published_at DESC NULLS LAST,discovered_at DESC,id);
CREATE INDEX IF NOT EXISTS articles_saved ON articles(discovered_at DESC) WHERE is_saved;
CREATE TABLE IF NOT EXISTS crawl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  discovered integer NOT NULL DEFAULT 0,
  extracted integer NOT NULL DEFAULT 0,
  failed_sources integer NOT NULL DEFAULT 0
);
`;
