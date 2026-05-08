# BroadLister — Architecture

**Status:** planning, 2026-05-08

## Recommended posture

BroadLister is a **single-operator, local-first, self-contained product** that follows the same general shape as the ProjectReckoner backends (Fastify + Prisma + SQLite), so the machine and its operators do not have to learn a new pattern. It is a *sibling* of ProjectReckoner, not a sub-module.

```
┌──────────────────────────────────────────────────────────────────┐
│ Operator (Bo) — browser on localhost                            │
└──────────────────────────────────────────────────────────────────┘
              │ HTTPS via Vite dev / mkcert (later: bundled)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ broadlister-web (React + Vite)        port 4100 (proposed)      │
│   - SPA. All API calls proxied through Vite to backend.          │
└──────────────────────────────────────────────────────────────────┘
              │ HTTP localhost
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ broadlister-api (Fastify + Prisma)    port 3021 (proposed)      │
│   - REST API: journalists, outlets, articles, tags, campaigns,   │
│     citations, review queue, imports, exports.                   │
│   - Prisma client over local SQLite file.                        │
│   - Deterministic adapters (CSV, URL fetch, future Sheets).      │
└──────────────────────────────────────────────────────────────────┘
              │ filesystem
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ broadlister.sqlite (single file under repo data/)                │
│ + content-addressed local cache for fetched HTML / metadata      │
└──────────────────────────────────────────────────────────────────┘
```

Optional later: an `broadlister-bridge` worker for Bucketer / Tabulator / TaskReckoner adapters, kept as a separate process so the API stays clean.

### Why this stack

- **Fastify + Prisma + SQLite** matches TaskReckoner / Tabulator / Bucketer (`Fastify + Prisma + SQLite` per the ProjectReckoner runbook). Same operational pattern, same migration tooling, same testability.
- **SQLite over PGlite/RxDB/Electric for v1.** Single operator, single machine, no real-time multi-tab sync need yet. SQLite gives strongest local guarantees, simplest backups (one file), and matches the rest of the stack. PGlite/Electric are evaluated in `research/BROADLISTER_RESEARCH_SYNTHESIS.md` and remain options if Bo later wants browser-side sync.
- **React + Vite** matches `reckoner-app` so the GUI feels like a sibling.
- **No always-on systemd service in v1.** Started by operator; the trio under user systemd (TaskReckoner / Bucketer / Tabulator) is canonical and BroadLister should not be promoted into the always-on baseline until it is stable and Bo approves.

### Why **not** Payload / Directus / Strapi / Twenty / Atomic / Relaticle

- They are full CMS / CRM platforms with admin UIs and conventions designed around generic content models. BroadLister is a *narrow* tool with a strong opinionated schema (journalist/outlet/article + provenance + per-client overlay). Adopting a CMS would force us to either fight the framework or design the data model in someone else's vocabulary.
- Some patterns from these tools (Directus M2M tag interface, Twenty-style relationship UI) are worth borrowing visually, but not their full runtimes.
- Running a Postgres-backed CMS contradicts the local-first / single-file goal.

See `research/BROADLISTER_RESEARCH_SYNTHESIS.md` for the full evaluation.

## Service boundaries

### Internal modules (in-process within `broadlister-api`)

- `core/` — domain models (Journalist, Outlet, Article, Tag, Citation, Campaign, ...)
- `db/` — Prisma client, migrations, seeds
- `routes/` — Fastify route handlers (one file per resource)
- `services/` — business logic (dedupe, merge, search, scoring, overlay resolution)
- `adapters/` — input/output adapters:
  - `csv-import` (v1)
  - `url-fetch` (v1, deterministic single-page metadata)
  - `sheets` (v1.1)
  - `bucketer` (v1.2, read-only)
  - `tabulator-bridge` (v1.3, read-only by default)
  - `taskreckoner-bridge` (v1.3+)
- `provenance/` — citation model, verification states, conflict resolver
- `review-queue/` — proposed records, merges, and enrichments awaiting operator review

### External boundaries

| External system   | Coupling in v1 | Direction   | Notes                                             |
| ----------------- | -------------- | ----------- | ------------------------------------------------- |
| ProjectReckoner   | None           | -           | BroadLister is a sibling. No imports either way.  |
| TaskReckoner API  | None in v1     | future: out | v1.3+ posts outreach-status events as ledger rows |
| Bucketer API      | None in v1     | future: in  | v1.2 reads weekly inbound roundups (read-only)    |
| Tabulator API     | None in v1     | future: in  | v1.3 reads tag taxonomy (read-only)               |
| ontology-core     | None in v1     | future: ref | tag/beat alignment without dependency             |
| BusyIntern        | None ever      | -           | Stays separate by design                          |
| Hermes harness    | None at runtime| -           | Hermes manages *processes*, not *data*           |
| sevenfold profile | None at runtime| -           | sevenfold provides domain review, not runtime    |
| Gmail / Drive     | None in v1     | deferred    | Out of scope for v1 planning                     |
| systemd           | None in v1     | deferred    | No always-on service until stable + approved     |

### Local-first posture

