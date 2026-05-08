# BroadLister — Entity Model

**Status:** planning, 2026-05-08

This document is the canonical entity vocabulary. The concrete schema lives in `BROADLISTER_SCHEMA_DRAFT.md`. Tagging detail lives in `BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md`. Provenance detail lives in `BROADLISTER_PROVENANCE_AND_VERIFICATION.md`.

## Two-tier model

BroadLister has two logical tiers, refined here in light of `BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md`:

1. **Global media graph** — public, sourced facts about journalists, outlets, articles, beats, contact methods. Reusable across clients with provenance. **Holds facts, never opinions.** Never contains client strategy, narrative fit, exclusion judgments, or relationship warmth.
2. **Client overlay** — per-client opinion on the global graph: campaigns, lists, target scoring, narrative fit, campaign constraints, exclusions, embargoes, outreach status, relationship warmth, client-private notes. **Holds opinions and strategy.** Never visible across clients. Narrower scope when the row also belongs to a campaign (campaign overlay).

The implication: subjective relationship judgments — "warm with this client", "do not pitch this campaign", "loves data angles for our narrative" — are **always overlay-scoped**, even when they feel like properties of the journalist. They are properties of the *(client × journalist)* or *(campaign × journalist)* relationship.

```
              ┌─────────────────────────────────────────────────┐
              │                GLOBAL MEDIA GRAPH                │
              │  Journalist  ↔  Affiliation  ↔  Outlet           │
              │      │                            │              │
              │      └─── Byline ── Article ──────┘              │
              │             │           │                        │
              │             ▼           ▼                        │
              │           Tag (beat / topic / format / region)   │
              │             │                                    │
              │             └── Citation (source URL + state)    │
              │                                                  │
              │           ContactMethod (verified / proposed)    │
              └─────────────────────────────────────────────────┘
                                  │
            ┌─────────────────────┴────────────────────┐
            ▼                                          ▼
   ┌────────────────────┐                    ┌────────────────────┐
   │ CLIENT A OVERLAY   │                    │ CLIENT B OVERLAY   │
   │ Campaigns          │                    │ Campaigns          │
   │ CampaignLists      │                    │ CampaignLists      │
   │ CampaignContacts   │                    │ CampaignContacts   │
   │  (+ score, notes,  │                    │  (+ score, notes,  │
   │   exclusion, ...)  │                    │   exclusion, ...)  │
   │ OutreachEvents     │                    │ OutreachEvents     │
   │ ClientNotes        │                    │ ClientNotes        │
   └────────────────────┘                    └────────────────────┘
```

## Global entities

### `Journalist`

A person who has written or is associated with media coverage.

Identity:
- `id` (uuid)
- `display_name` (canonical render)
- `name_variants` (array; e.g. nicknames, byline forms)
- `primary_affiliation_id` → `Outlet` (optional; the outlet they are most associated with *now*)
- `merge_status` (`active` | `merged_into` with pointer | `deprecated`)

Public attributes (verified or proposed; each fact carries provenance):
- `bio_short`
- `home_country` / `home_region` (only when sourced)
- `language(s)`
- `external_handles`: `{ twitter_x, linkedin, mastodon, bluesky, threads, personal_site }` — each with provenance
- `global_status_flags_json` — narrow JSON blob holding **public, sourced** preferences only (e.g. `["prefers_email_for_pitches"]` when stated in a bio, `["no_crypto_pitches"]` when stated publicly). Each entry is rejected by the service layer unless a citation is attached. Defaults `null`.

Out of scope on this entity (these are overlay-scoped, see below): "do not pitch", relationship warmth, "low fit", exclusions, embargo state, hostile/sensitive flags, narrative-fit notes, intro paths, follow-up fatigue.

Lifecycle:
- `created_at`, `updated_at`
- `freshness_signal` (most recent byline date, last verification date)
- `confidence_score` (derived; not authoritative)

Notes:
- A journalist can have multiple historical outlets via `Affiliation`. The `primary_affiliation_id` is a denormalized convenience pointer for UI.
- All fields except `id`, `display_name`, `created_at`, `merge_status` are *optional* and can be marked `unverified-proposal`.

### `Outlet`

A publication, podcast, newsletter, or media organization.

- `id`
- `name`
- `slug`
- `parent_outlet_id` (e.g. `The Verge` parent → `Vox Media`)
- `outlet_type` (`newspaper | magazine | digital | newsletter | podcast | tv | radio | wire | trade | blog | substack | youtube | other`)
- `home_url`
- `rss_feeds` (array)
- `region` / `country`
- `language(s)`
- `notes_public` (provenance-backed public summary)
- `merge_status`
- timestamps + freshness

