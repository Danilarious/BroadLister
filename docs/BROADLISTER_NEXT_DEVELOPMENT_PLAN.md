# BroadLister Next Development Plan

## Recommended Next Phase

Next implementation phase should be `B1) Tabulator reviewed-media local JSON export`, after Bo reviews and approves the planning contract and test scaffold.

The browser-validation and hardening pass added Playwright coverage, expanded API hardening tests, documented Tailscale access, and preserved the no-outreach and cross-client safety posture. The import-ingestion pass added deterministic, review-gated URL article ingestion and CSV contact imports. The reconciliation pass added deterministic duplicate matching, linked approval resolution, import batch filtering, defer/reject paths, and review queue context panels. No additional hardening block is currently severe enough to defer ontology planning.

This planning package defines alignment contracts for ontology-core, Tabulator, and Bucketer. It does not hard-couple BroadLister to ProjectReckoner, Tabulator, TaskReckoner, Bucketer, Hermes, or sevenfold at runtime.

Implemented branches: `phase-4-ontology-snapshot-import`, `phase-4-ontology-review-refinement`, `phase-4-tabulator-export-planning`. Current scaffold branch: `phase-4-tabulator-export-tests`.

## Objective

Bridge A now implements the smallest safe bridge plus local review refinement: a static ontology/tag mapping snapshot intake that creates BroadLister review items, shows field-level changes/provenance, handles repeated imports safely, and stores accepted mappings locally. The next bridge should remain file-first: reviewed media artifacts exported as local JSON for a future Tabulator-side importer.

## Proposed Workstreams

1. Implement Tabulator export preview for reviewed public media artifacts only.
2. Add local JSON export/download with deterministic ordering and stable export keys.
3. Require provenance coverage and omit records without supporting citations.
4. Add leak tests proving client/campaign overlay fields never appear in generic Tabulator exports.
5. Keep Tabulator API writes, Tabulator-side importer, Bucketer imports, and monitoring hints deferred.

## Likely Architecture

- BroadLister owns its local SQLite database.
- Ontology mapping starts as advisory metadata from versioned local snapshots.
- ProjectReckoner ontology identifiers are referenced as external IDs, not joined through runtime service calls.
- Tabulator alignment follows file/snapshot artifact contracts before API writes.
- BroadLister produces export files; Tabulator owns any later importer.
- Bucketer alignment starts after ontology mapping, through signal candidate snapshots.

## Explicit Deferrals

- No live ProjectReckoner service dependency.
- No automatic tag rewriting.
- No LLM classification in ingestion.
- No LLM classification in ingestion until it is proposal-only, operator-triggered, and explicitly approved.
- No large-scale scraping.
- No social-graph inference.
- No sentiment analysis.
- No Gmail, email sending, or outreach automation.
- No shared cloud database.
- No multi-user sync.
- No direct Tabulator API writes.
- No Tabulator runtime packages in BroadLister.
- No client/campaign overlay export into generic Tabulator links/tags.

## Risks

- Global/client scope confusion if campaign narrative tags leak into global records.
- Runtime coupling if ontology-core is treated as a required service instead of a reference taxonomy.
- Tag drift if BroadLister and Tabulator evolve without explicit mapping versions.
- Operator confusion if advisory matches appear as verified facts.
- Export incompatibility if client-folder conventions change without sevenfold review.
- Provenance gaps if older article/tag records lack citations.
- Idempotency drift if export keys include timestamps instead of stable BroadLister IDs and URL hashes.

## Acceptance Criteria

- Written mapping spec from BroadLister tags to ontology-core concepts.
- Clear distinction between global media facts and client/campaign interpretations.
- No runtime dependency on ProjectReckoner or Tabulator.
- Tests prove BroadLister starts and verifies independently.
- Playwright browser tests remain green on desktop and mobile viewports.
- Export shapes remain compatible with `06_media_lists/`, `02_source_audit/`, and `09_approvals/`.
- sevenfold domain review passes for client workflow and export handling.
- Hermes handoff remains orchestration-only.
- Bo approves any implementation phase after reviewing the plan.
- Tabulator export contract reviewed before implementation.
- Tests cover no client overlay leakage, provenance required, reviewed-only export, deterministic shape, repeat export idempotency, no network calls, and no external writes.

## Hardening Items Deferred

- Full automated accessibility audit with `axe-core`: defer until the next UI-focused pass because current Playwright checks cover basic labels, visible navigation, touch targets, and horizontal overflow without adding another dependency.
- Backup restore automation: documented procedure is sufficient for the current local-first MVP. Add an automated restore rehearsal before destructive migrations.
- Production packaging/deployment: defer until Bo decides whether BroadLister should remain dev-run only or receive a local packaged runner. Do not add systemd without explicit approval.
- Manual field-level merge/update UI for import proposals: current approval flow matches existing records or creates new ones deterministically. Add explicit merge/update controls only after operator use proves the needed cases.
- Bulk approval: keep deferred until duplicate/match confidence and dependency ordering have more real-world validation.

## Suggested First Implementation After Approval

Tabulator export implementation should include:

- Extend the existing pure `BroadListerReviewedMediaExportBundle.v1` contract helper into a DB-backed preview service.
- Preview route/UI that shows eligible records, omitted records, provenance coverage, and forbidden overlay categories.
- File/download export only; no Tabulator POST.
- Eligible artifact types: reviewed articles, outlet references, byline references, global tags, provenance packets, import/source metadata.
- Hard test fixture containing client overlay records to prove they are omitted.
- Repeat export test with stable ordering and stable `stable_export_key`.

Recommended next after Bo review: implement local JSON export preview/download. Defer Tabulator API writes and Tabulator importer until the file contract is exercised.
