# BroadLister — Operational Model & Boundaries

**Status:** planning, 2026-05-08
**Reads with:** every other doc in `docs/`. This doc is the binding scope sheet.
**Audience:** Codex (must read before implementation), Hermes General/default (architecture review), sevenfold (PR workflow realism review), Bo (final authority).

## 1. Purpose

This doc exists to keep BroadLister from drifting into one of the two failure modes that look attractive in code but ruin the product:

- **Generic-CRM drift.** Adding pipeline stages, lead scoring, sequences, deal records, "engagement velocity", workflow automations, and other ideas borrowed from sales tools. Sevenfold's work is *editorial relationship work*, not sales.
- **Autonomous-outreach drift.** Adding any feature that sends, schedules, queues for sending, or "prepares to send" a message to a journalist without an operator in the loop on every send. BroadLister is a workspace; it is not an actor.

Every implementation decision must pass these two checks:

1. Does this feature behave like *editorial PR work* a Sevenfold operator already does, just better organized? → likely OK.
2. Does this feature send, schedule, batch-send, or "tee up auto-send" any external message? → not allowed in any phase covered by these docs.

If a proposed feature can't fit cleanly under (1) without flirting with (2), it does not belong in BroadLister.

## 2. Core philosophy

- **Local-first media intelligence.** Single operator, single machine, one SQLite file. No cloud, no telemetry, no remote logs.
- **Provenance-aware relationship workspace.** Every fact is a triple: claim, citation, operator confidence. No fact without a citation reaches outreach prep.
- **Operator-controlled PR workflow tool.** The operator drives every state change that affects external-facing artifacts. Agents and adapters propose; operators decide.
- **Review-gated research and targeting environment.** Imports, enrichments, merges, and verifications all land in the review queue first. The queue is the spine, not a side feature.
- **Not a spam platform, CRM, or autonomous pitcher.** Stated negatively because the temptation to add "just a small sequence runner" is real. The answer is no.

## 3. Global / shared media intelligence

These facts are reusable across clients **with provenance**. They live on global tables (`Journalist`, `Outlet`, `Article`, `Affiliation`, `Byline`, `ContactMethod`, `Tag`, `Citation`, `ProvenanceLink`). They never carry `client_id`.

Safe to be global:

- **Journalist identity.** Display name, name variants, languages, primary affiliation pointer, public bio fragments — each with citation.
- **Outlet identity.** Name, slug, parent outlet, type, region, RSS feeds, public masthead notes — each with citation.
- **Outlet affiliation history.** Time-bounded `Affiliation` rows with role, start/end, citation.
- **Article / byline history.** `Article` + `Byline` rows. Public coverage record.
- **Beats and topics.** `Tag(kind='beat'|'topic')` linked via per-target join tables with per-link confidence and citation.
- **Public editorial focus.** Format / region / language / broad-tag descriptors that the journalist or outlet self-describes (mastheads, bios, "I cover X" statements). All cited.
- **Public / source-backed contact methods.** `ContactMethod` rows with `verification_state`, `lawful_to_store`, `verified_via_citation_id`. Defaults make new contact methods *not* outreach-safe until operator action.
- **Source URLs.** Every fact's underlying citation.
- **Social profiles only when sourced.** Twitter/X, LinkedIn, Mastodon, Bluesky, Threads, personal sites — only when present in a sourced bio, masthead, or operator-cited capture.
- **Verification state per contact method.** `unverified | proposed | verified | revoked | known_invalid`.
- **Freshness / confidence metadata per record and per field.** `Journalist.freshness_signal`, `Journalist.confidence_score`, plus per-`ProvenanceLink` confidence.
- **Provenance / citations.** All `Citation` and `ProvenanceLink` rows.
- **Dedupe / merge history.** `MergeEvent` rows are global because the entities they reference are global.

What does **not** belong globally:

- Any opinion about a journalist's *fit* for a client narrative.
- Any operator judgment about how warm/cold the relationship is.
- Any "do not pitch" / "loves exclusives" / "prefers data angles" annotation that is operator interpretation rather than a sourced public statement.
- Any embargo state, exclusion flag, or competitor-conflict note.

## 4. Client / campaign overlays

These are *opinions* and *strategy*, scoped per client (and usually per campaign). They live in overlay tables (`Campaign`, `CampaignList`, `CampaignContact`, `OutreachStatus`, `OutreachEvent`, `ClientNote`, `ClientTag`, `ClientApproval`, plus the new structures introduced below). They **always** carry `client_id`.

