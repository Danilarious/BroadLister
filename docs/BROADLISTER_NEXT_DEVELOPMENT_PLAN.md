# BroadLister Next Development Plan

## Recommended Next Phase

Next phase should be `B) Tabulator reviewed-artifact export planning`, unless Bo wants manual conflict-resolution controls before exports.

The browser-validation and hardening pass added Playwright coverage, expanded API hardening tests, documented Tailscale access, and preserved the no-outreach and cross-client safety posture. The import-ingestion pass added deterministic, review-gated URL article ingestion and CSV contact imports. The reconciliation pass added deterministic duplicate matching, linked approval resolution, import batch filtering, defer/reject paths, and review queue context panels. No additional hardening block is currently severe enough to defer ontology planning.

This planning package defines alignment contracts for ontology-core, Tabulator, and Bucketer. It does not hard-couple BroadLister to ProjectReckoner, Tabulator, TaskReckoner, Bucketer, Hermes, or sevenfold at runtime.

Implemented branches: `phase-4-ontology-snapshot-import`, then `phase-4-ontology-review-refinement`.

## Objective

Bridge A now implements the smallest safe bridge plus local review refinement: a static ontology/tag mapping snapshot intake that creates BroadLister review items, shows field-level changes/provenance, handles repeated imports safely, and stores accepted mappings locally. No external API calls or package-level runtime dependency.

## Proposed Workstreams

1. Validate Bridge A with a real operator-curated ontology snapshot.
2. If real use shows many conflicts, add manual conflict-resolution controls before export work.
3. Add optional fixture examples for Tabulator tag snapshots if Bo wants Tabulator mapping coverage before exports.
4. Move to Tabulator reviewed-artifact export planning once Bo accepts the current local mapping review.
5. Keep Bucketer imports and monitoring hints deferred until Tabulator artifact shape is proven.

## Likely Architecture

- BroadLister owns its local SQLite database.
- Ontology mapping starts as advisory metadata from versioned local snapshots.
- ProjectReckoner ontology identifiers are referenced as external IDs, not joined through runtime service calls.
- Tabulator alignment follows file/snapshot artifact contracts before API writes.
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

## Risks

- Global/client scope confusion if campaign narrative tags leak into global records.
- Runtime coupling if ontology-core is treated as a required service instead of a reference taxonomy.
- Tag drift if BroadLister and Tabulator evolve without explicit mapping versions.
- Operator confusion if advisory matches appear as verified facts.
- Export incompatibility if client-folder conventions change without sevenfold review.

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

## Hardening Items Deferred

- Full automated accessibility audit with `axe-core`: defer until the next UI-focused pass because current Playwright checks cover basic labels, visible navigation, touch targets, and horizontal overflow without adding another dependency.
- Backup restore automation: documented procedure is sufficient for the current local-first MVP. Add an automated restore rehearsal before destructive migrations.
- Production packaging/deployment: defer until Bo decides whether BroadLister should remain dev-run only or receive a local packaged runner. Do not add systemd without explicit approval.
- Manual field-level merge/update UI for import proposals: current approval flow matches existing records or creates new ones deterministically. Add explicit merge/update controls only after operator use proves the needed cases.
- Bulk approval: keep deferred until duplicate/match confidence and dependency ordering have more real-world validation.

## Suggested First Implementation After Approval

Bridge A implementation now includes:

- `docs/fixtures/ontology-snapshot.v1.example.json`.
- API preview/commit route for local mapping snapshots, creating review items only.
- Review context for mapping candidates.
- Field-level mapping review, provenance visibility, repeat-import safety, and conflict states.
- Approved mapping storage in `Tag.external_ids_json`.
- Tests for parse, field-level preview, review item creation, repeated import safety, duplicate source IDs, external ID conflicts, normalized matching, approval mutation, reject/defer non-mutation, malformed snapshots, no network calls, and cross-client leakage.

Recommended next after Bo review: Tabulator export planning is now reasonable. One more local refinement pass is only needed if Bo wants explicit manual merge/update controls for conflict rows before any export planning.
