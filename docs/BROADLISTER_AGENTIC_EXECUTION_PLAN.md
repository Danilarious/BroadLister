# BroadLister — Agentic Execution Plan

**Status:** planning, 2026-05-08

How the existing agentic stack (Codex / Hermes General/default / sevenfold profile) should manage BroadLister's build and ongoing operation. This document is binding for the build phases below; deviations require Bo's explicit approval.

## Agent topology recap

```
Bo (final authority)
   │
   ▼
Codex                                — terminal operator, implementation manager, verifier
   │
   ▼
Hermes General/default                — canonical orchestrator / manager
   │
   ▼
sevenfold (Hermes profile)            — bounded Sevenfold PR/media domain reviewer
   │
   ▼
BroadLister codebase / data           — what gets built
```

Notes on that order:

- **Bo always.** No agent ships destructive or shared-state changes without Bo's approval.
- **Codex** is the active hands-on agent. Codex reads the planning docs in this folder, produces implementation plans, executes the implementation in a visible terminal, runs verifications.
- **Hermes General/default** is the architecture reviewer. Codex proposes; Hermes General/default sanity-checks against `agent-os` / cross-project boundaries.
- **sevenfold** is a *domain reviewer* for media/PR concerns — schema fits Sevenfold workflow? export shape works for `06_media_lists/`? cross-client guardrails align with `09_approvals/`? sevenfold does **not** own architecture.

## Codex's role per phase

### Phase 0 (planning closeout)

- Read every `docs/BROADLISTER_*.md`. **`BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md` is mandatory** — it is the binding scope sheet.
- Read `docs/BROADLISTER_GLOSSARY.md` to disambiguate overlapping terms.
- Check the empty repo state.
- Produce an **implementation plan** that:
  - Names the exact files Phase 1 will create (paths only, no code).
  - Names the ports it will use (proposed: API 3021, web 4100; defer-to-Bo if conflicts).
  - Names the dependencies it will install with versions and intent.
  - Confirms it will not touch ProjectReckoner / BusyIntern / Hermes / agent-os / sevenfold / systemd / Google creds.
  - Confirms in writing the §11 obligations from the operational model (global-vs-overlay separation, lean v1 status fields, narrative-fit JSON, campaign-constraints JSON, cross-client leakage test in Phase 3, dependency deny-list test in Phase 1).
  - Includes a rollback plan if Phase 1 needs to be reverted.
- Submit plan to Bo. Wait for explicit approval.

### Phases 1–5 (implementation)

For each phase Codex:

1. Reads the relevant doc(s).
2. Asks Hermes General/default for an architecture review of the planned diff *before* writing code.
3. For media/PR-specific design choices, asks sevenfold for review of the same plan, scoped to its domain.
4. Implements in **small, reviewable commits** (or commit-equivalents if not yet a git repo).
5. Verifies after each commit:
   - Type check.
   - Lint.
   - Unit + integration tests.
   - Cross-client leakage test from Phase 3 onward.
   - Manual smoke (open app, complete a representative flow).
6. Reports outcomes to Bo at clear stopping points.
7. Stops if anything in this doc's "stopping conditions" triggers (see roadmap).

### Codex must never

- Modify ProjectReckoner / BusyIntern / Hermes / agent-os / sevenfold codebases.
- Change Hermes profiles or Hermes harness configs.
- Modify systemd units, Google credentials, Gmail / Drive / Calendar configs.
- Touch client folders under `agents/sevenfold/clients/<slug>/` except via *operator-driven exports* in BroadLister UI.
- Send any external network message (email, DM, webhook) on behalf of the operator.
- Loosen the cross-client safety guards.
- Skip approval gates ("I'll commit and we'll review later" is not allowed).

## Hermes General/default's role

Hermes General/default is the canonical orchestrator. For BroadLister it serves two purposes:

1. **Architecture review.** Each implementation plan from Codex is reviewed against `agent-os`, `00-system-overview.md`, `01-agent-architecture.md`, and the runtime decision records. Hermes flags anything that contradicts the canonical architecture.
2. **Process orchestration.** When Codex needs to spin up a temporary task agent (e.g. "ingest 200 URLs deterministically"), Hermes manages the lifecycle and ensures it runs in a visible terminal context.

Hermes does **not** own BroadLister's code or data.

## sevenfold's role

The sevenfold profile is a **bounded** domain reviewer. Its scope:

- Confirm the campaign workspace + list builder produce artifacts compatible with `06_media_lists/<slug>/` shape.
- Confirm provenance / source-audit alignment with `02_source_audit/<slug>_Source_Audit.md`.
- Confirm approval flows align with `09_approvals/<slug>_Approval_and_Fact_Check_Log.md`.
- Confirm no cross-client leakage in proposed exports.
- Optionally help operators draft *export shapes* — what columns belong in a brief — without ever writing into BroadLister or other live systems.

### sevenfold's mandatory pre-implementation review

Before Phase 1 begins, sevenfold must specifically review and sign off on:

