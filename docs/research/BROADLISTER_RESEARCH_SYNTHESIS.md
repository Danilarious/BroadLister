# BroadLister — Research Synthesis

**Status:** planning, 2026-05-08
**Source:** `docs/research/broadlister-reference-research-v0.md`

This is a distilled view of the input research, separating useful patterns from probably-overkill options, with a list of cheap empirical spikes worth running before settling.

The input research surveys CMS frameworks (Payload / Directus / Strapi), opinionated CRMs (Twenty / Atomic / Relaticle), local-first stacks (PGlite / Electric / RxDB / SQLite WASM), media-extraction tooling (news-please / Crawl4AI / Media Cloud / Journalist RSS aggregators / authortwitter), and UI ingredients (React Query Builder, Directus Tags M2M).

## Likely useful patterns

### From Directus & Twenty

- **Tags-as-M2M-with-side-data interface.** Directus's tags interface and Twenty's relationship pickers establish a UX expectation that tag application can carry per-link metadata. We embrace this in `JournalistTag` / `OutletTag` / `ArticleTag` join tables with `confidence` / `citation_id`.
- **Polymorphic detail panels.** Twenty's "object > detail with sections" layout is a strong fit for journalist/outlet detail pages. Borrow the pattern, not the codebase.

### From Atomic CRM & Relaticle

- **Activity timelines per entity.** A vertical, append-only timeline with structured event kinds is the right shape for `OutreachEvent`. Adopt this UX pattern; don't import their data model.
- **Relationship graph hints.** Relaticle leans into showing "who knows whom"; we don't model person-to-person relationships in v1 but the *journalist ↔ outlet ↔ article* triangle benefits from similar visual affordances.

### From React Query Builder

- **Composable filter UIs.** Saved segments (v1.1) want a small, opinionated filter builder. React Query Builder is fine if we slim it; we may end up with a custom 200-line component because we have only ~10 filterable fields.

### From SQLite + FTS5

- **FTS5 virtual tables** for `Journalist.display_name`, `Outlet.name`, `Article.title`, `ClientNote.body_md`. Defer to v1.1 once schema is stable.

### From news-please & per-outlet selectors

- **Per-host extraction recipes** with a JSON-LD-first fallback are the right shape. We ship our own small recipe library rather than depending on news-please.
- **Structured data first** (JSON-LD `Article`, `NewsArticle`, `author`, `datePublished`) for byline/published_at extraction.

### From Tabulator (in-house)

- **Adapter contract**: `fetch()`, `normalize()`, `fingerprint()`, `diff()`, `citations()`. Direct steal — adapters in BroadLister implement an analogous interface.
- **No-LLM-in-ingestion** rule. Direct steal.
- **`#pkb`-marker artifact protocol.** Inspires our `Citation.source_type='tabulator_artifact'` reservation.

### From OpenClaw context-sync (in-house)

- **Required provenance fields** on every cross-system packet (`source_system`, `observed_at`, `trace_id`, `explanation`, `source_of_truth`). BroadLister mirrors this discipline at the field level via `Citation` + `ProvenanceLink`.

### From the Sevenfold client folder structure

- **Folder taxonomy** (`01_sources/`, `02_source_audit/`, `03_messaging/`, `06_media_lists/`, `09_approvals/`) is a behavioral spec for what BroadLister exports must look like. Use it as our export-shape contract for v1.3+.

## Probably overkill

### CMS frameworks (Payload, Directus, Strapi)

- They expose admin UIs and content-type configuration models that don't fit a narrow, opinionated tool.
- Adopting them forces us to design our schema in their vocabulary and run their server. Local-first single-file goes out the window.
- **Verdict:** do not adopt as a runtime; pull *UX patterns* only.

### Twenty / Atomic / Relaticle as runtimes

- Same story — full CRM platforms with sales-pipeline assumptions we'd fight.
- **Verdict:** do not adopt; pull *UX patterns* only.

### Electric / RxDB / SQLite WASM

- Useful when sync is real. We don't have a sync requirement in v1.
- Electric pairs cleanly with PGlite for browser-first usage; reconsider only if multi-machine sync becomes a goal.
- **Verdict:** defer. Empirical spike worth running *if and only if* Bo wants browser-side persistence.

### PGlite as primary datastore

- Useful if we want to swap to Postgres later without changing client code.
- Trade-off: younger ecosystem, slower bulk ops, more memory at boot.
- **Verdict:** defer. SQLite is the default; PGlite is the next switch.

