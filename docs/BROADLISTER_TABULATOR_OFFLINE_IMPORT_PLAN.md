# BroadLister Tabulator Offline Import Plan

Status: BroadLister-local offline `validate_dry_run` is implemented as pure in-memory contract scaffolding. No Tabulator runtime integration, BroadLister schema change, backend file writer, network call, contact export, or external write is implemented here.

Current implementation:

- `apps/api/src/services/tabulator-offline-dry-run.ts` validates a `BroadListerReviewedMediaExportBundle.v1` payload and returns a deterministic `BroadListerTabulatorOfflineImportDryRun.v1` plan.
- `apps/api/test/tabulator-offline-dry-run.test.ts` covers valid sample bundles, malformed bundles, forbidden contact/client-private fields, missing provenance, duplicate/idempotency keys, deterministic mapping, no network calls, no external writes, and no Tabulator runtime dependency.
- The dry run is not a route, not a UI, not a CLI writer, and not a Tabulator importer.

## Current BroadLister Bundle Shape

BroadLister can generate an operator-confirmed local JSON artifact from the Exports screen. The file contains only the `BroadListerReviewedMediaExportBundle.v1` payload returned by `GET /tabulator/export/preview`.

Top-level fields:

```ts
type BroadListerReviewedMediaExportBundleV1 = {
  schema: "BroadListerReviewedMediaExportBundle.v1";
  export_schema_version: "v1";
  export_id: string;
  exported_at: string;
  exported_by: string;
  source_system: "broadlister";
  export_scope: "reviewed_public_media";
  source_tag_or_commit?: string;
  source_instance: { repo: "BroadLister"; git_commit?: string };
  validation_limits: string[];
  eligibility_policy: {
    requires_reviewed_records: true;
    requires_provenance: true;
    excludes_client_overlays: true;
    excludes_outreach_fields: true;
  };
  articles: BroadListerReviewedArticleLink[];
  outlets: BroadListerReviewedOutletReference[];
  bylines: BroadListerReviewedBylineReference[];
  tags: BroadListerTagMapping[];
  provenance: BroadListerProvenancePacket[];
  artifacts: BroadListerReviewedMediaArtifact[];
  omitted: Array<{ broadlister_model: "Article"; id: string; reason: "not_reviewed" | "missing_provenance" }>;
  redaction_report: {
    policy: "deny_client_overlay_fields";
    redacted_field_count: 0;
    denied_fields_checked: string[];
    omitted_record_count: number;
  };
  summary: {
    article_count: number;
    outlet_count: number;
    byline_count: number;
    tag_count: number;
    provenance_packet_count: number;
  };
};
```

The bundle is deterministic for the same reviewed records and export identity. It is intentionally generic: no client-specific campaign overlay fields, pitch angles, relationship warmth, exclusions, notes, contact methods, or outreach state are allowed.

## Manual Handling Today

1. Generate the bundle in BroadLister from `Exports -> Tabulator preview`.
2. Confirm the local-only safety checkbox.
3. Download the JSON file using the generated filename format `broadlister-tabulator-preview-bundle-YYYYMMDD-HHMMSS.json`.
4. Store the file in a local operator-controlled folder, not inside client folders by default.
5. Inspect the JSON before any future Tabulator use:
   - `schema` is `BroadListerReviewedMediaExportBundle.v1`.
   - `eligibility_policy.requires_reviewed_records` is `true`.
   - `eligibility_policy.requires_provenance` is `true`.
   - `eligibility_policy.excludes_client_overlays` is `true`.
   - `eligibility_policy.excludes_outreach_fields` is `true`.
   - `validation_limits` includes no Tabulator API writes, no client overlay fields, and no contact methods.
   - `redaction_report.redacted_field_count` is `0`.
6. Do not upload, paste, or import the bundle into Tabulator until a Tabulator-side adapter exists and Bo approves the import operation.

## Tabulator-Side Inspection Summary

Read-only inspection path: `/home/bxby/development/reckoner-app/tabulator`.

Relevant Tabulator primitives:

