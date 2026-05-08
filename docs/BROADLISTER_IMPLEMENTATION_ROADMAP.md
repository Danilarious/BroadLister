# BroadLister — Implementation Roadmap

**Status:** planning, 2026-05-08
**Note:** Phase numbers are deliberately conservative. Bo and Codex may compress phases when scope is light, but **never skip approval gates**.

## Phase 0 — Repo & docs baseline

**Owner of execution:** Codex via Hermes General → sevenfold (review only).
**Goal:** A consistent, navigable repository skeleton with these planning docs as the spine. **No application code.**

Tasks:

1. Initialize a git repository (if Bo wants — repo is currently *not* a git repo per environment context). Decision is Bo's; doc baseline does not require git.
2. Add `README.md` at the repo root pointing to `docs/README.md`.
3. Add `.gitignore` covering `node_modules/`, `data/`, `logs/`, `*.sqlite*`, `.env*`, `.DS_Store`.
4. Add `package.json` placeholder (private, no dependencies) only if Bo explicitly approves; otherwise defer until Phase 1.
5. Codex produces an **implementation plan PR** (or markdown plan if no remote) referencing this roadmap. The plan must:
   - Confirm phase boundary.
   - List exactly which files and ports it will touch in Phase 1.
   - Confirm no changes to ProjectReckoner / BusyIntern / Hermes / agent-os / sevenfold / systemd / Google credentials.
   - Confirm understanding of `BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md`: global vs overlay separation, lean v1 status fields, narrative-fit-as-JSON, campaign-constraints-as-JSON, deferral list.
   - Wait for Bo's approval before running Phase 1.

Phase 0 closeout artifacts (in `docs/`):

- `BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md` (canonical operational scope).
- `BROADLISTER_GLOSSARY.md` (term definitions).
- All other planning docs aligned with the operational model.

Exit criteria:

- All planning docs reviewed by Hermes General.
- Domain-fit reviewed by sevenfold profile, with **explicit sign-off on PR workflow realism, journalist relationship/status model, narrative fit model, and campaign operational constraints**.
- Bo signs off on the implementation plan.

## Phase 1 — Local data model & importer

**Goal:** A local Fastify + Prisma + SQLite service that supports CSV import, manual journalist/outlet/article CRUD, and the review queue. **No UI yet** beyond an admin-style placeholder for poking the API; or a deliberately minimal SPA shell.

Tasks:

1. Scaffold `broadlister-api` (TypeScript, Fastify, Prisma).
2. Initialize `data/broadlister.sqlite`.
3. Implement Prisma schema per `BROADLISTER_SCHEMA_DRAFT.md` (with Phase-0 refinements). This includes the new lean status/fit/constraints fields:
   - `Journalist.global_status_flags_json` (citation-required entries).
   - `Campaign.constraints_json` + `Campaign.constraints_required`.
   - `CampaignContact.narrative_fit_json`.
   - `OutreachStatus.relationship_warmth`.
4. Migrations: initial migration captures all global + overlay tables.
5. Service layer: dedupe, merge, citation creation, review-item application, URL canonicalization. Service-layer Zod validators for `global_status_flags_json`, `constraints_json`, `narrative_fit_json`. Service-layer rejection of any global-table write that lacks required citation for "fact" fields.
6. Routes:
   - `/journalists`, `/outlets`, `/articles`, `/tags` CRUD + search.
   - `/contact-methods` CRUD.
   - `/citations`, `/provenance` CRUD.
   - `/review` list / approve / reject / merge.
   - `/imports/csv` upload / map / preview / commit.
   - `/clients`, `/campaigns`, `/campaign-lists`, `/campaign-contacts`, `/outreach-status`, `/outreach-events`.
   - `/health`.
