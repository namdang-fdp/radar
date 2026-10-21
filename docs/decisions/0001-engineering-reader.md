# ADR-0001: Personal engineering reader on the existing VPS

Status: Accepted. Crawl and reading MVP implemented; translation, summaries and public Internet access deferred. Internal VPS deployment uses the pipeline in deployment/.
Date: 2026-10-21.

Current implementation scope: collect original articles and provide the reading UI first, as requested by the user. No AI or translation calls. The daily schedule defaults to 07:15 Asia/Ho_Chi_Minh. See [the current MVP spec](../mvp-spec.md) and [README](../../README.md).

## Context

The user wants a personal website for daily reading of 20 engineering blogs, with Vietnamese translation and summaries. They have a VPS/server, explicitly choose PostgreSQL, want a light theme with comfortable typography, and require Gemini summaries to run only after pressing a button.

The previous prototype and October 11 plan describe another scope involving economy news, HN/arXiv, Java DSA, and SQLite.

## Decision

- Astro SSR + Node.js + TypeScript + Tailwind CSS, with Astro API endpoints and React components where useful.
- PostgreSQL for articles, translations, cached summaries, and processing state. Use a dedicated database and credentials on verified infrastructure.
- RSS/Atom discovery, Crawlee, and Mozilla Readability; scheduled collection independent of page requests.
- Initially proposed Google Cloud Translation Basic v2 NMT; this provider choice is superseded by [ADR-0002](0002-translation-without-billing.md) because the user will not enable billing.
- Gemini only after a user summary request; cache by content/model/prompt version and deduplicate concurrent requests. Failures do not authorize background paid retries.
- Docker Compose on the VPS with persisted data and the selected domain/access route. This documentation update performs no production changes.
- A light reader with Vietnamese-capable typography, approximately 18px text, generous line height, and constrained reading width.

## Alternatives considered

- FreshRSS + RSSBox: useful reuse, but the user chose a custom website and reading interface.
- Workers + D1: feasible, but the user has a VPS and explicitly chooses PostgreSQL.
- Next.js or a React SPA: feasible; Astro fits article reading and can incorporate React.
- SQLite: superseded by the user's PostgreSQL choice.
- Automatic Gemini summaries: excluded by the user's click-only cost requirement.

## Consequences and validation

Application work focuses on the reader, source configuration, storage, and provider integration. Full-text extraction is not guaranteed for all sources. Translation and summary costs/credentials remain separate.

Before release, verify deduplication, partial source failures, publication metadata, safe article rendering, preserved code, and PostgreSQL persistence. Prove that collection/navigation make zero Gemini calls, concurrent clicks do not duplicate generation, and cached summaries survive reloads/restarts. Verify personal access control and the actual VPS route before publishing.