- `Link`: canonical URL, title, description, site name, content type, source type, import batch ID, source path JSON, provenance JSON.
- `ExternalSourceRecord`: source system, source record ID, canonical URL, source URL, link ID, import batch ID, raw source metadata JSON, provenance JSON; unique on `(sourceSystem, sourceRecordId)`.
- `Tag`: name, normalized name, tag type; unique on `(normalizedName, tagType)`.
- `LinkTag`: many-to-many link/tag edge with source and optional confidence.
- `ResearchArtifact`: structured artifact records with `artifact_type`, title, summary, canonical ref, text/JSON content, source path, and provenance.
- `OntologyProposal`: review-only ontology mutation proposal model. Approval records review state but does not automatically mutate tags.

Current Tabulator import posture:

- Chrome bookmark import has preview and commit routes.
- `externalImportContract.ts` and `ImportService.previewExternalImport` can normalize external source payloads.
- A public external import route was not found during this inspection.
- Tabulator docs emphasize deterministic link canonicalization, tag graph safety, and review-only ontology mutation.

Implication: first implementation should be a Tabulator-side offline importer/dry-run command or preview route that reads a local BroadLister bundle file and produces a mutation plan. BroadLister should not call Tabulator.

## Implemented BroadLister-Local Dry Run

The BroadLister-local dry run exists to validate downloaded bundles before any Tabulator-side implementation consumes them. It is intentionally non-mutating and in-memory.

Return shape:

```ts
type BroadListerTabulatorOfflineImportDryRunV1 = {
  schema: "BroadListerTabulatorOfflineImportDryRun.v1";
  mode: "validate_dry_run";
  validation: {
    ok: boolean;
    errors: Finding[];
    warnings: Finding[];
  };
  source_bundle: {
    schema?: string;
    export_schema_version?: string;
    export_id?: string;
    exported_at?: string;
    bundle_sha256: string;
  };
  idempotency: {
    duplicate_findings: Finding[];
    keys: Array<{ entity: string; source_id: string; key: string }>;
  };
  mapping_preview: {
    operations: Array<{ op: string; entity: string; idempotency_key: string; source: object; preview: object }>;
    proposals: Array<{ op: "queue_ontology_proposal"; entity: "OntologyProposal"; idempotency_key: string; source: object; preview: object }>;
    rejected_records: Array<{ source_id: string; reason: string; path: string }>;
    omitted_records: object[];
  };
  safety: {
    tabulator_api_called: false;
    tabulator_runtime_dependency_used: false;
    external_writes_performed: false;
    contacts_imported: false;
    client_private_fields_imported: false;
  };
};
```

The mapping preview is advisory only:

- `Article` -> proposed Tabulator `Link`.
- `Article` -> proposed `ExternalSourceRecord`.
- referenced tags -> proposed `Tag`.
- artifact tag edges -> proposed `LinkTag`.
- reviewed article artifact -> proposed `ResearchArtifact`.
- unmapped BroadLister tags -> proposed `OntologyProposal`.

## Future Tabulator-Side Import Adapter Design

Adapter owner: Tabulator repo, not BroadLister.

Initial shape:

```ts
type TabulatorBroadListerOfflineImportInput = {
  bundle_path: string;
  mode: "validate" | "dry_run" | "commit";
  imported_by: string;
  import_note?: string;
};

type TabulatorBroadListerOfflineImportPlan = {
  schema: "TabulatorBroadListerOfflineImportPlan.v1";
  source_bundle: {
    export_id: string;
    exported_at: string;
    source_tag_or_commit?: string;
    bundle_sha256: string;
  };
  validation: {
    accepted: boolean;
    errors: string[];
    warnings: string[];
  };
  operations: Array<
    | { op: "upsert_link"; broadlister_article_id: string; canonical_url: string; action: "create" | "match_existing" }
    | { op: "upsert_external_source_record"; source_system: "broadlister"; source_record_id: string; action: "create" | "refresh_existing" }
    | { op: "upsert_tag"; broadlister_tag_id: string; normalized_name: string; tag_type: "system"; action: "create" | "match_existing" }
    | { op: "attach_link_tag"; broadlister_article_id: string; broadlister_tag_id: string; action: "create" | "already_exists" }
    | { op: "create_research_artifact"; artifact_id: string; action: "create" | "already_exists" }
    | { op: "queue_ontology_proposal"; broadlister_tag_id: string; proposal_type: "create_tag" | "merge_tags"; action: "optional_manual_review" }
  >;
  counts: {
    links: number;
    external_source_records: number;
    tags: number;
    link_tags: number;
    research_artifacts: number;
    ontology_proposals: number;
  };
};
```

