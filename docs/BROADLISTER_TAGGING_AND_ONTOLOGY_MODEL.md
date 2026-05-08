# BroadLister — Tagging & Ontology Model

**Status:** planning, 2026-05-08

This document defines how BroadLister classifies journalists, outlets, articles, and campaign rows. It is intentionally aligned-with-but-not-coupled-to Tabulator and ontology-core, so a future bridge is mechanical.

## Goals

- One unified `Tag` table with a `kind` discriminator.
- Distinguish **broad tags** ("crypto", "fintech") from **specific tags** ("stablecoin yield", "RWA tokenization").
- Distinguish global tags (re-usable across clients) from client-only annotations (`ClientTag`, separate table — never mixed).
- Carry `confidence`, `source` (citation), and `scope` per *link*, not per tag, so the same tag can mean different things at different verification levels for different journalists/outlets.
- Stay portable to Tabulator's tag/link model and to ontology-core's beat taxonomy without forcing an integration on day one.

## Scope discipline (read this before adding any tag)

Tags fall into three scopes. They never share a table.

| Scope                 | Where it lives                                       | What it can describe                                           |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| **Global, public**    | `Tag` + `JournalistTag` / `OutletTag` / `ArticleTag` | Beats, topics, formats, regions, languages — **sourced facts** |
| **Client overlay**    | `ClientTag`                                          | Per-client annotations: relationship, suitability, embargo, risk |
| **Campaign overlay**  | Inside `CampaignContact.narrative_fit_json` / `Campaign.constraints_json` | Per-campaign judgments: narrative angle fit, exclusivity flags, sensitive-topic markers |

Hard rule: a tag that represents an **opinion** about a (client × journalist) or (campaign × journalist) relationship is overlay-only. It never enters the global `Tag` table — even if it would be convenient.

### Tag-by-scope examples

