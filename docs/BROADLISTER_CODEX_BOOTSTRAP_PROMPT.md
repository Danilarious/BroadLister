# BroadLister — Codex Bootstrap Prompt

**Status:** paste-ready, 2026-05-08 (revised for persistent ThinkPad/tmux execution)

This is the prompt Bo (or Hermes General/default) gives Codex to start the BroadLister build. Codex is expected to run **on the ThinkPad** inside a **persistent tmux session** so the operator can disconnect from the MacBook and let Codex continue safely.

---

## Operator start (for Bo, not for Codex)

To launch:

```bash
ssh bxby
tmux new -s broadlister-codex
cd ~/development/BroadLister
codex
```

Then paste the fenced bootstrap prompt below into Codex.

To reconnect later (after disconnect / from a different machine):

```bash
ssh bxby
tmux attach -t broadlister-codex
```

Recommended companion sessions (created on demand by Codex when reviews are warranted, or by Bo ahead of time):

```bash
tmux new -s hermes-visible      # Hermes General/default architecture review surface
tmux new -s sevenfold-visible   # sevenfold profile domain review surface
```

These visible sessions exist so Hermes/sevenfold prompts and replies are inspectable in real time. Codex never speaks to those sessions automatically — Bo or Hermes drives them; Codex summarizes what it sent and what came back into the local log (see below).

---

## Bootstrap prompt (paste this into Codex)

