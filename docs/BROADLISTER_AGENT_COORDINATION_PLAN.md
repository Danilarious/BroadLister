# BroadLister Agent Coordination Plan

Updated: 2026-05-10T14:55:26-07:00

## Roles

Codex is the hands-on implementation manager and verifier. Codex changes BroadLister code/docs, runs tests, commits, tags, pushes, and stops at safety boundaries.

Hermes General/default is the orchestration and architecture coordination layer. Hermes keeps BroadLister aligned with ProjectReckoner, Tabulator, Bucketer, ontology-core, and Sevenfold operating needs. Hermes is not the architecture owner and should not become a runtime dependency.

sevenfold is a bounded Sevenfold PR/media workflow reviewer. It should review client relevance, media-list workflow fit, approval gates, source audit conventions, and cross-client safety. Codex should not route directly to sevenfold unless Bo or Hermes explicitly directs it.

reckoner-dev is the ProjectReckoner/Tabulator/Bucketer/ontology-core architecture reviewer. It should be involved before changing ProjectReckoner, Tabulator, Bucketer, ontology-core, or their integration contracts.

## When To Involve Each

Involve Codex for:

- BroadLister implementation.
- Test and verification work.
- Documentation updates.
- Repo hygiene, commits, tags, and pushes.

Involve Hermes for:

- Cross-system sequencing decisions.
- Integration boundary checks.
- Routing questions to reckoner-dev or sevenfold.
- BroadLister operating handoffs.
- Review of coordination plans and next-phase order.

Involve reckoner-dev through Hermes for:

- Tabulator-side dry-run/import work.
- ProjectReckoner control-plane alignment.
- ontology-core mapping questions.
- Bucketer model, adapter, signal, bucket, or source questions.
- Any proposed schema or runtime integration in ProjectReckoner repos.

Involve sevenfold through Hermes for:

- Client media workflow fit.
- Campaign list review conventions.
- Source audit and approvals.
- Export handling into client folders.
- Cross-client safety from a Sevenfold operations perspective.

## Dedicated BroadLister Hermes Profile

A dedicated BroadLister Hermes profile is not recommended yet.

Create one later when at least one condition is true:

- BroadLister is used in regular Sevenfold media-list operations.
- Bo starts a real pilot client campaign list workflow in BroadLister.
- Hermes needs recurring BroadLister-specific memory for imports, exports, approvals, source audits, and runbook tasks.
- Default Hermes context becomes too broad or risky for operator support.
- BroadLister-specific skills are stable enough to encode.

Do not create the profile solely because Phase 4 planning exists. That adds coordination overhead before a stable operating loop exists.

## Hermes Operating Loop

Hermes should stay in the loop by reviewing:

- Phase boundary changes.
- Integration sequencing.
- Any move from file-first to API-backed bridges.
- Any proposed schema change.
- Any potential outreach/contact/export expansion.
- Any ProjectReckoner, Tabulator, Bucketer, ontology-core, or sevenfold routing issue.

Hermes should not:

- Own BroadLister architecture.
- Add runtime dependencies.
- Modify BroadLister or ProjectReckoner repos without explicit implementation authorization.
- Bypass Bo/operator approval gates.
- Trigger outreach or message sending.

## Future BroadLister Skills

Hermes could later build or request these skills:

- `broadlister-operator-runbook`: start, verify, backup, import, export, and diagnose BroadLister.
- `broadlister-cross-client-safety`: check forbidden fields, overlay leakage, and export scope.
- `broadlister-tabulator-bundle-handling`: generate, inspect, validate, and hand off bundle files.
- `broadlister-sevenfold-media-workflow`: map BroadLister artifacts to Sevenfold client source audits, approvals, and media-list deliverables.
- `broadlister-projectreckoner-bridge`: route Tabulator, Bucketer, and ontology-core integration questions safely.

These should be documentation-backed and should not include Gmail/send/outreach permissions.

## Sevenfold Workflow Fit

BroadLister supports Sevenfold daily media relations by:

- Maintaining reusable public journalist/outlet/article/tag knowledge.
- Keeping client-specific fit, exclusions, warmth, approvals, and pitch strategy scoped to campaign overlays.
- Producing reviewed media-list and source-audit artifacts.
- Enforcing provenance before facts become exportable.
- Preserving operator authority over approvals and exports.

BroadLister must not become:

- A CRM.
- An outreach automation system.
- A Gmail/sending tool.
- A hidden external integration.
- A replacement for ProjectReckoner, Tabulator, Bucketer, Hermes, or sevenfold.

## ProjectReckoner And Bridge Fit

ProjectReckoner remains the broader control plane.

Tabulator should receive reviewed public media artifacts through file-first bundles, then a Tabulator-owned offline validate/dry-run adapter, and only later a commit mode if Bo approves.

ontology-core alignment should remain advisory/read-only at first. BroadLister may map external IDs into local tags, but must not auto-merge ontology concepts across systems.

Bucketer should remain the signal/news monitoring instrument. Bucketer signals may later become BroadLister review proposals. BroadLister topics/outlets/lists may later suggest Bucketer buckets. Both directions should start file-first and review-gated.

## Review Gates And Escalation

Stop and involve Bo/Hermes before:

- Schema changes.
- Any external write.
- Any Tabulator/Bucketer/ProjectReckoner runtime dependency.
- Any API-backed bridge replacing file-first handoff.
- Any contact-method export.
- Any client-private field crossing a boundary.
- Any outreach, Gmail, webhook, notification, queue, or send behavior.
- Any cross-client leakage test failure.
- Any dependency deny-list failure.
- Any Hermes/reckoner-dev/sevenfold review that returns fail or pass-with-unmet conditions.

## Hermes Calibration Result

Hermes General/default reviewed this checkpoint on 2026-05-10.

Findings:

- Current BroadLister development order is aligned with ProjectReckoner and Sevenfold mission.
- No broader integration-planning pause is needed.
- Next implementation should be Tabulator-side offline `validate`/`dry_run` in `/home/bxby/development/reckoner-app/tabulator`.
- Use a CLI/helper first, not a public API first.
- Keep modes to `validate` and `dry_run`; no commit mode.
- Do not add BroadLister runtime dependency to Tabulator.
- Do not create a dedicated BroadLister Hermes profile yet.
- Create a dedicated profile after real Sevenfold day-to-day or pilot-campaign use begins.

Consultation note:

- Hermes did not consult live reckoner-dev or sevenfold profiles in that CLI turn. It used current repo docs, prior Hermes/sevenfold review records, and Tabulator/ProjectReckoner inspection.
