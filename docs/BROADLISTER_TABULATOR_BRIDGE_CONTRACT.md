# BroadLister Tabulator Bridge Contract

## Status

Read-only preview scaffold with operator UI. No export adapter, JSON download, file writer, or Tabulator runtime integration is implemented in this phase.

This contract defines the next safe bridge after local ontology snapshot import refinement: reviewed BroadLister media artifacts exported to a local JSON file that Tabulator may later import. BroadLister must not POST to Tabulator, import Tabulator runtime code, or require Tabulator to run.

Current implementation scaffold:

- `apps/api/src/services/tabulator-export-contract.ts` contains a pure in-memory contract helper and safety validator.
- `apps/api/test/tabulator-export-contract.test.ts` locks the forbidden-field, reviewed-only, provenance-required, deterministic-shape, idempotency, no-network, and no-external-write expectations.
- `apps/api/src/services/tabulator-export-preview.ts` contains a DB-backed service-only preview that reads approved/provenance-backed public records, feeds allowlisted data into the contract helper, and returns an in-memory preview bundle plus omission metadata.
- `apps/api/test/tabulator-export-preview.test.ts` locks the preview behavior.
- `GET /tabulator/export/preview` exposes that in-memory preview through a read-only local API route.
- `apps/api/test/tabulator-export-preview-route.test.ts` locks the route behavior.
- `apps/web/src/screens/TabulatorPreviewScreen.tsx` displays an operator-facing preview-only surface with counts, included records, omission reasons, provenance coverage, safety flags, and optional article ID scoping.
- No JSON download, file writer, or Tabulator integration exists yet.

## Intent

Tabulator stores canonical links, generic tags, link-tag edges, external source records, ontology proposals, and research artifacts. BroadLister stores media-specific journalist, outlet, article, byline, tag, citation, review, and client/campaign overlay data.

The bridge should make reviewed public media intelligence portable without leaking Sevenfold client strategy or creating runtime coupling.

## Non-Negotiable Boundaries

- No BroadLister runtime dependency on Tabulator, ProjectReckoner, Bucketer, Hermes, or sevenfold.
- No direct Tabulator API writes in the first implementation.
- No network calls in export generation.
- Export is operator-triggered and previewed before file write.
- Only approved/reviewed public media facts are export-eligible.
- Every exported artifact must include provenance.
- Client/campaign overlay fields are excluded by default.
- No outreach, Gmail, contact-action, sequence, cadence, or relationship-warmth fields.
- Repeat exports must be deterministic and idempotent by stable export keys.
- Export serialization must be allowlist-based. Never implement as "copy object minus forbidden fields."

## Tabulator Surface To Target

Read-only inspection shows Tabulator can later consume BroadLister exports through these concepts:

- `Link`: canonical URL, original URL, title, description, site name, content type, source type, import batch, source path, provenance.
- `ExternalSourceRecord`: source system/record ID, canonical URL, source URL, import batch, raw source metadata, provenance.
- `ResearchArtifact`: text/JSON reference artifacts with canonical refs, source path, and provenance.
- `Tag`: generic normalized tags with `tagType`.
- `LinkTag`: link-tag association with source and confidence.
- `OntologyProposal`: review-only ontology mutation proposals. BroadLister should not create these directly in phase one.

## Export-Eligible BroadLister Artifacts

Allowed only when the records are global public media facts and have provenance:

- Reviewed `Article` records with canonical URL, title, outlet, publication metadata, excerpt, language, and article tags.
- Reviewed `Outlet` references attached to exported articles or exported as source references.
- Reviewed `Byline` relationships between articles and journalists.
- Reviewed `Journalist` public identity references only when needed for byline context.
- Reviewed global `Tag` records for topics, beats, formats, regions, languages, broad tags, and specific tags.
- `Citation` and `ProvenanceLink` packets supporting exported facts.
- `ImportBatch` / source metadata as provenance context.
- Approved ontology/tag external references stored in `Tag.external_ids_json`.

## Explicitly Forbidden By Default

Never export these into generic Tabulator link/tag/research artifacts unless Bo approves a separate scoped client artifact:

- Client-private notes.
- Pitch angles.
- Campaign strategy.
- `CampaignContact.narrative_fit_json`.
- `Campaign.constraints_json` / embargo notes.
- `Campaign.embargo_until`.
- Relationship warmth.
- Outreach status.
- Exclusions and exclusion reasons.
- Approval-state rationale for client campaigns.
- Private client relevance reasoning.
- Contact methods, emails, handles, or lawful-to-store details.
- Any field that exists only because a client/campaign overlay exists.

If a future client-scoped export is approved, it must use a separate `BroadListerClientRelevanceArtifact` and must not become a generic Tabulator tag or link fact.

## First Future Implementation Path