7. CSV importer with mapping templates.
8. Service tests for dedupe, merge resolution, conflict detection.
9. **Dependency deny-list test.** Build fails if any send-side dependency (`nodemailer`, `@sendgrid/mail`, `mailgun.js`, `@aws-sdk/client-ses`, equivalents) is reachable in the API package's dependency graph.
10. **Cross-client leakage test placeholder.** A failing-by-design test exists in Phase 1 with a TODO marker; promoted to a real test in Phase 3.

Exit criteria:

- Operator can run `pnpm dev`, hit endpoints with curl / a small admin UI, perform a full ingest → review → commit cycle, and see the data persisted.
- All endpoints return provenance for fact-bearing reads.
- No global table accepts a `client_id` (CI guard added).
- Dependency deny-list test passes.

## Phase 2 — UI for contacts / outlets / articles / tags

**Goal:** The operator-facing SPA reaches *parity with the API* for browsing and editing.

Tasks:

1. Scaffold `broadlister-web` (React + Vite, TypeScript, on port 4100).
2. Vite proxy → API (`/api` → `http://localhost:3021`).
3. Screens per `BROADLISTER_UI_AND_WORKFLOW_MODEL.md`:
   - Journalist directory + detail.
   - Outlet directory + detail.
   - Article feed.
   - Tags directory.
   - Review queue.
   - Import wizard.
4. Provenance pop-out component used on every editable field.
5. Keyboard shortcuts on directories and queues.
6. Empty states and onboarding card.

Exit criteria:

- Operator can perform every Phase-1 verb through the UI.
- Search and filtering meet performance targets on a 5k-journalist dataset (UI < 200ms perceived).

## Phase 3 — Campaign overlays & list builder

**Goal:** Per-client overlays become first-class, including approvals and exports. The narrative-fit and campaign-constraints panels become real UI here, even though their underlying schema fields ship in Phase 1.

Tasks:

1. Client switcher in header.
2. Campaign workspace per `BROADLISTER_UI_AND_WORKFLOW_MODEL.md` — campaign + list views.
3. **Campaign constraints panel.** Structured form over `Campaign.constraints_json` with `constraints_required` enforcement.
4. Add-to-list picker scoped by suggested filters.
5. CampaignContact overlay editor with all per-row fields.
6. **Narrative fit editor.** Inline structured form over `CampaignContact.narrative_fit_json`. Evidence picker over global `Byline`s. No raw JSON exposure.
7. **Relationship/status panel** on journalist detail (when client is selected): `OutreachStatus.state` + `relationship_warmth` editor, recent `OutreachEvent` log, `notes_private`.
8. Outreach status + outreach event log.
9. ClientApproval workflow.
10. Approval/fact-check readiness chips (computed: contact-readiness, citation coverage, ClientApproval state).
11. Export to CSV + markdown brief, with provenance and `email_safe` per row. Source-audit and approval-log shapes mapping to Sevenfold folder conventions (`02_source_audit/`, `09_approvals/`, `06_media_lists/`).
12. Cross-client safety guards in the API and UI — promoted from Phase-1 placeholder to a real integration test that fails the build if any client's overlay data is reachable through another client's view.

Exit criteria:

- Operator can build, approve, and export a Trace-Finance Tier-1 list end to end.
- Cross-client leakage tests pass.
- Narrative fit and campaign constraints are usable through structured UI (no raw JSON edits).
- Sevenfold profile signs off on the export shape (it should map cleanly to `06_media_lists/`, `02_source_audit/`, `09_approvals/`).

## Phase 4 — Bucketer & Tabulator bridge

**Goal:** Read-only adapters that bring the broader signal graph into BroadLister without coupling.

Tasks:

1. Bucketer adapter:
   - Polls Bucketer at `127.0.0.1:3003` per configured watches.
   - Article URLs in signals routed through URL-fetch adapter.
   - Resulting proposals land in review queue with `source_type='bucketer_signal'`.
2. URL-fetch adapter expansion:
   - Recipe library covering top 10–20 outlets relevant to active clients.
   - Generic fallback extractor.
   - Snapshot caching.
