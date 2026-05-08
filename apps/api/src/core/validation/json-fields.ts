import { z } from "zod";
import { confidences, publicPreferenceFlags } from "./enums.js";

export const globalStatusFlagsSchema = z.object({
  version: z.literal(1),
  flags: z.array(z.object({
    flag: z.enum(publicPreferenceFlags),
    citation_id: z.string().min(1)
  }))
});

export const campaignConstraintsSchema = z.object({
  version: z.literal(1),
  approved_messaging: z.array(z.string()).default([]),
  approved_claims: z.array(z.string()).default([]),
  forbidden_claims: z.array(z.string()).default([]),
  legal_caveats: z.array(z.string()).default([]),
  embargo_kind: z.string().optional(),
  exclusivity_plan: z.string().optional(),
  tiering_and_sequencing: z.string().optional(),
  outreach_windows: z.array(z.string()).default([]),
  spokesperson_availability: z.array(z.string()).default([]),
  geographic_constraints: z.array(z.string()).default([]),
  sensitive_topics: z.array(z.string()).default([]),
  competitor_conflicts: z.array(z.string()).default([]),
  approval_requirements: z.array(z.string()).default([]),
  source_fact_check_requirements: z.array(z.string()).default([])
});

export const narrativeFitSchema = z.object({
  version: z.literal(1),
  narrative_angle: z.string().optional(),
  coverage_rationale: z.string().optional(),
  evidence_byline_ids: z.array(z.string()).default([]),
  likely_objections: z.array(z.string()).default([]),
  preferred_framing: z.string().optional(),
  competing_narratives: z.array(z.string()).default([]),
  confidence: z.enum(confidences).optional(),
  source_citations_json: z.array(z.string()).default([]),
  operator_notes: z.string().optional(),
  exclusivity_window: z.string().optional()
});

export function parseJsonField<T>(value: string | null | undefined, schema: z.ZodType<T>): T | null {
  if (!value) return null;
  return schema.parse(JSON.parse(value));
}

export function stringifyValidatedJson<T>(value: unknown, schema: z.ZodType<T>): string {
  return JSON.stringify(schema.parse(value));
}