Belongs in client overlay (per client, optionally per campaign):

- **Pitch rationale.** Why this journalist is on this campaign list.
- **Campaign-specific target score.** 1–5 (or similar). Different campaigns score the same journalist differently.
- **Narrative fit.** Operator's read of fit between client narrative and journalist's coverage history.
- **Positioning notes.** How we plan to frame the story for this person.
- **Approved claims.** What the client has greenlit us to say at this stage.
- **Forbidden / not-yet-approved claims.** Claims we cannot use yet.
- **Legal sensitivities / compliance caveats.** Embargo until SEC clearance, NDA-bounded items, etc.
- **Embargo state.** `none | embargoed_until_<date> | exclusive_to_<list>`.
- **Exclusivity status.** Which campaign list / journalist gets first look.
- **Exclusions.** Operator-flagged "not for this client / campaign / launch".
- **Outlet sequencing.** Tier-1 first, then Tier-2; coordinated launch windows.
- **Outreach windows.** When this campaign can start contacting.
- **Follow-up status.** Queued, replied, declined, on hold for this campaign.
- **Relationship warmth for this client.** Per-(client × journalist) read; not a global truth.
- **Private notes.** Free-form operator notes scoped to the client.
- **Approval state.** `draft | approved | rejected_for_outreach`.
- **Any client-specific strategy.** Anything that would expose private positioning if leaked.

### Hard invariants

- **Client overlays must never leak across clients.** Schema separation + integration test starting in Phase 3.
- **Campaign lists reference, never duplicate.** `CampaignContact` carries FKs to global `Journalist` / `Outlet`. Operators do not copy global facts onto overlay rows.
- **Global tables never carry `client_id`.** CI guard in Phase 1.

## 5. Journalist status and relationship nuance

This is the area where generic-CRM drift is most tempting. We resist it by separating *facts* from *judgments* and by keeping subjective annotations overlay-scoped.

### Concept inventory (not a final enum list)

These concepts may appear in the system, in different scopes:

- `active`
- `monitor`
- `do_not_pitch`
- `cooldown`
- `needs_verification`
- `contact_unverified`
- `contact_verified`
- `prefers_email`
- `prefers_dm`
- `embargo_safe`
- `embargo_unknown`
- `hostile_or_sensitive`
- `previously_responsive`
- `low_fit`
- `relationship_warm`
- `intro_path_available`
- `no_crypto_pitches`
- `no_ai_pitches`
- `prefers_exclusives`
- `prefers_data_driven_angles`
- `timing_preference`
- `follow_up_fatigue`

### Where each concept lives

| Concept                        | Scope          | Reason                                                                                  | v1?  |
| ------------------------------ | -------------- | --------------------------------------------------------------------------------------- | ---- |
| `active` / `merge_status=active` | Global       | Lifecycle of the entity itself; not a relationship judgment.                            | yes  |
| `needs_verification`           | Global         | Property of the data record. Surfaces in review queue.                                  | yes  |
| `contact_unverified` / `contact_verified` | Global | `ContactMethod.verification_state`. Already in schema.                              | yes  |
| `monitor`                      | Client overlay | Per-client decision: "watch this person but don't pitch yet".                           | v1.1 |
| `do_not_pitch`                 | Client overlay | Per-client exclusion. Use `CampaignContact.exclusion_flag` + `exclusion_reason`.        | yes  |
| `cooldown`                     | Client overlay | Per-client + time-bound. Use `OutreachStatus.state='hold'` + `last_event_at`.           | yes  |
| `prefers_email` / `prefers_dm` | Hybrid         | If sourced from journalist's public bio: global, with citation. If operator inference: client overlay. | v1 (global only when sourced) |
| `embargo_safe` / `embargo_unknown` | Client overlay | Per-client, per-campaign judgment.                                                  | v1.1 |
| `hostile_or_sensitive`         | Client overlay | Operator judgment scoped per client. Never global.                                      | v1.1 |
| `previously_responsive`        | Derived (overlay) | Computed from `OutreachEvent` history per client. Not stored as a flag.              | v1.1 |
| `low_fit`                      | Campaign overlay | Computed/operator-assigned per campaign. Use `CampaignContact.target_score`.          | yes  |
| `relationship_warm`            | Client overlay | Operator's read per client. Use `OutreachStatus.state='approved'|'replied'` + a `relationship_warmth` overlay field.| v1.1 |
| `intro_path_available`         | Client overlay | Per-client; references `ClientNote` body.                                               | v1.1 |
| `no_crypto_pitches` / `no_ai_pitches` | Hybrid | If journalist publicly states it: global tag with citation. If operator inference: client overlay note. | v1 (global only when sourced) |
| `prefers_exclusives`           | Hybrid         | Same rule.                                                                              | v1.1 |
| `prefers_data_driven_angles`   | Hybrid         | Same rule.                                                                              | v1.1 |
| `timing_preference`            | Client overlay | Almost always operator-inferred per relationship.                                       | v1.1 |
| `follow_up_fatigue`            | Derived (overlay) | Computed from per-client outreach history.                                           | v1.1 |

