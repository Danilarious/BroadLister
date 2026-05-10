# BroadLister Bucketer Bridge Contract

## Status

Planning-only. No adapter is implemented in this phase.

## Intent

Define how Bucketer signals and buckets may become BroadLister review candidates later, and how BroadLister may provide monitoring hints back to Bucketer without runtime coupling.

Bucketer watches external sources and emits signals. BroadLister reviews media facts and client-specific campaign relevance. The safe bridge is snapshot/file based and review-gated.

## Boundary Rules

- BroadLister does not require Bucketer at runtime.
- BroadLister does not call Bucketer APIs in the next implementation phase.
- BroadLister does not write Bucketer buckets, signals, sources, scoring, or routing rules.
- Bucketer signals create BroadLister review items only.
- BroadLister client relevance must not become Bucketer scoring logic without explicit operator sanitization and approval.
- No autonomous outreach.

## Mapping Summary

| Bucketer | BroadLister |
| --- | --- |
| `Signal.url` | article candidate URL |
| `Signal.title` | article candidate title |
| `Signal.summary` | article excerpt / review summary |
| `Signal.source_id` | citation source id or outlet/source hint |
| `Signal.source_type` | citation source type metadata |
| `Signal.published_at` | article published date |
| `Signal.score` | import review context only, not target score |
| `Signal.bucket_id` | source bucket hint, not global tag by default |
| `Signal.tags` | tag candidates or ontology mapping candidates |
| `Signal.raw_metadata` | citation notes / import metadata |
| `Bucket.id/name` | monitoring topic hint or ontology concept reference |

## BroadListerBucketerSignalCandidate

Use this for Bucketer-to-BroadLister snapshots.

```ts
interface BroadListerBucketerSignalCandidate {
  schema: "BroadListerBucketerSignalCandidate.v1";
  source_system: "bucketer";
  source_record_id: string;
  imported_at: string;
  signal: {
    id: string;
    url: string;
    title: string;
    summary?: string;
    source_id?: string;
    source_type: "rss" | "web" | "social" | "manual" | "other";
    published_at?: string;
    score?: number;
    bucket_id?: string;
    tags: string[];
    raw_metadata?: Record<string, unknown>;
  };
  bucket?: {
    id: string;
    name: string;
    description?: string;
    keywords?: string[];
    tags?: string[];
  };
  ontology_hints?: Array<{
    label: string;
    ontology_core_id?: string;
    ontology_core_slug?: string;
    relationship: "exact" | "broader" | "narrower" | "related";
    confidence: "low" | "medium" | "high";
  }>;
  proposed_broadlister_actions: Array<
    | "article_candidate"
    | "outlet_candidate"
    | "journalist_candidate"
    | "byline_candidate"
    | "tag_candidate"
    | "article_tag_candidate"
    | "client_relevance_candidate"
  >;
  provenance: {
    observed_at: string;
    source_snapshot_ref?: string;
    source_url?: string;
    payload_hash?: string;
    score_explain?: string;
  };
}
```

## BroadLister Monitoring Hint

Use this later for BroadLister-to-Bucketer suggestions. It must be advisory, sanitized, and operator-triggered.

```ts
interface BroadListerBucketerMonitoringHint {
  schema: "BroadListerBucketerMonitoringHint.v1";
  source_system: "broadlister";
  exported_at: string;
  exported_by: string;
  hint_type: "outlet_source" | "topic_watch" | "journalist_watch" | "keyword_watch";
  public_only: true;
  basis: {
    outlet_ids?: string[];
    journalist_ids?: string[];
    article_ids?: string[];
    tag_ids?: string[];
    citation_ids: string[];
  };
  suggested_bucket?: {
    id?: string;
    name: string;
    description?: string;
    keywords: string[];
    tags: string[];
    ontology_core_ids?: string[];
  };
  exclusions: {
    client_private_data_included: false;
    contact_methods_included: false;
    outreach_state_included: false;
    campaign_narrative_included: false;
  };
  provenance: Array<{
    citation_id: string;
    source_url?: string;
    observed_at: string;
    confidence: "low" | "medium" | "high";
  }>;
}
```

## Import Flow

1. Operator exports a Bucketer signal snapshot.
2. BroadLister imports the snapshot as `ImportBatch(source_type='bucketer_signal_snapshot')`.
3. BroadLister creates review items only.
4. Existing reconciliation handles article/outlet/journalist/tag matches.
5. Client relevance candidates are scoped to a client only if the snapshot explicitly carries an approved client slug and the operator confirms it.

## Export Flow

1. Operator selects public-only reviewed BroadLister records.
2. BroadLister creates monitoring hint files.
3. Operator inspects for leakage.
4. Bucketer may ingest later through its own operator-approved path.

## Recommended Timing

Do not implement Bucketer-to-BroadLister import first. It is useful, but it depends on a stable ontology/tag mapping layer so signal tags do not create taxonomy debt.

Implement after:

- ontology mapping snapshot review exists,
- source leakage tests cover client/campaign overlay fields,
- at least one Tabulator/BroadLister link artifact fixture exists.

## Risks

- Bucketer scores could be mistaken for BroadLister target scores. Keep them import-context-only.
- Bucketer bucket tags may be operational routing terms, not media ontology tags.
- Client relevance may leak into monitoring hints if not explicitly stripped.
- Source feeds can produce noisy or duplicated article candidates; import through review queue only.