Recommended phases:

1. `validate`: parse bundle, verify schema, enforce forbidden-field denylist, verify provenance coverage, compute bundle hash, report counts.
2. `dry_run`: build deterministic Tabulator operation plan without DB writes.
3. `commit`: write only after operator confirmation inside Tabulator. Commit should be separate from preview and should remain local/offline.

## Validation Before Tabulator Import

Required checks:

- Bundle `schema` equals `BroadListerReviewedMediaExportBundle.v1`.
- Bundle `export_schema_version` equals `v1`.
- Bundle `source_system` equals `broadlister`.
- Bundle `export_scope` equals `reviewed_public_media`.
- Eligibility policy requires reviewed records and provenance.
- Eligibility policy excludes client overlays and outreach fields.
- No contact-method keys or values are present.
- No forbidden client/campaign/private field keys are present.
- Every `artifact` has `review_state: "reviewed"`.
- Every imported article has at least one provenance packet.
- Every provenance packet has `citation_id`, `source_type`, `observed_at`, and target model/id.
- Every article has a canonical URL.
- Deterministic hash is computed over canonical JSON.
- Duplicate `broadlister_article_id`, `stable_export_key`, `canonical_url`, and `packet_id` collisions are reported.
- Unknown fields are either rejected or preserved only in raw source metadata after explicit allowlist review.

## Proposed Mapping

| BroadLister bundle field | Tabulator target | Notes |
| --- | --- | --- |
| `articles[].tabulator_link_hint.canonicalUrl` | `Link.canonicalUrl` | Canonical URL is the primary dedupe key. |
| `articles[].tabulator_link_hint.originalUrl` | `Link.originalUrl` | Optional. |
| `articles[].title` | `Link.title` | Public article fact only. |
| `articles[].description` | `Link.description` | Public summary/description only. |
| `articles[].outlet_name` | `Link.siteName` | Maps media outlet display name to site name. |
| `articles[].tabulator_link_hint.contentType` | `Link.contentType` | Expected value `article`. |
| `artifacts[].tabulator_target.link_source_type` | `Link.sourceType` | Expected value `broadlister_export`. |
| `artifacts[].tabulator_target.source_path` | `Link.sourcePathJson` | Preserve BroadLister source path. |
| `provenance[]` relevant to article | `Link.provenanceJson` | Store compact provenance pointer set, not full private notes. |
| `articles[].broadlister_article_id` | `ExternalSourceRecord.sourceRecordId` | `sourceSystem` should be `broadlister`. |
| `articles[].canonical_url` | `ExternalSourceRecord.canonicalUrl` | Dedupe fallback if source record exists. |
| `artifacts[].stable_export_key` | `ExternalSourceRecord.rawSourceMetadataJson` | Useful idempotency/debug key. |
| `tags[].tabulator_tag_hint.name` | `Tag.name` | Create/match as `tagType: "system"` initially. |
| `tags[].tabulator_tag_hint.normalized_name` | `Tag.normalizedName` | Match with Tabulator normalization. |
| `tags[].tabulator_tag_hint.link_tag_source` | `LinkTag.source` | Expected value `broadlister`. |
| `tags[].confidence` | `LinkTag.confidence` | Map string confidence to decimal only if Tabulator accepts a stable convention. |
| `bylines[]` | `ResearchArtifact.contentJson` or `Link.provenanceJson` | Do not create contact/person records in Tabulator v1. Treat bylines as article metadata only. |
| `outlets[]` | `ResearchArtifact.contentJson` or link metadata | Tabulator does not currently have an outlet entity. Do not force one. |
| `provenance[]` | `ResearchArtifact` or `provenanceJson` | Full provenance packet can be represented as source-pack style artifact if useful. |

## Provenance Handling

Minimum import should store provenance pointers in `Link.provenanceJson` and `ExternalSourceRecord.provenanceJson`:

