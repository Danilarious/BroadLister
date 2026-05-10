# BroadLister Phase 4 Ontology Alignment Architecture Review

## Revision History

- 2026-05-09 20:53:08 PDT — Initial planning-only architecture review.

## Verdict

PASS with conditions.

BroadLister can align with ProjectReckoner ontology-core, Tabulator, and Bucketer if the alignment remains contract/file/envelope based and review-gated. It must not introduce runtime coupling, hard foreign keys, startup dependencies, direct writes to ProjectReckoner services, autonomous outreach, or client/campaign data leakage.

## Reviewed Context

BroadLister repo:
- `/home/bxby/development/BroadLister`
- Branch: `phase-4-ontology-alignment-planning`
- Stack: local-first Fastify/Prisma/SQLite media intelligence.
- Phase 4 import ingestion and reconciliation are complete.

BroadLister references inspected:
- `docs/BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md`
- `docs/BROADLISTER_ENTITY_MODEL.md`
- `docs/BROADLISTER_IMPORT_INGESTION_CONTRACT.md`
- `apps/api/prisma/schema.prisma`

ProjectReckoner references inspected/read-only:
- `/home/bxby/development/reckoner-app/ontology-core/README.md`
- `/home/bxby/development/reckoner-app/PROJECT_RECKONER_CURRENT.md`
- `/home/bxby/development/reckoner-app/bucketer/README.md`
- `/home/bxby/development/reckoner-app/tabulator/apps/api/prisma/schema.prisma`

ProjectReckoner architecture consultation was delegated in a read-only reckoner-dev-style pass. No files/services/databases outside this BroadLister plan were mutated.

## Boundary Principles

1. BroadLister remains its own repo and product.
2. BroadLister must run correctly when ProjectReckoner, Tabulator, Bucketer, ontology-core, Hermes, and sevenfold-specific tooling are stopped.
3. Alignment is by explicit contracts, static snapshots, exported/imported envelopes, external IDs, and review items.
4. External IDs are references stored in JSON, not hard FKs.
5. All external-origin changes land in `ReviewItem` before touching canonical BroadLister records.
6. Client relevance and campaign relevance are overlays, never global ontology facts.
7. No autonomous outreach or hidden outbound integration.
8. No direct writes to ProjectReckoner/Tabulator/Bucketer/ontology-core in this phase.

## Concept Mapping

| BroadLister concept | ontology-core mapping | Tabulator mapping | Bucketer mapping | Planning guidance |
|---|---|---|---|---|
| `Tag` | Concept/tag reference; stable slug if known. | `Tag` reference via `external_ids_json.tabulator_id`; not a required live dependency. | Optional tag string used for monitoring classification. | Keep BroadLister `Tag` local. Store `ontology_core_slug` / `tabulator_id` in `external_ids_json` after review. |
| `Beat` | Canonical concept/category candidate. | Tag with `tagType` equivalent if exported. | High-level monitoring bucket/topic hint. | Treat as small stable taxonomy. New beats require operator review. |
| `Topic` | Concept candidate or child/narrower concept reference. | Link tag when attached to exported article/link. | Signal tag or query-topic hint. | More fluid than beats, but promotion to ontology remains review-gated. |
| `Outlet category` | Weak mapping to public/stable concepts only, e.g. trade press, policy media. | Link/site metadata or tag only when attached to an exported link/artifact. | Source/category hint. | Do not overfit outlet categories into ontology-core. Keep provenance-backed. |
| `Journalist beat profile` | Journalist-to-concept claim through local `JournalistTag` + citation. | Poor fit for raw `LinkTag`; better as `ResearchArtifact` or structured note if exported. | Can inform monitoring interests, but only advisory. | Keep BroadLister as source of truth. Export only reviewed/sanitized profiles with provenance. |
| `Article tags` | Article-to-concept claim. | Strong fit to `Link` + `LinkTag` when article URL is exported. | Signal/article classification. | Preserve citation/provenance and confidence. |
| `Client relevance` | No global ontology mapping. | Only sanitized, operator-approved research artifact if exported. | No default mapping. | Keep in `ClientNote`, `ClientTag`, `OutreachStatus`, or other client overlay. Never global. |
| `Campaign relevance` | No global ontology mapping. | Only sanitized, operator-approved campaign artifact if explicitly requested. | No default mapping. | Keep in `Campaign`, `CampaignContact`, `narrative_fit_json`, approvals. |
| `Citation` | Evidence/provenance primitive. | `Link.provenanceJson`, `ExternalSourceRecord.provenanceJson`, or `ResearchArtifact.provenanceJson`. | Source/signal provenance. | Use citation/provenance as the bridge spine. |
| `ImportBatch` | Import/run envelope, not ontology concept. | `Link.importBatchId`, `ExternalSourceRecord.importBatchId`; research artifact source path/provenance. | Bucketer signal/import envelope. | Preserve `source_system`, `source_record_id`, `source_url`, `canonical_url`, raw metadata, confidence, and review status. |

## Recommended Bridge Order

### Now: E — docs-only

PASS.

Use this planning artifact and any follow-on docs to lock boundaries before implementation. Do not write runtime code yet unless Bo explicitly opens a bounded implementation lane.

### First real implementation bridge: A — read-only ontology import/reference into BroadLister

