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

Planned future flow:

1. BroadLister builds an operator-previewed local JSON bundle of reviewed media artifacts.
2. Bundle contains article links, outlet references, byline references, tag mappings, and provenance packets.
3. Operator inspects and saves/downloads the file.
4. A later Tabulator-side importer may create `Link`, `ExternalSourceRecord`, `Tag`, `LinkTag`, and optional `ResearchArtifact` rows from the file.
5. BroadLister does not POST to Tabulator in the first implementation.
6. Tag mappings stay advisory unless Bo approves write-back.

Eligible BroadLister records are reviewed global media facts only: articles, outlets, bylines, journalist public identity references needed for bylines, global tags/topics/beats, citations, provenance links, and import/source metadata.

Forbidden by default: client-private notes, pitch angles, campaign strategy, narrative fit, relationship warmth, exclusions, embargo notes, outreach status, contact methods, and private client relevance reasoning.

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

Implemented Bridge A shape:

- API preview: `POST /imports/ontology/preview`
- API commit: `POST /imports/ontology`
- Source type: `ontology_snapshot`
- Review item kind: `ontology_mapping_candidate`
- Approved mutation: local `Tag.external_ids_json` only
- Fixture: `docs/fixtures/ontology-snapshot.v1.example.json`

The API accepts JSON text from a browser upload/paste. It does not read ProjectReckoner files, import ontology-core packages, call external APIs, or write to external systems.

Bridge A refinement adds field-level review and safer repeat use:

- Preview classifies rows as `create_new`, `match_existing`, `already_mapped`, `conflict`, or `duplicate_in_snapshot`.
- Review detail shows source concept ID, source kind, suggested BroadLister tag kind, match confidence, match reason, fields touched, external IDs added, and snapshot provenance.
- Repeated imports reuse an existing pending ontology mapping review item for the same source system/version/record ID.
- Approval is idempotent for already mapped rows where practical.
- Approval is blocked for conflict and duplicate-source-ID rows; operator should reject or defer those.

## Recommended Bridge Sequence

Current recommendation after inspecting BroadLister, ontology-core, Tabulator, and Bucketer:

1. Complete contract docs only in this phase.
2. Current implementation: read-only ontology/tag mapping snapshot import into BroadLister review queue.
3. Current refinement: field-level review, provenance visibility, repeat-import safety, and conflict detection.
4. Current planning package: define reviewed-media-artifact export contracts for Tabulator-compatible local JSON files.
5. Then Bucketer-to-BroadLister signal candidate import.
6. Last: BroadLister-to-Bucketer monitoring hints.

Rationale:

- ontology-core is the semantic spine and requires stable IDs plus reversible ontology mutations. BroadLister should reference it, not embed app-specific logic into it.
- Tabulator and Bucketer both already have link/tag/signal concepts, but their tags are more generic than BroadLister's media ontology.
- Mapping first reduces the chance that Bucketer signals or Tabulator links create duplicate or mis-scoped BroadLister tags.
- File/snapshot exchange keeps BroadLister operationally independent and easy to verify with external systems stopped.

## Data Contracts

Detailed future adapter contracts now live in:

- `BROADLISTER_ONTOLOGY_ALIGNMENT_PLAN.md`
- `BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `BROADLISTER_BUCKETER_BRIDGE_CONTRACT.md`

Primary interface shapes:

- `BroadListerOntologyMapping`
- `BroadListerTabulatorLinkCandidate`
- `BroadListerBucketerSignalCandidate`
- `BroadListerReviewedMediaExportBundle`
- `BroadListerReviewedMediaArtifact`
- `BroadListerReviewedArticleLink`
- `BroadListerReviewedOutletReference`
- `BroadListerReviewedBylineReference`
- `BroadListerTagMapping`
- `BroadListerProvenancePacket`
- `BroadListerClientRelevanceArtifact`
- `BroadListerBucketerMonitoringHint`

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

- Exercise Bridge A on real exported mapping snapshots.
- Add operator refinements only if needed, such as manual conflict resolution controls.
- Keep external IDs in JSON fields unless Bo approves a migration.

### Phase C: Operator-triggered bridge

- Current scaffold: pure BroadLister reviewed-media export contract helper and safety tests only; no runtime export route or file writer yet.
- Implement BroadLister reviewed media export preview and local JSON file/download.
- Keep Tabulator import as a later Tabulator-owned adapter.
- Import Tabulator/Bucketer export files or API snapshots by explicit operator action only after export shape is proven.
- Keep all writes deterministic and reviewable.

## Acceptance Criteria

- No runtime coupling.
- No cross-client leakage.
- No automatic global tag or ontology mutation.
- All imported records are review-gated.
- Provenance and source system are visible.
- Tabulator export tests prove no client overlay leakage and provenance coverage.
- sevenfold domain review passes for client workflow.
- Bo approves any implementation beyond local deterministic ingestion.

## Explicit Non-Goals

- No shared database.
- No direct Tabulator write-back.
- No direct Bucketer source/routing mutation.
- No ontology-core package import as a required BroadLister runtime dependency.
- No promotion of client relevance or campaign narrative into global ontology.
- No automatic link/signal import without operator review.