### `Affiliation`

A time-bounded link between `Journalist` and `Outlet`.

- `id`
- `journalist_id`
- `outlet_id`
- `role` (`staff | contributor | freelance | columnist | editor | host | producer | guest | other`)
- `start_date`, `end_date` (nullable)
- `is_current` (denormalized boolean for query speed)
- provenance

### `Article`

A specific piece of coverage.

- `id`
- `url` (canonicalized)
- `url_canonical` (after canonicalization rules; unique key)
- `title`
- `published_at`
- `outlet_id`
- `byline_text` (raw byline string as captured)
- `language`
- `excerpt` (operator-curated or extracted)
- `tags` (M2M)
- `fetched_at`, `fetch_etag`, `fetch_hash`
- provenance (always)

### `Byline`

A link between `Article` and `Journalist`. (Articles can have multiple authors; journalists can have many articles.)

- `id`
- `article_id`
- `journalist_id`
- `position` (author order)
- `confidence` (`high | medium | low`) — extraction may be ambiguous
- provenance

### `Beat` / `Topic`

A subject-matter classification. Modeled as a sub-type of `Tag` (see tagging doc) with `kind = 'beat'` or `kind = 'topic'`.

### `Tag`

A unified tag table covering beats, topics, formats, regions, broad/specific tags, and Tabulator-bridge tags. See `BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md` for the kind taxonomy.

### `ContactMethod`

A way to reach a journalist (or, more rarely, an outlet).

- `id`
- `subject_type` (`journalist | outlet`)
- `subject_id`
- `kind` (`email | phone | dm_handle | tipline | form_url | mail`)
- `value` (normalized)
- `value_hash` (for dedupe)
- `verification_state` (`unverified | proposed | verified | revoked | known_invalid`)
- `lawful_to_store` (boolean; jurisdiction-conscious; defaults false until reviewed)
- `verified_at`, `verified_by` (operator), `verified_via_citation_id`
- provenance
- `is_primary` (per kind)

### `Citation`

A source for a fact. Polymorphic.

- `id`
- `source_url` (or local file ref / artifact ref)
- `source_type` (`url | csv_import | bucketer_signal | tabulator_artifact | manual_entry | sheet_row | api`)
- `observed_at`
- `captured_by` (operator id; v1 has one operator)
- `notes`
- `payload_hash` (content-addressed snapshot pointer if cached)

### `ProvenanceLink`

Many-to-many between `Citation` and any other entity/field (since one citation can support multiple facts, and one fact can be supported by multiple citations).

- `id`
- `citation_id`
- `target_type` (entity name)
- `target_id`
- `target_field` (e.g. `Journalist.bio_short`, `Affiliation.role`, `ContactMethod.value`)
- `assertion_kind` (`supports | contradicts | proposes`)
- `confidence` (`high | medium | low`)

### `ReviewItem`

A pending change waiting for operator approval.

- `id`
- `kind` (`new_journalist | merge | enrichment | new_byline | new_contact | bulk_import_row | ...`)
- `status` (`pending | approved | rejected | superseded`)
- `proposal_payload` (json: the change as it would apply)
- `current_payload` (json: the relevant current snapshot)
- `source_citation_id`
- `created_at`, `decided_at`, `decided_by`, `decision_note`

### `MergeEvent`

History of journalist/outlet merges so they can be traced and (best-effort) inspected.

- `id`
- `entity_type`
- `merged_from_id`
- `merged_into_id`
- `merge_strategy` (`field_priority | manual_pick | external_id_match`)
- `field_resolutions` (json)
- `created_at`, `created_by`
- `reversible_until` (optional)

## Client-overlay entities

These are physically separate tables and **always** carry a `client_id`.

### `Client`

- `id`
- `slug` (matches `agents/sevenfold/clients/<slug>/`)
- `display_name`
- `archived_at`

### `Campaign`

A bounded engagement for a client.

- `id`
- `client_id`
- `name`
- `slug`
- `objective_short`
- `embargo_until` (optional)
- `state` (`draft | active | paused | closed`)
- `start_date`, `target_end_date`
- `lead_operator`
- `constraints_json` — versioned JSON blob holding campaign operational constraints: approved_messaging, approved_claims, forbidden_claims, legal_caveats, embargo_kind, exclusivity_plan, tiering_and_sequencing, outreach_windows, spokesperson_availability, geographic_constraints, sensitive_topics, competitor_conflicts, approval_requirements, source_fact_check_requirements. Validated by Zod in the service layer.
- `constraints_required` (bool, default `false`) — when `true`, exports require the constraints panel to be filled before producing an outreach-ready brief.

