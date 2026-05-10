# BroadLister Next Development Plan

## Recommended Next Phase

Next phase after this planning package should be `A1) read-only ontology mapping snapshot review`.

The browser-validation and hardening pass added Playwright coverage, expanded API hardening tests, documented Tailscale access, and preserved the no-outreach and cross-client safety posture. The import-ingestion pass added deterministic, review-gated URL article ingestion and CSV contact imports. The reconciliation pass added deterministic duplicate matching, linked approval resolution, import batch filtering, defer/reject paths, and review queue context panels. No additional hardening block is currently severe enough to defer ontology planning.

This planning package defines alignment contracts for ontology-core, Tabulator, and Bucketer. It does not hard-couple BroadLister to ProjectReckoner, Tabulator, TaskReckoner, Bucketer, Hermes, or sevenfold at runtime.

Recommended implementation branch after Bo approval: `phase-4-ontology-mapping-snapshot`.

## Objective

Implement the smallest safe bridge: a local, read-only ontology/tag mapping snapshot intake that creates BroadLister review items and stores accepted mappings locally. No external API calls or package-level runtime dependency.

## Proposed Workstreams

1. Add a fixture-backed `BroadListerOntologyMapping.v1` JSON snapshot format.
2. Add an import preview that detects matching local tags by slug/name.
3. Create `ReviewItem(kind='ontology_mapping_candidate')` rows only.
4. Add review approval behavior that stores approved external references locally, likely in `Tag.external_ids_json` or a small local mapping table.
5. Add leakage tests proving client relevance, campaign narrative fit, outreach status, and client notes cannot be emitted as global mappings.
6. Add independence tests proving BroadLister verifies with ProjectReckoner, Tabulator, Bucketer, Hermes, and sevenfold stopped.

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

If Bo approves implementation after this planning phase, start with:

- `docs/fixtures/ontology-mapping-snapshot.v1.example.json` or equivalent.
- API preview/commit route for local mapping snapshots, creating review items only.
- Review context for mapping candidates.
- Approved mapping storage in `Tag.external_ids_json` unless a migration for a local `OntologyMapping` table is explicitly approved.
- Tests that prevent mapped campaign-only concepts from entering global records or generic Tabulator/Bucketer artifacts.

Do not implement this until Bo explicitly approves the next development phase.
