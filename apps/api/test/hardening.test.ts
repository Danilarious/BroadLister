import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

describe("API hardening", () => {
  it("rejects malformed payloads before creating global records", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/journalists",
      payload: { display_name: "" }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("validation_error");
  });

  it("keeps contact methods unverified and not lawful-to-store by default", async () => {
    const app = await buildApp();
    const suffix = crypto.randomUUID();
    const journalist = await prisma.journalist.create({
      data: {
        display_name: `Verification Reporter ${suffix}`,
        display_name_norm: `verification reporter ${suffix}`,
        name_variants_json: "[]"
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/contact-methods",
      payload: {
        subject_type: "journalist",
        journalist_id: journalist.id,
        kind: "email",
        value: `verify-${suffix}@example.com`
      }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      verification_state: "unverified",
      lawful_to_store: false
    });
  });

  it("requires operator-provided URL snapshots and never fetches live pages", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/imports/url",
      payload: { url: "https://example.com/no-live-fetch" }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "html_required" });
  });

  it("scopes approval logs to the requested client", async () => {
    const app = await buildApp();
    const suffix = crypto.randomUUID();
    const clientA = await prisma.client.create({ data: { slug: `approval-a-${suffix}`, display_name: `Approval A ${suffix}` } });
    const clientB = await prisma.client.create({ data: { slug: `approval-b-${suffix}`, display_name: `Approval B ${suffix}` } });

    await prisma.clientApproval.create({
      data: {
        client_id: clientA.id,
        subject_type: "campaign_list",
        subject_id: `subject-a-${suffix}`,
        state: "approved",
        note: "CLIENT_A_APPROVAL_ONLY"
      }
    });
    await prisma.clientApproval.create({
      data: {
        client_id: clientB.id,
        subject_type: "campaign_list",
        subject_id: `subject-b-${suffix}`,
        state: "approved",
        note: "CLIENT_B_APPROVAL_ONLY"
      }
    });

    const response = await app.inject({ method: "GET", url: `/exports/${clientA.id}/approval-log.md` });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("CLIENT_A_APPROVAL_ONLY");
    expect(response.body).not.toContain("CLIENT_B_APPROVAL_ONLY");
  });

  it("keeps all campaign list export formats scoped to the owning client", async () => {
    const app = await buildApp();
    const suffix = crypto.randomUUID();
    const journalist = await prisma.journalist.create({
      data: {
        display_name: `Scoped Export Reporter ${suffix}`,
        display_name_norm: `scoped export reporter ${suffix}`,
        name_variants_json: "[]"
      }
    });
    const clientA = await prisma.client.create({ data: { slug: `export-a-${suffix}`, display_name: `Export A ${suffix}` } });
    const clientB = await prisma.client.create({ data: { slug: `export-b-${suffix}`, display_name: `Export B ${suffix}` } });
    const campaignA = await prisma.campaign.create({ data: { client_id: clientA.id, name: "Export A Campaign", slug: `export-a-${suffix}` } });
    const campaignB = await prisma.campaign.create({ data: { client_id: clientB.id, name: "Export B Campaign", slug: `export-b-${suffix}` } });
    const listA = await prisma.campaignList.create({ data: { campaign_id: campaignA.id, name: "Export A List" } });
    const listB = await prisma.campaignList.create({ data: { campaign_id: campaignB.id, name: "Export B List" } });
    await prisma.campaignContact.create({
      data: {
        campaign_list_id: listA.id,
        journalist_id: journalist.id,
        target_rationale: "EXPORT_A_PRIVATE"
      }
    });
    await prisma.campaignContact.create({
      data: {
        campaign_list_id: listB.id,
        journalist_id: journalist.id,
        target_rationale: "EXPORT_B_PRIVATE"
      }
    });

    const brief = await app.inject({ method: "GET", url: `/exports/${clientA.id}/campaign-lists/${listA.id}/brief.md` });
    const wrongClientBrief = await app.inject({ method: "GET", url: `/exports/${clientA.id}/campaign-lists/${listB.id}/brief.md` });
    await app.close();

    expect(brief.statusCode).toBe(200);
    expect(brief.body).toContain("DRAFT");
    expect(brief.body).toContain(`Scoped Export Reporter ${suffix}`);
    expect(brief.body).not.toContain("EXPORT_A_PRIVATE");
    expect(brief.body).not.toContain("EXPORT_B_PRIVATE");
    expect(wrongClientBrief.statusCode).toBe(404);
    expect(wrongClientBrief.body).not.toContain("EXPORT_B_PRIVATE");
  });
});
