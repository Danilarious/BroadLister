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

export type ImportBatch = ApiRecord & {
  label: string;
  source_type: string;
  state: string;
  row_count: number;
};

export type Client = ApiRecord & {
  slug: string;
  display_name: string;
};

