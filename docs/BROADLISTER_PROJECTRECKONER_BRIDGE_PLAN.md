# BroadLister ProjectReckoner Bridge Plan

## Purpose

Define how BroadLister should align with Bucketer, Tabulator, and ontology-core without creating runtime coupling. BroadLister remains the local media intelligence and relationship workspace. ProjectReckoner remains the broader control plane.

## Current Boundary

- BroadLister owns journalist, outlet, article, contact, campaign overlay, review queue, and export workflows.
- Bucketer owns source/news/topic monitoring and signal buckets.
- Tabulator owns saved links, generic link metadata, tags, and knowledge/provenance artifacts.
- ontology-core should provide shared vocabulary and stable concept identity over time.
- No current BroadLister runtime dependency on ProjectReckoner, Bucketer, Tabulator, ontology-core, Hermes, or sevenfold.

## Bucketer To BroadLister

Future flow:

1. Bucketer identifies an outlet/topic/news signal bucket.
2. Bucketed signal becomes an article candidate envelope.
3. BroadLister imports the candidate into the review queue.
4. BroadLister extracts outlet, article, journalist/byline, topic, and source provenance proposals.
5. Operator approves or rejects proposals before global records are touched.

Contract fields to align:

- `source_system`
- `source_record_id`
- `source_url`
- `canonical_url`
- `title`
- `summary`
- `published_at`
- `source_path`
- `raw_source_metadata`
- `score_explain`
- `provenance`

## BroadLister To Bucketer

Future flow:

1. BroadLister reviewed outlet/journalist/article records identify trusted sources.
2. Operator exports advisory source/topic monitoring suggestions.
3. Bucketer can use those suggestions to improve source lists or topic buckets.

No automatic write-back in the near term. Suggestions remain operator-mediated.

## Tabulator To BroadLister

Future flow:

1. Tabulator saved links or imported bookmarks expose canonical URL, title, site name, tags, and provenance.
2. BroadLister accepts those as media intelligence proposals.
3. BroadLister review queue decides whether the link becomes an article/outlet/journalist candidate.

BroadLister should mirror Tabulator's external import contract where useful, but should not call Tabulator APIs at runtime in v1.

## BroadLister To Tabulator

Future flow:

1. BroadLister reviewed article/outlet/journalist records can export link/provenance artifacts.
2. Tabulator can store those artifacts as knowledge or link metadata.
3. Tag mappings stay advisory unless Bo approves write-back.

## ontology-core Mapping

BroadLister should map local tags to ontology concepts by reference, not hard dependency.

Mapping categories:

- Broad topics: stablecoins, digital assets, payments.
- Specific topics: cross-border crypto settlement, central-bank restrictions.
- Beats: crypto regulation, fintech policy, payments infrastructure.
- Client relevance tags: Trace Finance relevance candidates; overlay-scoped, not global fact.
- Outlet categories: trade press, policy media, financial news, regional business media.

Near-term storage:

- Use `Tag.external_ids_json` for future `ontology_core_id`, `ontology_core_slug`, and `tabulator_tag_id`.
- Keep `client_relevance` tags advisory and review-gated.
- Do not validate against ontology-core at runtime yet.

## Near-Term Implementation Boundary

- BroadLister may implement its own deterministic article URL adapter.
- BroadLister may align output envelopes with Tabulator/Bucketer contracts.
- BroadLister must not import Tabulator/Bucketer runtime code.
- BroadLister must not require ProjectReckoner services to run.
- LLM assistance, if added later, must produce review proposals only.
- No autonomous outreach or Gmail behavior.

## Future Phases

### Phase A: Contract alignment

- Define a shared import envelope.
- Map BroadLister review item kinds to Tabulator/Bucketer signal/link fields.
- Add tests proving BroadLister runs with external systems stopped.

### Phase B: Advisory mapping

- Add ontology mapping UI or mapping file.
- Store external IDs in JSON fields.
- Add review queue items for mapping proposals.

### Phase C: Operator-triggered bridge

- Import Tabulator/Bucketer export files or API snapshots by explicit operator action.
- Export BroadLister reviewed artifacts for Tabulator/Bucketer consumption.
- Keep all writes deterministic and reviewable.

## Acceptance Criteria

- No runtime coupling.
- No cross-client leakage.
- No automatic global tag or ontology mutation.
- All imported records are review-gated.
- Provenance and source system are visible.
- sevenfold domain review passes for client workflow.
- Bo approves any implementation beyond local deterministic ingestion.
