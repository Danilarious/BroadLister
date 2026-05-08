# BroadLister — Glossary

**Status:** planning, 2026-05-08

Definitions for the most-used terms across the BroadLister docs. When two terms could mean the same thing in casual speech but mean different things here, the entry calls that out.

## global record

A row on a global table (`Journalist`, `Outlet`, `Article`, `Affiliation`, `Byline`, `ContactMethod`, `Tag`, `Citation`, `ProvenanceLink`). Carries no `client_id`. Reusable across clients with provenance. Holds *facts*, never *opinions*.

## client overlay

A row on a client-scoped table (`Client`, `Campaign`, `CampaignList`, `CampaignContact`, `OutreachStatus`, `OutreachEvent`, `ClientNote`, `ClientTag`, `ClientApproval`). Always carries `client_id`. Holds opinions, strategy, and per-client state. Never visible across clients.

## campaign overlay

A subset of client overlay scoped to a specific `Campaign`. `CampaignList` and `CampaignContact` are campaign overlays. The narrative fit and per-row pitch angle live here.

## narrative fit

The operator's read of whether and how a journalist's coverage history can carry a particular client's narrative angle for a particular campaign. **Always overlay-scoped**, never global. In v1 stored as `CampaignContact.narrative_fit_json` with a versioned, validated shape.

## beat

A canonical, taxonomy-style coverage area for a journalist or outlet. `Tag(kind='beat')`. Small, stable list. New beats require operator review.

## topic

A more specific subject. May nest informally under a beat. `Tag(kind='topic')`. Allowed to grow; surfaces in tag hygiene reports.

## source

The thing that supports a fact: a URL, a CSV row, a Bucketer signal, a manual entry, a sheet row. Modeled as a `Citation`.

## citation

A first-class record of a source: `source_type`, `source_url` / `source_local_path`, `observed_at`, optional `payload_hash` of a cached snapshot. A `Citation` *exists*; a `ProvenanceLink` is what it *claims about* a target.

## provenance

The chain that connects a fact (a field on an entity) to one or more `Citation`s via `ProvenanceLink` rows, with `assertion_kind` (`supports | contradicts | proposes`) and `confidence`. "Provenance or it didn't happen."

## verification state

For a `ContactMethod`, one of `unverified | proposed | verified | revoked | known_invalid`. A contact method is **outreach-safe** only when `verified` AND `lawful_to_store=true` AND `verified_via_citation_id` is non-null.

## relationship status

The operator's read of where a (client × journalist) relationship sits. In v1 expressed via `OutreachStatus.state` (`none | planned | approved | contacted | replied | declined | hold | blacklisted_for_client`) and `OutreachStatus.relationship_warmth` (`unknown | cold | neutral | warm | hot`). **Always client-scoped.** Never a global property of the journalist.

## outreach-safe (a.k.a. `email_safe`)

A computed boolean per (campaign-contact × contact-method): the contact method is `verified`, `lawful_to_store`, has a `verified_via_citation_id`, the journalist is `merge_status='active'`, and the parent `CampaignContact` is `approval_state='approved'` under an `approved` `ClientApproval`. If any element is missing, the row is *draft*, not *outreach-safe*.

## campaign constraint

A campaign-level operational rule: approved messaging, forbidden claims, embargo, exclusivity, sequencing, outreach window, geographic constraint, sensitive topic, competitor conflict, approval requirement, source/fact-check requirement. In v1 stored as `Campaign.constraints_json`.

## exclusion

A per-(campaign × journalist or outlet) flag indicating "do not include in this campaign's outreach". Modeled as `CampaignContact.exclusion_flag` + `exclusion_reason`. **Always overlay-scoped.** A "do not pitch" judgment is never global.

## approval gate

A required operator decision before a state transition. Five named gates:

1. Architecture (Hermes General/default).
2. Domain (sevenfold).
3. Schema (Codex + Bo).
4. Safety (automated tests: cross-client leakage, lawful-storage default, no-outreach-side-effects).
5. Operator (Bo).

For data-level approvals (per §8 of the operational model), the gate is the operator clicking "approve" in BroadLister.

## review queue

The central operator surface for `ReviewItem` rows. Inputs from CSV import, URL ingest, future Bucketer/Tabulator bridges, and conflict detection all land here. Operator approves / rejects / merges. **Imports never write directly to global tables.**

## enrichment event

A *proposed* change to existing data sourced from an adapter (URL fetch, future twitter/x profile pull, future LinkedIn paste, etc.). Lands as a `ReviewItem` with `kind='enrichment'`. Never auto-applied.

## media list

A `CampaignList` row plus its `CampaignContact` rows. Exportable as CSV / markdown brief once approval gates pass. Maps to Sevenfold's existing `06_media_lists/<slug>/` filesystem location on export.

## source audit

A markdown + CSV export listing every `Citation` used to support a campaign's records during a date range. Maps to Sevenfold's existing `02_source_audit/<slug>_Source_Audit.md` shape.

## (and a few related-but-distinct terms worth disambiguating)

- **`OutreachEvent` vs `OutreachStatus`.** `OutreachEvent` is an append-only ledger row (a thing that happened). `OutreachStatus` is the most-recent rolled-up state for a (client × journalist).
- **Tag (global) vs ClientTag (overlay).** Different tables. Global tags are public/sourced and shareable; client tags are per-client annotations. They never mix.
- **Citation vs ProvenanceLink.** A `Citation` is the source object (one URL = one citation). A `ProvenanceLink` is "this citation supports this field on this entity". One citation can have many provenance links.
- **`merge_status` (global) vs relationship status (overlay).** `merge_status` is record lifecycle (`active`/`merged_into`/`deprecated`). Relationship status is per-client human judgment. They share neither values nor scope.
- **Verification (global) vs approval (overlay).** Verification is a property of a *fact* (does it have a citation; is the contact method real). Approval is a property of an *artifact* (was this list okayed by the client). A fact can be verified without being approved-for-outreach, and vice versa.
