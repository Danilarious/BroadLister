import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

const generatedAt = "2026-05-10T16:00:00.000Z";

describe("Tabulator export preview route", () => {
  it("returns preview bundle and omission metadata for reviewed public records", async () => {
    const app = await buildApp();
    const fixture = await createReviewedMediaFixture();
    const unapproved = await createArticleOnly("route-unapproved", true);
    const unprovenanced = await createArticleOnly("route-unprovenanced", false);
    await approve("article_candidate", unprovenanced.article);

    const response = await app.inject({
      method: "GET",
      url: `/tabulator/export/preview?export_id=route-${fixture.suffix}&generated_at=${encodeURIComponent(generatedAt)}&exported_by=tester&source_tag_or_commit=route-test&article_ids=${fixture.article.id},${unapproved.article.id},${unprovenanced.article.id}`
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.bundle).toMatchObject({
      schema: "BroadListerReviewedMediaExportBundle.v1",
      export_id: `route-${fixture.suffix}`,
      exported_at: generatedAt,
      exported_by: "tester",
      source_tag_or_commit: "route-test"
    });
    expect(body.metadata).toMatchObject({
      schema: "BroadListerTabulatorExportPreview.v1",
      export_id: `route-${fixture.suffix}`,
      generated_at: generatedAt,
      mode: "service_only_preview"
    });
    expect(body.metadata.included_article_ids).toEqual([fixture.article.id]);
    expect(body.metadata.omitted_records).toEqual(expect.arrayContaining([
      expect.objectContaining({ broadlister_model: "Article", id: unapproved.article.id, reason: "not_approved" }),
      expect.objectContaining({ broadlister_model: "Article", id: unprovenanced.article.id, reason: "missing_provenance" })
    ]));
  });

  it("does not expose client-private fields or contact methods", async () => {
    const app = await buildApp();
    const fixture = await createReviewedMediaFixture();
    await createPrivateOverlayAndContact(fixture);

    const response = await app.inject({
      method: "GET",
      url: `/tabulator/export/preview?export_id=route-private-${fixture.suffix}&generated_at=${encodeURIComponent(generatedAt)}&article_ids=${fixture.article.id}`
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(fixture.article.title);
    expect(response.body).not.toContain(`ROUTE_PRIVATE_RATIONALE_${fixture.suffix}`);
    expect(response.body).not.toContain(`ROUTE_PRIVATE_NOTE_${fixture.suffix}`);
    expect(response.body).not.toContain(`route-reporter-${fixture.suffix}@example.com`);
    expect(response.body).not.toContain("contact_methods");
    expect(response.json().metadata.safety.contacts_exported).toBe(false);
  });

  it("scopes preview to selected article IDs", async () => {
    const app = await buildApp();
    const first = await createReviewedMediaFixture();
    const second = await createReviewedMediaFixture();

    const response = await app.inject({
      method: "GET",
      url: `/tabulator/export/preview?export_id=route-scope-${first.suffix}&generated_at=${encodeURIComponent(generatedAt)}&article_ids=${second.article.id}`
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().metadata.included_article_ids).toEqual([second.article.id]);
    expect(response.body).toContain(second.article.title);
    expect(response.body).not.toContain(first.article.title);
  });

  it("performs no network calls, file writes, or Tabulator runtime integration", async () => {
    const app = await buildApp();
    const fixture = await createReviewedMediaFixture();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));

    const response = await app.inject({
      method: "GET",
      url: `/tabulator/export/preview?export_id=route-side-effects-${fixture.suffix}&generated_at=${encodeURIComponent(generatedAt)}&article_ids=${fixture.article.id}`
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const routeSource = readFileSync("src/routes/tabulator-export.ts", "utf8");
    const serviceSource = readFileSync("src/services/tabulator-export-preview.ts", "utf8");
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string> };
    expect(routeSource).not.toContain("node:fs");
    expect(routeSource).not.toContain("writeFile");
    expect(routeSource).not.toContain("fetch(");
    expect(serviceSource).not.toContain("node:fs");
    expect(serviceSource).not.toContain("writeFile");
    expect(Object.keys(manifest.dependencies ?? {}).some((name) => name.includes("tabulator"))).toBe(false);
  });

  it("keeps cross-client overlay data out of generic preview output", async () => {
    const app = await buildApp();
    const fixture = await createReviewedMediaFixture();
    const clientA = await createPrivateOverlayAndContact(fixture, "a");
    const clientB = await createPrivateOverlayAndContact(fixture, "b");

    const response = await app.inject({
      method: "GET",
      url: `/tabulator/export/preview?export_id=route-isolation-${fixture.suffix}&generated_at=${encodeURIComponent(generatedAt)}&article_ids=${fixture.article.id}`
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(clientA.privateToken);
    expect(response.body).not.toContain(clientB.privateToken);
    expect(response.body).not.toContain(clientA.client.id);
    expect(response.body).not.toContain(clientB.client.id);
  });
});

async function createReviewedMediaFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const outlet = await prisma.outlet.create({
    data: {
      name: `Route Outlet ${suffix}`,
      name_norm: `route outlet ${suffix}`,
      slug: `route-outlet-${suffix}`,
      outlet_type: "digital",
      home_url_host: `route-${suffix}.example.com`
    }
  });
  const journalist = await prisma.journalist.create({
    data: {
      display_name: `Route Reporter ${suffix}`,
      display_name_norm: `route reporter ${suffix}`,
      name_variants_json: "[]"
    }
  });
  const article = await prisma.article.create({
    data: {
      url: `https://route-${suffix}.example.com/story?utm=test`,
      url_canonical: `https://route-${suffix}.example.com/story`,
      title: `Route Story ${suffix}`,
      outlet_id: outlet.id,
      language: "en",
      excerpt: `Route public excerpt ${suffix}`
    }
  });
  const byline = await prisma.byline.create({
    data: {
      article_id: article.id,
      journalist_id: journalist.id,
      position: 0,
      confidence: "high"
    }
  });
  const tag = await prisma.tag.create({
    data: {
      name: `Route Topic ${suffix}`,
      slug: `topic:route-${suffix}`,
      kind: "topic",
      external_ids_json: JSON.stringify({ ontology_core_id: `route-ontology-${suffix}`, relationship_to_ontology: "exact" })
    }
  });
  const articleTag = await prisma.articleTag.create({
    data: {
      article_id: article.id,
      tag_id: tag.id,
      confidence: "high"
    }
  });
  const citation = await prisma.citation.create({
    data: {
      source_type: "article_url",
      source_url: article.url_canonical,
      observed_at: new Date(generatedAt),
      captured_by: "test"
    }
  });
  await prisma.provenanceLink.createMany({
    data: [
      { citation_id: citation.id, target_type: "Article", target_id: article.id, target_field: "title", assertion_kind: "supports", confidence: "high" },
      { citation_id: citation.id, target_type: "Byline", target_id: byline.id, target_field: "journalist_id", assertion_kind: "supports", confidence: "high" },
      { citation_id: citation.id, target_type: "ArticleTag", target_id: articleTag.id, target_field: "tag_id", assertion_kind: "supports", confidence: "high" }
    ]
  });
  await approve("outlet_candidate", outlet);
  await approve("journalist_candidate", journalist);
  await approve("article_candidate", article);
  await approve("byline_candidate", byline);
  await approve("tag_candidate", tag);
  await approve("article_tag_candidate", articleTag);
  return { suffix, outlet, journalist, article, byline, tag, articleTag };
}

async function createArticleOnly(label: string, withProvenance: boolean) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const outlet = await prisma.outlet.create({
    data: {
      name: `Route ${label} Outlet ${suffix}`,
      name_norm: `route ${label} outlet ${suffix}`,
      slug: `route-${label}-outlet-${suffix}`,
      outlet_type: "digital"
    }
  });
  const article = await prisma.article.create({
    data: {
      url: `https://route-${label}-${suffix}.example.com/story`,
      url_canonical: `https://route-${label}-${suffix}.example.com/story`,
      title: `Route ${label} Story ${suffix}`,
      outlet_id: outlet.id
    }
  });
  if (withProvenance) {
    const citation = await prisma.citation.create({
      data: {
        source_type: "article_url",
        source_url: article.url_canonical,
        observed_at: new Date(generatedAt)
      }
    });
    await prisma.provenanceLink.create({
      data: {
        citation_id: citation.id,
        target_type: "Article",
        target_id: article.id,
        target_field: "title"
      }
    });
  }
  return { outlet, article };
}

async function approve(kind: string, record: { id: string }) {
  return prisma.reviewItem.create({
    data: {
      kind,
      status: "approved",
      proposal_payload_json: JSON.stringify({ action: "create", model: kind, data: {} }),
      current_payload_json: JSON.stringify(record),
      decided_at: new Date(generatedAt),
      decided_by: "test"
    }
  });
}

async function createPrivateOverlayAndContact(fixture: Awaited<ReturnType<typeof createReviewedMediaFixture>>, variant = "") {
  const suffix = `${fixture.suffix}${variant}`;
  const privateToken = `ROUTE_PRIVATE_RATIONALE_${suffix}`;
  const client = await prisma.client.create({
    data: {
      slug: `route-client-${suffix}`,
      display_name: `Route Client ${suffix}`
    }
  });
  const campaign = await prisma.campaign.create({
    data: {
      client_id: client.id,
      name: `Route Campaign ${suffix}`,
      slug: `route-campaign-${suffix}`,
      constraints_json: JSON.stringify({ token: `ROUTE_PRIVATE_CONSTRAINT_${suffix}` })
    }
  });
  const list = await prisma.campaignList.create({
    data: {
      campaign_id: campaign.id,
      name: `Route List ${suffix}`
    }
  });
  await prisma.campaignContact.create({
    data: {
      campaign_list_id: list.id,
      journalist_id: fixture.journalist.id,
      outlet_id: fixture.outlet.id,
      target_rationale: privateToken,
      pitch_angle: `ROUTE_PRIVATE_PITCH_${suffix}`,
      narrative_fit_json: JSON.stringify({ token: `ROUTE_PRIVATE_NARRATIVE_${suffix}` })
    }
  });
  await prisma.clientNote.create({
    data: {
      client_id: client.id,
      journalist_id: fixture.journalist.id,
      body_md: `ROUTE_PRIVATE_NOTE_${suffix}`
    }
  });
  await prisma.contactMethod.create({
    data: {
      subject_type: "journalist",
      journalist_id: fixture.journalist.id,
      kind: "email",
      value: `route-reporter-${fixture.suffix}@example.com`,
      value_norm: `route-reporter-${fixture.suffix}@example.com`,
      value_hash: crypto.createHash("sha256").update(`route-reporter-${fixture.suffix}@example.com`).digest("hex"),
      verification_state: "verified",
      lawful_to_store: true
    }
  });
  return { client, privateToken };
}
