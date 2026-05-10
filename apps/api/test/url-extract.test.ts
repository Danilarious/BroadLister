import { describe, expect, it } from "vitest";
import { proposeFromHtml } from "../src/adapters/url/extract.js";

describe("single URL ingest proposal", () => {
  it("extracts deterministic article metadata from provided HTML", () => {
    const proposal = proposeFromHtml("https://www.example.com/story?b=2&a=1#frag", `
      <html lang="en">
        <head>
          <title>Fallback Title</title>
          <meta property="og:title" content="Structured Title">
          <meta name="author" content="Jane Reporter">
          <meta property="article:published_time" content="2026-05-01T10:00:00.000Z">
          <meta property="og:description" content="A short excerpt">
        </head>
      </html>
    `);

    expect(proposal.article.url_canonical).toBe("https://example.com/story?a=1&b=2");
    expect(proposal.article.title).toBe("Structured Title");
    expect(proposal.article.byline_text).toBe("Jane Reporter");
    expect(proposal.article.language).toBe("en");
    expect(proposal.outlet.home_url_host).toBe("example.com");
  });

  it("prefers JSON-LD NewsArticle metadata and derives Trace Finance relevance", () => {
    const proposal = proposeFromHtml("https://www.coindesk.com/policy/2026/05/02/story", `
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
    `);

    expect(proposal.extraction.source).toBe("json_ld");
    expect(proposal.article.title).toContain("Brazil");
    expect(proposal.authors).toEqual(["Ana Paula Pereira"]);
    expect(proposal.outlet.name).toBe("CoinDesk");
    expect(proposal.tags.map((tag) => tag.name)).toEqual(expect.arrayContaining(["Stablecoins", "Cross-border payments", "Brazil"]));
    expect(proposal.client_relevance?.client_slug).toBe("trace-finance");
  });

  it("falls back to OpenGraph metadata when JSON-LD is absent", () => {
    const proposal = proposeFromHtml("https://example.com/policy", `
      <html>
        <head>
          <meta property="og:title" content="OpenGraph Policy Story">
          <meta property="og:site_name" content="Policy Wire">
          <meta property="og:description" content="Stablecoin regulation update">
        </head>
      </html>
    `);

    expect(proposal.extraction.source).toBe("meta");
    expect(proposal.article.title).toBe("OpenGraph Policy Story");
    expect(proposal.outlet.name).toBe("Policy Wire");
  });
});