1. Completed scaffold: read-only API route exposes a DB-backed in-memory `BroadListerReviewedMediaExportBundle` preview.
2. Completed scaffold: operator UI preview surface displays counts, included records, provenance coverage, omitted rows/reasons, safety flags, and optional article ID scoping without writing files.
3. Next implementation slice, if approved: add an operator-confirmed local JSON download/export response using the same allowlisted bundle shape.
4. BroadLister must write only an operator-confirmed local file or return an operator-triggered download response.
5. A later Tabulator-side import adapter consumes that JSON file.
6. Direct Tabulator API writes remain deferred until Bo approves them.

No server-side path reading from Tabulator and no Tabulator imports in BroadLister.

## Bundle Shape

```ts
interface BroadListerReviewedMediaExportBundle {
  schema: "BroadListerReviewedMediaExportBundle.v1";
  export_schema_version: "v1";
  export_id: string;
  exported_at: string;
  exported_by: string;
  source_system: "broadlister";
  export_scope: "reviewed_public_media";
  source_tag_or_commit?: string;
  source_instance: {
    repo: "BroadLister";
    database_id?: string;
    git_commit?: string;
  };
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
  artifacts: BroadListerReviewedMediaArtifact[]; // article-centered assembled view for importer convenience
  omitted: Array<{
    broadlister_model: string;
    id: string;
    reason: string;
  }>;
  redaction_report: {
    policy: "deny_client_overlay_fields";
    redacted_field_count: number;
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
}
```

Hermes review condition: BroadLister should treat this as a neutral source bundle. The future Tabulator importer owns the mapping into Tabulator tables and any `ResearchArtifact` decisions.

## BroadListerReviewedMediaArtifact

One artifact represents one reviewed article/link export unit with attached outlet, byline, tag, and provenance references. Outlet-only and journalist-only exports should be avoided until Tabulator has an explicit non-link import lane.

```ts
interface BroadListerReviewedMediaArtifact {
  schema: "BroadListerReviewedMediaArtifact.v1";
  artifact_id: string;
  stable_export_key: string; // e.g. broadlister:article:<article_id>:<url_hash>
  review_state: "reviewed";
  exported_at: string;
  source_system: "broadlister";
  article: BroadListerReviewedArticleLink;
  outlet?: BroadListerReviewedOutletReference;
  bylines: BroadListerReviewedBylineReference[];
  tags: BroadListerTagMapping[];
  provenance: BroadListerProvenancePacket[];
  tabulator_target: {
    preferred_entity: "Link";
    link_source_type: "broadlister_export";
    link_content_type: "article";
    external_source_system: "broadlister";
    external_source_record_id: string;
    source_path: ["BroadLister", "ReviewedMedia", string];
    research_artifact_type?: "source_pack" | "local_file_ref" | "note";
  };
}
```

## BroadListerReviewedArticleLink

```ts
interface BroadListerReviewedArticleLink {
  broadlister_article_id: string;
  canonical_url: string;
  original_url?: string;
  title: string;
  description?: string;
  published_at?: string;
  language?: string;
  outlet_id: string;
  outlet_name: string;
  tabulator_link_hint: {
    canonicalUrl: string;
    originalUrl?: string;
    title: string;
    description?: string;
    siteName?: string;
    contentType: "article";
  };
}
```

## BroadListerReviewedOutletReference

```ts
interface BroadListerReviewedOutletReference {
  broadlister_outlet_id: string;
  name: string;
  slug: string;
  home_url?: string;
  home_url_host?: string;
  outlet_type?: string;
  region?: string;
  country?: string;
  tabulator_metadata: {
    siteName: string;
    source_kind: "media_outlet";
  };
}
```

## BroadListerReviewedBylineReference

```ts
interface BroadListerReviewedBylineReference {
  broadlister_byline_id: string;
  broadlister_article_id: string;
  broadlister_journalist_id: string;
  journalist_display_name: string;
  position: number;
  confidence: "low" | "medium" | "high";
  provenance_ids: string[];
  tabulator_metadata: {
    relation: "authored_by";
    export_as_metadata_only: true;
  };
}
```

## BroadListerTagMapping

```ts
interface BroadListerTagMapping {
  broadlister_tag_id: string;
  slug: string;
  name: string;
  kind: "beat" | "topic" | "format" | "region" | "language" | "broad" | "specific";
  confidence: "low" | "medium" | "high";
  source: "article_tag" | "outlet_tag" | "journalist_tag" | "operator_review";
  ontology_core_id?: string;
  ontology_core_slug?: string;
  tabulator_tag_id?: string;
  relationship_to_ontology?: "exact" | "broader" | "narrower" | "related" | "none";
  tabulator_tag_hint: {
    name: string;
    normalized_name: string;
    tag_type: "system" | "user";
    link_tag_source: "broadlister";
  };
}
```

## BroadListerProvenancePacket

