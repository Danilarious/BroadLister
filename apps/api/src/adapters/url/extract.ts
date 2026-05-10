import { canonicalizeUrl, normalizeHost, slugify } from "../../core/normalize.js";

export type CandidateTag = {
  name: string;
  slug: string;
  kind: "topic" | "beat" | "client_relevance";
  confidence: "low" | "medium" | "high";
  reason: string;
};

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
    home_url?: string;
  };
  authors: string[];
  tags: CandidateTag[];
  client_relevance?: {
    client_slug: "trace-finance";
    label: string;
    confidence: "low" | "medium";
    rationale: string;
  };
  extraction: {
    source: "json_ld" | "meta" | "fallback";
    warnings: string[];
  };
};

type JsonLdNode = Record<string, unknown>;

const topicRules: Array<{ name: string; kind: CandidateTag["kind"]; terms: string[] }> = [
  { name: "Stablecoins", kind: "topic", terms: ["stablecoin", "stablecoins"] },
  { name: "Crypto regulation", kind: "beat", terms: ["crypto regulation", "regulation", "central bank", "ban", "policy"] },
  { name: "Cross-border payments", kind: "topic", terms: ["cross-border", "cross border", "settlement", "payments"] },
  { name: "Brazil", kind: "topic", terms: ["brazil", "brazilian"] },
  { name: "Digital assets", kind: "topic", terms: ["crypto", "digital asset", "digital assets"] }
];

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

function extractLink(html: string, rel: string): string | undefined {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<link[^>]+rel=["']${escaped}["'][^>]+href=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return undefined;
}

function extractJsonLd(html: string): JsonLdNode[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return scripts.flatMap((match) => {
    try {
      const parsed = JSON.parse(decodeHtml(match[1].trim())) as unknown;
      return flattenJsonLd(parsed);
    } catch {
      return [];
    }
  });
}

function flattenJsonLd(value: unknown): JsonLdNode[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const node = value as JsonLdNode;
  const graph = node["@graph"];
  return [node, ...(Array.isArray(graph) ? graph.flatMap(flattenJsonLd) : [])];
}

function nodeType(node: JsonLdNode): string[] {
  const value = node["@type"];
  return Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
}

function findArticleNode(nodes: JsonLdNode[]): JsonLdNode | undefined {
  return nodes.find((node) => nodeType(node).some((type) => ["Article", "NewsArticle", "ReportageNewsArticle", "BlogPosting"].includes(type)));
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return decodeHtml(value.trim());
  return undefined;
}

function authorNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) => {
    if (typeof item === "string") return [decodeHtml(item.trim())].filter(Boolean);
    if (item && typeof item === "object") {
      const name = stringValue((item as JsonLdNode).name);
      return name ? [name] : [];
    }
    return [];
  });
}

function publisherName(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return stringValue((value as JsonLdNode).name);
  return undefined;
}

function extractTitle(html: string, articleNode?: JsonLdNode): string | undefined {
  return stringValue(articleNode?.headline)
    ?? stringValue(articleNode?.name)
    ?? extractMeta(html, "og:title")
    ?? extractMeta(html, "twitter:title")
    ?? decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "");
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

function candidateTags(text: string): CandidateTag[] {
  const normalized = text.toLowerCase();
  return topicRules
    .filter((rule) => rule.terms.some((term) => normalized.includes(term)))
    .map((rule) => ({
      name: rule.name,
      slug: `${rule.kind}:${slugify(rule.name)}`,
      kind: rule.kind,
      confidence: "medium",
      reason: `Matched deterministic terms: ${rule.terms.filter((term) => normalized.includes(term)).join(", ")}`
    }));
}

function traceFinanceRelevance(tags: CandidateTag[], text: string): UrlIngestProposal["client_relevance"] | undefined {
  const normalized = text.toLowerCase();
  const hasStablecoin = normalized.includes("stablecoin");
  const hasPayments = normalized.includes("cross-border") || normalized.includes("cross border") || normalized.includes("settlement") || normalized.includes("payments");
  const hasPolicy = normalized.includes("central bank") || normalized.includes("regulation") || normalized.includes("ban");
  if (!hasStablecoin || !(hasPayments || hasPolicy)) return undefined;
  const matched = tags.map((tag) => tag.name).join(", ");
  return {
    client_slug: "trace-finance",
    label: "Trace Finance relevance candidate",
    confidence: hasPayments && hasPolicy ? "medium" : "low",
    rationale: `Review-gated relevance candidate based on stablecoin/payment-policy terms${matched ? ` and tags: ${matched}` : ""}.`
  };
}

function maybeDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function proposeFromHtml(url: string, html: string): UrlIngestProposal {
  const nodes = extractJsonLd(html);
  const articleNode = findArticleNode(nodes);
  const canonical = canonicalizeUrl(stringValue(articleNode?.url) ?? extractLink(html, "canonical") ?? extractMeta(html, "og:url") ?? url);
  const host = normalizeHost(canonical);
  const title = extractTitle(html, articleNode) || canonical;
  const jsonLdAuthors = authorNames(articleNode?.author);
  const metaByline = extractMeta(html, "author") ?? extractMeta(html, "article:author") ?? extractMeta(html, "byl");
  const authors = jsonLdAuthors.length > 0 ? jsonLdAuthors : (metaByline ? [metaByline] : []);
  const published = stringValue(articleNode?.datePublished) ?? extractMeta(html, "article:published_time") ?? extractMeta(html, "date");
  const excerpt = stringValue(articleNode?.description) ?? extractMeta(html, "og:description") ?? extractMeta(html, "description") ?? extractMeta(html, "twitter:description");
  const outletName = publisherName(articleNode?.publisher) ?? extractMeta(html, "og:site_name") ?? host ?? "Unknown outlet";
  const textForTags = [title, excerpt, authors.join(" "), outletName, canonical].filter(Boolean).join(" ");
  const tags = candidateTags(textForTags);

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
      byline_text: authors.join(", ") || undefined,
      published_at: maybeDate(published),
      language: extractLanguage(html),
      excerpt
    },
    outlet: {
      name: outletName,
      slug: slugify(outletName || host || "unknown-outlet"),
      home_url_host: host,
      home_url: host ? `https://${host}` : undefined
    },
    authors,
    tags,
    client_relevance: traceFinanceRelevance(tags, textForTags),
    extraction: {
      source: articleNode ? "json_ld" : (extractMeta(html, "og:title") ? "meta" : "fallback"),
      warnings: []
    }
  };
}
