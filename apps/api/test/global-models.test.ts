import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { globalModels } from "../src/core/invariants/scope.js";

describe("global model scope invariant", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

  it("does not allow client_id on global Prisma models", () => {
    for (const model of globalModels) {
      const match = schema.match(new RegExp(`model\\s+${model}\\s+\\{([\\s\\S]*?)\\n\\}`, "m"));
      expect(match, `${model} exists`).not.toBeNull();
      expect(match?.[1], `${model} must not contain client_id`).not.toMatch(/\bclient_id\b/);
    }
  });
});