```ts
interface BroadListerProvenancePacket {
  packet_id: string;
  citation_id: string;
  provenance_link_id?: string;
  source_type: string;
  source_url?: string;
  source_local_path?: string;
  observed_at: string;
  captured_by?: string;
  payload_hash?: string;
  target: {
    broadlister_model: "Article" | "Outlet" | "Journalist" | "Byline" | "Tag";
    broadlister_id: string;
    field?: string;
  };
  assertion_kind: "supports" | "contradicts" | "proposes";
  confidence: "low" | "medium" | "high";
  tabulator_provenance_json: {
    source_system: "broadlister";
    citation_id: string;
    observed_at: string;
    target_field?: string;
    explanation: string;
  };
}
```

## Tabulator Import Mapping

A future Tabulator-side adapter should map:

- `BroadListerReviewedArticleLink` -> `Link`.
- `BroadListerReviewedMediaArtifact.stable_export_key` -> `ExternalSourceRecord.sourceRecordId`.
- `BroadListerReviewedMediaArtifact.tabulator_target.source_path` -> `Link.sourcePathJson`.
- `BroadListerProvenancePacket.tabulator_provenance_json` -> `Link.provenanceJson` and/or `ExternalSourceRecord.provenanceJson`.
- `BroadListerTagMapping.tabulator_tag_hint` -> `Tag` plus `LinkTag`.
- Full artifact JSON -> optional `ResearchArtifact.contentJson`.

BroadLister should produce the file. Tabulator should own the importer.

## Allowlist Fields

The first implementation should only serialize these BroadLister model fields:

- `Article`: `id`, `url`, `url_canonical`, `title`, `published_at`, `outlet_id`, `byline_text`, `language`, `excerpt`, `fetch_hash`, `created_at`, `updated_at`.
- `Outlet`: `id`, `name`, `name_norm`, `slug`, `outlet_type`, `home_url`, `home_url_host`, `region`, `country`, `languages_json`, `notes_public`.
- `Byline`: `id`, `article_id`, `journalist_id`, `position`, `confidence`, `created_at`.
- `Journalist`: `id`, `display_name`, `display_name_norm` only for byline display context.
- `Tag`: `id`, `name`, `slug`, `kind`, `description`, `external_ids_json`.
- `ArticleTag`, `OutletTag`, `JournalistTag`: IDs, linked IDs, `confidence`, `citation_id`, `scope` only when scope is global/public.
- `Citation`: `id`, `source_type`, `source_url`, `source_local_path`, `observed_at`, `captured_by`, `notes`, `payload_hash`.
- `ProvenanceLink`: `id`, `citation_id`, `target_type`, `target_id`, `target_field`, `assertion_kind`, `confidence`.
- `ImportBatch` / `ImportBatchRow`: IDs, source type, label, row index, mapped/source metadata needed for provenance only.

Everything else is omitted unless a later approved contract adds it.

## Forbidden-Field Test Denylist

The implementation test fixture must include records containing these field names and prove they do not appear in generic Tabulator export JSON:

- `pitch_angle`
- `target_rationale`
- `suitability_note`
- `narrative_fit_json`
- `exclusion_flag`
- `exclusion_reason`
- `embargo_until`
- `embargo_note`
- `relationship_warmth`
- `notes_private`
- `summary_private`
- `ClientNote.body_md`
- `ClientApproval.note`
- `Campaign.constraints_json`
- `client_id`
- `campaign_id`
- `campaign_list_id`

## Safety Tests Required Before Implementation

Implementation must not begin until tests are planned for:

- No client overlay leakage: exported JSON contains no campaign/client-private fields.
- Provenance required: each artifact has at least one citation/provenance packet.
- Reviewed-only export: draft/pending/rejected review proposals and unreviewed imports do not export.
- Deterministic shape: same DB state produces stable export keys and stable sorted output.
- Repeat export idempotency: repeated file exports do not change IDs except `exported_at`/`export_id`.
- No network calls: export preview/file generation does not call `fetch`, Tabulator APIs, or ProjectReckoner.
- No external writes: export generation writes only the operator-selected local file/download.
- Preview-first behavior: operator sees counts, omitted rows, missing-provenance rows, redaction report, and destination before write.
- Fail-closed provenance: normal export excludes or blocks records missing provenance. A diagnostic/incomplete export mode would need separate approval.
- Deny-list still passes and no Tabulator package appears in BroadLister runtime dependencies.
- Cross-client leakage integration test still passes.

## Deferred

- Direct Tabulator API POST.
- Tabulator-side importer implementation.
- Exporting client relevance artifacts.
- Exporting campaign or outreach-prep data.
- Creating Tabulator `OntologyProposal` records.
- Bidirectional sync or automatic mirror jobs.
- Runtime dependency on ProjectReckoner/Tabulator.