### v1 status fields (lean)

For v1, only encode what is unambiguous and load-bearing:

**Global (already in schema):**
- `Journalist.merge_status` ∈ `active | merged_into | deprecated`.
- `ContactMethod.verification_state` ∈ `unverified | proposed | verified | revoked | known_invalid`.
- `Journalist.freshness_signal`, `Journalist.confidence_score` (advisory rollups).

**Overlay (already in schema):**
- `OutreachStatus.state` ∈ `none | planned | approved | contacted | replied | declined | hold | blacklisted_for_client`.
- `CampaignContact.exclusion_flag` + `exclusion_reason`.
- `CampaignContact.approval_state` ∈ `draft | approved | rejected_for_outreach`.

**v1 additions (small):**

- `Journalist.global_status_flags_json` — narrow JSON blob for **public, sourced** preferences only (e.g. `["prefers_email_for_pitches"]` when stated in a bio). Defaults `null`. Must point at a citation; UI rejects entries without one.
- `OutreachStatus.relationship_warmth` ∈ `unknown | cold | neutral | warm | hot`. Per-(client × journalist).
- `OutreachStatus.notes_private` already exists; documented as the home for any soft signal not yet warranting structured fields.

### What v1 does **not** add

- A general `Journalist.status` enum on the global record. Tempting, dangerous: invites cross-client opinion onto a shared row.
- A multi-axis preference matrix (channel × timing × topic). Defer; encode in `OutreachStatus.notes_private` until the shape is real.
- A computed engagement score. v1 surfaces raw history; no scoring.

### Important

> Most subjective relationship nuance is overlay-scoped, not global.
> Do not encode operator guesses as permanent global truth.

## 6. Narrative fit model

Narrative fit is the operator's read of *whether and how* a particular journalist's coverage history can carry a particular client's narrative angle. It is the most overlay-shaped concept in the system.

### What lives where

**Global:**
- Article / byline history.
- Beat / topic tag links with confidence and citation.
- Outlet's editorial focus (when sourced).

**Campaign overlay (per `CampaignContact`):**
- `narrative_angle` — the angle of *this campaign* (one or two sentences).
- `coverage_rationale` — why this journalist's prior coverage supports this angle (operator note).
- `evidence_byline_ids` — references to specific `Byline` / `Article` ids that ground the rationale.
- `likely_objections` — what we expect this journalist to push back on.
- `preferred_framing` — which angle to lead with, given this journalist.
- `competing_narratives` — other narratives this journalist has run that may conflict.
- `confidence` — operator's confidence in the fit, `low | medium | high`.
- `source_citations_json` — short list of citation ids backing the rationale (typically the same byline links used as evidence).
- `operator_notes` — free text.

### v1 representation

Keep it small and shippable:

- A single new column on `CampaignContact`: `narrative_fit_json` (TEXT). A versioned JSON blob containing the fields above, validated by a Zod schema in the service layer.
- An optional join-style note: when the operator tags a `Byline` as evidence, the join lives in `narrative_fit_json.evidence_byline_ids` (denormalized array). We do **not** introduce a separate `NarrativeFitEvidence` join table in v1. v1.1 may promote it if querying-by-evidence becomes a real workflow.

### Why JSON for now

- The shape will move during v1 use. JSON lets us iterate on the form without migration churn.
- The fields are mostly read in the side panel of one row at a time; we don't need to query across them in v1.
- v1.1 may promote any field with high query value (`confidence`, `evidence_byline_ids`) into structured columns once we know the shape.

### Hard rule

