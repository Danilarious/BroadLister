# BroadLister — Product Brief

**Status:** planning, 2026-05-08
**Owner:** Bo / Sevenfold.io
**Repo:** `~/development/BroadLister/`
**Eventual product label:** Sevenfold MediaDesk (deferred rename)

## What BroadLister is

BroadLister is a **local-first media intelligence and media-relationship operations system** for Sevenfold.io's internal PR / communications work. It is the workspace where Bo (and eventually a small Sevenfold team) curates **journalists, outlets, articles, beats, and campaign-scoped media lists** with provenance, verification, and operator approval gates.

The simplest mental model:

> A provenance-aware journalist/outlet/article knowledge base, with per-client overlays for campaign work, that can later accept inbound signals from Bucketer and exchange tag concepts with Tabulator.

## What BroadLister is **not**

- Not a generic CRM (no sales pipeline, no opportunity stages, no quotas).
- Not a mass-outreach or spam tool. Outreach is operator-driven and approval-gated.
- Not a replacement for ProjectReckoner, TaskReckoner, Bucketer, Tabulator, BusyIntern, or Hermes.
- Not an autonomous pitching system. No agent sends a pitch on its own at any phase covered by this plan.
- Not a Gmail automation system in v1. Gmail integration is on the long-term map only.
- Not a multi-tenant SaaS. Single operator on a local machine; clients are *internal scoping* not *tenants*.

## Why it exists

Sevenfold work today fans out across markdown files, Google Sheets, ad-hoc CSVs, and per-client folders under `agents/sevenfold/clients/<slug>/`. That is fine for narrative work but breaks down for:

1. Reusing **journalist/outlet knowledge** across clients without leaking client-private notes.
2. Keeping **citations and verification state** attached to facts (email, beat, outlet affiliation).
3. Building **campaign-scoped lists** that reference, rather than duplicate, the global media graph.
4. Letting future Bucketer signals (e.g. weekly client-relevant article roundups) flow into the journalist/outlet graph in a structured way.
5. Giving the operator a **review queue** for proposed records / merges / enrichments before they become canonical.

## Core workflows (operator-facing)

1. **Create or open a campaign** scoped to a client (e.g. `trace-finance / Q3 launch`).
2. **Set campaign operational constraints** for that campaign: approved messaging, forbidden claims, embargo, exclusivity, sequencing, outreach window, sensitive topics, competitor conflicts, source/fact-check requirements. (See `BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md` §7.)
3. **Search global media** by beat, outlet, recency of relevant byline, tag, or freeform query.
4. **Build a campaign list** by adding global journalists/outlets and attaching client-scoped overlay notes (target rationale, target score, exclusion flags). For each row, capture **narrative fit** — angle, coverage rationale, evidence bylines, likely objections, preferred framing, confidence — as overlay-scoped data.
5. **Track relationship state** per (client × journalist): outreach status (`none | planned | approved | contacted | replied | declined | hold | blacklisted_for_client`) and relationship warmth (`unknown | cold | neutral | warm | hot`). Both are overlay-scoped — never global.
6. **Import** journalist/outlet rows from CSV, Google Sheets, a Bucketer signal, or a manual article URL. Imports always land in a **review queue** before merging into the global graph.
7. **Verify and enrich** records: confirm email lawfulness, attach byline article, set freshness, capture provenance. Subjective preferences ("prefers exclusives", "no AI pitches") are global only when sourced from a public statement with a citation; otherwise they live as overlay notes.
8. **Export** media lists, source audits, briefing packets, and approval/fact-check logs in shapes that map to Sevenfold's existing `06_media_lists/`, `02_source_audit/`, `09_approvals/` folder conventions. All rows carry provenance and `email_safe` flags.
9. **Track outreach status** per client per journalist — recorded in BroadLister, executed outside it. The system is the workspace, not the actor.

## v1 scope (MVP)

Goals:

