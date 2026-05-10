# BroadLister Hermes Handoff

## Hermes Role

Hermes may orchestrate BroadLister-related work, summarize operator requests, and route Sevenfold-domain questions to the sevenfold profile. Hermes is not the architecture owner. BroadLister remains its own repo and product, with Codex as implementation manager for code changes.

## Operating BroadLister

Repo:

```text
/home/bxby/development/BroadLister
```

Start locally:

```bash
pnpm install
pnpm db:generate
pnpm dev
```

Ports:

- API: `3021`
- Web: `4100`

Verify:

```bash
pnpm verify
pnpm check:global-models
pnpm check:denylist
pnpm build
```

Back up:

```bash
pnpm backup:db
```

## Routing Model

- Codex: implementation manager, verifier, repo edits, tests, docs.
- Hermes General/default: orchestration harness and handoff coordinator.
- sevenfold profile: bounded Sevenfold domain reviewer for client workflow fit, media-list usage, approvals, and client-folder alignment.
- Bo: final authority.

Hermes should ask sevenfold for domain review when BroadLister work changes campaign workspace shape, export shape, client-folder conventions, cross-client safety guards, or any outreach-adjacent behavior. Hermes should not ask sevenfold to own architecture or implementation.

## Required Safety Framing

Every BroadLister task must preserve:

- No autonomous outreach.
- No Gmail sending.
- No hidden outbound integrations.
- No generic CRM drift.
- No runtime dependency on Hermes, ProjectReckoner, Tabulator, TaskReckoner, Bucketer, BusyIntern, or sevenfold.
- Global facts separate from client overlays.
- Scoped exports and approval gates.
- Cross-client leakage protections.

## How Hermes Should Brief Sevenfold

Use this framing:

```text
BroadLister is Sevenfold's local-first media intelligence workspace. Review whether the proposed BroadLister task supports Sevenfold media relations workflows without weakening client isolation, approval gates, scoped exports, or no-outreach boundaries. Treat yourself as a bounded domain reviewer, not root orchestrator. If the task affects export shape, campaign overlays, approvals, source audits, or client-folder conventions, return pass/fail plus concrete conditions.
```

## Stop Conditions

Hermes should stop and return to Bo if a task involves:

- Outbound communication.
- Credentials.
- Destructive migration risk.
- Cross-client leakage uncertainty.
- Changes to systemd or always-on operation.
- Runtime coupling to external Sevenfold infrastructure.
- A sevenfold review that returns fail or pass with unmet conditions.

## 2026-05-09 Hermes Briefing Result

Hermes General/default reviewed this handoff during the post-Phase-3 UI polish pass and returned `PASS`.

Hermes briefed the sevenfold profile and recorded sevenfold session `20260509_185143_9caa3c`. sevenfold returned `PASS with conditions`.

Conditions to preserve:

- sevenfold remains a bounded domain reviewer, not root orchestrator.
- BroadLister remains standalone and local-first.
- Cross-client leakage tests must stay required and passing before usable exports.
- Client-scoped query, review, and export enforcement must remain intact.
- Source provenance must stay attached to import, proposal, and export artifacts.
- URL and CSV imports remain proposal-only until review queue approval.
- Narrative fit, constraints, and `ClientApproval` gates stay human-review-gated.
- No autonomous outreach, Gmail sending/sync, hidden outbound integrations, or silent data egress.
- No runtime dependency on ProjectReckoner, Hermes, sevenfold, Tabulator, TaskReckoner, Bucketer, or BusyIntern.
