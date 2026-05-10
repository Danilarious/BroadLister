# BroadLister Next Development Plan

## Recommended Next Phase

Next phase should be `A) ontology-core / Tabulator alignment planning`.

The browser-validation and hardening pass added Playwright coverage, expanded API hardening tests, documented Tailscale access, and preserved the no-outreach and cross-client safety posture. No additional hardening block is currently severe enough to defer ontology planning.

This remains planning-first alignment for ontology and tagging interoperability. It should not hard-couple BroadLister to ProjectReckoner, Tabulator, TaskReckoner, Bucketer, Hermes, or sevenfold at runtime.

Recommended phase name: `phase-4-ontology-alignment-planning`.

## Objective

Design a safe bridge between BroadLister's media ontology and the broader Sevenfold/ProjectReckoner ontology ecosystem. The first implementation should likely be read-only or advisory mapping, not shared runtime ownership.

## Proposed Workstreams

1. Inventory BroadLister tag classes, provenance fields, and campaign overlay fields.
2. Inventory ProjectReckoner `ontology-core` concepts and Tabulator tagging semantics.
3. Define a mapping layer from BroadLister media tags to ontology-core identifiers.
4. Decide which mappings are global facts and which are campaign/client interpretations.
5. Add deterministic import/export mapping specs before any code integration.
6. Add tests proving BroadLister still runs with ProjectReckoner, Tabulator, and Hermes stopped.

## Likely Architecture

- BroadLister owns its local SQLite database.
- Ontology mapping starts as advisory metadata, preferably JSON-backed or a separate local mapping table.
- ProjectReckoner ontology identifiers may be referenced as external IDs, not joined through runtime service calls.
- Tabulator alignment should focus on taxonomy compatibility and export/import shapes.
- Any future bridge should be operator-triggered and deterministic.

## Explicit Deferrals

- No live ProjectReckoner service dependency.
- No automatic tag rewriting.
- No LLM classification in ingestion.
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

## Suggested First Implementation After Approval

If Bo approves implementation after the planning phase, start with:

- A local `OntologyMapping` model or JSON-backed mapping file for advisory mappings.
- A UI surface showing tag mapping confidence and source provenance.
- Import/export transforms that include mapping metadata without changing existing export contracts.
- Tests that prevent mapped campaign-only concepts from entering global records.

Do not implement this until Bo explicitly approves the next development phase.