Recommended first after docs review.

Safe shape:
- Operator-triggered import from static local snapshot/file or explicit local path.
- No live service call required during BroadLister startup or normal operation.
- Import creates `ReviewItem` proposals for `Tag.external_ids_json` mappings.
- Approval updates only BroadLister local records.
- No writes to ontology-core, Tabulator, or ProjectReckoner.
- No hard FKs.
- Client/campaign overlays excluded.

Why first:
- Lowest data leakage risk.
- Helps stabilize tag/beat/topic vocabulary before export/import bridges.
- Exercises review queue without touching outside systems.

### Second: B — export reviewed BroadLister artifacts into Tabulator

Good second bridge after A stabilizes.

Safe shape:
- Operator-triggered export only.
- Export reviewed article/source/provenance artifacts as Tabulator `ResearchArtifact` bundles or `Link` + `ExternalSourceRecord` payloads.
- Include provenance, validation limits, and BroadLister source IDs.
- Sanitize client/campaign overlays by default; include only when explicitly approved for the export scope.
- Dry-run/export-file first before any later API POST phase.

### Later: C — Bucketer-to-BroadLister article candidate import

Useful, but riskier than A/B.

Safe shape:
- Bucketer signals create BroadLister `ImportBatch(source_type='bucketer_signal')`, `ImportBatchRow`, `Citation`, and `ReviewItem` proposals.
- No direct creation of `Article`, `Journalist`, `Outlet`, `Tag`, or `ClientNote` without review.
- Treat Bucketer output as attention signal, not verified fact.

### Later still: D — BroadLister-to-Bucketer monitoring hints

Defer until inbound Bucketer candidate handling is proven.

Safe shape:
- Export advisory hints as a file/envelope, not direct Bucketer config writes.
- Operator manually reviews/applies to Bucketer.
- No client-private campaign strategy in default hints.

## Major Risks

1. Client leakage
   - Highest risk.
   - Client relevance, relationship warmth, suitability, narrative fit, embargoes, exclusions, and campaign strategy must not become global tags, ontology concepts, or default Tabulator/Bucketer data.

2. Runtime coupling
   - BroadLister startup or core UX must not depend on ProjectReckoner services.
   - Bridge failures must degrade to “bridge unavailable,” not break BroadLister.

3. Ontology pollution
   - Media-workflow shorthand should not silently mutate ontology-core.
   - New concepts should remain proposals until reviewed.

4. Semantic mismatch
   - Tabulator tags links; BroadLister tags journalists/outlets/articles with per-link confidence/citation.
   - Journalist beat profiles should not be flattened into generic Tabulator `LinkTag` rows without context.

5. Bucketer signal noise
   - Bucketer determines what is worth attention; it is not a verification authority.
   - All Bucketer-origin records must remain candidates until reviewed.

6. Bidirectional write creep
   - Automatic write-back to ontology-core, Tabulator, or Bucketer would create hidden coupling and maintenance risk.

## PASS Conditions

- BroadLister remains operational when ProjectReckoner services are stopped.
- No direct writes to ProjectReckoner, ontology-core, Tabulator, or Bucketer in this phase.
- No runtime dependency on those systems.
- All imports are review-gated through `ReviewItem` before canonical mutation.
- All exports are operator-triggered and scoped.
- Client/campaign overlays remain physically/logically separate from global media graph facts.
- Citations/provenance are preserved in all bridge payloads.
- External references remain JSON refs, not FKs.
- No autonomous outreach, email/DM sending, or hidden outbound automation.

## FAIL Conditions

- BroadLister startup requires ontology-core, Tabulator, Bucketer, ProjectReckoner, Hermes, or sevenfold runtime availability.
- Any bridge auto-creates canonical `Journalist`, `Outlet`, `Article`, `Tag`, client, or campaign records without review.
- Client relevance or campaign fit becomes a global `Tag` or ontology-core concept.
- Private campaign strategy is exported to Tabulator/Bucketer by default.
- BroadLister writes to Bucketer config, Tabulator tags, or ontology-core mutations without explicit later approval.
- Bucketer signals are treated as verified facts.
- Tabulator `LinkTag` is used as the only representation for journalist-level beat profiles.

## Concise Implementation Planning Guidance

If Bo approves a follow-on implementation lane, keep it bounded to bridge A:

1. Add a docs contract for `ontology_snapshot_import.v1`.
2. Define accepted input fields: `source_system`, `source_version`, `concept_slug`, `concept_id`, `label`, `kind`, `parent_slug`, `description`, `provenance`, `imported_at`.
3. Add a dry-run validator that reports exact proposed BroadLister `Tag` mappings.
4. Commit import batches as `ImportBatch(source_type='ontology_snapshot')`.
5. Create `ReviewItem(kind='tag_mapping_candidate')` rows only.
6. On approval, update only `Tag.external_ids_json` or create a local `Tag` if operator explicitly approves.
7. Add tests proving no canonical mutation before approval and no client/campaign overlay import.
8. Document degraded state: missing snapshot or bad snapshot shows operator-visible error and leaves BroadLister unchanged.

MVP stopping point:
- A static ontology snapshot can be dry-run and converted into review proposals.
- Approved proposals update BroadLister local tag external refs.
- No external service is called.
- No external repo/database is mutated.