- Local-first, single-operator, on-machine.
- Global tables for `Journalist`, `Outlet`, `Article`, `Beat/Topic`, `Tag`, `Citation`.
- Per-client overlay tables for `Campaign`, `CampaignList`, `CampaignContact`, `OutreachStatus`, `ClientNote`.
- **Lean status & nuance fields** per the operational model:
  - global: `Journalist.merge_status`, `ContactMethod.verification_state`, `Journalist.global_status_flags_json` (citation-required, public/sourced preferences only).
  - overlay: `OutreachStatus.relationship_warmth`, `CampaignContact.exclusion_flag` + `exclusion_reason`, `CampaignContact.approval_state`.
- **Narrative fit** as `CampaignContact.narrative_fit_json` (versioned, schema-validated). No separate join table in v1.
- **Campaign operational constraints** as `Campaign.constraints_json` + `Campaign.embargo_until` + `Campaign.constraints_required` boolean.
- CSV import with explicit column mapping; review queue; merge/dedupe with provenance.
- Manual single-URL article ingest (paste URL → fetch metadata → propose journalist+outlet+article).
- Basic search + filter UI (journalists, outlets, articles, tags).
- Campaign list builder with operator add/remove and per-row overlay fields, including a narrative fit panel and a campaign constraints panel.
- Export media lists to CSV and markdown briefs, plus source-audit and approval-log shapes that map to Sevenfold folder conventions.
- Provenance + verification fields on every fact.
- Cross-client leakage **integration test** in Phase 3 (real test, not TODO).
- Dependency deny-list test (build fails if any send-side library is reachable).
- No automated outreach. No Gmail. No multi-user auth.

Explicit non-goals for v1:

- No Bucketer signal ingestion (planned in v1.2).
- No Sheets import/export (planned in v1.1).
- No Tabulator tag bridge (planned in v1.3).
- No TaskReckoner integration (planned in v1.3+).
- No agent-driven enrichment (planned in v2).
- No multi-machine sync.

## v1.1 scope

- Google Sheets import/export adapter (read + write).
- Saved segments / smart lists (filter rules → reusable view).
- Bulk overlay edits per campaign.
- Article-feed view per outlet and per journalist.

## v1.2 scope

- Bucketer signal adapter (read-only ingest of weekly inbound roundups → review queue).
- Article URL batch ingest with deterministic byline extraction.
- Confidence/freshness scoring on derived fields.

## v1.3 scope

- Tabulator tag bridge: read shared tag taxonomy, propose tags, never auto-write back without operator approval.
- TaskReckoner workflow ledger integration: outreach status changes recorded as TaskReckoner events.
- Optional ontology-core alignment for beat/topic taxonomy.

## v2 horizon

- Agent-assisted enrichment (deterministic adapters first, LLM-assisted second, both review-gated).
- Multi-operator collaboration on a shared local network.
- Optional Gmail-side outreach view (read-only first; sending stays out of scope until Bo says otherwise).

## Sevenfold-specific operating value

- **Per-client confidentiality is enforceable in schema**, not just convention. A client's pitch angles, exclusions, embargoes, and notes never sit on a global journalist record.
- **The journalist/outlet graph compounds** across clients. Verifying an outlet's beat for client A makes that fact available (with provenance) for client B; client A's *strategy* against that outlet does not.
- **Provenance is a first-class field**, matching Sevenfold's source-audit discipline (`02_source_audit/<slug>_Source_Audit.md`).
- **Approval gates are first-class**, matching the existing `09_approvals/<slug>_Approval_and_Fact_Check_Log.md` flow.
- **Campaign lists in BroadLister can replace** ad-hoc `06_media_lists/` spreadsheets without disrupting the existing client-folder pattern — they can export back to that folder.

## Design tenets

1. **Operator authority.** No automated outbound action. Every external-facing artifact is operator-approved.
2. **Provenance or it didn't happen.** A fact without a citation is a *proposal*, not a *fact*.
3. **Global facts are reusable; client strategy is not.** Schema enforces this separation.
4. **Boring stack first.** Same Fastify + Prisma + SQLite shape ProjectReckoner uses, so Codex / Hermes / Bo can navigate it without retraining.
5. **No coupling we don't yet need.** Bridges to Bucketer / Tabulator / TaskReckoner are designed-for-later, not built-on-day-one.
6. **Lawful-storage default.** Email and personal contact data only when sourced and lawful; otherwise stored as `unverified-proposal` or not at all.
