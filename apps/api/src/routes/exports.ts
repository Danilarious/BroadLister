import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { approvalLogMarkdown, markdownBrief, mediaListCsv, sourceAuditMarkdown } from "../services/exports.js";

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/exports/:clientId/campaign-lists/:campaignListId/media-list.csv", async (request, reply) => {
    const { clientId, campaignListId } = z.object({ clientId: z.string(), campaignListId: z.string() }).parse(request.params);
    try {
      const body = await mediaListCsv(clientId, campaignListId);
      return reply.type("text/csv").send(body);
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
  });

  app.get("/exports/:clientId/campaign-lists/:campaignListId/brief.md", async (request, reply) => {
    const { clientId, campaignListId } = z.object({ clientId: z.string(), campaignListId: z.string() }).parse(request.params);
    try {
      const body = await markdownBrief(clientId, campaignListId);
      return reply.type("text/markdown").send(body);
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
  });

  app.get("/exports/:clientId/source-audit.md", async (request, reply) => {
    const { clientId } = z.object({ clientId: z.string() }).parse(request.params);
    return reply.type("text/markdown").send(await sourceAuditMarkdown(clientId));
  });

  app.get("/exports/:clientId/approval-log.md", async (request, reply) => {
    const { clientId } = z.object({ clientId: z.string() }).parse(request.params);
    return reply.type("text/markdown").send(await approvalLogMarkdown(clientId));
  });
}
