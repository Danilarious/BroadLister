import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

const articleHtml = `
  <html lang="en">
    <head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": "Brazil's Central Bank Bans Stablecoin and Crypto Settlement in Cross-Border Payments",
          "datePublished": "2026-05-02T12:00:00Z",
          "description": "Brazil stablecoin payment regulation and cross-border crypto settlement policy.",
          "author": [{"@type": "Person", "name": "Ana Paula Pereira"}],
          "publisher": {"@type": "Organization", "name": "CoinDesk"}
        }
      </script>
    </head>
  </html>
`;

describe("import ingestion workflows", () => {
  it("previews CSV rows with detected media-contact mapping", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/imports/csv/preview",
      payload: {
        label: "Preview import",
        csv: "name,outlet,role,email,beat,location,profile url,notes\nJane Reporter,Daily Wire,Reporter,jane@example.com,stablecoins,Brazil,https://example.com/jane,source note\n"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      row_count: 1,
      detected_mapping: {
        name: "display_name",
        outlet: "outlet_name",
        role: "role_title",
        email: "email",
        beat: "tag",
        location: "location_region",
        "profile url": "profile_url",
        notes: "notes"
      }
    });
  });

  it("commits a large-ish CSV as review items without direct global writes", async () => {
    const app = await buildApp();
    const suffix = crypto.randomUUID();
    const rows = Array.from({ length: 25 }, (_, index) => `Reporter ${index} ${suffix},Outlet ${index} ${suffix},reporter${index}@example.com,stablecoins`).join("\n");
    const response = await app.inject({
      method: "POST",
      url: "/imports/csv",
      payload: {
        label: `Large-ish CSV ${suffix}`,
        csv: `name,outlet,email,beat\n${rows}\n`
      }
    });

    expect(response.statusCode).toBe(201);
    const batch = response.json();
    const reviewItems = await prisma.reviewItem.findMany({ where: { source_import_batch_id: batch.id } });
    const directJournalistWrites = await prisma.journalist.count({ where: { display_name: { contains: suffix } } });
    await app.close();

    expect(batch.row_count).toBe(25);
    expect(reviewItems.length).toBe(100);
    expect(reviewItems.some((item) => item.kind === "contact_method_candidate")).toBe(true);
    expect(reviewItems.some((item) => item.proposal_payload_json.includes("\"lawful_to_store\":false"))).toBe(true);
    expect(directJournalistWrites).toBe(0);
  });

  it("returns useful malformed CSV errors", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/imports/csv/preview",
      payload: {
        label: "Malformed",
        csv: "\"name,outlet\nJane,Example"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("malformed_csv");
  });

  it("creates review-gated article, outlet, journalist, byline, tag, and relevance proposals from HTML", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/imports/url",
      payload: {
        url: "https://www.coindesk.com/policy/2026/05/02/brazil-s-central-bank-bans-stablecoin-and-crypto-settlement-in-cross-border-payments",
        html: articleHtml
      }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    const body = response.json();
    const kinds = body.review_items.map((item: { kind: string }) => item.kind);
    expect(body.import_batch).toMatchObject({ source_type: "pasted_html", row_count: 1 });
    expect(body.review_items.every((item: { source_import_batch_id: string }) => item.source_import_batch_id === body.import_batch.id)).toBe(true);
    expect(kinds).toEqual(expect.arrayContaining([
      "outlet_candidate",
      "article_candidate",
      "journalist_candidate",
      "byline_candidate",
      "tag_candidate",
      "article_tag_candidate",
      "client_relevance_candidate"
    ]));
    expect(body.summary).toMatchObject({
      outlet_name: "CoinDesk",
      authors: ["Ana Paula Pereira"],
      client_relevance: "Trace Finance relevance candidate"
    });
  });

  it("reports blocked live URL fetches with an operator recovery path", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/imports/url",
      payload: {
        url: "http://127.0.0.1:9/not-available"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("html_unavailable");
    expect(response.json().message).toContain("Paste HTML manually");
  });
});
