import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizeText, slugify } from "../core/normalize.js";
import { prisma } from "../db/prisma.js";
import { validateCampaignConstraints, validateGlobalStatusFlags, validateNarrativeFit } from "../services/json-validators.js";

const idParams = z.object({ id: z.string().min(1) });
const searchQuery = z.object({ q: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });

function getModel(name: string) {
  return (prisma as any)[name];
}

async function validatePayload(resource: string, payload: any): Promise<any> {
  const data = { ...payload };
  if (resource === "journalist") {
    if (data.display_name && !data.display_name_norm) data.display_name_norm = normalizeText(data.display_name);
    if (data.global_status_flags_json && typeof data.global_status_flags_json !== "string") {
      data.global_status_flags_json = await validateGlobalStatusFlags(data.global_status_flags_json);
    }
  }
  if (resource === "outlet") {
    if (data.name && !data.name_norm) data.name_norm = normalizeText(data.name);
    if (data.name && !data.slug) data.slug = slugify(data.name);
  }
  if (resource === "tag") {
    if (data.name && !data.slug) data.slug = slugify(data.name);
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
  journalists: { model: "journalist", search: ["display_name", "display_name_norm"] },
  outlets: { model: "outlet", search: ["name", "name_norm", "slug"] },
  articles: { model: "article", search: ["title", "url_canonical"] },
  tags: { model: "tag", search: ["name", "slug", "kind"] },
  "contact-methods": { model: "contactMethod", search: ["value", "value_norm", "kind"] },
  citations: { model: "citation", search: ["source_url", "source_type", "notes"] },
  provenance: { model: "provenanceLink", search: ["target_type", "target_id", "target_field"] },
  clients: { model: "client", search: ["slug", "display_name"] },
  campaigns: { model: "campaign", search: ["name", "slug", "objective_short"] },
  "campaign-lists": { model: "campaignList", search: ["name", "description"] },
  "campaign-contacts": { model: "campaignContact", search: ["target_rationale", "pitch_angle", "suitability_note"] },
  "outreach-status": { model: "outreachStatus", search: ["state", "relationship_warmth", "notes_private"] },
  "outreach-events": { model: "outreachEvent", search: ["kind", "channel", "summary_private"] }
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
      const data = await validatePayload(config.model, request.body);
      const item = await model.create({ data });
      return reply.code(201).send(item);
    });

    app.patch(`/${path}/:id`, async (request, reply) => {
      const { id } = idParams.parse(request.params);
      const data = await validatePayload(config.model, request.body);
      try {
        return await model.update({ where: { id }, data });
      } catch {
        return reply.code(404).send({ error: "not_found" });
      }
    });
  }
}

