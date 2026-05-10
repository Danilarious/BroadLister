import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildTabulatorOfflineImportDryRun } from "../src/services/tabulator-offline-dry-run.js";

const fixturePath = resolve(process.cwd(), "../../docs/sample-artifacts/broadlister-tabulator-preview-bundle.sample.json");

function sampleBundle() {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
}

describe("Tabulator offline import dry run", () => {
  it("validates the sanitized sample bundle and returns a deterministic mapping preview", () => {
    const first = buildTabulatorOfflineImportDryRun(sampleBundle());
    const second = buildTabulatorOfflineImportDryRun(sampleBundle());

    expect(first.validation.ok).toBe(true);
    expect(first.validation.errors).toEqual([]);
    expect(first.source_bundle.schema).toBe("BroadListerReviewedMediaExportBundle.v1");
    expect(first.counts).toMatchObject({
      links: 1,
      external_source_records: 1,
      tags: 1,
      link_tags: 1,
      research_artifacts: 1,
      ontology_proposals: 1,
      rejected_records: 0
    });
    expect(first.mapping_preview.operations.map((operation) => operation.op)).toEqual([
      "upsert_external_source_record",
      "upsert_link",
      "attach_link_tag",
      "create_research_artifact",
      "upsert_tag"
    ]);
    expect(first).toEqual(second);
  });

  it("fails malformed bundles with useful contract errors", () => {
    const result = buildTabulatorOfflineImportDryRun({
      schema: "Wrong.v1",
      export_schema_version: "v0",
      source_system: "broadlister",
      export_scope: "reviewed_public_media",
      eligibility_policy: {}
    });

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors.map((error) => error.path)).toEqual([
      "eligibility_policy.excludes_client_overlays",
      "eligibility_policy.excludes_outreach_fields",
      "eligibility_policy.requires_provenance",
      "eligibility_policy.requires_reviewed_records",
      "export_schema_version",
      "schema",
      "provenance"
    ]);
  });

  it("rejects contact fields and client-private overlay fields", () => {
    const bundle = sampleBundle();
    const article = (bundle.articles as Array<Record<string, unknown>>)[0];
    article.email = "reporter@example.test";
    article.client_id = "client-private";

    const result = buildTabulatorOfflineImportDryRun(bundle);

    expect(result.validation.ok).toBe(false);
    expect(result.validation.errors.map((error) => `${error.code}:${error.path}`)).toContain("forbidden_bridge_field:articles.0.email");
    expect(result.validation.errors.map((error) => `${error.code}:${error.path}`)).toContain("forbidden_contract_field:articles.0.client_id");
  });

  it("rejects artifact records without required provenance", () => {
    const bundle = sampleBundle();
    const artifact = (bundle.artifacts as Array<Record<string, unknown>>)[0];
    artifact.provenance = [];

    const result = buildTabulatorOfflineImportDryRun(bundle);

    expect(result.validation.ok).toBe(false);
    expect(result.mapping_preview.rejected_records).toEqual([
      { source_id: "article-sample-001", reason: "missing_provenance", path: "artifacts.0.provenance" }
    ]);
    expect(result.mapping_preview.operations).toEqual([]);
  });

  it("reports duplicates while preserving stable idempotency keys", () => {
    const bundle = sampleBundle();
    const article = (bundle.articles as unknown[])[0];
    const artifact = (bundle.artifacts as unknown[])[0];
    bundle.articles = [article, JSON.parse(JSON.stringify(article))];
    bundle.artifacts = [artifact, JSON.parse(JSON.stringify(artifact))];

    const result = buildTabulatorOfflineImportDryRun(bundle);

    expect(result.validation.ok).toBe(true);
    expect(result.idempotency.duplicate_findings.map((finding) => finding.path)).toEqual([
      "articles.1.broadlister_article_id",
      "articles.1.canonical_url",
      "artifacts.1.stable_export_key"
    ]);
    expect(result.idempotency.keys.every((entry) => entry.key.startsWith("tabulator:"))).toBe(true);
  });

  it("does not perform network calls or external writes", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    const result = buildTabulatorOfflineImportDryRun(sampleBundle());
    fetchSpy.mockRestore();

    expect(result.safety).toEqual({
      tabulator_api_called: false,
      tabulator_runtime_dependency_used: false,
      external_writes_performed: false,
      contacts_imported: false,
      client_private_fields_imported: false
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not add a Tabulator runtime dependency", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies ?? {}).some((name) => name.toLowerCase().includes("tabulator"))).toBe(false);
  });
});
