import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { applyReviewItem } from "../services/review.js";

const idParams = z.object({ id: z.string().min(1) });
const decisionBody = z.object({ decided_by: z.string().optional(), decision_note: z.string().optional() });

export async function registerReviewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/review", async (request) => {
    const query = z.object({
      status: z.string().default("pending"),
      kind: z.string().optional(),
      source_import_batch_id: z.string().optional()
    }).parse(request.query);

    return prisma.reviewItem.findMany({
      where: {
        status: query.status,
        kind: query.kind,
        source_import_batch_id: query.source_import_batch_id
      },
      orderBy: { created_at: "asc" }
    });
  });

  app.post("/review/:id/approve", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = decisionBody.parse(request.body ?? {});
    try {
      return await applyReviewItem(id, body.decided_by);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/review/:id/reject", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = decisionBody.parse(request.body ?? {});
    try {
      return await prisma.reviewItem.update({
        where: { id },
        data: {
          status: "rejected",
          decided_at: new Date(),
          decided_by: body.decided_by ?? "operator",
          decision_note: body.decision_note
        }
      });
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
  });
}

