import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizeText, slugify } from "../core/normalize.js";
import { prisma } from "../db/prisma.js";
import { proposeFromHtml } from "../adapters/url/extract.js";

const ingestBody = z.object({
  url: z.string().url(),
  html: z.string().min(1).optional()
});

async function fetchHtml(url: string): Promise<{ html?: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "BroadLister local operator ingest/0.1 (+review-gated media intelligence)",
        "accept": "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) return { error: `Fetch failed with HTTP ${response.status}. Paste HTML manually to extract offline.` };
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return { error: `Expected HTML but received ${contentType || "unknown content type"}. Paste HTML manually to extract offline.` };
    const text = await response.text();
    if (text.length > 2_000_000) return { error: "HTML response exceeded 2 MB safety limit. Paste a smaller article HTML snapshot." };
    return { html: text };
  } catch (error) {
    return { error: `Fetch blocked or failed: ${(error as Error).message}. Paste HTML manually to extract offline.` };
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerUrlIngestRoutes(app: FastifyInstance): Promise<void> {
  app.post("/imports/url", async (request, reply) => {
    const body = ingestBody.parse(request.body);
    let html = body.html;
    let fetch_error: string | undefined;
    if (!html) {
      const fetched = await fetchHtml(body.url);
      html = fetched.html;
      fetch_error = fetched.error;
    }
    if (!html) {
      return reply.code(400).send({
        error: "html_unavailable",
        message: fetch_error ?? "No HTML was available for extraction."
      });
    }

    const proposal = proposeFromHtml(body.url, html);
    const citation = await prisma.citation.create({ data: proposal.citation });
    const outlet = await prisma.outlet.findFirst({ where: { home_url_host: proposal.outlet.home_url_host } });

    const reviewItems = [];
    if (!outlet) {
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "outlet_candidate",
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
          kind: "article_candidate",
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
          kind: "article_candidate",
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

    for (const author of proposal.authors) {
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "journalist_candidate",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "create",
            model: "journalist",
            data: {
              display_name: author,
              display_name_norm: normalizeText(author),
              name_variants_json: "[]"
            }
          })
        }
      }));
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "byline_candidate",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "create_after_article_and_journalist_review",
            model: "byline",
            data: {
              article_url_canonical: proposal.article.url_canonical,
              journalist_display_name: author,
              confidence: "medium"
            },
            blocked_reason: "Approve or match article and journalist first, then create the byline link."
          })
        }
      }));
    }

    for (const tag of proposal.tags) {
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "tag_candidate",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "create",
            model: "tag",
            data: {
              name: tag.name,
              slug: tag.slug || `${tag.kind}:${slugify(tag.name)}`,
              kind: tag.kind,
              description: tag.reason
            }
          })
        }
      }));
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "article_tag_candidate",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "advisory",
            model: "articleTag",
            data: {
              article_url_canonical: proposal.article.url_canonical,
              tag_slug: tag.slug,
              confidence: tag.confidence,
              reason: tag.reason
            },
            blocked_reason: "Approve or match article and tag first, then attach this article tag."
          })
        }
      }));
    }

    if (proposal.client_relevance) {
      reviewItems.push(await prisma.reviewItem.create({
        data: {
          kind: "client_relevance_candidate",
          source_citation_id: citation.id,
          proposal_payload_json: JSON.stringify({
            action: "advisory",
            model: "clientRelevance",
            data: {
              article_url_canonical: proposal.article.url_canonical,
              ...proposal.client_relevance
            },
            blocked_reason: "Client relevance is advisory and must be copied into a client/campaign overlay by the operator."
          })
        }
      }));
    }

    return reply.code(201).send({
      citation,
      review_items: reviewItems,
      summary: {
        fetch_error,
        extraction_source: proposal.extraction.source,
        article_title: proposal.article.title,
        outlet_name: proposal.outlet.name,
        authors: proposal.authors,
        tags: proposal.tags.map((tag) => tag.name),
        client_relevance: proposal.client_relevance?.label
      }
    });
  });
}
