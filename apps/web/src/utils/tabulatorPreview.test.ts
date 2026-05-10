import { describe, expect, it } from "vitest";

import type { TabulatorExportPreview } from "../types.js";
import { parseArticleIdsInput, previewCoverageLabel, tabulatorBundleDownloadFilename, tabulatorBundleDownloadText, validateTabulatorBundleDownload } from "./tabulatorPreview.js";

describe("parseArticleIdsInput", () => {
  it("accepts comma and newline separated article ids deterministically", () => {
    expect(parseArticleIdsInput("art-2, art-1\nart-2\n")).toEqual(["art-1", "art-2"]);
  });
});

describe("previewCoverageLabel", () => {
  it("summarizes empty and covered preview states", () => {
    expect(previewCoverageLabel(0, 0)).toBe("No reviewed articles included yet.");
    expect(previewCoverageLabel(1, 1)).toBe("1 provenance packet support 1 reviewed article.");
    expect(previewCoverageLabel(2, 3)).toBe("3 provenance packets support 2 reviewed articles.");
  });
});

describe("tabulator bundle download helpers", () => {
  it("builds deterministic local artifact filenames", () => {
    expect(tabulatorBundleDownloadFilename("2026-05-10T17:42:03.000Z")).toBe("broadlister-tabulator-preview-bundle-20260510-174203.json");
  });

  it("exports only the allowlisted bundle payload", () => {
    const preview = previewFixture();
    const text = tabulatorBundleDownloadText(preview);
    const parsed = JSON.parse(text);

    expect(parsed).toEqual(preview.bundle);
    expect(parsed.metadata).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain("contact_method");
    expect(JSON.stringify(parsed)).not.toContain("client_id");
    expect(JSON.stringify(parsed)).not.toContain("pitch_angle");
  });

  it("blocks download when safety flags are missing or unsafe", () => {
    expect(validateTabulatorBundleDownload(undefined).ok).toBe(false);
    const unsafe = previewFixture();
    unsafe.metadata.safety.contacts_exported = true;

    const validation = validateTabulatorBundleDownload(unsafe);
    expect(validation.ok).toBe(false);
    expect(validation.reasons.join(" ")).toContain("Contact method exclusion is not confirmed.");
  });

  it("rejects forbidden client-private and contact field fragments in the bundle", () => {
    const preview = previewFixture() as TabulatorExportPreview & { bundle: TabulatorExportPreview["bundle"] & { client_id?: string } };
    preview.bundle.client_id = "client-private";

    const validation = validateTabulatorBundleDownload(preview);
    expect(validation.ok).toBe(false);
    expect(validation.reasons.join(" ")).toContain("Forbidden field fragments present");
  });
});

function previewFixture(): TabulatorExportPreview {
  return {
    bundle: {
      schema: "BroadListerReviewedMediaExportBundle.v1",
      export_schema_version: "v1",
      export_id: "preview-test",
      exported_at: "2026-05-10T17:42:03.000Z",
      exported_by: "operator",
      source_system: "broadlister",
      export_scope: "reviewed_public_media",
      validation_limits: ["no contact methods"],
      eligibility_policy: {
        requires_reviewed_records: true,
        requires_provenance: true,
        excludes_client_overlays: true,
        excludes_outreach_fields: true
      },
      articles: [{
        broadlister_article_id: "article-1",
        canonical_url: "https://example.com/story",
        title: "Reviewed Story",
        outlet_id: "outlet-1",
        outlet_name: "Example Outlet"
      }],
      outlets: [{ broadlister_outlet_id: "outlet-1", name: "Example Outlet", slug: "example-outlet" }],
      bylines: [],
      tags: [],
      provenance: [{
        packet_id: "packet-1",
        citation_id: "citation-1",
        target: { broadlister_model: "Article", broadlister_id: "article-1" }
      }],
      artifacts: [{ artifact_id: "artifact-1", stable_export_key: "stable-1", review_state: "reviewed" }],
      omitted: [],
      redaction_report: {
        policy: "deny_client_overlay_fields",
        redacted_field_count: 0,
        omitted_record_count: 0
      },
      summary: {
        article_count: 1,
        outlet_count: 1,
        byline_count: 0,
        tag_count: 0,
        provenance_packet_count: 1
      }
    },
    metadata: {
      schema: "BroadListerTabulatorExportPreview.v1",
      export_id: "preview-test",
      generated_at: "2026-05-10T17:42:03.000Z",
      mode: "service_only_preview",
      included_article_ids: ["article-1"],
      omitted_records: [],
      safety: {
        route_added: false,
        ui_added: false,
        file_writer_added: false,
        network_calls_allowed: false,
        tabulator_runtime_dependency_allowed: false,
        contacts_exported: false,
        client_overlay_fields_excluded: true
      }
    }
  };
}
