import { describe, expect, it } from "vitest";
import { normalizeText, slugify } from "../src/core/normalize.js";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

function suffix() {
  return crypto.randomUUID();
}

async function outlet(name: string, host?: string) {
  return prisma.outlet.create({
    data: {
      name,
      name_norm: normalizeText(name),
      slug: `${slugify(name)}-${suffix()}`,
      outlet_type: "publication",
      home_url_host: host
    }
  });
}

async function article(title: string, outlet_id: string, url?: string) {
  const canonical = url ?? `https://example.com/${suffix()}`;
  return prisma.article.create({
    data: {
      title,
      url: canonical,
      url_canonical: canonical,
      outlet_id
    }
  });
}

async function journalist(name: string) {
  return prisma.journalist.create({
    data: {
      display_name: name,
      display_name_norm: normalizeText(name),
      name_variants_json: "[]"
    }
  });
}

async function reviewItem(kind: string, proposal: Record<string, unknown>, batchId?: string) {
  return prisma.reviewItem.create({
    data: {
      kind,
      source_import_batch_id: batchId,
      proposal_payload_json: JSON.stringify(proposal)
    }
  });
}

describe("import reconciliation and review approval", () => {
  it("surfaces deterministic duplicate matches for outlets, articles, journalists, and tags", async () => {
    const app = await buildApp();
    const unique = suffix();
    const existingOutlet = await outlet(`Ledger Review ${unique}`, `ledger-${unique}.example`);
    const existingArticle = await article(`Stablecoin policy ${unique}`, existingOutlet.id, `https://ledger-${unique}.example/policy`);
    await journalist(`Avery Match ${unique}`);
    await prisma.tag.create({ data: { name: `Stablecoins ${unique}`, slug: `topic:stablecoins-${unique}`, kind: "topic" } });

    const candidates = await Promise.all([
      reviewItem("outlet_candidate", { action: "create", model: "outlet", data: { name: existingOutlet.name, name_norm: existingOutlet.name_norm, slug: `duplicate-outlet-${unique}`, outlet_type: "publication", home_url_host: existingOutlet.home_url_host } }),
      reviewItem("article_candidate", { action: "create", model: "article", data: { title: existingArticle.title, url: existingArticle.url, url_canonical: existingArticle.url_canonical, outlet_id: existingOutlet.id } }),
      reviewItem("journalist_candidate", { action: "create", model: "journalist", data: { display_name: `Avery Match ${unique}`, display_name_norm: normalizeText(`Avery Match ${unique}`), name_variants_json: "[]" } }),
      reviewItem("tag_candidate", { action: "create", model: "tag", data: { name: `Stablecoins ${unique}`, slug: `topic:stablecoins-${unique}`, kind: "topic" } })
    ]);

    for (const candidate of candidates) {
      const response = await app.inject({ method: "GET", url: `/review/${candidate.id}/context` });
      expect(response.statusCode).toBe(200);
      expect(response.json().matches.length).toBeGreaterThan(0);
      expect(response.json().recommended_action).toBe("match_existing");
    }

    await app.close();
  });

  it("approves linked article, journalist, byline, article-tag, and client relevance proposals safely", async () => {
    const app = await buildApp();
    const unique = suffix();
    const client = await prisma.client.create({ data: { slug: `trace-${unique}`, display_name: `Trace ${unique}` } });
    const outletProposal = await reviewItem("outlet_candidate", {
      action: "create",
      model: "outlet",
      data: {
        name: `CoinDesk ${unique}`,
        name_norm: normalizeText(`CoinDesk ${unique}`),
        slug: `coindesk-${unique}`,
        outlet_type: "publication",
        home_url_host: `coindesk-${unique}.example`
      }
    });
    await app.inject({ method: "POST", url: `/review/${outletProposal.id}/approve`, payload: { decided_by: "test" } });

    const articleUrl = `https://coindesk-${unique}.example/policy/stablecoins`;
    const articleProposal = await reviewItem("article_candidate", {
      action: "create_after_outlet_review",
      model: "article",
      data: {
        title: `Stablecoin settlement ${unique}`,
        url: articleUrl,
        url_canonical: articleUrl,
        outlet_name: `CoinDesk ${unique}`,
        outlet_home_url_host: `coindesk-${unique}.example`
      },
      blocked_reason: "Outlet must be approved first."
    });
    const articleResponse = await app.inject({ method: "POST", url: `/review/${articleProposal.id}/approve`, payload: { decided_by: "test" } });
    expect(articleResponse.statusCode).toBe(200);

    const journalistProposal = await reviewItem("journalist_candidate", {
      action: "create",
      model: "journalist",
      data: {
        display_name: `Ana Paula ${unique}`,
        display_name_norm: normalizeText(`Ana Paula ${unique}`),
        name_variants_json: "[]"
      }
    });
    await app.inject({ method: "POST", url: `/review/${journalistProposal.id}/approve`, payload: { decided_by: "test" } });

    const bylineProposal = await reviewItem("byline_candidate", {
      action: "create_after_article_and_journalist_review",
      model: "byline",
      data: {
        article_url_canonical: articleUrl,
        journalist_display_name: `Ana Paula ${unique}`,
        confidence: "medium"
      }
    });
    const bylineResponse = await app.inject({ method: "POST", url: `/review/${bylineProposal.id}/approve`, payload: { decided_by: "test" } });
    expect(bylineResponse.statusCode).toBe(200);

    const tagProposal = await reviewItem("tag_candidate", {
      action: "create",
      model: "tag",
      data: { name: `Brazil ${unique}`, slug: `topic:brazil-${unique}`, kind: "topic" }
    });
    await app.inject({ method: "POST", url: `/review/${tagProposal.id}/approve`, payload: { decided_by: "test" } });
    const articleTagProposal = await reviewItem("article_tag_candidate", {
      action: "advisory",
      model: "articleTag",
      data: {
        article_url_canonical: articleUrl,
        tag_slug: `topic:brazil-${unique}`,
        confidence: "medium"
      }
    });
    await app.inject({ method: "POST", url: `/review/${articleTagProposal.id}/approve`, payload: { decided_by: "test" } });
    const articleTagAgain = await app.inject({ method: "POST", url: `/review/${articleTagProposal.id}/approve`, payload: { decided_by: "test" } });
    expect(articleTagAgain.statusCode).toBe(400);

    const articleRecord = await prisma.article.findUniqueOrThrow({ where: { url_canonical: articleUrl } });
    const tagRecord = await prisma.tag.findUniqueOrThrow({ where: { slug: `topic:brazil-${unique}` } });
    expect(await prisma.articleTag.count({ where: { article_id: articleRecord.id, tag_id: tagRecord.id } })).toBe(1);

    const relevanceProposal = await reviewItem("client_relevance_candidate", {
      action: "advisory",
      model: "clientRelevance",
      data: {
        client_slug: client.slug,
        article_url_canonical: articleUrl,
        label: "Trace Finance relevance candidate",
        confidence: "medium",
        rationale: "Stablecoin policy relevance"
      }
    });
    const relevanceResponse = await app.inject({ method: "POST", url: `/review/${relevanceProposal.id}/approve`, payload: { decided_by: "test" } });
    expect(relevanceResponse.statusCode).toBe(200);
    expect(await prisma.clientNote.count({ where: { client_id: client.id } })).toBe(1);

    await app.close();
  });

  it("keeps contact methods unverified and not lawful-to-store by default", async () => {
    const app = await buildApp();
    const unique = suffix();
    await journalist(`Contact Reporter ${unique}`);
    const candidate = await reviewItem("contact_method_candidate", {
      action: "attach_after_journalist_review",
      model: "contactMethod",
      data: {
        subject_type: "journalist",
        journalist_display_name: `Contact Reporter ${unique}`,
        kind: "email",
        value: `contact-${unique}@example.com`
      }
    });

    const response = await app.inject({ method: "POST", url: `/review/${candidate.id}/approve`, payload: { decided_by: "test" } });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      verification_state: "unverified",
      lawful_to_store: false
    });
  });

  it("rejects and defers proposals without mutating global records", async () => {
    const app = await buildApp();
    const unique = suffix();
    const rejected = await reviewItem("journalist_candidate", {
      action: "create",
      model: "journalist",
      data: { display_name: `Reject Me ${unique}`, display_name_norm: normalizeText(`Reject Me ${unique}`), name_variants_json: "[]" }
    });
    const deferred = await reviewItem("journalist_candidate", {
      action: "create",
      model: "journalist",
      data: { display_name: `Defer Me ${unique}`, display_name_norm: normalizeText(`Defer Me ${unique}`), name_variants_json: "[]" }
    });

    expect((await app.inject({ method: "POST", url: `/review/${rejected.id}/reject`, payload: { decided_by: "test" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/review/${deferred.id}/defer`, payload: { decided_by: "test" } })).statusCode).toBe(200);
    await app.close();

    expect(await prisma.journalist.count({ where: { display_name: { contains: unique } } })).toBe(0);
  });

  it("groups imports by batch and filters review items by batch and kind", async () => {
    const app = await buildApp();
    const unique = suffix();
    const response = await app.inject({
      method: "POST",
      url: "/imports/csv",
      payload: {
        label: `Reconciliation batch ${unique}`,
        csv: `name,outlet,email,beat\nBatch Reporter ${unique},Batch Outlet ${unique},batch-${unique}@example.com,stablecoins\n`
      }
    });
    expect(response.statusCode).toBe(201);
    const batch = response.json();

    const batchItems = await app.inject({ method: "GET", url: `/review?source_import_batch_id=${batch.id}` });
    const contactItems = await app.inject({ method: "GET", url: `/review?source_import_batch_id=${batch.id}&kind=contact_method_candidate` });
    await app.close();

    expect(batchItems.statusCode).toBe(200);
    expect(batchItems.json()).toHaveLength(4);
    expect(contactItems.statusCode).toBe(200);
    expect(contactItems.json()).toHaveLength(1);
  });
});
