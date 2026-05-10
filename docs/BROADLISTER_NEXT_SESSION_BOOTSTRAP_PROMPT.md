# BroadLister Next Session Bootstrap Prompt

Paste this into a fresh Codex session when continuing BroadLister work.

```text
Codex, continue BroadLister from the latest project calibration checkpoint.

Repo:
- /home/bxby/development/BroadLister

Read first:
- docs/BROADLISTER_PROJECT_STATUS_CHECKPOINT.md
- docs/BROADLISTER_AGENT_COORDINATION_PLAN.md
- docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md
- docs/IMPLEMENTATION_LOG.md
- docs/BROADLISTER_TABULATOR_OFFLINE_IMPORT_PLAN.md
- docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md
- docs/BROADLISTER_PROJECTRECKONER_BRIDGE_PLAN.md
- docs/BROADLISTER_BUCKETER_BRIDGE_PLAN.md
- docs/BROADLISTER_BUCKETER_ENTITY_MAPPING.md

Current completed BroadLister checkpoint:
- Branch: phase-4-project-calibration-handoff
- Tag: phase-4-project-calibration-handoff-complete
- Previous implementation checkpoint: phase-4-tabulator-offline-dry-run
- Previous implementation commit: 13ca24c
- Previous implementation tag: phase-4-tabulator-offline-dry-run-complete

Completed features:
- Phase 1/2/3 MVP: Fastify/Prisma/SQLite API, React/Vite UI, global media directories, campaign overlays, approvals, scoped exports, provenance, review queue, import flows, cross-client safety.
- Phase 4: import ingestion, reconciliation review, ontology alignment planning, static ontology snapshot import, field-level ontology review, Tabulator export contract, DB-backed preview service, read-only preview route, Exports UI, confirmed local JSON download, Tabulator offline import planning, Bucketer bridge planning, BroadLister-local offline Tabulator bundle validator/dry-run.

Deferred:
- Tabulator writes/API/runtime integration.
- Tabulator commit mode.
- Contact-method export.
- Client-private overlay export.
- BroadLister schema changes for bridges.
- Bucketer implementation.
- Runtime coupling to ProjectReckoner, Tabulator, Bucketer, Hermes, or sevenfold.
- Gmail/send/outreach automation.
- Systemd/always-on service.

Recommended next slice:
Implement Tabulator-side offline validate/dry_run for BroadLister bundle JSON in /home/bxby/development/reckoner-app/tabulator.

Before changing Tabulator:
1. Inspect BroadLister checkpoint docs.
2. Inspect /home/bxby/development/reckoner-app/tabulator read-only.
3. Create a Tabulator repo branch with a clear name, such as broadlister-offline-dry-run.
4. Confirm no schema change is required. If schema change seems required, stop and report.

Implementation boundaries for the next slice:
- Tabulator-side validate/dry_run only.
- Local file or in-memory fixture input only.
- No commit mode.
- No external writes.
- No BroadLister runtime dependency.
- No Tabulator API route unless docs explicitly justify it; prefer CLI/helper first.
- No contact data.
- No client-private overlay fields.
- No outreach.
- No network calls.
- No ProjectReckoner/BroadLister/Bucketer code changes unless explicitly approved.

Expected Tabulator-side behavior:
- Validate BroadListerReviewedMediaExportBundle.v1.
- Reject forbidden contact/client-private fields.
- Require provenance.
- Produce deterministic operation plan for Tabulator Link, ExternalSourceRecord, Tag, LinkTag, ResearchArtifact, and OntologyProposal concepts.
- Report duplicate/idempotency keys.
- Report omitted/rejected records with reasons.
- Perform no writes.

Hermes coordination:
- Use Hermes General/default for architecture review before or during the Tabulator-side slice.
- Hermes may consult reckoner-dev for ProjectReckoner/Tabulator architecture fit.
- Hermes may consult sevenfold for Sevenfold PR/media workflow fit.
- Codex should not directly manage sevenfold unless Hermes routes it.

Verification:
- In BroadLister docs-only handoff slices: run pnpm build and pnpm verify.
- In BroadLister implementation slices: run pnpm verify, pnpm check:global-models, pnpm check:denylist, pnpm build, relevant API/web/e2e/mobile/cross-client tests.
- In Tabulator repo: discover and run the repo's local typecheck/lint/test/build commands plus new targeted dry_run tests.

Stop conditions:
- Any schema change appears necessary.
- Any external write or network behavior appears.
- Any contact export/import appears.
- Any client-private field crossing appears.
- Any runtime coupling to BroadLister/ProjectReckoner/Bucketer/Hermes/sevenfold appears.
- Any cross-client safety concern appears.
- Hermes/reckoner-dev/sevenfold returns fail or pass-with-unmet conditions.
```