### `CampaignList`

A specific media list within a campaign. A campaign can have multiple lists (e.g. "Tier 1 trade press", "Crypto generalists", "Founder-friendly podcasts").

- `id`
- `campaign_id`
- `name`
- `description`
- `state`

### `CampaignContact`

The overlay for a journalist (and/or outlet) on a list. **This is the per-client opinion layer.**

- `id`
- `campaign_list_id`
- `journalist_id` (nullable if the list entry is outlet-only)
- `outlet_id` (nullable if journalist-only)
- `target_score` (operator score, e.g. 1–5)
- `target_rationale` (client-private)
- `pitch_angle` (client-private)
- `suitability_note` (client-private)
- `exclusion_flag` (boolean) + `exclusion_reason`
- `embargo_note`
- `approval_state` (`draft | approved | rejected_for_outreach`)
- `narrative_fit_json` — versioned JSON blob holding: `narrative_angle`, `coverage_rationale`, `evidence_byline_ids` (array of `Byline.id`), `likely_objections`, `preferred_framing`, `competing_narratives`, `confidence` (`low|medium|high`), `source_citations_json` (citation ids), `operator_notes`, `exclusivity_window` (optional). Schema-validated.
- `added_at`, `added_by`

### `OutreachStatus`

Per-(client × journalist), most-recent state of the relationship. **This is where journalist relationship status lives** — it is overlay-scoped and never global.

- `id`
- `client_id`
- `journalist_id`
- `state` (`none | planned | approved | contacted | replied | declined | hold | blacklisted_for_client`)
- `relationship_warmth` (`unknown | cold | neutral | warm | hot`) — operator-set; v1 does not auto-derive from event history.
- `last_event_at`
- `notes_private` — home for any soft signal not yet warranting structured fields (cooldown timing, intro path notes, follow-up fatigue, etc.).

### `OutreachEvent`

Append-only ledger of relationship events.

- `id`
- `client_id`
- `journalist_id`
- `campaign_id` (nullable)
- `kind` (`note | planned | approved_for_outreach | contacted | replied | declined | meeting_held | coverage_published | retracted`)
- `channel` (`email | call | event | dm | other`) — recorded, **not** executed
- `summary_private`
- `external_ref` (e.g. coverage URL → could promote to `Article`)
- `created_at`, `created_by`

### `ClientNote`

Free-form private notes scoped to a client and optionally to a journalist/outlet/campaign.

- `id`
- `client_id`
- `journalist_id` / `outlet_id` / `campaign_id` (nullable)
- `body_md`
- `created_at`, `created_by`

### `ClientTag`

A client-specific tag overlay (e.g. "Trace-friendly", "Avoid: Q2 2026 due to embargo"). Distinct from global `Tag` so it cannot leak.

- `id`
- `client_id`
- `name`
- `kind` (`relationship | suitability | risk | embargo | other`)

### `ClientApproval`

Approval gate for any client-scoped artifact (campaign list, contact set, message draft).

- `id`
- `client_id`
- `subject_type`
- `subject_id`
- `state` (`pending | approved | rejected | revoked`)
- `decided_by`, `decided_at`, `note`

## Global vs client-scoped — invariants

These are *enforced* invariants the schema must protect (see schema doc for indexes/constraints):

1. **No client_id on global tables.** `Journalist`, `Outlet`, `Article`, `Byline`, `Affiliation`, `ContactMethod`, `Tag`, `Citation`, `ProvenanceLink` never carry `client_id`.
2. **All overlay tables carry `client_id`** and never expose private fields in cross-client query helpers.
3. **Campaign lists reference, never duplicate.** `CampaignContact` holds an FK to `Journalist` / `Outlet`. Operator never copies global facts onto the overlay row.
4. **Client tags are distinct table.** No way to write a `ClientTag` onto `Journalist.tags`.
5. **Outreach is recorded, not executed.** `OutreachEvent.channel` is metadata; no adapter sends.
6. **Lawful-storage default off.** New `ContactMethod` rows default `lawful_to_store = false`. Operator action required to flip it.
7. **No global journalist relationship status.** Relationship state lives only on `OutreachStatus` (per client) and `CampaignContact` (per campaign). The global `Journalist` row carries record lifecycle (`merge_status`) and sourced public preferences (`global_status_flags_json`, citation-required) — nothing else.
8. **Narrative fit is overlay-scoped.** Lives only on `CampaignContact.narrative_fit_json`. Never on the global record.
9. **Campaign constraints are campaign-scoped.** Live only on `Campaign.constraints_json`. Never on the global record.

