import type { FastifyInstance } from "fastify";
import { z, type ZodTypeAny } from "zod";
import { normalizeHost, normalizeText, sha256, slugify } from "../core/normalize.js";
import {
  createArticleSchema,
  createCampaignContactSchema,
  createCampaignListSchema,
  createCampaignSchema,
  createCitationSchema,
  createClientApprovalSchema,
  createClientSchema,
  createContactMethodSchema,
  createJournalistSchema,
  createOutletSchema,
  createOutreachEventSchema,
  createOutreachStatusSchema,
  createProvenanceLinkSchema,
  createTagSchema
} from "../core/validation/requests.js";
import { prisma } from "../db/prisma.js";
import { validateCampaignConstraints, validateGlobalStatusFlags, validateNarrativeFit } from "../services/json-validators.js";

const idParams = z.object({ id: z.string().min(1) });
const searchQuery = z.object({ q: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });

function getModel(name: string) {
  return (prisma as any)[name];
}

function stringifyJsonLike(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function validatePayload(resource: string, schema: ZodTypeAny | undefined, payload: any): Promise<any> {
  const data = schema ? schema.parse(payload) : { ...payload };
  if (resource === "journalist") {
    if (data.display_name && !data.display_name_norm) data.display_name_norm = normalizeText(data.display_name);
    data.name_variants_json = stringifyJsonLike(data.name_variants_json) ?? "[]";
    data.languages_json = stringifyJsonLike(data.languages_json);
    data.external_handles_json = stringifyJsonLike(data.external_handles_json);
    if (data.global_status_flags_json && typeof data.global_status_flags_json !== "string") {
      data.global_status_flags_json = await validateGlobalStatusFlags(data.global_status_flags_json);
    }
  }
  if (resource === "outlet") {
    if (data.name && !data.name_norm) data.name_norm = normalizeText(data.name);
    if (data.name && !data.slug) data.slug = slugify(data.name);
    if (data.home_url && !data.home_url_host) data.home_url_host = normalizeHost(data.home_url);
    data.rss_feeds_json = stringifyJsonLike(data.rss_feeds_json);
    data.languages_json = stringifyJsonLike(data.languages_json);
  }
  if (resource === "tag") {
    if (data.name && !data.slug) data.slug = slugify(data.name);
    data.external_ids_json = stringifyJsonLike(data.external_ids_json);
  }
  if (resource === "contactMethod") {
    data.value_norm = data.value_norm ?? normalizeText(data.value);
    data.value_hash = data.value_hash ?? sha256(data.value_norm);
  }
  if (resource === "campaign" && data.constraints_json && typeof data.constraints_json !== "string") {
    data.constraints_json = validateCampaignConstraints(data.constraints_json);
  }
  if (resource === "campaignContact" && data.narrative_fit_json && typeof data.narrative_fit_json !== "string") {
    data.narrative_fit_json = await validateNarrativeFit(data.narrative_fit_json);
  }
  return data;
}

const resources = {
  journalists: { model: "journalist", search: ["display_name", "display_name_norm"], schema: createJournalistSchema },
  outlets: { model: "outlet", search: ["name", "name_norm", "slug"], schema: createOutletSchema },
  articles: { model: "article", search: ["title", "url_canonical"], schema: createArticleSchema },
  tags: { model: "tag", search: ["name", "slug", "kind"], schema: createTagSchema },
  "contact-methods": { model: "contactMethod", search: ["value", "value_norm", "kind"], schema: createContactMethodSchema },
  citations: { model: "citation", search: ["source_url", "source_type", "notes"], schema: createCitationSchema },
  provenance: { model: "provenanceLink", search: ["target_type", "target_id", "target_field"], schema: createProvenanceLinkSchema },
  clients: { model: "client", search: ["slug", "display_name"], schema: createClientSchema },
  campaigns: { model: "campaign", search: ["name", "slug", "objective_short"], schema: createCampaignSchema },
  "campaign-lists": { model: "campaignList", search: ["name", "description"], schema: createCampaignListSchema },
  "campaign-contacts": { model: "campaignContact", search: ["target_rationale", "pitch_angle", "suitability_note"], schema: createCampaignContactSchema },
  "outreach-status": { model: "outreachStatus", search: ["state", "relationship_warmth", "notes_private"], schema: createOutreachStatusSchema },
  "outreach-events": { model: "outreachEvent", search: ["kind", "channel", "summary_private"], schema: createOutreachEventSchema },
  "client-approvals": { model: "clientApproval", search: ["subject_type", "subject_id", "state"], schema: createClientApprovalSchema }
} as const;

export async function registerCrudRoutes(app: FastifyInstance): Promise<void> {
  for (const [path, config] of Object.entries(resources)) {
    const model = getModel(config.model);

    app.get(`/${path}`, async (request) => {
      const query = searchQuery.parse(request.query);
      const where = query.q
        ? {
            OR: config.search.map((field) => ({
              [field]: { contains: query.q }
            }))
          }
        : {};
      return model.findMany({ where, take: query.limit, orderBy: { created_at: "desc" } });
    });

    app.get(`/${path}/:id`, async (request, reply) => {
      const { id } = idParams.parse(request.params);
      const item = await model.findUnique({ where: { id } });
      if (!item) return reply.code(404).send({ error: "not_found" });
      return item;
    });

    app.post(`/${path}`, async (request, reply) => {
      const data = await validatePayload(config.model, config.schema, request.body);
      const item = await model.create({ data });
      return reply.code(201).send(item);
    });

    app.patch(`/${path}/:id`, async (request, reply) => {
      const { id } = idParams.parse(request.params);
      const data = await validatePayload(config.model, undefined, request.body);
      try {
        return await model.update({ where: { id }, data });
      } catch {
        return reply.code(404).send({ error: "not_found" });
      }
    });
  }
}
