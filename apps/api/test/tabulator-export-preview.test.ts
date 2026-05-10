import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "../src/db/prisma.js";
import { buildTabulatorExportPreview } from "../src/services/tabulator-export-preview.js";

const exportedAt = "2026-05-10T15:00:00.000Z";

describe("Tabulator DB-backed export preview service", () => {
  it("includes reviewed public records with provenance and omits unapproved or unprovenanced articles", async () => {
    const fixture = await createReviewedMediaFixture();
    const unapproved = await createArticleOnly("unapproved", true);
    const unprovenanced = await createArticleOnly("unprovenanced", false);
    await approve("article_candidate", unprovenanced.article);

    const preview = await buildTabulatorExportPreview({
      exportId: `preview-${fixture.suffix}`,
      exportedAt,
      exportedBy: "test",
      sourceTagOrCommit: "test-preview",
      articleIds: [fixture.article.id, unapproved.article.id, unprovenanced.article.id]
    });

    expect(preview.bundle.schema).toBe("BroadListerReviewedMediaExportBundle.v1");
    expect(preview.metadata.schema).toBe("BroadListerTabulatorExportPreview.v1");
    expect(preview.metadata.included_article_ids).toContain(fixture.article.id);
    expect(preview.bundle.articles.find((article) => article.broadlister_article_id === fixture.article.id)).toMatchObject({
      canonical_url: fixture.article.url_canonical,
      title: fixture.article.title,
      outlet_name: fixture.outlet.name
    });
    expect(preview.bundle.bylines.find((byline) => byline.broadlister_byline_id === fixture.byline.id)).toMatchObject({
      journalist_display_name: fixture.journalist.display_name
    });
    expect(preview.bundle.tags.find((tag) => tag.broadlister_tag_id === fixture.tag.id)).toMatchObject({
      name: fixture.tag.name,
      ontology_core_id: `ontology-${fixture.suffix}`
    });
    expect(preview.metadata.omitted_records).toEqual(expect.arrayContaining([
      expect.objectContaining({ broadlister_model: "Article", id: unapproved.article.id, reason: "not_approved" }),
      expect.objectContaining({ broadlister_model: "Article", id: unprovenanced.article.id, reason: "missing_provenance" })
    ]));
  });

  it("never serializes client overlay fields or contact methods", async () => {
    const fixture = await createReviewedMediaFixture();
    await createClientOverlayAndContactFixture(fixture);

    const preview = await buildTabulatorExportPreview({
      exportId: `preview-private-${fixture.suffix}`,
      exportedAt,
      exportedBy: "test",
      articleIds: [fixture.article.id]
    });
    const serialized = JSON.stringify(preview);

    expect(serialized).toContain(fixture.article.title);
    expect(serialized).not.toContain(`PRIVATE_RATIONALE_${fixture.suffix}`);
    expect(serialized).not.toContain(`PRIVATE_PITCH_${fixture.suffix}`);
    expect(serialized).not.toContain(`PRIVATE_NOTE_${fixture.suffix}`);
    expect(serialized).not.toContain(`PRIVATE_WARMTH_${fixture.suffix}`);
    expect(serialized).not.toContain(`reporter-${fixture.suffix}@example.com`);
    expect(serialized).not.toContain("contact_methods");
    expect(preview.metadata.safety.contacts_exported).toBe(false);
    expect(preview.metadata.safety.client_overlay_fields_excluded).toBe(true);
  });

  it("preserves deterministic output for the same DB state and export identity", async () => {
    const fixture = await createReviewedMediaFixture();

    const first = await buildTabulatorExportPreview({
      exportId: `preview-deterministic-${fixture.suffix}`,
      exportedAt,
      exportedBy: "test",
      articleIds: [fixture.article.id]
    });
    const second = await buildTabulatorExportPreview({
      exportId: `preview-deterministic-${fixture.suffix}`,
      exportedAt,
      exportedBy: "test",
      articleIds: [fixture.article.id]
    });

    expect(second).toEqual(first);
  });

  it("does not call network APIs or write files", async () => {
    const fixture = await createReviewedMediaFixture();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));

    const preview = await buildTabulatorExportPreview({
      exportId: `preview-side-effects-${fixture.suffix}`,
      exportedAt,
      exportedBy: "test",
      articleIds: [fixture.article.id]
    });

    expect(preview.metadata.safety.file_writer_added).toBe(false);
    const serviceSource = readFileSync("src/services/tabulator-export-preview.ts", "utf8");
    expect(serviceSource).not.toContain("node:fs");
    expect(serviceSource).not.toContain("writeFile");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("preserves cross-client isolation in generic Tabulator previews", async () => {
    const fixture = await createReviewedMediaFixture();
    const clientA = await createClientOverlayAndContactFixture(fixture, "a");
    const clientB = await createClientOverlayAndContactFixture(fixture, "b");

    const preview = await buildTabulatorExportPreview({
      exportId: `preview-isolation-${fixture.suffix}`,
      exportedAt,
      exportedBy: "test",
      articleIds: [fixture.article.id]
    });
    const serialized = JSON.stringify(preview);

    expect(serialized).not.toContain(clientA.privateToken);
    expect(serialized).not.toContain(clientB.privateToken);
    expect(serialized).not.toContain(clientA.client.id);
    expect(serialized).not.toContain(clientB.client.id);
  });
});

