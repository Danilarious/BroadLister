import { z } from "zod";
import { approvalStates, campaignStates, confidences, relationshipWarmths, tagKinds, verificationStates } from "./enums.js";

const optionalJsonText = z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional();

export const createJournalistSchema = z.object({
  display_name: z.string().min(1),
  display_name_norm: z.string().optional(),
  name_variants_json: optionalJsonText,
  bio_short: z.string().optional(),
  home_country: z.string().optional(),
  home_region: z.string().optional(),
  languages_json: optionalJsonText,
  external_handles_json: optionalJsonText,
  global_status_flags_json: optionalJsonText,
  merge_status: z.enum(["active", "merged_into", "deprecated"]).optional()
});

export const createOutletSchema = z.object({
  name: z.string().min(1),
  name_norm: z.string().optional(),
  slug: z.string().optional(),
  outlet_type: z.string().default("other"),
  home_url: z.string().url().optional(),
  home_url_host: z.string().optional(),
  rss_feeds_json: optionalJsonText,
  region: z.string().optional(),
  country: z.string().optional(),
  languages_json: optionalJsonText,
  notes_public: z.string().optional()
});

export const createArticleSchema = z.object({
  url: z.string().url(),
  url_canonical: z.string().url(),
  title: z.string().min(1),
  outlet_id: z.string().min(1),
  byline_text: z.string().optional(),
  language: z.string().optional(),
  excerpt: z.string().optional()
});

export const createTagSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  kind: z.enum(tagKinds),
  description: z.string().optional(),
  external_ids_json: optionalJsonText
});

export const createContactMethodSchema = z.object({
  subject_type: z.enum(["journalist", "outlet"]),
  journalist_id: z.string().optional(),
  outlet_id: z.string().optional(),
  kind: z.enum(["email", "phone", "dm_handle", "tipline", "form_url", "mail"]),
  value: z.string().min(1),
  value_norm: z.string().optional(),
  value_hash: z.string().optional(),
  verification_state: z.enum(verificationStates).optional(),
  lawful_to_store: z.boolean().optional(),
  is_primary: z.boolean().optional(),
  verified_via_citation_id: z.string().optional(),
  notes: z.string().optional()
}).refine((value) => Boolean(value.journalist_id) !== Boolean(value.outlet_id), {
  message: "Exactly one of journalist_id or outlet_id is required."
});

export const createCitationSchema = z.object({
  source_type: z.enum(["url", "csv_import", "bucketer_signal", "tabulator_artifact", "manual_entry", "sheet_row", "api"]),
  source_url: z.string().url().optional(),
  source_local_path: z.string().optional(),
  observed_at: z.coerce.date().default(() => new Date()),
  captured_by: z.string().optional(),
  notes: z.string().optional(),
  payload_hash: z.string().optional()
});

export const createClientSchema = z.object({
  slug: z.string().min(1),
  display_name: z.string().min(1)
});

export const createCampaignSchema = z.object({
  client_id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().optional(),
  objective_short: z.string().optional(),
  embargo_until: z.coerce.date().optional(),
  state: z.enum(campaignStates).optional(),
  lead_operator: z.string().optional(),
  constraints_json: optionalJsonText,
  constraints_required: z.boolean().optional()
});

export const createCampaignListSchema = z.object({
  campaign_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  state: z.string().optional()
});

export const createCampaignContactSchema = z.object({
  campaign_list_id: z.string().min(1),
  journalist_id: z.string().optional(),
  outlet_id: z.string().optional(),
  target_score: z.number().int().min(1).max(5).optional(),
  target_rationale: z.string().optional(),
  pitch_angle: z.string().optional(),
  suitability_note: z.string().optional(),
  exclusion_flag: z.boolean().optional(),
  exclusion_reason: z.string().optional(),
  embargo_note: z.string().optional(),
  approval_state: z.enum(approvalStates).optional(),
  narrative_fit_json: optionalJsonText
}).refine((value) => Boolean(value.journalist_id) || Boolean(value.outlet_id), {
  message: "At least one of journalist_id or outlet_id is required."
});

export const createOutreachStatusSchema = z.object({
  client_id: z.string().min(1),
  journalist_id: z.string().min(1),
  state: z.enum(["none", "planned", "approved", "contacted", "replied", "declined", "hold", "blacklisted_for_client"]).optional(),
  relationship_warmth: z.enum(relationshipWarmths).optional(),
  notes_private: z.string().optional()
});

export const createOutreachEventSchema = z.object({
  client_id: z.string().min(1),
  journalist_id: z.string().min(1),
  campaign_id: z.string().optional(),
  kind: z.enum(["note", "planned", "approved_for_outreach", "contacted", "replied", "declined", "meeting_held", "coverage_published", "retracted"]),
  channel: z.enum(["email", "call", "event", "dm", "other"]).optional(),
  summary_private: z.string().optional(),
  external_ref: z.string().optional(),
  created_by: z.string().optional()
});

export const createClientApprovalSchema = z.object({
  client_id: z.string().min(1),
  subject_type: z.string().min(1),
  subject_id: z.string().min(1),
  state: z.enum(["pending", "approved", "rejected", "revoked"]).optional(),
  note: z.string().optional()
});

export const createProvenanceLinkSchema = z.object({
  citation_id: z.string().min(1),
  target_type: z.string().min(1),
  target_id: z.string().min(1),
  target_field: z.string().optional(),
  assertion_kind: z.enum(["supports", "contradicts", "proposes"]).optional(),
  confidence: z.enum(confidences).optional()
});
