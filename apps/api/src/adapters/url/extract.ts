import { canonicalizeUrl, normalizeHost } from "../../core/normalize.js";

export type UrlIngestProposal = {
  citation: {
    source_type: "url";
    source_url: string;
    observed_at: Date;
    notes?: string;
  };
  article: {
    url: string;
    url_canonical: string;
    title: string;
    byline_text?: string;
    published_at?: Date;
    language?: string;
    excerpt?: string;
  };
  outlet: {
    name: string;
    slug: string;
    home_url_host: string | null;
  };
};

function extractMeta(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  return extractMeta(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
}

function extractLanguage(html: string): string | undefined {
  return html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function proposeFromHtml(url: string, html: string): UrlIngestProposal {
  const canonical = canonicalizeUrl(url);
  const host = normalizeHost(canonical);
  const title = extractTitle(html) ?? canonical;
  const byline = extractMeta(html, "author") ?? extractMeta(html, "article:author");
  const published = extractMeta(html, "article:published_time") ?? extractMeta(html, "date");
  const excerpt = extractMeta(html, "og:description") ?? extractMeta(html, "description");

  return {
    citation: {
      source_type: "url",
      source_url: canonical,
      observed_at: new Date(),
      notes: "single-url ingest proposal"
    },
    article: {
      url,
      url_canonical: canonical,
      title,
      byline_text: byline,
      published_at: published ? new Date(published) : undefined,
      language: extractLanguage(html),
      excerpt
    },
    outlet: {
      name: host ?? "Unknown outlet",
      slug: host?.replace(/[^a-z0-9]+/g, "-") ?? "unknown-outlet",
      home_url_host: host
    }
  };
}

