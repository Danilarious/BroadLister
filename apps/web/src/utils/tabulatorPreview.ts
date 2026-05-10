export function parseArticleIdsInput(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))).sort();
}

export function previewCoverageLabel(articleCount: number, provenancePacketCount: number): string {
  if (articleCount === 0) return "No reviewed articles included yet.";
  if (provenancePacketCount === 0) return "No provenance packets included.";
  return `${provenancePacketCount} provenance packet${provenancePacketCount === 1 ? "" : "s"} support ${articleCount} reviewed article${articleCount === 1 ? "" : "s"}.`;
}
