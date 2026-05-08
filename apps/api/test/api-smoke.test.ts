import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

describe("API smoke", () => {
  it("serves health", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: "broadlister-api" });
  });

  it("creates and applies a journalist review item", async () => {
    const app = await buildApp();
    const suffix = crypto.randomUUID();
    const reviewItem = await prisma.reviewItem.create({
      data: {
        kind: "new_journalist",
        proposal_payload_json: JSON.stringify({
          action: "create",
          model: "journalist",
          data: {
            display_name: `Smoke Reporter ${suffix}`,
            display_name_norm: `smoke reporter ${suffix}`,
            name_variants_json: "[]"
          }
        })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: `/review/${reviewItem.id}/approve`,
      payload: { decided_by: "test" }
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().display_name).toBe(`Smoke Reporter ${suffix}`);
  });
});

