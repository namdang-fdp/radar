# Crawl and reading MVP

Current user instruction: build collection and the reading UI now. Translation and Gemini summaries are deferred; no provider calls or placeholder AI controls in this version. Do not work around Cloudflare WARP. Ask the user to turn WARP off if it blocks local PostgreSQL.

## Working scope

- Astro SSR + TypeScript + Tailwind, PostgreSQL, RSS/Atom discovery, Crawlee and Mozilla Readability for readable articles.
- All 20 requested publishers in the source registry. Preserve source attribution, source dates when available, and canonical URLs. Source failures must be visible and independent.
- Collect new articles daily at 07:15 Asia/Ho_Chi_Minh and support an explicit local manual refresh. Deduplicate URLs and prevent concurrent refreshes.
- Reading list with URL-based search, publisher/topic filters, pagination, unread and saved views; article reader with persisted read/saved state.
- Store original English content. Sanitize article HTML before storage/rendering; do not label feed excerpts as full articles. Fall back to the original source link when extraction fails.
- PostgreSQL persistence across restarts. Existing legacy Python files are historical and not the application entrypoint.

## Design contract

The page's primary job is finding something worth reading, then reading comfortably. The primary action is opening an article. Use a light editorial layout: narrow source/navigation rail, clear list of articles, quiet source-status aside on wide screens, and a focused article column.

Reference evidence: FreshRSS's official light screenshot provides source navigation and unread/saved organization; the user's requested typography and light theme govern the reading surface. Use original branding and components. Avoid dense toolbar rows, a marketing hero, equal-size card grids, decorative gradients, or fake article content.

- Be Vietnam Pro, self-hosted. Body 18px, line height about 1.8, article measure around 70ch. Distinct but restrained headings.
- Bright white canvas and surfaces, dark ink, muted terracotta accent; semantic tokens and clear focus states.
- Source marks use initials, so navigation does not depend on external favicons.
- Real article metadata and excerpts; text labels accompany source health indicators.
- Mobile navigation collapses without losing search/source filtering. No horizontal page overflow at 320, 768, 1024 or 1440px.
- Meaningful empty, loading, database-error, extraction-error and source-error states. Keyboard-accessible controls.

## Acceptance evidence

Run unit tests for URL/date handling, content sanitization and discovery. Run PostgreSQL integration checks for deduplication, retained read/saved state and collection lock behavior. Run actual source collection, Astro type checks/build, and browser checks for reading, search, filtering, saved state, responsive layout and a clean console. No paid-provider keys are needed for these checks.
