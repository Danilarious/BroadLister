import { prisma } from "../db/prisma.js";
import { globalStatusFlagsSchema, narrativeFitSchema, campaignConstraintsSchema, stringifyValidatedJson } from "../core/validation/json-fields.js";

export async function validateGlobalStatusFlags(value: unknown): Promise<string> {
  const parsed = globalStatusFlagsSchema.parse(value);
  const citationIds = parsed.flags.map((entry) => entry.citation_id);
  const count = await prisma.citation.count({ where: { id: { in: citationIds } } });
  if (count !== new Set(citationIds).size) {
    throw new Error("Every global status flag must reference an existing citation.");
  }
  return JSON.stringify(parsed);
}

export async function validateNarrativeFit(value: unknown): Promise<string> {
  const parsed = narrativeFitSchema.parse(value);
  if (parsed.evidence_byline_ids.length > 0) {
    const count = await prisma.byline.count({ where: { id: { in: parsed.evidence_byline_ids } } });
    if (count !== new Set(parsed.evidence_byline_ids).size) {
      throw new Error("Narrative fit evidence bylines must exist.");
    }
  }
  if (parsed.source_citations_json.length > 0) {
    const count = await prisma.citation.count({ where: { id: { in: parsed.source_citations_json } } });
    if (count !== new Set(parsed.source_citations_json).size) {
      throw new Error("Narrative fit source citations must exist.");
    }
  }
  return JSON.stringify(parsed);
}

export function validateCampaignConstraints(value: unknown): string {
  return stringifyValidatedJson(value, campaignConstraintsSchema);
}