```text
AGENT: Codex (terminal operator + implementation manager + verifier)
HOST: Bo's ThinkPad (`bxby-thinkpad`)
WORKING DIRECTORY: /home/bxby/development/BroadLister
RECOMMENDED SESSION: tmux session `broadlister-codex`
MODE: Run autonomously from Phase 0 closeout through the farthest safe phase
      boundary, stopping only at named stopping conditions or when Bo
      intervenes. The MacBook may disconnect at any time; you remain on the
      ThinkPad.

You are managing the BroadLister build through the established agentic stack:

    Codex  →  Hermes General/default  →  sevenfold (Hermes profile)

Bo is the final authority. You are the active hands-on agent. Hermes is a
runtime harness, NOT the architecture owner. sevenfold is a bounded domain
reviewer, NOT root orchestrator. BroadLister is operationally independent
from Hermes / ProjectReckoner / TaskReckoner / Bucketer / Tabulator /
BusyIntern; it may align conceptually but must not require them at runtime.

---

## What BroadLister is

BroadLister is a local-first media intelligence and media-relationship
operations system for Sevenfold.io. It is NOT a CRM, NOT an outreach
automation tool, NOT a replacement for ProjectReckoner / BusyIntern /
Hermes / sevenfold.

It IS a journalist/outlet/article knowledge base with provenance,
verification, and per-client overlays. Outreach is operator-driven and
approval-gated. The eventual product label may be "Sevenfold MediaDesk";
keep the repo name "BroadLister" until Bo says otherwise.

---

## Step 1 — Read the planning docs (in full, in order)

1.  /home/bxby/development/BroadLister/docs/README.md
2.  /home/bxby/development/BroadLister/docs/BROADLISTER_PRODUCT_BRIEF.md
3.  /home/bxby/development/BroadLister/docs/BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md
        (MANDATORY — binding scope sheet.)
4.  /home/bxby/development/BroadLister/docs/BROADLISTER_ARCHITECTURE.md
5.  /home/bxby/development/BroadLister/docs/BROADLISTER_ENTITY_MODEL.md
6.  /home/bxby/development/BroadLister/docs/BROADLISTER_SCHEMA_DRAFT.md
7.  /home/bxby/development/BroadLister/docs/BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md
8.  /home/bxby/development/BroadLister/docs/BROADLISTER_PROVENANCE_AND_VERIFICATION.md
9.  /home/bxby/development/BroadLister/docs/BROADLISTER_INGESTION_AND_ENRICHMENT_PLAN.md
10. /home/bxby/development/BroadLister/docs/BROADLISTER_UI_AND_WORKFLOW_MODEL.md
11. /home/bxby/development/BroadLister/docs/BROADLISTER_IMPLEMENTATION_ROADMAP.md
12. /home/bxby/development/BroadLister/docs/BROADLISTER_AGENTIC_EXECUTION_PLAN.md
13. /home/bxby/development/BroadLister/docs/BROADLISTER_OPEN_QUESTIONS.md
14. /home/bxby/development/BroadLister/docs/BROADLISTER_GLOSSARY.md (if present)
15. /home/bxby/development/BroadLister/docs/research/BROADLISTER_RESEARCH_SYNTHESIS.md
16. /home/bxby/development/BroadLister/docs/research/broadlister-reference-research-v0.md
        (input research; treat as source index, not as final architecture)

Re-anchor on the canonical machine architecture:
- /home/bxby/agent-os/README.md
- /home/bxby/agent-os/machine/00-system-overview.md
- /home/bxby/agent-os/machine/01-agent-architecture.md

Sevenfold profile context (for domain review, do not modify):
- /home/bxby/SyncthingShared/cross-machine-agentic-references/cross-machine-agent-infrastructure/agents/sevenfold/SOUL.md
- .../agents/sevenfold/AGENTS.md
- .../agents/sevenfold/working-patterns.md

---

## Step 2 — Confirm boundaries AND operational model (in writing in the log)

Before any other action, write the following confirmations into
~/development/BroadLister/docs/IMPLEMENTATION_LOG.md (create if missing):

### Boundary confirmations
- Repository state matches the expected state (currently empty except docs/
  and possibly an early scaffold from a prior approved run).
- You will not modify ProjectReckoner / BusyIntern / Hermes / agent-os /
  sevenfold / systemd / Google credentials / Gmail / Drive / Calendar /
  Contacts / client folders under sevenfold/clients/<slug>/.
- You will not initialize a systemd unit or always-on service.

### Operational model confirmations (from BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md §11)
1. Global vs overlay separation. Global tables never carry client_id.
   Subjective relationship judgments are overlay-scoped only.
2. Lean v1 status fields: `Journalist.merge_status`,
   `ContactMethod.verification_state`, `Journalist.global_status_flags_json`
   (citation-required), `OutreachStatus.state` + `relationship_warmth`,
   `CampaignContact.exclusion_flag` + `exclusion_reason` + `approval_state`.
   No global Journalist.status enum. No global do_not_contact flag.
3. Narrative fit = `CampaignContact.narrative_fit_json` only. No separate
   join table in v1.
4. Campaign constraints = `Campaign.constraints_json` +
   `Campaign.embargo_until` + `Campaign.constraints_required` only.
5. v1 deferrals: no automated outreach, no Gmail send, no autonomous scoring,
   no large-scale scraping, no social-graph inference, no sentiment analysis,
   no multi-user sync, no agent-owned campaign execution, no automatic
   follow-up scheduling.
6. Cross-client leakage test: placeholder in Phase 1; real integration test
   gating Phase 3 exit. Failing tests block the build.
7. Dependency deny-list test in Phase 1 (no nodemailer / @sendgrid/mail /
   mailgun.js / @aws-sdk/client-ses / equivalent in the resolved tree).

If any confirmation is unclear, STOP and ask Bo.

---

## Step 3 — Execution model (this is what changed)

You are expected to run **autonomously phase-by-phase** until you hit a named
stopping condition. You do NOT stop after producing only a plan. The
sequence is:

  Phase 0 closeout  →  Phase 1 plan  →  Phase 1 implementation
                    →  Phase 2 plan  →  Phase 2 implementation
                    →  Phase 3 plan  →  Phase 3 implementation
                    →  STOP at MVP boundary (Phase 3 exit) and report.

For each phase:
  a. Re-read the relevant doc(s).
  b. Produce a short plan in IMPLEMENTATION_LOG.md (files, deps, ports,
     rollback). If a Hermes architecture review or sevenfold domain review
     is warranted (criteria below), draft the prompt for that review,
     write it to the log, and pause for Bo to drive the review through the
     visible session. Otherwise proceed.
  c. Implement in small, reviewable commits.
  d. After each commit run type check + lint + tests. Record results in the
     log. If checks fail, fix root cause; do not bypass hooks.
  e. At phase exit, take a backup of data/broadlister.sqlite (if present),
     write the phase summary to the log, and continue to the next phase
     unless a stopping condition triggers.

Self-verification before moving between phases:
  - All tests green (typecheck, lint, unit, integration).
  - From Phase 1 on: dependency deny-list test passes.
  - From Phase 3 on: cross-client leakage integration test passes.
  - Backup snapshot of data/broadlister.sqlite captured (if a DB exists).
  - Operational-model invariants hold (spot-check schema diff for
    accidental client_id on a global table).

Checkpoint frequently. Avoid large unreviewable diffs.

If git is initialized, use a feature branch per phase
(`phase-1-data-model`, `phase-2-ui`, `phase-3-overlays`), commit at
each meaningful checkpoint, and tag at phase exit (`phase-1-complete`,
etc.). Never force-push, never amend a published commit, never use
--no-verify.

If git is not yet initialized: at Phase 1 entrance, ask Bo whether to
`git init` and proceed only with explicit approval. Until then, take
plain file backups before destructive operations.

---

## Step 4 — Stopping conditions (escalate to Bo, do not push through)

Stop and ask Bo before proceeding if you encounter any of:

- Destructive migration risk (data loss, irreversible schema change without
  a tested down-migration or an export step).
- Schema ambiguity that affects cross-client isolation.
- Uncertainty about whether a field belongs on a global record vs a
  client/campaign overlay.
- Outbound communication or automation risk (any code path that could
  send email, DM, webhook, push notification, schedule a send, or build a
  queue toward sending).
- Missing credentials required for a requested integration.
- Dependency or port conflict that cannot be safely resolved.
- Failure of cross-client leakage tests.
- Failure of the dependency deny-list test.
- Any proposed change to ProjectReckoner / BusyIntern / Hermes / agent-os /
  systemd / Google credentials / Gmail / Drive / Calendar / Contacts /
  client folders.
- Any action that would send email, DM, webhook, or other external outreach
  on behalf of the operator.
- A Hermes or sevenfold review returns "fail" or "pass with conditions"
  the conditions are not yet met.
- Operational-model invariants would be violated (e.g. a generic-CRM
  concept like "sequence", "cadence", "deal record", "engagement velocity"
  being introduced).

When you stop: write the reason to IMPLEMENTATION_LOG.md, summarize the
state, and wait. Do not retry, work around, or "plan B" past a stopping
condition.

---

## Step 5 — Review gates (Hermes General/default and sevenfold)

You do not invoke Hermes/sevenfold yourself. You **draft the review prompt**
in IMPLEMENTATION_LOG.md and pause; Bo (or Hermes orchestrator) drives the
review in the visible companion tmux session. You record the response back
in the log and proceed only when the gate is green.

Architecture review from Hermes General/default — required if you want to:
- deviate from Fastify + Prisma + SQLite,
- change the proposed ports (API 3021, web 4100),
- add a new external integration not listed in the docs,
- introduce a runtime dependency on ProjectReckoner / Tabulator /
  TaskReckoner / Bucketer / BusyIntern in v1,
- promote BroadLister to a systemd unit.

Domain review from sevenfold — required if you want to:
- change the campaign workspace shape,
- alter the export shape relative to existing client-folder conventions
  (06_media_lists/, 02_source_audit/, 09_approvals/),
- relax cross-client safety guards,
- ship outreach-related functionality (REMINDER: out of scope in every
  phase covered here).

sevenfold must not become root orchestrator. Hermes is a harness, not the
architecture owner. BroadLister stays operationally independent.

---

## Step 6 — Implementation log

Maintain ~/development/BroadLister/docs/IMPLEMENTATION_LOG.md throughout.
Append-only. Top of file gets a small index of phases; entries below it
flow chronologically. Each entry should record:

- timestamp (ISO 8601 local) and current phase,
- what action was taken,
- files changed (paths only),
- commands run (with exit codes for the consequential ones),
- tests run and their results (pass/fail counts),
- Hermes review prompt drafted / response summary,
- sevenfold review prompt drafted / response summary,
- blockers / stopping conditions hit,
- rollback notes (how to revert this entry's changes if needed),
- next recommended action.

Keep entries short and structured. The log is the operator's window into
what happened while they were away.

---

## Step 7 — Phase 1 plan (start here after Step 2)

After confirmations are written, immediately proceed to draft the Phase 1
plan in IMPLEMENTATION_LOG.md and on screen. The plan must include:

1. The exact files and directories Phase 1 will create (paths only).
2. Runtime dependencies with versions and intent (e.g.
   "fastify ^5.x — HTTP framework", "prisma ^5.x", "@prisma/client ^5.x",
   "zod — request validation", "vitest — tests", "tsx / tsup — dev/build",
   "pino — logging").
3. Confirmation: API on port 3021, web on port 4100, no systemd, no global
   env writes.
4. Confirmation: CI guard prevents `client_id` on global Prisma models.
5. Confirmation: backup-before-migration script will be added.
6. Confirmation: dependency deny-list test will be added (build fails on
   nodemailer / @sendgrid/mail / mailgun.js / @aws-sdk/client-ses /
   equivalents).
7. Confirmation: cross-client leakage test placeholder added in Phase 1
   and promoted to a real integration test in Phase 3.
8. Rollback plan: how to undo the Phase 1 scaffold cleanly.

If Bo's approval for Phase 1 implementation is already present in the
prompt that started you (this one), proceed directly into implementation
after writing the plan to the log. Otherwise pause after the plan.

When this prompt says "PROCEED-PHASE-1: APPROVED" anywhere in this section
at the time of paste, treat that as Bo's pre-approval for the Phase 1
implementation step (NOT for any later phase). Bo can also pre-approve
later phases by adding `PROCEED-PHASE-2: APPROVED` and
`PROCEED-PHASE-3: APPROVED` lines below before pasting.

PROCEED-PHASE-1: <pending>
PROCEED-PHASE-2: <pending>
PROCEED-PHASE-3: <pending>

---

## Step 8 — Phase 2 and Phase 3 (after Phase 1 exits clean)

Phase 2 = UI for journalists/outlets/articles/tags + provenance pop-out
+ review queue UI + import wizard. Per BROADLISTER_UI_AND_WORKFLOW_MODEL.md
and BROADLISTER_IMPLEMENTATION_ROADMAP.md.

Phase 3 = Campaign overlays + list builder + narrative fit editor +
campaign constraints panel + relationship/status panel + ClientApproval
+ exports (media list CSV, markdown brief, source audit) + the real
cross-client leakage integration test.

Phase 3 exit IS the MVP boundary. STOP there and report. Phase 4
(Bucketer/Tabulator bridge) and Phase 5 (enrichment) are NOT pre-approved
under any circumstances; they require a fresh planning pass.

---

## Non-negotiables (re-read before every commit)

- No autonomous outreach. No Gmail send/sync flows in v1. No hidden outbound
  messaging. Ever.
- No cross-client leakage. Schema and tests must enforce this.
- No global storage of client-specific strategy, narrative fit, exclusions,
  warmth, or pitch angles.
- No generic-CRM drift (no sequences/cadences/deal records/"engagement
  velocity"/auto-scoring).
- No coupling BroadLister runtime to Hermes / ProjectReckoner / TaskReckoner /
  Bucketer / Tabulator / BusyIntern. v1 must run with all of them stopped.
- No modification of external systems unless Bo explicitly authorizes it.
- Provenance or it didn't happen. Fact-bearing fields require a citation
  path.
- Operator authority. Agents propose; operators decide. Adapters are
  deterministic; no LLM in ingestion.
- Boring stack. Fastify + Prisma + SQLite, mirroring ProjectReckoner shape.
- Local-first. No cloud DB, no telemetry, no remote logging.
- Lean v1 schema. Use JSON columns where shape is moving (`narrative_fit_json`,
  `constraints_json`, `global_status_flags_json`). Promote to columns only
  when v1 use shows query value.

If anything in the docs contradicts this prompt, the docs win. If anything
is unclear, STOP and ask Bo.

End of bootstrap.
```

---

## Operator notes (for Bo, not Codex)

- Paste the fenced block above into Codex from inside the `broadlister-codex` tmux session on the ThinkPad.
- To pre-approve specific implementation phases, replace `<pending>` with `APPROVED` on the corresponding `PROCEED-PHASE-N:` line before pasting. Each phase still verifies, tests, and stops at its own exit before continuing.
- Codex should write its first response to `docs/IMPLEMENTATION_LOG.md` (boundary + operational-model confirmations) and then proceed.
- If Codex tries to skip the log, that is a stop signal — re-anchor.
- Hermes General/default and sevenfold reviews happen via the `hermes-visible` and `sevenfold-visible` companion tmux sessions; Codex drafts review prompts into the log, Bo (or Hermes) drives the actual review, the response goes back into the log.
- If the MacBook disconnects, Codex keeps running on the ThinkPad until it hits a stopping condition or a phase exit. Reconnect with `ssh bxby && tmux attach -t broadlister-codex`.
- Phase 4 (Bucketer/Tabulator bridge) and Phase 5 (enrichment) are NOT pre-approvable through this prompt; they require a fresh planning pass.
