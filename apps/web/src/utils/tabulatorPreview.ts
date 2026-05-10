import type { TabulatorExportPreview } from "../types.js";

const forbiddenDownloadFieldFragments = [
  "contact_method",
  "contactMethods",
  "email",
  "phone",
  "pitch_angle",
  "target_rationale",
  "suitability_note",
  "narrative_fit_json",
  "exclusion_flag",
  "exclusion_reason",
  "relationship_warmth",
  "client_id",
  "campaign_id",
  "campaign_list_id"
] as const;

export function parseArticleIdsInput(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))).sort();
}

export function previewCoverageLabel(articleCount: number, provenancePacketCount: number): string {
  if (articleCount === 0) return "No reviewed articles included yet.";
  if (provenancePacketCount === 0) return "No provenance packets included.";
  return `${provenancePacketCount} provenance packet${provenancePacketCount === 1 ? "" : "s"} support ${articleCount} reviewed article${articleCount === 1 ? "" : "s"}.`;
}

export function tabulatorBundleDownloadFilename(exportedAt: string): string {
  const date = new Date(exportedAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date(0) : date;
  const stamp = safeDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "-");
  return `broadlister-tabulator-preview-bundle-${stamp}.json`;
}

export function validateTabulatorBundleDownload(preview: TabulatorExportPreview | undefined): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!preview) reasons.push("Preview bundle has not loaded.");
  if (preview && preview.bundle.schema !== "BroadListerReviewedMediaExportBundle.v1") reasons.push("Bundle schema is missing or unsupported.");
  if (preview && preview.bundle.export_schema_version !== "v1") reasons.push("Bundle version is missing or unsupported.");
  if (preview && !preview.metadata.safety) reasons.push("Preview safety flags are missing.");
  if (preview && preview.metadata.safety) {
    if (!preview.metadata.safety.client_overlay_fields_excluded) reasons.push("Client overlay exclusion is not confirmed.");
    if (preview.metadata.safety.contacts_exported) reasons.push("Contact method exclusion is not confirmed.");
    if (preview.metadata.safety.file_writer_added) reasons.push("Backend file writer is unexpectedly enabled.");
    if (preview.metadata.safety.network_calls_allowed) reasons.push("External network calls are unexpectedly allowed.");
    if (preview.metadata.safety.tabulator_runtime_dependency_allowed) reasons.push("Tabulator runtime dependency is unexpectedly allowed.");
  }
  if (preview) {
    const forbiddenHits = findForbiddenDownloadFields(preview.bundle);
    if (forbiddenHits.length > 0) reasons.push(`Forbidden field fragments present: ${forbiddenHits.join(", ")}`);
  }
  return { ok: reasons.length === 0, reasons };
}

export function tabulatorBundleDownloadText(preview: TabulatorExportPreview): string {
  const validation = validateTabulatorBundleDownload(preview);
  if (!validation.ok) throw new Error(validation.reasons.join(" "));
  return `${JSON.stringify(preview.bundle, null, 2)}\n`;
}

function findForbiddenDownloadFields(value: unknown): string[] {
  const hits = new Set<string>();
  walkForForbiddenFields(value, [], hits);
  return Array.from(hits).sort();
}

function walkForForbiddenFields(value: unknown, path: string[], hits: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForForbiddenFields(item, [...path, String(index)], hits));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (forbiddenDownloadFieldFragments.some((fragment) => key.toLowerCase().includes(fragment.toLowerCase()))) {
      hits.add(nextPath.join("."));
    }
    walkForForbiddenFields(child, nextPath, hits);
  }
}