## Where journalist status lives — quick map

| Concept                           | Table → Field                                         | Scope          | v1?  |
| --------------------------------- | ----------------------------------------------------- | -------------- | ---- |
| Record lifecycle                  | `Journalist.merge_status`                             | Global         | yes  |
| Public sourced preferences        | `Journalist.global_status_flags_json` (cite required) | Global         | yes  |
| Contact verification              | `ContactMethod.verification_state`                    | Global         | yes  |
| Outreach status (per client)      | `OutreachStatus.state`                                | Client overlay | yes  |
| Relationship warmth (per client)  | `OutreachStatus.relationship_warmth`                  | Client overlay | yes  |
| Soft notes (cooldown, intro path) | `OutreachStatus.notes_private`                        | Client overlay | yes  |
| Per-campaign exclusion            | `CampaignContact.exclusion_flag` + `exclusion_reason` | Campaign overlay | yes |
| Per-campaign target score         | `CampaignContact.target_score`                        | Campaign overlay | yes |
| Per-campaign approval to pitch    | `CampaignContact.approval_state`                      | Campaign overlay | yes |
| Narrative fit                     | `CampaignContact.narrative_fit_json`                  | Campaign overlay | yes |
| Campaign operational constraints  | `Campaign.constraints_json`, `Campaign.embargo_until` | Campaign overlay | yes |
| Auto-derived warmth               | (computed from events)                                | Overlay         | v1.1 |
| Multi-axis preference matrix      | (channel × timing × topic)                            | Overlay         | deferred |

## Dedupe / merge model

### Journalist dedupe

Strong matchers (any one is sufficient for an *auto-proposal* to review queue):

- Same `email` (verified) ContactMethod.
- Same external handle on `linkedin` or `twitter_x` (normalized).
- Same `name + outlet + first byline date` triple within tolerance.

Weak matchers (combine multiple before proposing):

- Same display name + same primary outlet.
- Same display name + overlapping beat tag set + nearby region.
- Name token Jaccard ≥ threshold + outlet overlap.

A weak match never auto-merges. It produces a `ReviewItem(kind='merge')`.

### Outlet dedupe

- Same `home_url` host (normalized).
- Same canonical name + country.
- Known parent/child relationships are *not* merges; they go in `parent_outlet_id`.

### Article dedupe

- Same `url_canonical`.
- Same `outlet_id + title + published_at` within tolerance (handles edited URLs).

### Merge resolution

When approved, `MergeEvent` records:

- which entity won (usually the older / better-cited record),
- per-field decisions (kept, replaced, conflicted-but-kept-with-note),
- redirects: queries against the merged-from id transparently route to merged-into.

### Reversibility

Merges are *soft*: the merged-from record stays with `merge_status = 'merged_into'` and `merged_into_id`. We do not destructively delete the original until Bo says otherwise. `reversible_until` is optional metadata for ops.

## Confidence / freshness / provenance fields (universal)

Every fact-bearing field on a global entity should be queryable along three axes:

1. **Provenance:** at least one `Citation` via `ProvenanceLink`, or marked `unverified-proposal`.
2. **Confidence:** derived from the strongest supporting `ProvenanceLink.confidence` minus contradicting links. Stored as `high | medium | low` per field, recomputed on write.
3. **Freshness:** `last_observed_at` per field; defaults to the `Citation.observed_at` of the strongest supporting link.

For ergonomics, journalists and outlets have a denormalized `freshness_signal` and `confidence_score` rolled up across their key fields. These are advisory only — the per-field values are the truth.

## Why this shape

- **Two-tier separation** is the only structural way to make "no cross-client leakage" enforceable without trusting humans to remember.
- **Polymorphic citations** keep provenance uniform across journalist bio fields, contact methods, byline links, etc.
- **Review queue is first-class**, mirroring how Sevenfold already operates (`02_source_audit/`, `09_approvals/`).
- **Merges are events, not destructive ops**, so the audit trail mirrors how PR/comms teams already think about source corrections.
- **Outreach is a ledger**, matching TaskReckoner's actor/assignment/run-ledger MVP, so the future bridge is one-shaped to an existing target.
