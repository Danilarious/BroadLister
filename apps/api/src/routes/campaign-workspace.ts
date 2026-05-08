import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

export async function registerCampaignWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workspace/:clientId", async (request, reply) => {
    const { clientId } = z.object({ clientId: z.string() }).parse(request.params);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        campaigns: {
          include: {
            lists: {
              include: {
                contacts: {
                  include: {
                    journalist: true,
                    outlet: true
                  }
                }
              }
            }
          }
        },
        outreach_statuses: true,
        approvals: true
      }
    });
    if (!client) return reply.code(404).send({ error: "not_found" });
    return client;
  });

  app.get("/workspace/:clientId/journalists/:journalistId/status", async (request) => {
    const { clientId, journalistId } = z.object({ clientId: z.string(), journalistId: z.string() }).parse(request.params);
    return prisma.outreachStatus.findUnique({
      where: { client_id_journalist_id: { client_id: clientId, journalist_id: journalistId } }
    });
  });
}

