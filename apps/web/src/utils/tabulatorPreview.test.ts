import { describe, expect, it } from "vitest";

import { parseArticleIdsInput, previewCoverageLabel } from "./tabulatorPreview.js";

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