- **PR workflow realism.** Does the v1 set of operator workflows (campaign creation → constraints → list build → narrative fit → approval → export) match how Sevenfold actually operates today?
- **Journalist relationship/status nuance.** Are the v1 fields (`OutreachStatus.state`, `relationship_warmth`, `notes_private`, `CampaignContact.exclusion_flag/reason`) sufficient without becoming a generic CRM? Anything missing that would force operator workarounds?
- **Narrative fit model.** Is `CampaignContact.narrative_fit_json` (with the named fields) sufficient for v1 operator practice?
- **Campaign operational constraints.** Are the constraint categories in `Campaign.constraints_json` complete enough that the operator does not have to invent fields?
- **Export shapes.** Do the proposed exports (media list, source audit, briefing packet, approval log, outreach-prep) map cleanly to existing client folder conventions?

If sevenfold flags anything, it surfaces back to Bo (and to Codex via Hermes General/default) for resolution. sevenfold does **not** modify schemas or implementation directly.

sevenfold must **never**:

- Become root orchestrator.
- Replace Hermes General/default.
- Own any service, schema, or migration decision.
- Mutate ProjectReckoner / TaskReckoner / Tabulator / BusyIntern.
- Author or send outreach.
- Auto-create CRM-style automation.

## Visibility model

### When to use a visible tmux window

- Any time Codex runs migrations.
- Any time Codex runs a batch import or batch URL fetch (Phase 4+).
- Any time Codex runs an LLM-assisted enrichment job (Phase 5+).
- Any time a long-running script is started in the background that affects local state.

The tmux window is the operator's at-a-glance signal that something is happening on the machine.

### When a temporary task agent is acceptable

A temporary task agent is justified when a job is:

- Deterministic (no LLM, or strictly bounded LLM).
- Idempotent or write-protected (writes to review queue only).
- Time-boxed.
- Visible (tmux window or persistent log).

A temporary task agent is **never** acceptable for:

- Sending external messages.
- Modifying client folders.
- Modifying ProjectReckoner / BusyIntern / Hermes / agent-os / sevenfold.
- Mutating verified contact methods.
- Approving review items.

### When to keep work in the foreground

- Schema migrations.
- Initial CSV imports for a new client.
- Any change that affects the cross-client safety guards.

## Review gates

The system has **five** named review gates. Every code change passes at least one.

1. **Architecture gate (Hermes General/default).** New service boundaries, new dependencies, new ports, new external integrations.
2. **Domain gate (sevenfold).** Anything that affects the operator's PR/media workflow shape.
3. **Schema gate (Codex + Bo).** Any change to Prisma models / migrations.
4. **Safety gate (Codex automated tests).** Cross-client leakage test, lawful-storage default test, no-outreach-side-effects test.
5. **Operator gate (Bo).** Phase entrance, phase exit, stopping conditions, any deferral or scope change.

## Rollback rules

- Every migration ships a corresponding `down` migration *or* a documented one-way cutover with prior export.
- A backup of `data/broadlister.sqlite` is taken before:
  - Any migration.
  - Any import-commit.
  - Any merge approval that affects > N entities (e.g. > 50).
- When in doubt, take a backup. Disk is cheap.

## Safety rules

- BroadLister never opens an outbound network connection except via adapters under `adapters/`. Adapters live in their own module so they can be audited independently.
- Adapters are deterministic and rate-limited.
- LLM calls (Phase 5+) are off by default, behind explicit operator opt-in per feature, with cost ceiling enforced in code.
- No telemetry, no analytics, no remote logging.

## No hidden outreach automation

- BroadLister has **zero** code that sends a message of any kind.
- BroadLister has **zero** scheduled tasks that interact with people.
- BroadLister has **zero** integrations with email-sending services.
- This is enforced by: (a) absence in the codebase, (b) a smoke test that fails if any module imports a known-bad list (`nodemailer`, `sendgrid`, `mailgun`, `aws-ses`, etc.), (c) Hermes General/default review on any new dependency.

## Communication patterns

- Codex reports phase boundaries to Bo with a short status: what was done, what was verified, what was deferred, what's next.
- Hermes General/default's review is short and structured: pass / pass-with-conditions / fail with reasoning.
- sevenfold's review is short and structured, scoped to domain concerns.

## What to do if anything is unclear

- Codex stops, surfaces the question, asks Bo.
- Codex prefers stopping to guessing.
- "It might be fine" is never enough to proceed.

## Worked execution example (Phase 1 first commit)

1. Codex reads `BROADLISTER_SCHEMA_DRAFT.md` and `BROADLISTER_ARCHITECTURE.md`.
2. Codex drafts the Phase 1 plan: scaffold `broadlister-api`, install Fastify + Prisma + SQLite, write the initial Prisma schema, run the first migration, expose `/health`.
3. Hermes General/default reviews: "Architecture aligns with agent-os runtime decisions; ports proposed (3021) do not collide with existing services. Pass."
4. sevenfold reviews: domain concerns trivial at this commit; "Pass — no domain impact."
5. Bo approves.
6. Codex executes in a visible tmux window. Migration runs. Test runs. `/health` returns 200.
7. Codex reports: "API up at 3021, schema migrated to v0.0.1, no cross-client tables yet. Phase 1 step 1 of N complete."

This is the pattern repeated across every commit until BroadLister is shippable.
