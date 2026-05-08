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
});