```json
{
  "source_system": "broadlister",
  "export_id": "export-id",
  "bundle_sha256": "sha256...",
  "source_tag_or_commit": "git-or-tag",
  "citation_ids": ["citation-id"],
  "provenance_packet_ids": ["packet-id"],
  "imported_by": "operator",
  "imported_at": "ISO-8601"
}
```

For larger evidence bundles, create one `ResearchArtifact` with:

- `artifact_type`: `source_pack`
- `title`: `BroadLister reviewed media export <export_id>`
- `canonical_ref`: `broadlister:export:<export_id>`
- `content_json`: compact bundle summary plus provenance packets
- `source_path`: `["BroadLister", "ReviewedMedia", "<export_id>"]`
- `provenance`: actor, bundle hash, source commit/tag, and validation result

## Duplicate And Idempotency Strategy

Use deterministic keys:

- Link match: canonical URL.
- External source match: `(sourceSystem: "broadlister", sourceRecordId: broadlister_article_id)`.
- Tag match: `(normalizedName, tagType)`.
- LinkTag match: `(linkId, tagId)`.
- ResearchArtifact match: `canonicalRef = broadlister:export:<export_id>` or `broadlister:artifact:<stable_export_key>`.

Conflict behavior:

- Existing canonical URL with no BroadLister mapping: attach an `ExternalSourceRecord` after dry-run review.
- Existing BroadLister source record points to different canonical URL: block commit and require manual review.
- Existing tag normalized name with different intended type: block or queue `OntologyProposal`, do not silently merge.
- Duplicate artifact ID or stable export key inside a bundle: block commit.
- Re-import of same bundle: dry-run should report `already_exists` or `refresh_existing`, not duplicate rows.

## Rollback Strategy

Before any future commit mode:

1. Record bundle hash, import batch ID, imported-at timestamp, and generated operation plan.
2. Prefer wrapping DB writes in a single transaction.
3. Ensure every write carries `sourceType` or provenance marker `broadlister_export`.
4. Rollback option A: transaction rollback if any operation fails.
5. Rollback option B: generated compensating delete plan for rows created by the import batch only.
6. Never delete pre-existing `Link`, `Tag`, or `LinkTag` rows that were only matched, not created.
7. Preserve a spool file containing the failed operation plan if commit fails.

## Explicit Non-Negotiables

- No contact data: no emails, phone numbers, social handles, addresses, contact-method records, or outreach readiness fields.
- No client-private overlay data: no pitch angles, campaign strategy, narrative fit, suitability notes, relationship warmth, exclusions, embargo notes, client notes, approvals, or campaign IDs.
- No BroadLister-to-Tabulator API calls in the first import implementation.
- No Tabulator runtime dependency in BroadLister.
- No direct writes into ProjectReckoner from BroadLister.
- No automatic ontology mutation in Tabulator; use review/proposal flow when ontology changes are needed.

## Risks

- Tabulator has no public external import route yet; forcing one too early would expand integration scope.
- Link canonicalization differences could cause duplicate or wrongly merged links.
- BroadLister tag kinds do not map perfectly to Tabulator tag types; start with `system`/`broadlister` source and preserve original kind in metadata.
- Bylines and outlets have no dedicated Tabulator entities; treating them as link metadata/source artifacts is safer than inventing schema.
- Provenance payloads can grow; large packets may belong in `ResearchArtifact` rather than every `Link`.
- Operator-downloaded files can be copied into unsafe locations. Runbook discipline matters.

## Open Questions

- Should the Tabulator adapter be a CLI first, a preview route first, or both?
- Should a committed import create one bundle-level `ResearchArtifact`, one artifact per reviewed article, or both?
- What exact confidence mapping should convert BroadLister `low | medium | high` into Tabulator `Decimal`?
- Should BroadLister tag `kind` become Tabulator `tagType: "system"` for all imports, or should Tabulator add a dedicated `media` or `broadlister` tag type?
- Should Tabulator store bylines only in provenance JSON, or expose them in a research artifact for search?
- Where should operator-approved bundle files live long-term: BroadLister exports folder, Tabulator spool folder, or a separate operator archive?
