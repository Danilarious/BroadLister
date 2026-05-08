import { describe, expect, it } from "vitest";
import { campaignConstraintsSchema, globalStatusFlagsSchema, narrativeFitSchema } from "../src/core/validation/json-fields.js";

describe("JSON field validators", () => {
  it("requires citations for public global status flags", () => {
    expect(() => globalStatusFlagsSchema.parse({
      version: 1,
      flags: [{ flag: "no_ai_pitches", citation_id: "citation-1" }]
    })).not.toThrow();

    expect(() => globalStatusFlagsSchema.parse({
      version: 1,
      flags: [{ flag: "no_ai_pitches" }]
    })).toThrow();
  });

  it("validates campaign constraints as versioned JSON", () => {
    const parsed = campaignConstraintsSchema.parse({
      version: 1,
      approved_messaging: ["Approved line"]
    });

    expect(parsed.approved_messaging).toEqual(["Approved line"]);
    expect(parsed.forbidden_claims).toEqual([]);
  });

  it("validates narrative fit without exposing raw JSON assumptions", () => {
    const parsed = narrativeFitSchema.parse({
      version: 1,
      narrative_angle: "A precise campaign angle",
      confidence: "medium"
    });

    expect(parsed.evidence_byline_ids).toEqual([]);
    expect(parsed.confidence).toBe("medium");
  });
});

