import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertNoForbiddenFields,
  buildTabulatorReviewedMediaExportBundle,
  findForbiddenFieldPaths,
  stableArticleExportKey,
  tabulatorExportForbiddenFields
} from "../src/services/tabulator-export-contract.js";

function reviewedArticle(overrides: Record<string, unknown> = {}) {
  return {
    review_state: "reviewed" as const,
    article: {
      id: "article-1",
      canonical_url: "https://example.com/media/story",
      original_url: "https://example.com/media/story?utm_source=test",
      title: "Reviewed story",
      description: "Public article description",
      published_at: "2026-05-10T12:00:00.000Z",
      language: "en",
      outlet_id: "outlet-1",
      outlet_name: "Example Media",
      fetch_hash: "hash-public"
    },
    outlet: {
      id: "outlet-1",
      name: "Example Media",
      slug: "example-media",
      home_url: "https://example.com",
      home_url_host: "example.com",
      outlet_type: "trade",
      region: "North America",
      country: "US"
    },
    bylines: [{
      id: "byline-1",
      article_id: "article-1",
      journalist_id: "journalist-1",
      journalist_display_name: "Riley Reporter",
      position: 0,
      confidence: "high" as const,
      provenance_ids: ["citation-1"]
    }],
    tags: [{
      id: "tag-1",
      slug: "topic:stablecoins",
      name: "Stablecoins",
      kind: "topic" as const,
      confidence: "high" as const,
      source: "article_tag" as const,
      ontology_core_id: "entity_stablecoins",
      ontology_core_slug: "stablecoins",
      relationship_to_ontology: "exact" as const
    }],
    provenance: [{
      packet_id: "packet-1",
      citation_id: "citation-1",
      provenance_link_id: "provenance-link-1",
      source_type: "article_url",
      source_url: "https://example.com/media/story",
      observed_at: "2026-05-10T12:05:00.000Z",
      captured_by: "test",
      payload_hash: "hash-public",
      target_model: "Article" as const,
      target_id: "article-1",
      target_field: "url_canonical",
      assertion_kind: "supports" as const,
      confidence: "high" as const
    }],
    ...overrides
  };
}

function bundleInput(articles = [reviewedArticle()]) {
  return {
    exportId: "export-1",
    exportedAt: "2026-05-10T13:00:00.000Z",
    exportedBy: "test",
    sourceTagOrCommit: "test-commit",
    articles
  };
}

describe("Tabulator reviewed media export contract scaffold", () => {
  it("builds deterministic reviewed public media bundle shape", () => {
    const bundle = buildTabulatorReviewedMediaExportBundle(bundleInput());

    expect(bundle).toMatchObject({
      schema: "BroadListerReviewedMediaExportBundle.v1",
      export_schema_version: "v1",
      source_system: "broadlister",
      export_scope: "reviewed_public_media",
      eligibility_policy: {
        requires_reviewed_records: true,
        requires_provenance: true,
        excludes_client_overlays: true,
        excludes_outreach_fields: true
      },
      summary: {
        article_count: 1,
        outlet_count: 1,
        byline_count: 1,
        tag_count: 1,
        provenance_packet_count: 1
      }
    });
    expect(bundle.articles[0]).toMatchObject({
      broadlister_article_id: "article-1",
      canonical_url: "https://example.com/media/story",
      tabulator_link_hint: { contentType: "article", siteName: "Example Media" }
    });
    expect(bundle.artifacts[0].stable_export_key).toBe(stableArticleExportKey("article-1", "https://example.com/media/story"));
  });

  it("blocks forbidden client overlay fields from generic Tabulator export JSON", () => {
    for (const field of tabulatorExportForbiddenFields) {
      const payload = field.includes(".")
        ? field.split(".").reverse().reduce<Record<string, unknown> | string>((child, key) => ({ [key]: child }), "private")
        : { safe: true, nested: { [field]: "private" } };
      expect(() => assertNoForbiddenFields(payload)).toThrow("Forbidden Tabulator export fields");
    }
  });

  it("finds nested client overlay leakage paths before serialization", () => {
    const hits = findForbiddenFieldPaths({
      article: { title: "Public" },
      campaignContact: {
        narrative_fit_json: "{\"private\":true}",
        exclusion_reason: "client private"
      },
      approval: { ClientApproval: { note: "approval note" } }
    });

    expect(hits).toEqual([
      "approval.ClientApproval.note",
      "campaignContact.exclusion_reason",
      "campaignContact.narrative_fit_json"
    ]);
  });

  it("omits pending and missing-provenance records from export output", () => {
    const bundle = buildTabulatorReviewedMediaExportBundle(bundleInput([
      reviewedArticle(),
      reviewedArticle({
        review_state: "pending",
        article: { ...reviewedArticle().article, id: "article-pending", canonical_url: "https://example.com/pending" }
      }),
      reviewedArticle({
        provenance: [],
        article: { ...reviewedArticle().article, id: "article-unproven", canonical_url: "https://example.com/unproven" }
      })
    ]));

    expect(bundle.articles.map((article) => article.broadlister_article_id)).toEqual(["article-1"]);
    expect(bundle.omitted).toEqual([
      { broadlister_model: "Article", id: "article-pending", reason: "not_reviewed" },
      { broadlister_model: "Article", id: "article-unproven", reason: "missing_provenance" }
    ]);
    expect(bundle.redaction_report.omitted_record_count).toBe(2);
  });

  it("does not export contact methods or private client fields from allowed inputs", () => {
    const bundle = buildTabulatorReviewedMediaExportBundle(bundleInput());
    const { redaction_report, ...exportedPayload } = bundle;
    const serialized = JSON.stringify(exportedPayload);
    expect(redaction_report.denied_fields_checked).toContain("relationship_warmth");

    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("lawful_to_store");
    expect(serialized).not.toContain("relationship_warmth");
    expect(serialized).not.toContain("pitch_angle");
    expect(serialized).not.toContain("target_rationale");
    expect(serialized).not.toContain("client_id");
    expect(serialized).not.toContain("campaign_id");
  });

  it("keeps repeat export output idempotent except export identity fields", () => {
    const first = buildTabulatorReviewedMediaExportBundle(bundleInput());
    const second = buildTabulatorReviewedMediaExportBundle({
      ...bundleInput(),
      exportId: "export-2",
      exportedAt: "2026-05-10T14:00:00.000Z"
    });

    const stripVolatile = (bundle: unknown) => {
      const parsed = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
      stripKeys(parsed, new Set(["export_id", "exported_at"]));
      return parsed;
    };

    expect(stripVolatile(first)).toEqual(stripVolatile(second));
  });

  it("does not perform network calls or external writes", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    const bundle = buildTabulatorReviewedMediaExportBundle(bundleInput());
    fetchSpy.mockRestore();

    expect(bundle.summary.article_count).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not add a Tabulator runtime dependency", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {})).not.toContain("tabulator");
    expect(Object.keys(manifest.dependencies ?? {}).some((name) => name.includes("tabulator"))).toBe(false);
  });
});

function stripKeys(value: unknown, keys: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => stripKeys(item, keys));
    return;
  }
  for (const key of Object.keys(value)) {
    if (keys.has(key)) {
      delete (value as Record<string, unknown>)[key];
    } else {
      stripKeys((value as Record<string, unknown>)[key], keys);
    }
  }
}