- `beat:crypto-policy` → global. (Public coverage area, sourced.)
- `format:newsletter` → global. (Public format.)
- `region:eu` → global. (Public, sourced.)
- `broad:founder-friendly` → global **only when** sourced from a public statement (e.g. journalist's own bio: "I love startup-founder narratives"). Otherwise overlay.
- `relationship:warm` → never global. Lives in `OutreachStatus.relationship_warmth` per client.
- `exclusion:do-not-pitch-this-launch` → never global. Lives in `CampaignContact.exclusion_flag` + `exclusion_reason`.
- `embargo:hold-until-Q3` → never global. Lives in `Campaign.constraints_json` and (per row) `CampaignContact.narrative_fit_json.exclusivity_window`.
- `risk:competitor-conflict` → never global. Lives as a `ClientTag(kind='risk')` or in campaign constraints.
- `suitability:trace-narrative-fit` → never global. Lives as a `ClientTag(kind='suitability')`.

Operator instinct test: "Would a different Sevenfold client want to see this label on the same journalist?" If no, it is overlay-scoped.

## Unified Tag table

A single `Tag` table with a `kind` enum:

| `kind`    | Purpose                                                  | Example                                    |
| --------- | -------------------------------------------------------- | ------------------------------------------ |
| `beat`    | Editorial coverage area (canonical, taxonomy-style)      | `beat:crypto-policy`, `beat:venture`       |
| `topic`   | More specific subject; can nest under beats              | `topic:stablecoins`, `topic:rwa-tokenization` |
| `format`  | Content/coverage format                                  | `format:long-form`, `format:newsletter`    |
| `region`  | Geographic coverage focus                                | `region:us`, `region:apac`                 |
| `language`| Working language(s) (rarely used as a tag; usually field) | `language:en`                              |
| `broad`   | Loose narrative / persona / vibe tag                     | `broad:founder-friendly`, `broad:skeptic`  |
| `specific`| Narrow descriptor that doesn't fit the taxonomy yet      | `specific:remote-team-coverage`            |

A tag has:

- `name` (display)
- `slug` (canonical, kebab-case, unique)
- `kind`
- `description` (optional, for taxonomy hygiene)
- `external_ids_json` — reserved for `{ tabulator_id, ontology_core_slug, custom: ... }` (no live coupling in v1).

### Why one table

A single `Tag` table with `kind` keeps the tagging UI uniform and avoids a proliferation of join tables. The trade-off is that `kind` is a stringly-typed discriminator. Mitigation:

- Strict allowed-values list in code.
- Dropdowns in UI rather than free-text.
- A periodic sanity report flagging tags whose `kind` looks wrong (e.g. `kind=beat` but used only on `Outlet` for region-shaped semantics).

## Per-link metadata (where the real signal lives)

Each tag-to-target link (`JournalistTag`, `OutletTag`, `ArticleTag`) carries:

- `confidence`: `high | medium | low` — operator's certainty for this link.
- `citation_id`: nullable FK to `Citation` — what supports the link.
- `scope`: defaults to `global`. Always `global` on global join tables. (Client-scoped annotation goes in `ClientTag`, not here.)

This means the same tag — say `topic:stablecoins` — can be `high` confidence on a journalist with a citation pointing to a recent byline, and `low` confidence on another journalist where the link is just operator intuition.

## Beat / topic taxonomy

We seed a deliberate **starter taxonomy** (kept short to avoid taxonomy debt) and let it grow under operator review:

Starter beats (illustrative; final list in Phase 0 with sevenfold review):

```
beat:crypto-policy
beat:crypto-markets
beat:crypto-tech
beat:fintech-policy
beat:fintech-payments
beat:venture
beat:enterprise-software
beat:ai-policy
beat:ai-product
beat:climate-tech
beat:macro
beat:culture
beat:culture-internet
```

Topics nest under beats *informally* (no FK enforcement in v1). We may add `tag.parent_id` later if hierarchy becomes load-bearing.

Rules:

- **No new `kind=beat` tag without operator review.** Beats are intended to be a small, stable taxonomy.
- **`kind=topic` and `kind=specific` can grow freely** but show up in a periodic "tag hygiene" report so operator can promote / merge / retire them.

## Broad vs specific tags

- **Broad tags** are persona/narrative shorthand operators recognize across clients ("technical-deep", "regulatory-savvy", "founder-friendly", "investor-skeptic"). They're useful for filtering campaign lists at the persona level.
- **Specific tags** capture niche signal that doesn't yet justify promotion to the taxonomy ("covers Sui ecosystem", "writes about ZK fraud").

The system *does not* treat broad and specific differently in queries; the distinction is for human authoring discipline.

## Client tags (`ClientTag`)

A separate table. Reasons:

1. Schema-level guarantee that client opinions never sit on global rows.
2. Different lifecycle: client tags are scoped to a client and may use names that would be confusing globally ("Q3-blacklist", "Trace-friendly").

`ClientTag.kind`:

- `relationship` — operator's read of the relationship ("warm", "cold", "rebuilding")
- `suitability` — campaign suitability ("good-for-narrative-angle-X")
- `risk` — caution flags ("conflict-of-interest", "embargo-disrupted")
- `embargo` — embargo-specific ("embargoed-until-launch")
- `other`

### Linking client tags

Client tags attach via `CampaignContact` overlay fields and via `ClientNote.references`. We do **not** create a generic `JournalistClientTag` table in v1; a journalist's client-scoped tags surface through the campaign-contact rows the operator owns. If, in v1.1, we find we want client-tag-level CRUD on a journalist outside any campaign, we'll add a `ClientJournalistTag` table.

## Tag confidence rollup → field-level confidence

For UI we need a single confidence read on the journalist for "this person covers stablecoins":

- Take the highest `confidence` across all `JournalistTag` rows for `tag = topic:stablecoins`.
- If contradicting evidence exists (e.g. a tag with `assertion_kind=contradicts` via citation), downgrade by one level.
- Persisted as `Journalist.confidence_score` rolled across key tag-fields and key bio fields. This is advisory; per-link confidence is the truth.

## Tag write paths

- Operator UI direct add/remove (creates a `JournalistTag` / `OutletTag` / `ArticleTag` directly in v1; in v1.1 we may move this to a review queue for *new* tag creation specifically).
- Article ingestion: when a new article is ingested, no tags are auto-applied in v1. Tag inference is a v2 enrichment.
- Bucketer signal ingestion (v1.2): proposed tags go to the review queue, never auto-applied.
- Tabulator bridge (v1.3): proposed tag mappings go to review queue.

## Relationship to Tabulator and ontology-core

### Tabulator

Tabulator owns tag/link/ontology-adjacent storage in the broader system (`/api/tags`, `/api/links`, `/api/research/artifacts`). BroadLister has its own local tag store because:

- BroadLister's confidence/scope/citation-per-link data is richer than Tabulator's link tags need to be.
- We don't want to take a network dependency on a separate service for every tag write.

We design for *bridge-readiness*:

- `Tag.external_ids_json` reserves a slot for the Tabulator UUID and any other external ID.
- v1.3 bridge: a `tabulator-bridge` adapter that:
  - reads Tabulator's tag list and proposes a mapping to BroadLister tags via `external_ids_json`,
  - flags mismatches (different slugs, divergent kinds) into the review queue,
  - by default does not write back to Tabulator.

### ontology-core

ontology-core defines canonical concept slugs across ProjectReckoner. BroadLister's beats/topics align in spirit. v1 doesn't validate against ontology-core. v1.3 may add a one-way "ontology-core slug → BroadLister tag" sync that updates `external_ids_json.ontology_core_slug` when a match is recognized.

## How tags should carry confidence, source, and scope

Worked example, assertion: *"Casey Newton (`Platformer`) covers AI-product and AI-policy."*

We store:

- `Tag(slug='topic:ai-product', kind='topic')`
- `Tag(slug='topic:ai-policy',  kind='topic')`
- `JournalistTag(journalist_id=casey, tag_id=ai-product, confidence='high', citation_id=cit-001, scope='global')`
- `JournalistTag(journalist_id=casey, tag_id=ai-policy,  confidence='medium', citation_id=cit-002, scope='global')`
- `Citation(cit-001, source_type='url', source_url='<recent ai-product byline>', observed_at=2026-04-30)`
- `ProvenanceLink(citation_id=cit-001, target_type='Journalist', target_id=casey, target_field='topic:ai-product', assertion_kind='supports', confidence='high')`

When operator searches "journalists covering ai-product, high confidence", the query is straightforward. When the same operator pulls Casey onto a Trace Finance campaign list, the operator can attach an additional **client-private** `ClientTag(name='trace-narrative-fit', kind='suitability')` via the campaign contact overlay; that does not touch the global tags.

## Tag hygiene & lifecycle

- Periodic ops report: tags with no links (orphans), tags appearing only once (specific-tag long tail), tags whose kind is misused.
- Operator may **merge** tags (similar to entity merges) producing a `MergeEvent(entity_type='Tag')` in v1.1; v1 keeps tag merges as a manual SQL maintenance script.
- Tags may be **retired** (renamed to `__deprecated/<slug>`) but never hard-deleted while still linked.

## Out of scope for v1

- Hierarchical taxonomy with parent FKs.
- Tag synonyms / aliases (planned v1.1 if needed).
- Multi-language tag display names.
- Auto-tag inference from article text.
- Live Tabulator write-back.

## Bottom line

The tagging system is designed so a tag is a small thing, but a *link* between a tag and a journalist/outlet/article is a rich, citable, confidence-aware claim. That's the asymmetry that distinguishes BroadLister's tagging from a generic CRM tag.