Narrative fit is **never** stored on the global `Journalist`. It is per (client × campaign × journalist). It does not leak into the cross-client view.

## 7. Campaign operational constraints

Campaigns carry constraints that affect *how* outreach can happen, distinct from *who* is targeted.

### Constraints to model

- **Approved messaging.** Lines / phrasings already cleared by the client.
- **Approved claims.** Specific facts/figures cleared as on-record.
- **Forbidden / not-yet-approved claims.** Items the operator must not use.
- **Legal / compliance caveats.** Securities-style "not an offer", competitive sensitivity, etc.
- **Embargo timing.** `embargo_until` already on `Campaign`; expand with `embargo_kind` and notes.
- **Exclusive status.** "Tier-1 exclusive to journalist X for 24 hours; Tier-2 follows".
- **Tiering and sequencing.** Per-list ordering; whose-pitch-goes-first.
- **Outreach windows.** When pitches may go out.
- **Spokesperson availability.** Window during which client founders/execs are reachable.
- **Geographic constraints.** Region-locked storylines (e.g. EU launch first).
- **Sensitive topics.** Topics to avoid in this campaign even if a journalist normally covers them.
- **Competitor conflicts.** Outlets / journalists with conflicts of interest for this client (e.g. journalist invested in a competitor).
- **Approval requirements.** Which artifacts require ClientApproval before export.
- **Source / fact-check requirements.** What level of provenance the client requires before lines go on record.

### v1 representation

These constraints are operational notes that change frequently per campaign. Same logic as narrative fit:

