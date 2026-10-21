# ADR-0002: Translation must not require billing

Date: 2026-10-21.
Status: Billing constraint accepted; replacement provider not yet selected.

## Context

The user rejected Google Cloud Translation after learning that billing must be enabled. They still want Vietnamese reading and Gemini summaries only after pressing a button. They also explicitly requested that the agent configure PostgreSQL Compose for local development on port 5434 and fill DATABASE_URL.

## Decision

- Supersede the Google Cloud Translation provider choice in ADR-0001. Do not require Google Cloud billing or credentials to continue development.
- Keep translation disabled until a replacement is selected; record the alternatives in [translation options](../translation-options.md).
- Consider self-hosted LibreTranslate/Argos for English → Vietnamese without per-request API fees, or Gemini Free Tier with a separate explicit translation action if the user selects that approach.
- The existing Gemini summary-only contract remains in force. Researching a Gemini translation option does not authorize background translations or model test calls.
- Create a dedicated local PostgreSQL 17 container, generated credentials in ignored `.env`, a matching localhost:5434 DATABASE_URL, healthcheck, and named-volume persistence. The Linux dev Compose uses a normal Docker bridge with the published port bound only to loopback. Do not change routes, VPN or network mode to work around WARP; ask the user to turn it off if it blocks a connection.

## Consequences

Self-hosted translation consumes VPS CPU/RAM and needs a quality check on real engineering articles. Gemini's Free Tier is limited to eligible models/projects and quotas; it must not silently fall back to a paid service. Both options should reuse saved translations for unchanged content.

The dev database can be used immediately by a future local application. VPS deployment still requires the actual production database and network details.
