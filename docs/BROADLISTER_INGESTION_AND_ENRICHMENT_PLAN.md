# BroadLister — Ingestion & Enrichment Plan

**Status:** planning, 2026-05-08

This document covers how data **enters** BroadLister and how it is **enriched** before it becomes part of the global media graph. Two principles dominate:

1. **Ingestion is deterministic.** No LLM in the import pipeline. (Mirrors Tabulator's "no LLM calls during ingestion" rule.)
2. **Operator-approval-gated.** Imports never touch global tables directly. Everything lands in a review queue.

## Phase map (recap)

| Phase | Adapter                  | State in plan |
| ----- | ------------------------ | ------------- |
| v1    | CSV import               | yes           |
| v1    | Single-URL ingestion     | yes           |
| v1.1  | Google Sheets import/export | planned    |
| v1.2  | Bucketer signal adapter  | planned       |
| v1.2  | Article URL batch ingest | planned       |
| v1.3  | Tabulator tag bridge     | planned       |
| v1.3+ | TaskReckoner mirror      | planned       |
| v2    | LLM-assisted enrichment  | gated, deferred |

## CSV import (v1)

### Scope

Import a CSV that represents proposed journalists, outlets, articles, or contact methods. Most realistic operator imports are mixed (one row often implies a journalist + outlet + contact + tag set).

### Flow

1. Upload CSV → creates an `ImportBatch` (state `uploaded`).
2. Parse rows → `ImportBatchRow.raw_json` per row, exact original.
3. Operator maps columns to BroadLister fields in a wizard. Mapping is saved per-batch and per-named-template.
4. System validates each row: required keys, type checks, URL canonicalization, contact-method format checks. Validation errors surface inline with the offending row.
5. System normalizes each row → `ImportBatchRow.mapped_json` (the proposed shape).
6. System dedupes against the global graph:
   - hard match → propose merge / merge-update
   - weak match → propose merge with low confidence
   - no match → propose new record
7. Each row becomes one or more `ReviewItem` rows (e.g. one for the journalist, one for the contact method, one for the affiliation).
8. Operator works through the review queue; approvals apply changes through the service layer (which writes the global tables and creates `ProvenanceLink`s back to the import batch as the citation).
9. After review is complete, batch transitions `committed`.

### Mapping rules

- Column → field mapping is operator-driven. The wizard suggests mappings based on column header name.
- Mapping templates are saved as JSON under `data/mapping-templates/<name>.json`. Templates are project-local.
- Unmapped columns are preserved in `raw_json` and surface as "unmapped notes" on the review item.

### Validation

- Email addresses: parse to local-part/domain, lowercase domain, sanity-check TLD.
- URLs: canonicalize (strip fragments, normalize host, keep meaningful query params per allowlist).
- Dates: parse ISO 8601 first, then per-locale fallbacks; fail loudly on ambiguous formats (`5/6/2026`).
- Names: trim, normalize whitespace, reject obvious bad input (`""`, `Unknown`, `(not provided)`).
- Tags: split on `,` or `;`, normalize to slug, propose `kind` based on prefix (`beat:` etc.) or default to `specific`.

### Failure modes

- A malformed row is held as `decision='pending'` with a structured `validation_errors_json` until the operator fixes mapping or rejects it.
- A row triggering multiple weak matches surfaces all candidates in the review UI.

## Google Sheets import/export (v1.1)

### Import

- OAuth-based connection (Bo's existing Google credentials posture; no new credential storage in v1.1, defer if not feasible without changes).
- Import works against a sheet by URL. The wizard mirrors the CSV flow but with live-refresh support (re-pull the same sheet, re-run mapping, surface diffs from prior import).
- A `Citation(source_type='sheet_row', notes='<sheet>!<row>')` is created for each row.

### Export

- Push a campaign list to a Google Sheet with headers, provenance summary, and `email_safe` flags.
- Re-export updates rows in place keyed by journalist id.

### Out of scope

- Editing journalists *back* from Sheets in v1.1. Sheets are output, with optional re-import in a later phase.

## Bucketer signal import (v1.2)

This is the "pie-in-the-sky" flow Bo flagged: weekly client-relevant inbound article roundups produced by Bucketer should produce candidate journalist/outlet/article records in BroadLister.

### Flow

1. BroadLister polls Bucketer (`http://127.0.0.1:3003`) for digests/signals matching a configured slice (e.g. tag/topic, client subject area, time window).
2. Each signal arrives with at least one citation by Bucketer convention. Article URLs in the signal are pulled into BroadLister.
3. For each article URL, the URL-fetch adapter runs (deterministic). It produces:
   - article record proposal (with `Citation(source_type='bucketer_signal', source_url=signal_url)`),
   - byline proposal,
   - outlet proposal (or match to existing outlet),
   - tag proposals from the article extraction recipe.
4. Records land in the review queue.
5. Optionally, the operator can scope a Bucketer poll to a `Client` to filter signals by client subject area, but this is purely a query convenience — overlay rows are *not* created automatically.

### Constraints

- Read-only against Bucketer.
- Configuration lives in BroadLister (`data/bucketer-watches.json`); no Bucketer-side configuration changes.
- Polling interval default is conservative (e.g. once an hour). No tight loops.
- Signals already imported are deduped by `Citation(source_url)` + `Article.url_canonical`.

### Failure modes

- Bucketer down or 5xx: log, retry with backoff, surface a banner in the UI.
- Article URL behind paywall / 404: still record the citation and create an `Article(title=raw_byline_text, fetched=false)` proposal so the byline isn't lost.

## Article/byline extraction (v1 + v1.2)

### v1: single-URL paste

Operator pastes one URL. The URL-fetch adapter:

- Looks up a per-host recipe (`adapters/url-fetch/recipes/<host>.ts`).
- Fetches HTML with a polite UA, content-type checked, size-capped.
- Caches the response under `data/cache/<sha256>` (best-effort).
- Extracts `title`, `published_at`, `byline_text`, `language`, `excerpt`.
- Splits byline into one-or-more journalist proposals.
- Looks up matching outlet by `home_url_host`.
- Produces `ReviewItem`s for journalist(s), outlet (if new), and article.

### v1.2: batch URL ingest

A textarea / file of URLs. Same per-URL pipeline, parallelized politely (rate-limited). Produces one `ImportBatch(source_type='url')` for visibility.

### Recipe library

Per-outlet recipes are typed adapters in `adapters/url-fetch/recipes/`. Each implements:

- `match(host) -> boolean`
- `extract(html, headers) -> { title, published_at, byline_text, ... }`
- `confidence` per field

Recipes are added by operator-need, not speculatively. A generic fallback handles unknown hosts at lower confidence.

### Inspiration

We borrow the *spirit* of `news-please` and similar tools (per-outlet selectors, structured-data first), but we do **not** import them as a runtime dependency. Their long-tail extraction code is large; we want a small, owned recipe library so behavior is auditable.

## Journalist enrichment

### v1 (manual + deterministic)

- Operator enters bio, region, language, handles directly.
- "Cite from URL" workflow attaches a citation when the operator pastes a source.
- No automated enrichment.

### v1.1

- Bulk-edit overlay fields on a list (e.g. mark ten contacts as `approved` for a campaign in one operation).
- "Refresh from primary outlet" — when an outlet's region/country is updated, propose adopting the same on staff journalists' bios (review-gated).

### v1.2 (deterministic adapters)

- Per-handle adapter: when a journalist has a `twitter_x` handle, optionally fetch a public profile snapshot to confirm the handle resolves and to pull a public bio fragment as a citation (subject to terms-of-service review).
- LinkedIn: **not** scraped. Operator-pasted only. (LinkedIn's terms are restrictive; we do not crawl.)
- Personal site: when present, fetch home page to extract bio text + alternate handles.

All deterministic enrichment lands in the review queue. None is automatic.

### v2 (LLM-assisted, optional, opt-in)

- Topic inference from a journalist's recent bylines.
- Pitch-angle suggestion (reading public coverage, *not* client material) — review-gated, never auto-saved.
- LLM calls live in `services/enrichment/llm/*` and are explicitly off-by-default.
- Cost cap and call log enforced in code, modeled on Bucketer's `<$50 LLM credits` constraint posture.

## Validation and review queues

The review queue is the central operator surface. It is not a side feature.

### Review item lifecycle

- `pending` → operator opens it, sees the proposed change side-by-side with the current state, sees the source citation, sees confidence and any conflicts.
- `approved` → service layer applies the change (creates / merges / updates entities, creates `ProvenanceLink`s).
- `rejected` → recorded with note; the proposal is preserved for audit.
- `superseded` → newer proposal makes this one moot.

### Reviewer ergonomics

- Keyboard shortcuts: `a` (approve), `r` (reject), `m` (merge into existing), `s` (skip).
- Bulk actions: "approve all where confidence high & no conflict".
- Filters: by import batch, by entity type, by client (when a review item is *for* a client overlay change).

### What never goes through the review queue

- Operator manual edits in the UI. They write directly (with a `manual_entry` citation).
- Campaign overlay edits (per-client opinion). These are operator-owned.
- Search and read operations.

## No autonomous outreach — explicitly

- BroadLister has **no** mail-sending code. None.
- BroadLister has **no** social-DM code. None.
- BroadLister has **no** scheduler that contacts journalists.
- `OutreachEvent` is a record of what the operator did **outside** the system. Recording an event does not send anything.
- v1.3+ TaskReckoner mirroring is *also* recording-only — TaskReckoner does not send, either.
- Gmail integration, when/if it lands, is read-only first (see thread / log a reply received). Sending is not in this plan and remains explicitly out of scope until Bo says otherwise.

## Rate limiting & politeness

- URL fetches: per-host minimum interval (e.g. 1 req / 5 sec). Exponential backoff on 4xx/5xx.
- Bucketer poll: capped frequency.
- Sheets API: respect Google's quotas; exponential backoff.
- All adapters carry a `notes` field on their `Citation` to record HTTP status and timing.

## Logging & observability

- Each ingest run creates an entry in a local `logs/ingest/YYYY-MM-DD.log`. Plain text.
- Errors with context surface in a UI "Adapter health" panel.
- Per-adapter metrics (rows processed, time taken, error count) shown in a small dashboard.

## Out of scope

- Crawling whole sites. We fetch one page at a time.
- Building our own newspaper-text-extraction library. We use targeted recipes + structured-data extraction.
- Maintaining a fork of news-please / Crawl4AI / authortwitter. These are inspirations, not dependencies.
- Indexing full article bodies for FTS in v1. We may add `Article.body_text` indexing in v1.1 if needed.
