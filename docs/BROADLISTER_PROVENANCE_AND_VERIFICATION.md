# BroadLister — Provenance & Verification

**Status:** planning, 2026-05-08

This document defines how BroadLister captures, stores, and uses **citations**, **verification states**, and **conflict resolution** so that no fact about a journalist or outlet enters outreach prep without traceable support.

## Source of inspiration

- Sevenfold's existing source-audit discipline: `clients/<slug>/02_source_audit/<slug>_Source_Audit.md`.
- ProjectReckoner's OpenClaw context-sync packet shape (which makes provenance a top-level, required field with `source_system`, `observed_at`, `trace_id`, `explanation`, `source_of_truth`).
- Tabulator's research-artifact protocol (`#pkb` marker, `research_brief`, `source_pack`).
- The principle that every emitted signal should carry ≥ 1 citation, lifted from Tabulator's adapter architecture.

BroadLister doesn't depend on those systems at runtime in v1, but we adopt their discipline.

## Citation model

```
                        ┌──────────────────┐
                        │     Citation     │
                        │ (the source)     │
                        └─────────┬────────┘
                                  │
                                  │ 1..n
                                  ▼
                  ┌─────────────────────────────┐
                  │      ProvenanceLink         │
                  │  one citation → one target  │
                  │  (target may be a field)    │
                  └─────────────────────────────┘
                                  │
              ┌───────────────────┼────────────────────┐
              ▼                   ▼                    ▼
        Journalist            Outlet               Article / Byline /
        (.bio_short,          (.notes_public,      Affiliation /
         .home_country,        .region, ...)       ContactMethod / Tag link
         .external_handles,
         topic tags, ...)
```

A `Citation` is **the source itself** — a URL, a CSV row, a Bucketer signal, a manual entry.
A `ProvenanceLink` is **what the source claims**, attached to a specific entity or field.

### Citation fields

- `source_type` ∈ `url | csv_import | bucketer_signal | tabulator_artifact | manual_entry | sheet_row | api`
- `source_url` (if applicable)
- `source_local_path` (if a local artifact / cached file)
- `observed_at` — when *we* observed the source. Distinct from any internal "published_at" of the cited content.
- `captured_by` — operator id (single op in v1, but field is permanent).
- `notes` — free text.
- `payload_hash` — SHA256 of a cached snapshot of the source, when caching is feasible. Enables offline re-inspection and proves the source didn't silently change.

### ProvenanceLink fields

- `citation_id` → `Citation`
- `target_type` — `Journalist | Outlet | Article | Byline | Affiliation | ContactMethod | JournalistTag | OutletTag | ArticleTag`
- `target_id`
- `target_field` — optional; e.g. `bio_short`, `home_country`, `value` (for ContactMethod), or `topic:stablecoins` (for tag link)
- `assertion_kind` ∈ `supports | contradicts | proposes`
- `confidence` ∈ `high | medium | low`

### Worked examples

- A New York Times byline page is fetched. → `Citation(source_url=<page>, source_type='url', observed_at=now)`. From that citation we make `ProvenanceLink`s: one per byline (target=`Byline.id`, supports), one for journalist's affiliation if visible (target=`Affiliation.id`, supports, confidence=`high`), one for any topic tag visible from headline/section (target=`JournalistTag.id`, supports, confidence=`medium`).
- A CSV import row claims "Jane Doe, jane@example.com, Bloomberg, crypto-policy". → `Citation(source_type='csv_import', source_local_path=batch-file)`. Provenance links propose journalist row, contact method, affiliation, beat tag — all `assertion_kind='proposes'` until operator approves.

## Verification states (per `ContactMethod`)

`ContactMethod.verification_state`:

- `unverified` — present, no positive verification.
- `proposed` — supplied via import or extraction; awaiting operator review.
- `verified` — operator has confirmed via a defensible source.
- `revoked` — previously verified, now known stale (e.g. journalist moved outlets).
- `known_invalid` — confirmed wrong (bounce, public correction).

A `ContactMethod` is **safe to use in outreach prep** only when:
1. `verification_state = 'verified'`, AND
2. `lawful_to_store = true`, AND
3. `verified_via_citation_id` is non-null (we know how it was verified).

UI never surfaces unverified emails as "ready to use". They are visible as proposals only.

### `lawful_to_store`

Default `false`. Set to `true` only when:

- Source is publicly published (e.g. masthead, professional profile, journalist's own bio).
- Or: the journalist supplied it directly (e.g. a reply, an event card).
- Or: the data was acquired from a service whose terms permit retention (case-by-case, operator-reviewed).

Sources that **do not** count:

- Email scraped from non-public origin.
- Database leaks.
- Scraped patterns from internal corporate directories.
- Aggregator services without licensing alignment.

When in doubt, leave `lawful_to_store = false`. The system stores the row but treats it as proposal-only and never exports it.

## Verification states for non-contact facts

Non-contact facts (bio fragments, beat tags, current affiliation) carry implicit verification through the `ProvenanceLink.confidence` distribution. We compute a per-field rollup:

- `verified` — at least one `ProvenanceLink(supports, high)` and no `ProvenanceLink(contradicts, *)`.
- `corroborated` — multiple `supports` of any confidence.
- `proposed` — only `proposes` links (often from imports).
- `contradicted` — has at least one `contradicts` link unresolved.

This rollup is computed on read for the contact panel UI. It is not stored on the entity.

## Verification rules for status, social profiles, and narrative fit

These are common edge cases where operators are tempted to "just write something" without a citation. Explicit rules:

### Social profiles (Twitter/X, LinkedIn, Mastodon, Bluesky, Threads, personal site)

- A social handle on a global `Journalist` row requires a `Citation` whose `source_url` is one of:
  - the journalist's own published bio (outlet masthead, personal site),
  - a verified outlet's masthead,
  - a sourced article byline page that lists the handle,
  - operator paste with a `manual_entry` citation **and** a screenshot/snapshot in the cache.
- A social handle entered without a citation lands in the review queue as a `ReviewItem(kind='enrichment')`. UI makes "save" require a citation form for new handles on saved records.
- The handle is treated as `proposed` until a citation links it.

### `Journalist.global_status_flags_json` entries

- Every entry **must** have a citation. The service-layer validator rejects writes otherwise.
- Citation must be a `source_url` showing the journalist publicly stating the preference (e.g. "I only take pitches by email").
- The flags are limited to a documented allow-list (`prefers_email_for_pitches`, `prefers_dm_for_pitches`, `no_unsolicited_pitches`, `no_crypto_pitches`, `no_ai_pitches`, `prefers_exclusives`, `prefers_data_driven_angles`). New flag values require a docs change, not a one-off insert.

### Relationship status (per client)

- Relationship status (`OutreachStatus.state`, `OutreachStatus.relationship_warmth`) is **operator judgment**, not a sourced fact. It does not require a citation.
- Treat it as an opinion field. It is never displayed as "verified". The UI labels it as the operator's read.
- Changing it from `none` / `planned` to anything stronger goes through the operator approval gate (§8 of the operational model).

### Narrative fit

- Narrative fit (`CampaignContact.narrative_fit_json`) is also operator judgment. No citation requirement on the overall blob.
- However, the `evidence_byline_ids` array references global `Byline` rows; those bylines must exist and be cited. Service layer validates that referenced byline ids resolve to active records.
- The `source_citations_json` array references global `Citation` rows; those citations must exist.
- Narrative fit is never marked `verified`. UI labels it as the operator's read, with confidence (`low|medium|high`) shown.

### Distinguishing sourced public facts from operator judgment

This is the dividing line:

- **Sourced public fact** → eligible to live globally. Requires a `Citation` with `source_url` (or local artifact path). UI shows it with a verification rollup.
- **Operator judgment** → lives only in overlay tables (`OutreachStatus`, `CampaignContact`, `ClientNote`, `ClientTag`). UI labels it as opinion. No verification rollup.

The service layer enforces this by rejecting any write to a global table that lacks the corresponding `ProvenanceLink` for fields that are configured as "fact" fields (per a per-field allow-list in `core/`).

## Article-derived metadata

When an article URL is ingested, we extract (deterministically; no LLM in v1):

- `title` — from `<title>`, `og:title`, or JSON-LD `headline`.
- `published_at` — from `article:published_time`, JSON-LD `datePublished`, or visible byline date.
- `byline_text` — from `article:author`, JSON-LD `author`, or known per-outlet byline selectors.
- `language` — from `<html lang>`.
- `excerpt` — from `og:description` or first paragraph.

Each extracted field becomes a `ProvenanceLink(supports, confidence based on extractor strength)` to the `Article` record (and to any inferred `Byline`).

Per-outlet extraction recipes are kept in `adapters/url-fetch/recipes/<host>.ts`. If no recipe matches, we fall back to generic extractors and mark resulting links `confidence='low'`.

We **do not** apply heuristic name-disambiguation (e.g. "is this 'J. Smith' the same as 'Jane Smith'?") at ingestion. Disambiguation is a review-queue decision.

## Manual overrides

Operator can **edit any field** through the UI. When that happens:

- The edit creates a synthetic `Citation(source_type='manual_entry', captured_by=operator_id, notes=edit_reason)`.
- The existing field value is replaced; the prior value is recorded in the `Citation.notes` if material.
- Prior `ProvenanceLink`s for that field are **not deleted** — they stand as historical claims. The new manual link wins on confidence rollup.

This means the audit log of what we believed and why is recoverable even after an operator override.

## Conflict resolution

A conflict exists when two citations make incompatible claims about the same field (e.g. two affiliations that overlap in time, two different bio_short statements).

Resolution flow:

1. **Detect**: on insert, the service layer checks for value mismatches against existing high-confidence supports for the same field/entity.
2. **Materialize**: if mismatch, create a `ReviewItem(kind='conflict', proposal_payload=new_value, current_payload=existing_value)` rather than overwriting.
3. **Operator decides**: keep one, take both (e.g. multiple bio sources), mark one `contradicts`, or write a manual override that supersedes both.
4. **Record**: the chosen path is captured as new `ProvenanceLink`s and (if applicable) a manual entry citation.

We do *not* try to auto-resolve via citation recency or confidence — operator review is the ground truth.

## What counts as "safe to use in outreach prep"

A campaign list / contact set is **export-safe** only when, for each row:

- The `Journalist` has `merge_status = 'active'` (not deprecated, not merged out).
- All listed fields used in the export are at least `corroborated` (supports rollup ≥ 2 or 1×high).
- Any `ContactMethod` chosen for the export is `verified | lawful_to_store=true | verified_via_citation_id != null`.
- The `CampaignContact.approval_state = 'approved'`.
- The parent `CampaignList.state` and `Campaign.state` are not `closed`/`paused`.
- A `ClientApproval(subject_type='campaign_list', subject_id=...)` is `approved`.

Anything below the bar is exportable as **draft** (clearly marked) but never as **outreach-ready**.

## Citation ergonomics

Capturing provenance must be **fast**, or operators won't do it. UI affordances:

- "Cite from URL" button on every editable field: paste URL → fetch + cache → automatic `Citation` + `ProvenanceLink`.
- "Cite from current import row" when in import-review mode: one click attaches the import row as the citation for the field.
- "I edited this manually" prompt: brief reason field; produces a `manual_entry` citation.

We deliberately do **not** require a citation on every edit. Edits without explicit citation fall back to the implicit `manual_entry` citation. Captures with no citation never reach `verified`.

## Snapshot caching

For URL citations we attempt to cache the fetched HTML to a content-addressed local store (`data/cache/<sha256>`). The cache is opt-in per fetch and best-effort. Reasons:

- Outlets may rewrite or paywall pages.
- Future re-verification benefits from a frozen reference.
- Snapshot hash is the `Citation.payload_hash`; UI links to the snapshot when present.

We do **not** cache for sources with restrictive terms; the URL alone is recorded.

## Provenance & exports

All exports (campaign list CSV, markdown brief) include for each row:

- `provenance_summary` — short string like `verified×2, proposed×1`.
- `email_safe` — boolean: combined verified + lawful + cite-present.
- Optional `cite_urls` column listing citation URLs when present.

Operators (and clients receiving briefs) should be able to see *why* a journalist is on the list.

## Sevenfold source-audit alignment

The on-disk Sevenfold pattern (`02_source_audit/<slug>_Source_Audit.md` and `.csv`) captures source claims for client work. BroadLister's provenance is the same idea, structured. v1.1 may add an export adapter that produces a Source Audit markdown / CSV from BroadLister citations for a given client/campaign — so the Sevenfold profile can keep using its existing review document while the data lives in BroadLister.

## Out of scope for v1

- Cryptographic signing of citations.
- Public verification badges (e.g. CrossRef, ORCID).
- Network-of-citations scoring (PageRank-style).
- Autonomous re-verification ("recheck this email weekly").

## Bottom line

A fact in BroadLister is a triple: *the claim*, *the citation*, *the operator's confidence*. The schema makes that triple cheap to write and impossible to forget. Outreach prep filters on it explicitly. That's how we keep client work defensible.