3. Tabulator bridge (read-only):
   - Pulls Tabulator tag list.
   - Proposes mappings to BroadLister tags via `external_ids_json`.
   - Surfaces mismatches in review queue.
4. TaskReckoner mirror (lightweight):
   - On `OutreachEvent` create, post a task-ledger entry to TaskReckoner.
   - Configurable; default off until Bo enables.

Exit criteria:

- Weekly Bucketer pull produces useful, deduped proposals.
- Tabulator tag mapping does not fight the local tag store.
- Operator reports the bridges feel like *help*, not noise.

## Phase 5 — Enrichment & agentic assistance

**Goal:** Optional, review-gated enrichment.

Tasks:

1. Deterministic enrichment adapters:
   - Twitter/X public profile (TOS-permitting).
   - Personal-site bio extraction.
   - Outlet masthead extraction (when available).
2. LLM-assisted enrichment under `services/enrichment/llm/*`:
   - Cost cap, call log.
   - Topic inference from public bylines.
   - **No** access to client overlay data.
   - All proposals land in review queue.
3. Optional agentic assistance hook:
   - Codex-or-equivalent runs in a *visible tmux window* per agent-os/Hermes patterns to handle batch ingest tasks.
   - Never sends external messages; never edits operator-approved data.

Exit criteria:

- Operator opts in per-feature.
- LLM spend is bounded.
- All enrichment is observable and reversible.

## Explicit MVP boundary

The **MVP is the union of Phases 1, 2, and 3**. Below that boundary, BroadLister is not yet useful for client work. Above it (Phases 4 and 5), it grows into the system that connects to Bucketer / Tabulator / TaskReckoner and supports agentic help.

Specifically, **MVP must include**:

- All global entities + overlay entities.
- CSV importer with mapping templates and review queue.
- Single-URL article ingest.
- Provenance + verification flow on every fact-bearing field.
- Campaign workspace with list builder, overlays, ClientApproval, and exports.
- Cross-client safety guards.

**MVP must NOT include** (deferrals):

- Bucketer adapter.
- Tabulator tag bridge.
- Sheets adapter.
- LLM-assisted enrichment.
- TaskReckoner mirror.
- Agentic batch ingest.
- Multi-machine sync.

## Risk-driven sequencing notes

- **Phase 1 must include the review queue.** Don't ship CRUD without the queue; otherwise we set a precedent of bypassing approval gates.
- **Phase 2 must include the provenance pop-out.** The temptation to ship a "clean" UI without exposing citations is real; resist it. The pop-out is the spine of operator trust.
- **Phase 3 must include the cross-client leakage test before any export.** A test that fails fast if a client_id chain is missing in the overlay query layer.
- **Phase 4** can be reordered: Tabulator bridge first if tag confusion is the active pain; Bucketer first if signal triage is the bottleneck. Decide at Phase-3 close.
- **Phase 5** is opt-in. Default-off LLM, default-off agentic batch. Bo flips switches per feature.

## Stopping conditions (any cause Codex to stop and escalate)

- A migration would be destructive without an export.
- A planned change would touch ProjectReckoner / BusyIntern / Hermes / agent-os / sevenfold / systemd / Google credentials.
- A planned change would broaden the network surface beyond `localhost`.
- A planned change would attempt outbound mail or social actions.
- A test for cross-client leakage fails.
- The schema diverges materially from `BROADLISTER_SCHEMA_DRAFT.md` without an updated draft and Bo's review.

## Backups & rollback

- Phase 1 onward: a `pnpm script` that copies `data/broadlister.sqlite` to `data/backups/<UTC-timestamp>.sqlite` before any migration or import commit.
- Operators can revert to a backup by stopping the API, swapping the file, restarting.
- Migration scripts ship `down` migrations or, when they cannot, a documented one-way cutover including the export step.
- All destructive maintenance scripts require an explicit `--i-understand` flag.