- A new `Campaign.constraints_json` column holding a versioned JSON blob with the fields above, schema-validated.
- The `Campaign.embargo_until` column **stays** as a structured column (it's queried for visibility filters).
- A new `Campaign.constraints_required` boolean defaulting `false`. When `true`, exports require the constraints panel to be filled before producing an outreach-ready brief.

### v1 UI obligation

A **Campaign constraints panel** in the campaign workspace, with structured slots for each constraint above. v1 ships this panel even if the underlying storage is JSON; UI is what makes the constraints visible during list-building.

### Where constraints go on individual rows

Some constraints flow to `CampaignContact` as overrides — e.g. a Tier-1 exclusive may be enforced via a `CampaignContact.exclusivity_window` field within the `narrative_fit_json`. Don't add many top-level columns; let the JSON carry it for v1.

### Hard rule

> Campaign constraints belong to campaign / client overlay records, not global journalist records.

## 8. Human approval requirements

Actions that **always** require operator approval:

- **Exporting media lists** (any format).
- **Changing verification status** of a contact method (`unverified` → `verified`).
- **Approving enriched contact data** from imports / adapters.
- **Merging journalist identities** (or outlet identities).
- **Deleting provenance.** (Citations / ProvenanceLinks are append-only by default; deletion is operator-initiated and logged.)
- **Marking a relationship state canonical.** Setting `OutreachStatus.state` to anything stronger than `none` / `planned`.
- **Moving a contact to outreach-ready status.** `CampaignContact.approval_state` → `approved`.
- **Generating outreach-ready sheets / briefs.** Final exports trip a `ClientApproval` requirement.
- **Any outbound messaging.** N/A in BroadLister; if such a feature is ever proposed, see §10 deferrals.

UI surfaces missing approvals as a banner, not silent. If the gate isn't met, the action button is disabled with a hover hint explaining what's missing.

## 9. Export philosophy

Exports are **operator-facing artifacts**. They are *never* automation triggers.

### v1 export shapes

1. **Media list CSV.** Per `CampaignList`. Columns include: display name, primary outlet, beats, contact-readiness, provenance summary, `email_safe`, target score, narrative-fit summary (from JSON), exclusion flag, embargo note. Every row carries provenance-summary so the recipient sees *why*.
2. **Source audit doc** (markdown + CSV). Per client and date range. Lists every `Citation` used to support the campaign's records. Maps to Sevenfold's existing `02_source_audit/<slug>_Source_Audit.md` shape.
3. **Campaign targeting sheet.** Slimmed media list with target score and narrative angle visible. Suitable for client review.
4. **Briefing packet** (markdown). Per campaign. Embeds: campaign objective, constraints panel snapshot, list summaries, sourcing notes, approval log.
5. **Approval / fact-check log.** Per client, list of `ClientApproval` rows with decisions and notes. Maps to `09_approvals/<slug>_Approval_and_Fact_Check_Log.md`.
6. **Outreach-prep export.** A flat document (CSV + brief MD) for one approved list, intended to be the operator's working file when they execute outreach by hand.

### Hard rules

- An export marked "outreach-ready" requires every gate from §8 to be green.
- A draft export is always allowed but clearly labeled `DRAFT — NOT FOR OUTREACH`.
- Exports include a `generated_at` and the operator id.
- Exports never include another client's overlay data, ever.

## 10. Future / deferred concepts

These concepts are explicitly **out of scope** for the phases covered in `BROADLISTER_IMPLEMENTATION_ROADMAP.md`:

- **Automated outreach.** Not in any phase.
- **Gmail send / sync flows.** Not in any phase. (Read-only Gmail thread inspection might be considered in v2 with explicit Bo approval; not before.)
- **Autonomous journalist scoring.** Out of scope. v1 has operator scoring.
- **Large-scale scraping.** Out of scope. v1 fetches one URL at a time with politeness rules.
- **Social graph inference** (who-knows-whom). Out of scope.
- **Sentiment analysis** of articles. Out of scope.
- **Distributed multi-user sync.** Out of scope. Single operator on one machine.
- **Agent-owned campaign execution.** Out of scope. Agents propose; operators decide.
- **Automatic follow-up scheduling.** Out of scope. The system records, it does not schedule sends.

If any of these become live needs, they require a fresh planning pass, an architecture review by Hermes General/default, a domain review by sevenfold, and Bo's explicit approval. They do not slip in as "small" features.

## 11. Codex implementation implications

What Codex must do (and not do) when starting implementation:

### Must do

- **Keep the v1 schema small.** Add only what is necessary. Use JSON columns (`narrative_fit_json`, `constraints_json`, `global_status_flags_json`) where the shape is still moving.
- **Include enough fields for v1 operator reality:**
  - relationship status: `OutreachStatus.relationship_warmth`,
  - narrative fit: `CampaignContact.narrative_fit_json`,
  - campaign constraints: `Campaign.constraints_json` + `Campaign.constraints_required`,
  - global sourced preferences: `Journalist.global_status_flags_json` (citation-required).
- **Implement the cross-client leakage test in Phase 3** as a true integration test, not a TODO. Failing the test blocks the build.
- **Preserve provenance fields.** Citations are append-only by default. Manual operator edits create a `manual_entry` citation per §6 of `BROADLISTER_PROVENANCE_AND_VERIFICATION.md`.
- **Keep subjective / contextual PR notes out of global records** unless clearly public and sourced. Schema and service layer must reject attempts to write opinion onto global tables.
- **Add the dependency deny-list test.** Build fails if the API package's resolved tree contains a known sender (`nodemailer`, `@sendgrid/mail`, `mailgun.js`, `@aws-sdk/client-ses`, etc.).

### Must not do

- Do **not** add a global `Journalist.status` enum. Resist the symmetry; status is a relationship judgment, not a record property.
- Do **not** introduce a "sequence" / "cadence" / "campaign step" concept. That is sales-tool DNA and outside the scope of every phase in the roadmap.
- Do **not** add a global "do not contact" flag. Use `CampaignContact.exclusion_flag` per client.
- Do **not** prematurely promote `narrative_fit_json` fields into columns until v1 use shows which fields are query-relevant.
- Do **not** embed any send-side dependency, even disabled. Absence is the enforcement.
- Do **not** auto-fill `relationship_warmth` based on event history in v1. Operators set it explicitly. v1.1 may add a derived suggestion, but the operator-set value always wins.

### Phase 0 closeout obligations (read this whole doc first)

Codex must, before producing the Phase 1 plan, confirm in writing:

1. Global vs overlay field separation is understood and enforced.
2. The v1 status fields are exactly the lean set in §5.
3. Narrative fit is JSON (with schema validator) on `CampaignContact`, not a separate table in v1.
4. Campaign constraints are JSON on `Campaign` plus the `embargo_until` and `constraints_required` columns.
5. The cross-client leakage test will be implemented in Phase 3 as a real test, not a TODO.
6. The dependency deny-list test will be implemented in Phase 1.

---

## Bottom line

BroadLister has the discipline of a research workspace, the schema of a relationship database, and the boundaries of a bounded internal tool. This document is what keeps those three from drifting toward CRM, scraper, or outreach platform shapes.

When in doubt, re-read §10 first.
