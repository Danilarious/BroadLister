export type ResourceName = "journalists" | "outlets" | "articles" | "tags";

export type ApiRecord = Record<string, unknown> & {
  id: string;
  created_at?: string;
  updated_at?: string;
};

export type ReviewItem = ApiRecord & {
  kind: string;
  status: string;
  proposal_payload_json: string;
  current_payload_json?: string;
  source_import_batch_id?: string;
  decision_note?: string;
};

export type ReviewMatch = {
  model: string;
  id: string;
  label: string;
  confidence: "low" | "medium" | "high";
  reason: string;
};

export type ReviewDependency = {
  model: string;
  status: "resolved" | "missing";
  label: string;
  id?: string;
  reason: string;
};

export type ReviewContext = {
  summary: string;
  matches: ReviewMatch[];
  dependencies: ReviewDependency[];
  recommended_action: "create_new" | "match_existing" | "resolve_dependencies" | "advisory_apply" | "reject_or_defer";
  proposal: Record<string, unknown>;
};

export type ImportBatch = ApiRecord & {
  label: string;
  source_type: string;
  state: string;
  row_count: number;
};

export type CsvPreview = {
  row_count: number;
  columns: string[];
  detected_mapping: Record<string, string>;
  sample: Array<{ raw: Record<string, string>; mapped: Record<string, string> }>;
};

export type UrlIngestSummary = {
  fetch_error?: string;
  extraction_source: string;
  article_title: string;
  outlet_name: string;
  authors: string[];
  tags: string[];
  client_relevance?: string;
};

export type UrlIngestResult = {
  import_batch?: ImportBatch;
  review_items: ReviewItem[];
  summary: UrlIngestSummary;
};

export type OntologyPreviewRow = {
  source_system: string;
  source_version: string;
  source_snapshot_id?: string;
  source_snapshot_label?: string;
  source_record_id: string;
  source_concept_id?: string;
  name: string;
  kind: string;
  source_kind: string;
  suggested_tag_kind: string;
  external_id?: string;
  concept_slug: string;
  suggested_tag_slug: string;
  mapping_status: "already_mapped" | "match_existing" | "create_new" | "conflict" | "duplicate_in_snapshot";
  suggested_match?: {
    id: string;
    slug: string;
    name: string;
    kind: string;
  };
  confidence: "low" | "medium" | "high";
  reason: string;
  conflict_reasons: string[];
  field_changes: Array<{
    field: string;
    current?: unknown;
    proposed: unknown;
    action: "create" | "update" | "unchanged" | "add_external_id" | "conflict";
  }>;
  external_ids_to_add: Record<string, string>;
  provenance_summary: {
    source_system: string;
    source_version: string;
    source_snapshot_id?: string;
    source_snapshot_label?: string;
    exported_at?: string;
    observed_at: string;
    rationale?: string;
  };
};

export type OntologySnapshotPreview = {
  schema: "BroadListerOntologySnapshotPreview.v1";
  source_system: string;
  source_version: string;
  concept_count: number;
  rows: OntologyPreviewRow[];
};

export type OntologyImportResult = {
  import_batch: ImportBatch;
  review_items: ReviewItem[];
  preview: OntologySnapshotPreview;
};

export type Client = ApiRecord & {
  slug: string;
  display_name: string;
};

export type CampaignContact = ApiRecord & {
  journalist_id?: string;
  outlet_id?: string;
  target_score?: number;
  target_rationale?: string;
  pitch_angle?: string;
  suitability_note?: string;
  exclusion_flag?: boolean;
  exclusion_reason?: string;
  approval_state: string;
  narrative_fit_json?: string;
  journalist?: ApiRecord & { display_name?: string };
  outlet?: ApiRecord & { name?: string };
};

export type CampaignList = ApiRecord & {
  name: string;
  contacts: CampaignContact[];
};

export type Campaign = ApiRecord & {
  name: string;
  slug: string;
  constraints_json?: string;
  constraints_required?: boolean;
  lists: CampaignList[];
};

export type CampaignWorkspace = Client & {
  campaigns: Campaign[];
  outreach_statuses: ApiRecord[];
  approvals: ApiRecord[];
};

export type TabulatorExportPreviewArticle = {
  broadlister_article_id: string;
  canonical_url: string;
  title: string;
  outlet_id: string;
  outlet_name: string;
};

export type TabulatorExportPreviewOutlet = {
  broadlister_outlet_id: string;
  name: string;
  slug: string;
};

export type TabulatorExportPreviewByline = {
  broadlister_byline_id: string;
  broadlister_article_id: string;
  broadlister_journalist_id: string;
  journalist_display_name: string;
};

export type TabulatorExportPreviewOmittedRecord = {
  broadlister_model: string;
  id: string;
  reason: string;
  detail?: string;
};

export type TabulatorExportPreview = {
  bundle: {
    schema: "BroadListerReviewedMediaExportBundle.v1";
    export_schema_version: "v1";
    export_id: string;
    exported_at: string;
    exported_by: string;
    source_system: "broadlister";
    export_scope: "reviewed_public_media";
    source_tag_or_commit?: string;
    validation_limits: string[];
    eligibility_policy: {
      requires_reviewed_records: boolean;
      requires_provenance: boolean;
      excludes_client_overlays: boolean;
      excludes_outreach_fields: boolean;
    };
    articles: TabulatorExportPreviewArticle[];
    outlets: TabulatorExportPreviewOutlet[];
    bylines: TabulatorExportPreviewByline[];
    tags: Array<{ broadlister_tag_id: string; name: string; kind: string; slug: string }>;
    provenance: Array<{ packet_id: string; citation_id: string; target: { broadlister_model: string; broadlister_id: string; field?: string } }>;
    artifacts: Array<{ artifact_id: string; stable_export_key: string; review_state: "reviewed" }>;
    omitted: TabulatorExportPreviewOmittedRecord[];
    redaction_report: {
      policy: string;
      redacted_field_count: number;
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
  metadata: {
    schema: "BroadListerTabulatorExportPreview.v1";
    export_id: string;
    generated_at: string;
    mode: "service_only_preview";
    included_article_ids: string[];
    omitted_records: TabulatorExportPreviewOmittedRecord[];
    safety: {
      route_added: boolean;
      ui_added: boolean;
      file_writer_added: boolean;
      network_calls_allowed: boolean;
      tabulator_runtime_dependency_allowed: boolean;
      contacts_exported: boolean;
      client_overlay_fields_excluded: boolean;
    };
  };
};
