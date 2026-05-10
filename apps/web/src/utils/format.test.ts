import { describe, expect, it } from "vitest";

import { formatValue, safeJson } from "./format.js";

describe("formatValue", () => {
  it("uses explicit empty-state copy for unset values", () => {
    expect(formatValue(null)).toBe("Not set");
    expect(formatValue(undefined)).toBe("Not set");
    expect(formatValue("")).toBe("Not set");
  });

  it("formats JSON-like values for review panels", () => {
    expect(formatValue('{"confidence":"operator-reviewed"}')).toBe(
      JSON.stringify({ confidence: "operator-reviewed" }, null, 2),
    );
    expect(formatValue({ scope: "campaign-overlay" })).toBe(
      JSON.stringify({ scope: "campaign-overlay" }, null, 2),
    );
  });
});

describe("safeJson", () => {
  it("returns parsed JSON or the original operator text", () => {
    expect(safeJson('{"approval":"required"}')).toEqual({ approval: "required" });
    expect(safeJson("operator note")).toBe("operator note");
  });
});
