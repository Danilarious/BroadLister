import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizeText } from "../core/normalize.js";
import { prisma } from "../db/prisma.js";
import { proposeFromHtml } from "../adapters/url/extract.js";

const ingestBody = z.object({
  url: z.string().url(),
  html: z.string().min(1).optional()
});

export async function registerUrlIngestRoutes(app: FastifyInstance): Promise<void> {
  app.post("/imports/url", async (request, reply) => {
    const body = ingestBody.parse(request.body);
    if (!body.html) {
      return reply.code(400).send({
        error: "html_required",
        message: "Phase 1 accepts operator-provided HTML snapshots only. Live URL fetching remains adapter-scoped."
      });
    }

    const proposal = proposeFromHtml(body.url, body.html);
    const citation = await prisma.citation.create({ data: proposal.citation });
    const outlet = await prisma.outlet.findFirst({ where: { home_url_host: proposal.outlet.home_url_host } });

    const reviewItems = [];
    if (!outlet) {
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "new_outlet",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "create",
            model: "outlet",
            data: {
              name: proposal.outlet.name,
              name_norm: normalizeText(proposal.outlet.name),
              slug: proposal.outlet.slug,
              outlet_type: "other",
              home_url_host: proposal.outlet.home_url_host
            }
          })
        }
      }));
    }

    if (outlet) {
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "new_article",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "create",
            model: "article",
            data: {
              ...proposal.article,
              outlet_id: outlet.id
            }
          })
        }
      }));
    } else {
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "new_article",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "create_after_outlet_review",
            model: "article",
            data: proposal.article,
            blocked_reason: "Outlet must be approved before article can be applied."
          })
        }
      }));
    }

    return reply.code(201).send({ citation, review_items: reviewItems });
  });
}
