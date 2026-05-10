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
