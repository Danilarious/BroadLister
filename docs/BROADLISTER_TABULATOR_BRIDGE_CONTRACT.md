# BroadLister Tabulator Bridge Contract

## Status

Planning-only. No adapter is implemented in this phase.

## Intent

Define safe data envelopes for future operator-triggered exchange between BroadLister and Tabulator. Tabulator stores canonical links, tags, link-tag associations, external source records, ontology proposals, and research artifacts. BroadLister stores media-specific journalist/outlet/article knowledge with provenance and client overlays.

The bridge must be file/snapshot-first before any API integration.

## Non-Negotiable Boundaries

- BroadLister does not require Tabulator at runtime.
- BroadLister does not write directly to Tabulator in the next implementation phase.
- Tabulator import/export is operator-triggered.
- Client overlay data is excluded unless using the explicit client relevance artifact shape.
- No outreach or contact-action fields are exported.
- Every artifact carries provenance and source system metadata.

## Mapping Summary

| BroadLister | Tabulator |
| --- | --- |
| `Article.url_canonical` | `Link.canonicalUrl` |
| `Article.url` | `Link.originalUrl` |
| `Article.title` | `Link.title` |
| `Article.excerpt` | `Link.description` |
| `Outlet.name` | `Link.siteName` or metadata |
| `ArticleTag` | `LinkTag` candidate |
| `Tag` | `Tag` candidate or mapping reference |
| `Citation` | `ResearchArtifact`, `Link.provenanceJson`, `ExternalSourceRecord.provenanceJson` |
| `ImportBatch` | `Link.importBatchId`, `ExternalSourceRecord.importBatchId` |
| `ReviewItem` | no direct equivalent; BroadLister review remains local |

## BroadListerReviewedMediaArtifact

Use this for exporting reviewed public media facts from BroadLister for Tabulator intake.

```ts
interface BroadListerReviewedMediaArtifact {
  schema: "BroadListerReviewedMediaArtifact.v1";
  artifact_id: string;
  exported_at: string;
  exported_by: string;
  source_system: "broadlister";
  review_state: "approved";
  media_type: "article" | "outlet" | "journalist" | "byline";
  article?: {
    id: string;
    canonical_url: string;
    original_url?: string;
    title: string;
    description?: string;
    published_at?: string;
    language?: string;
    outlet_id: string;
    outlet_name: string;
  };
  outlet?: {
    id: string;
    name: string;
    home_url?: string;
    home_url_host?: string;
    outlet_type?: string;
    region?: string;
    country?: string;
  };
  journalist?: {
    id: string;
    display_name: string;
    public_profile_urls?: string[];
  };
  byline?: {
    article_id: string;
    journalist_id: string;
    confidence: "low" | "medium" | "high";
  };
  global_tags: Array<{
    tag_id: string;
    slug: string;
    name: string;
    kind: "beat" | "topic" | "format" | "region" | "language" | "broad" | "specific";
    confidence: "low" | "medium" | "high";
    ontology_core_id?: string;
    ontology_core_slug?: string;
    tabulator_tag_id?: string;
  }>;
  provenance: Array<{
    citation_id: string;
    source_type: string;
    source_url?: string;
    source_local_path?: string;
    observed_at: string;
    payload_hash?: string;
    target_type?: string;
    target_field?: string;
    assertion_kind?: "supports" | "contradicts" | "proposes";
    confidence?: "low" | "medium" | "high";
  }>;
  tabulator_hint: {
    content_type: "article" | "profile" | "source" | "other";
    source_type: "broadlister_export";
    source_path: string[];
    canonical_ref: string;
  };
}
```

## BroadListerClientRelevanceArtifact

Use this only for explicit client/campaign exports. It is not a global media fact and must not be converted into generic Tabulator tags.