### Media Cloud backend

- Heavy data-warehouse-style stack designed for academic-grade media research.
- Way over the operational bar for a single-operator PR tool.
- **Verdict:** do not adopt.

### Crawl4AI

- LLM-driven scraping. Useful for novel-shape sites; we explicitly do *not* want LLM in ingestion.
- **Verdict:** consider only as a Phase-5 LLM-assisted enrichment fallback for stubborn sites; off-by-default and review-gated.

### Journalist RSS aggregators / authortwitter

- Useful as *enrichment* signals later (RSS feeds per journalist for byline freshness; Twitter handle resolution if TOS-permitting).
- **Verdict:** Phase 4–5 candidates, not v1.

## Local validation tasks

These are doc-level checks Codex (or a temporary task agent in a visible window) can do before code:

1. **Confirm Prisma + SQLite supports the relations and JSON-as-text patterns** in `BROADLISTER_SCHEMA_DRAFT.md`. Read the Prisma SQLite docs; verify nothing in the schema requires Postgres-only features.
2. **Confirm `url_canonical` rules.** Pick a canonicalization approach (RFC 3986 + a safe-list of preserved query params) and write the rule set.
3. **Confirm port allocation.** Verify 3021 / 4100 are free relative to ProjectReckoner's documented port reference (3001 / 3002 / 3003 / 3011 / 4000 / 5173).
4. **Confirm CSV libraries.** A short, mature CSV parser (`papaparse` server-side, or `csv-parse`). Pick one; don't over-engineer.
5. **Confirm dependency posture.** No `nodemailer`, `sendgrid`, `mailgun`, `aws-ses`, or similar reachable from the API package's dependency graph.

## Recommended empirical spikes (small, time-boxed)

Each spike is a 2–4 hour exercise, not a project.

1. **CSV → review-queue spike.** Stand up Fastify + Prisma + SQLite in a throwaway folder, ingest a 200-row CSV through the proposed pipeline, generate review items, approve a few, write the global rows. Tests the schema's ergonomics.
2. **Per-host extraction recipe spike.** Pick three outlets relevant to Trace Finance. Write three recipes. Confirm byline + published_at + outlet match are reliable. This validates the recipe pattern is small enough to maintain.
3. **Cross-client safety spike.** Build the two-client overlay test: insert two clients, two campaigns, verify the API never returns Client B's overlay fields when querying as Client A. Should fit in a single integration test.
4. **FTS5 spike.** Spike SQLite FTS5 over `Journalist.display_name + name_variants_json` + `Outlet.name`. Confirm it returns useful results in <50ms on 5k journalists.
5. **Snapshot-cache spike.** Fetch 5 outlet pages, compute SHA256, store under `data/cache/<hash>`, link via `Citation.payload_hash`. Confirm the round-trip works and disk usage is sane.

## Sources worth inspecting later

- **Prisma SQLite limitations** — search for current state of partial indexes, expression indexes, FTS integration.
- **`url-canonicalization` library** in TypeScript with an active maintainer.
- **HTML metadata extraction** libraries that respect JSON-LD first (e.g. `metascraper` and similar). Evaluate for the URL-fetch adapter without committing.
- **Google Sheets v4 API** quotas and permissions model (for v1.1).
- **Bucketer's signal payload shape** (re-read `bucketer/` docs at v1.2 entrance to align the adapter with current Bucketer output).
- **TaskReckoner actor/assignment/run-ledger MVP spec** (`/home/bxby/agent-os/machine/2026-04-02-taskreckoner-actor-ledger-mvp-spec.md`) — re-read at v1.3 entrance.
- **Directus Tags M2M interface** — visual-pattern reference only.
- **Twenty CRM detail-panel layouts** — visual-pattern reference only.

## Bottom line

The research surfaces no tool we should adopt as a runtime dependency for v1. It provides:

- A handful of UX patterns worth borrowing (tags M2M with side data, activity timelines, polymorphic detail panels).
- An adapter contract pattern we already use internally (Tabulator's `SourceAdapterV2`).
- A discipline (per-citation provenance) that already runs through ProjectReckoner / OpenClaw context-sync.

The right move is to build a small, owned codebase that mirrors the ProjectReckoner stack (Fastify + Prisma + SQLite + React/Vite) and treats the input research as a UX library and a list of patterns to borrow on demand.
