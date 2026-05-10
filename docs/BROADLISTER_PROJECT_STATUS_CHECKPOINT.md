# BroadLister Project Status Checkpoint

Updated: 2026-05-10T14:55:26-07:00

## Current Stage

BroadLister is past the Phase 3 MVP boundary and is in Phase 4 integration-alignment work. The product remains a local-first Sevenfold media intelligence workspace: global public media facts, review-gated imports, campaign/client overlays, approval-gated exports, and no autonomous outreach.

Current clean checkpoint before this handoff:

- Branch: `phase-4-tabulator-offline-dry-run`
- Commit: `13ca24c`
- Tag: `phase-4-tabulator-offline-dry-run-complete`
- Branch and tag: pushed

This handoff branch:

- Branch: `phase-4-project-calibration-handoff`
- Purpose: documentation, project calibration, and Hermes coordination only

## Built And Verified

- Fastify/Prisma/SQLite API and React/Vite web app.
- Global records for journalists, outlets, articles, tags, citations, provenance links, import batches, review items, campaigns, campaign contacts, outreach status, and client approvals.
- CSV import and review queue with deterministic matching.
- URL ingest proposals.
- Field-level ontology snapshot preview/import into review queue.
- Ontology approval updating only local `Tag.external_ids_json`.
- Repeated ontology import safety, conflict handling, and provenance-visible review.
- Campaign overlays, narrative fit, constraints, scoped approvals, and exports.
- Cross-client leakage integration test.
- Dependency deny-list guard.
- Operator-facing Tabulator export preview UI.
- Confirmed local browser JSON download for `BroadListerReviewedMediaExportBundle.v1`.
- BroadLister-local offline Tabulator bundle validator/dry-run helper.

Latest verified commands from the dry-run checkpoint:

- `pnpm verify`
- `pnpm check:global-models`
- `pnpm check:denylist`
- `pnpm build`
- Targeted Tabulator dry-run/export/cross-client tests

## Planning-Only

- Tabulator-side offline import adapter design.
- Bucketer-to-BroadLister and BroadLister-to-Bucketer bridge concepts.
- ProjectReckoner/ontology-core/Tabulator alignment plan.
- Dedicated BroadLister Hermes profile proposal.
- Future commit mode for Tabulator imports.
- Future Bucketer signal intake and reverse bucket-suggestion flows.

## Deferred

- Tabulator API/runtime integration.
- Direct writes to Tabulator.
- Backend export file writer.
- Contact-method export.
- Client-private overlay export.
- Bucketer implementation.
- Runtime coupling to ProjectReckoner, Tabulator, Bucketer, Hermes, or sevenfold.
- Gmail/send/outreach automation.
- Schema changes for integration bridges.
- Systemd or always-on service.

## Branch And Tag History

- `phase-1-complete`: data model and core safeguards.
- `phase-2-complete`: UI foundation.
- `phase-3-complete`: MVP boundary.
- `phase-3-ui-polish-complete`: production-quality UI pass.
- `phase-3-hardening-browser-complete`: browser/mobile hardening.
- `phase-4-import-ingestion-complete`: import ingestion.
- `phase-4-reconciliation-review-complete`: review queue reconciliation.
- `phase-4-ontology-alignment-planning-complete`: ontology/ProjectReckoner planning.
- `phase-4-ontology-snapshot-import-complete`: static ontology snapshot import.
- `phase-4-ontology-review-refinement-complete`: field-level ontology review refinement.
- `phase-4-tabulator-export-planning-complete`: Tabulator export planning.
- `phase-4-tabulator-export-tests-complete`: export contract safety scaffolding.
- `phase-4-tabulator-export-preview-complete`: DB-backed preview service.
- `phase-4-tabulator-export-preview-route-complete`: read-only preview route.
- `phase-4-tabulator-export-preview-ui-complete`: operator preview UI.
- `phase-4-tabulator-export-json-download-complete`: confirmed local JSON download.
- `phase-4-tabulator-offline-import-planning-complete`: Tabulator offline import planning.
- `phase-4-bucketer-bridge-planning-complete`: Bucketer bridge planning.
- `phase-4-tabulator-offline-dry-run-complete`: BroadLister-local offline dry-run validator.

## Safety Guarantees

- Global tables do not carry client-specific overlay fields.
- Client/campaign strategy, narrative fit, exclusions, relationship warmth, approvals, and private notes remain overlay-scoped.
- Export contract denies contact methods and client-private fields.
- Tabulator bundle generation requires reviewed/approved public records and provenance.
- Tabulator preview/download is local-only and operator-confirmed.
- Offline dry-run is pure in-memory and non-mutating.
- No BroadLister bridge code calls Tabulator, Bucketer, ProjectReckoner, Hermes, sevenfold, Gmail, or external services.
- Cross-client leakage tests gate the build.
- Dependency deny-list blocks mail/send-provider dependencies.

## Local Run And Access

From `/home/bxby/development/BroadLister`:

```bash
pnpm install
pnpm db:generate
pnpm dev
```

Local ports:

- API: `http://127.0.0.1:3021`
- Web: `http://127.0.0.1:4100`
- SQLite DB: `data/broadlister.sqlite`

Mac or phone access should use the ThinkPad LAN/Tailscale address with web port `4100` and API port `3021`. Do not add systemd or an always-on service without Bo approval.

Common checks:

```bash
pnpm verify
pnpm check:global-models
pnpm check:denylist
pnpm build
pnpm test:e2e
pnpm test:mobile
pnpm verify:full
```

Back up before migrations or broad data experiments:

```bash
pnpm backup:db
```

## Known Risks

- Tabulator has generic link/tag/artifact primitives, not dedicated journalist/outlet/byline entities. The first Tabulator-side dry-run must avoid schema pressure.
- BroadLister tag kinds do not perfectly map to Tabulator tag types. Preserve source metadata and use conservative mappings.
- ResearchArtifact idempotency must be explicit because existing Tabulator uniqueness may not cover every future import case.
- Downloaded bundles are operator-controlled files after download; handling conventions must stay documented.
- Bucketer signals are noisier than reviewed BroadLister exports, so Bucketer bridge implementation should wait until Tabulator validate/dry-run is stable.

## Recommended Next Slices

1. Implement Tabulator-side offline `validate`/`dry_run` for `BroadListerReviewedMediaExportBundle.v1` in `/home/bxby/development/reckoner-app/tabulator`. Keep it local, deterministic, non-mutating, and file-first.
2. Add Tabulator-side sample fixture validation and dry-run operation plan tests. No commit mode.
3. Review results with Hermes/reckoner-dev before considering any Tabulator commit mode.
4. After Tabulator dry-run is stable, plan Bucketer-to-BroadLister file candidate contract tests and review-queue preview/import.
5. Create a dedicated BroadLister Hermes profile only after BroadLister enters regular Sevenfold operating use or pilot-campaign workflows.
