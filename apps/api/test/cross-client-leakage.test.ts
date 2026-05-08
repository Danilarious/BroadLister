import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

describe("cross-client leakage integration", () => {
  it("does not expose another client's campaign overlays through workspace or exports", async () => {
    const app = await buildApp();
    const suffix = crypto.randomUUID();
    const journalist = await prisma.journalist.create({
      data: {
        display_name: `Leak Test Journalist ${suffix}`,
        display_name_norm: `leak test journalist ${suffix}`,
        name_variants_json: "[]"
      }
    });
    const outlet = await prisma.outlet.create({
      data: {
        name: `Leak Test Outlet ${suffix}`,
        name_norm: `leak test outlet ${suffix}`,
        slug: `leak-test-outlet-${suffix}`,
        outlet_type: "digital"
      }
    });

    const clientA = await prisma.client.create({ data: { slug: `client-a-${suffix}`, display_name: `Client A ${suffix}` } });
    const clientB = await prisma.client.create({ data: { slug: `client-b-${suffix}`, display_name: `Client B ${suffix}` } });

    const campaignA = await prisma.campaign.create({ data: { client_id: clientA.id, name: "A Launch", slug: `a-launch-${suffix}` } });
    const campaignB = await prisma.campaign.create({ data: { client_id: clientB.id, name: "B Launch", slug: `b-launch-${suffix}` } });
    const listA = await prisma.campaignList.create({ data: { campaign_id: campaignA.id, name: "A List" } });
    const listB = await prisma.campaignList.create({ data: { campaign_id: campaignB.id, name: "B List" } });

    await prisma.campaignContact.create({
      data: {
        campaign_list_id: listA.id,
        journalist_id: journalist.id,
        outlet_id: outlet.id,
        target_rationale: "CLIENT_A_PRIVATE_RATIONALE",
        pitch_angle: "CLIENT_A_PRIVATE_ANGLE"
      }
    });
    await prisma.campaignContact.create({
      data: {
        campaign_list_id: listB.id,
        journalist_id: journalist.id,
        outlet_id: outlet.id,
        target_rationale: "CLIENT_B_PRIVATE_RATIONALE",
        pitch_angle: "CLIENT_B_PRIVATE_ANGLE"
      }
    });

    const workspaceA = await app.inject({ method: "GET", url: `/workspace/${clientA.id}` });
    expect(workspaceA.statusCode).toBe(200);
    expect(workspaceA.body).toContain("CLIENT_A_PRIVATE_RATIONALE");
    expect(workspaceA.body).not.toContain("CLIENT_B_PRIVATE_RATIONALE");
    expect(workspaceA.body).not.toContain("CLIENT_B_PRIVATE_ANGLE");

    const csvA = await app.inject({ method: "GET", url: `/exports/${clientA.id}/campaign-lists/${listA.id}/media-list.csv` });
    expect(csvA.statusCode).toBe(200);
    expect(csvA.body).not.toContain("CLIENT_B_PRIVATE_RATIONALE");
    expect(csvA.body).not.toContain("CLIENT_B_PRIVATE_ANGLE");

    const forbidden = await app.inject({ method: "GET", url: `/exports/${clientA.id}/campaign-lists/${listB.id}/media-list.csv` });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.body).not.toContain("CLIENT_B_PRIVATE_RATIONALE");

    await app.close();
  });
});
