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

  it("rejects invalid contact method scope", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/contact-methods",
      payload: {
        subject_type: "journalist",
        kind: "email",
        value: "invalid@example.com"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Exactly one of journalist_id or outlet_id is required");
  });

  it("creates review items from a CSV import", async () => {
    const app = await buildApp();
    const suffix = crypto.randomUUID();
    const response = await app.inject({
      method: "POST",
      url: "/imports/csv",
      payload: {
        label: `Smoke import ${suffix}`,
        csv: `Name,Outlet\nCSV Reporter ${suffix},CSV Outlet ${suffix}\n`,
        mapping: {
          Name: "display_name",
          Outlet: "outlet_name"
        }
      }
    });

    expect(response.statusCode).toBe(201);
    const batch = response.json();
    const reviewResponse = await app.inject({
      method: "GET",
      url: `/review?source_import_batch_id=${batch.id}`
    });

    await app.close();

    expect(reviewResponse.statusCode).toBe(200);
    expect(reviewResponse.json()).toHaveLength(2);
  });
});