- All data on the operator's machine. No cloud DB.
- DB file: `~/development/BroadLister/data/broadlister.sqlite` (or `XDG_DATA_HOME/broadlister/` if Bo prefers).
- Local cache for fetched HTML/JSON: `~/development/BroadLister/data/cache/<sha256>` content-addressed.
- Backups are file-copy (`cp` / `rsync` / Syncthing-friendly) — single file means no orchestration.
- The system functions fully offline once data is loaded; only ingestion adapters require network.
- No telemetry. No external analytics.

## Relation to the broader ecosystem

### vs. ProjectReckoner

- ProjectReckoner is the **product/control plane** (per `agent-os/01-agent-architecture.md`). It owns task state, workflows, governance queues, agent registry.
- BroadLister is a **domain product** for media work. It does not host orchestration or task state.
- BroadLister may, in v1.3+, *post events* into TaskReckoner (e.g., "outreach approved for X journalist on Y campaign") so the orchestration layer has visibility, but it never embeds TaskReckoner.
- BroadLister will **not** import from `reckoner-app` codebase. Any shared types are duplicated locally and kept in lockstep manually until a shared package is justified.

### vs. TaskReckoner

- TaskReckoner is the workflow/approval ledger. Long-term, BroadLister's approval gates (campaign approved, list approved, contact approved-for-outreach) should produce TaskReckoner ledger entries.
- v1 keeps approvals **inside** BroadLister (its own approval table) so we don't take a hard dependency before the schemas settle.

### vs. Bucketer

- Bucketer is the **signal intake engine**. The "pie-in-the-sky" flow (Bucketer → article → journalist/outlet/article extraction → review queue → global media graph → client overlay) is real but **deferred to v1.2**.
- v1 supports the *manual* version of that flow: paste a URL, get an article record proposal, review-queue, merge.

### vs. Tabulator

- Tabulator owns tags / links / ontology-adjacent storage. BroadLister's local tag table is **conceptually compatible** but independently stored.
- v1.3 introduces a read-only `tabulator-bridge` adapter that imports tag taxonomy and proposes mappings. Auto-write-back to Tabulator is not in scope until Bo says so.
- BroadLister's tag confidence/source/scope fields are designed so they could be promoted into Tabulator format later without lossy reshape.

### vs. ontology-core

- ontology-core is referenced for naming conventions in beats/topics. BroadLister carries its own beat/topic table in v1; alignment is a doc-level concern, not a runtime one.

### vs. BusyIntern

- BusyIntern is on port 3001, separate repo, separate runtime. **No coupling, ever.**
- Patterns BusyIntern has used (LLM-assisted ranking, role-fit scoring) may *inspire* later BroadLister enrichment, but BroadLister is not absorbed into BusyIntern and BusyIntern is not absorbed into BroadLister.

### vs. Hermes / agent-os / sevenfold

- agent-os defines machine architecture; BroadLister obeys it.
- Hermes is the runtime harness Codex/agents speak through; it doesn't own BroadLister code.
- **sevenfold** Hermes profile reviews BroadLister's *domain* concerns (journalist confidentiality, source audit alignment, client-folder workflow compatibility). It does not own implementation.

## What is intentionally *not* coupled yet

These bridges are *designed-for* in the schema, but not built in v1:

1. **Bucketer adapter** — schema fields support `source_system = 'bucketer'`, `bucketer_signal_id`, but no live importer.
2. **Tabulator tag bridge** — `Tag` table has `external_ids` jsonb-ish field for future Tabulator UUIDs.
3. **TaskReckoner ledger** — `OutreachEvent` table is schema-ready to be mirrored as TaskReckoner runs/assignments.
4. **Gmail outreach** — schema supports `OutreachEvent.channel = 'email'`, but no Gmail adapter.
5. **Multi-machine sync** — single SQLite file in v1. CRDT/Electric/RxDB *could* be slotted later but not now.
6. **ontology-core canonical taxonomy** — schema accepts external taxonomy IDs but doesn't validate against one yet.

Each deferred bridge has a corresponding section in `BROADLISTER_INGESTION_AND_ENRICHMENT_PLAN.md` so the seams are documented.

## Process model

- **Dev mode (v1):** `pnpm dev` boots `broadlister-api` (port 3021) and `broadlister-web` (port 4100). Single Vite proxy.
- **Persisted mode (v1):** operator launches with a script. No systemd unit until stable.
- **Future:** opt-in user-systemd unit `broadlister-api.service` *only after* it has run reliably for an extended period, modeled on the existing `reckoner-*.service` pattern. This decision is **not** made in this plan.

## Security and confidentiality posture

- All-localhost. No external port binding.
- `data/broadlister.sqlite` is **never** committed. `.gitignore` covers `data/`.
- Cache directory is **never** committed.
- No credentials in repo. Future external integrations (Sheets, Gmail) read credentials from a local-only `.env` modeled after ProjectReckoner's pattern, never from source.
- Per-client overlay tables are physically separate from global tables; queries never join client-private fields onto cross-client result sets.

## Operational hygiene rules

1. Schema migrations are committed and reversible.
2. No destructive migration without an export step first.
3. Imports never write directly to global tables; they always go through the review queue.
4. Outbound network calls (URL fetch, Sheets, etc.) are confined to `adapters/` modules and rate-limited.
5. No LLM calls in core ingestion pipelines — adapters are deterministic. LLM-assisted enrichment lives in `services/enrichment/` and is review-gated, mirroring Tabulator's "no LLM in ingestion" rule.