```ts
interface BroadListerClientRelevanceArtifact {
  schema: "BroadListerClientRelevanceArtifact.v1";
  artifact_id: string;
  exported_at: string;
  exported_by: string;
  source_system: "broadlister";
  scope: "client_overlay" | "campaign_overlay";
  client: {
    id: string;
    slug: string;
    display_name: string;
  };
  campaign?: {
    id: string;
    slug: string;
    name: string;
  };
  subject: {
    article_id?: string;
    journalist_id?: string;
    outlet_id?: string;
    canonical_url?: string;
    title?: string;
    display_name?: string;
  };
  relevance: {
    label: string;
    confidence: "low" | "medium" | "high";
    rationale: string;
    narrative_fit_json?: Record<string, unknown>;
    constraints_context?: Record<string, unknown>;
  };
  safety: {
    global_fact: false;
    may_write_global_tag: false;
    may_export_to_generic_tabulator_tag: false;
    requires_operator_approval: true;
  };
  provenance: Array<{
    citation_id: string;
    source_type: string;
    source_url?: string;
    observed_at: string;
    confidence?: "low" | "medium" | "high";
  }>;
}
```

## BroadListerTabulatorLinkCandidate

Use this for importing Tabulator links into BroadLister review queue.

```ts
interface BroadListerTabulatorLinkCandidate {
  schema: "BroadListerTabulatorLinkCandidate.v1";
  source_system: "tabulator";
  source_record_id: string;
  import_batch_id?: string;
  canonical_url: string;
  original_url?: string;
  title?: string;
  description?: string;
  site_name?: string;
  content_type?: "article" | "tool" | "video" | "repo" | "other";
  tabulator_tags: Array<{
    id?: string;
    name: string;
    normalized_name?: string;
    tag_type?: "folder" | "user" | "ai" | "system";
    confidence?: number;
    source?: string;
  }>;
  external_source_record?: {
    source_system: string;
    source_record_id?: string;
    source_url?: string;
    raw_source_metadata?: Record<string, unknown>;
  };
  provenance: {
    source_path?: string[];
    provenance_json?: Record<string, unknown>;
    observed_at: string;
  };
  proposed_broadlister_actions: Array<
    | "article_candidate"
    | "outlet_candidate"
    | "tag_candidate"
    | "article_tag_candidate"
  >;
}
```

## Export As ResearchArtifact

If Tabulator intake uses `ResearchArtifact`, map BroadLister artifacts as:

```ts
interface BroadListerTabulatorResearchArtifactPayload {
  artifact_type: "source_pack" | "local_file_ref" | "note";
  title: string;
  summary?: string;
  canonical_ref: string;
  content_text?: string;
  content_json: {
    schema: "BroadListerReviewedMediaArtifact.v1" | "BroadListerClientRelevanceArtifact.v1";
    broadlister_artifact: Record<string, unknown>;
    tags: ["#pkb", "broadlister"];
  };
  source_path: ["BroadLister", "MediaDesk", string];
  provenance: {
    actor: string;
    marker: "#pkb";
    source_system: "broadlister";
    exported_at: string;
  };
}
```

## Review Rules

Tabulator-to-BroadLister:

1. Import file/snapshot only.
2. Create `ImportBatch(source_type='tabulator_snapshot')`.
3. Create review items for article/outlet/tag/article-tag candidates.
4. Operator approves or rejects through existing reconciliation.

BroadLister-to-Tabulator:

1. Export reviewed artifacts to file.
2. Operator inspects payload.
3. A later Tabulator-side tool may import it.
4. No BroadLister direct API POST until Bo approves a write-back phase.

## Risks

- Tabulator tag types are generic (`folder`, `user`, `ai`, `system`); BroadLister tag kinds are media-specific. Always map through review.
- Tabulator links may include non-media URLs. BroadLister should not import non-media links as articles without operator review.
- Client relevance artifacts must not be mixed into generic link tags.
- Tabulator AI suggestions must remain suggestions, not BroadLister global facts.