async function createReviewedMediaFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const outlet = await prisma.outlet.create({
    data: {
      name: `Preview Outlet ${suffix}`,
      name_norm: `preview outlet ${suffix}`,
      slug: `preview-outlet-${suffix}`,
      outlet_type: "digital",
      home_url: `https://preview-${suffix}.example.com`,
      home_url_host: `preview-${suffix}.example.com`
    }
  });
  const journalist = await prisma.journalist.create({
    data: {
      display_name: `Preview Reporter ${suffix}`,
      display_name_norm: `preview reporter ${suffix}`,
      name_variants_json: "[]"
    }
  });
  const article = await prisma.article.create({
    data: {
      url: `https://preview-${suffix}.example.com/story?utm=test`,
      url_canonical: `https://preview-${suffix}.example.com/story`,
      title: `Preview Story ${suffix}`,
      outlet_id: outlet.id,
      language: "en",
      excerpt: `Public preview excerpt ${suffix}`
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
      name: `Preview Topic ${suffix}`,
      slug: `topic:preview-${suffix}`,
      kind: "topic",
      external_ids_json: JSON.stringify({
        ontology_core_id: `ontology-${suffix}`,
        ontology_core_slug: `preview-${suffix}`,
        tabulator_tag_id: `tabulator-tag-${suffix}`,
        relationship_to_ontology: "exact"
      })
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
      observed_at: new Date(exportedAt),
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
  return { suffix, outlet, journalist, article, byline, tag, articleTag, citation };
}

async function createArticleOnly(label: string, withProvenance: boolean) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const outlet = await prisma.outlet.create({
    data: {
      name: `Preview ${label} Outlet ${suffix}`,
      name_norm: `preview ${label} outlet ${suffix}`,
      slug: `preview-${label}-outlet-${suffix}`,
      outlet_type: "digital"
    }
  });
  const article = await prisma.article.create({
    data: {
      url: `https://preview-${label}-${suffix}.example.com/story`,
      url_canonical: `https://preview-${label}-${suffix}.example.com/story`,
      title: `Preview ${label} Story ${suffix}`,
      outlet_id: outlet.id
    }
  });
  if (withProvenance) {
    const citation = await prisma.citation.create({
      data: {
        source_type: "article_url",
        source_url: article.url_canonical,
        observed_at: new Date(exportedAt)
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
      decided_at: new Date(exportedAt),
      decided_by: "test"
    }
  });
}

async function createClientOverlayAndContactFixture(fixture: Awaited<ReturnType<typeof createReviewedMediaFixture>>, variant = "") {
  const suffix = `${fixture.suffix}${variant}`;
  const privateToken = `PRIVATE_RATIONALE_${suffix}`;
  const client = await prisma.client.create({
    data: {
      slug: `preview-client-${suffix}`,
      display_name: `Preview Client ${suffix}`
    }
  });
  const campaign = await prisma.campaign.create({
    data: {
      client_id: client.id,
      name: `Preview Campaign ${suffix}`,
      slug: `preview-campaign-${suffix}`,
      constraints_json: JSON.stringify({ token: `PRIVATE_CONSTRAINT_${suffix}` })
    }
  });
  const list = await prisma.campaignList.create({
    data: {
      campaign_id: campaign.id,
      name: `Preview List ${suffix}`
    }
  });
  await prisma.campaignContact.create({
    data: {
      campaign_list_id: list.id,
      journalist_id: fixture.journalist.id,
      outlet_id: fixture.outlet.id,
      target_rationale: privateToken,
      pitch_angle: `PRIVATE_PITCH_${suffix}`,
      narrative_fit_json: JSON.stringify({ token: `PRIVATE_NARRATIVE_${suffix}` }),
      exclusion_reason: `PRIVATE_EXCLUSION_${suffix}`
    }
  });
  await prisma.clientNote.create({
    data: {
      client_id: client.id,
      journalist_id: fixture.journalist.id,
      body_md: `PRIVATE_NOTE_${suffix}`
    }
  });
  await prisma.outreachStatus.create({
    data: {
      client_id: client.id,
      journalist_id: fixture.journalist.id,
      relationship_warmth: `PRIVATE_WARMTH_${suffix}`,
      notes_private: `PRIVATE_STATUS_${suffix}`
    }
  });
  await prisma.clientApproval.create({
    data: {
      client_id: client.id,
      subject_type: "article",
      subject_id: fixture.article.id,
      state: "approved",
      note: `PRIVATE_APPROVAL_${suffix}`
    }
  });
  await prisma.contactMethod.create({
    data: {
      subject_type: "journalist",
      journalist_id: fixture.journalist.id,
      kind: "email",
      value: `reporter-${fixture.suffix}@example.com`,
      value_norm: `reporter-${fixture.suffix}@example.com`,
      value_hash: crypto.createHash("sha256").update(`reporter-${fixture.suffix}@example.com`).digest("hex"),
      verification_state: "verified",
      lawful_to_store: true
    }
  });
  return { client, privateToken };
}
