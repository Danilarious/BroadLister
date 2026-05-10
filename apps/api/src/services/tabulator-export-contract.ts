import { createHash } from "node:crypto";

export const tabulatorExportForbiddenFields = [
  "pitch_angle",
  "target_rationale",
  "suitability_note",
  "narrative_fit_json",
  "exclusion_flag",
  "exclusion_reason",
  "embargo_until",
  "embargo_note",
  "relationship_warmth",
  "notes_private",
  "summary_private",
  "ClientNote.body_md",
  "ClientApproval.note",
  "Campaign.constraints_json",
  "client_id",
  "campaign_id",
  "campaign_list_id"
] as const;

export type TabulatorReviewedMediaBundleInput = {
  exportId: string;
  exportedAt: string;
  exportedBy: string;
  sourceTagOrCommit?: string;
  articles: ReviewedArticleInput[];
};

export type ReviewedArticleInput = {
  article: {
    id: string;
    canonical_url: string;
    original_url?: string;
    title: string;
    description?: string;
    published_at?: string;
    language?: string;
    outlet_id: string;
    outlet_name: string;
    fetch_hash?: string;
  };
  outlet?: {
    id: string;
    name: string;
    slug: string;
    home_url?: string;
    home_url_host?: string;
    outlet_type?: string;
    region?: string;
    country?: string;
  };
  bylines?: Array<{
    id: string;
    article_id: string;
    journalist_id: string;
    journalist_display_name: string;
    position?: number;
    confidence?: "low" | "medium" | "high";
    provenance_ids?: string[];
  }>;
  tags?: Array<{
    id: string;
    slug: string;
    name: string;
    kind: "beat" | "topic" | "format" | "region" | "language" | "broad" | "specific";
    confidence?: "low" | "medium" | "high";
    source?: "article_tag" | "outlet_tag" | "journalist_tag" | "operator_review";
    ontology_core_id?: string;
    ontology_core_slug?: string;
    tabulator_tag_id?: string;
    relationship_to_ontology?: "exact" | "broader" | "narrower" | "related" | "none";
  }>;
  provenance: Array<{
    packet_id?: string;
    citation_id: string;
    provenance_link_id?: string;
    source_type: string;
    source_url?: string;
    source_local_path?: string;
    observed_at: string;
    captured_by?: string;
    payload_hash?: string;
    target_model: "Article" | "Outlet" | "Journalist" | "Byline" | "Tag";
    target_id: string;
    target_field?: string;
    assertion_kind?: "supports" | "contradicts" | "proposes";
    confidence?: "low" | "medium" | "high";
  }>;
  review_state: "reviewed" | "pending" | "rejected";
};

export type TabulatorReviewedMediaExportBundle = ReturnType<typeof buildTabulatorReviewedMediaExportBundle>;

export function buildTabulatorReviewedMediaExportBundle(input: TabulatorReviewedMediaBundleInput) {
  assertNoForbiddenFields(input);

  const eligible = input.articles
    .filter((entry) => entry.review_state === "reviewed")
    .filter((entry) => entry.provenance.length > 0)
    .sort((a, b) => a.article.canonical_url.localeCompare(b.article.canonical_url) || a.article.id.localeCompare(b.article.id));

  const omitted = input.articles
    .filter((entry) => entry.review_state !== "reviewed" || entry.provenance.length === 0)
    .map((entry) => ({
      broadlister_model: "Article",
      id: entry.article.id,
      reason: entry.review_state !== "reviewed" ? "not_reviewed" : "missing_provenance"
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const articles = eligible.map((entry) => ({
    broadlister_article_id: entry.article.id,
    canonical_url: entry.article.canonical_url,
    original_url: entry.article.original_url,
    title: entry.article.title,
    description: entry.article.description,
    published_at: entry.article.published_at,
    language: entry.article.language,
    outlet_id: entry.article.outlet_id,
    outlet_name: entry.article.outlet_name,
    tabulator_link_hint: {
      canonicalUrl: entry.article.canonical_url,
      originalUrl: entry.article.original_url,
      title: entry.article.title,
      description: entry.article.description,
      siteName: entry.article.outlet_name,
      contentType: "article" as const
    }
  }));

  const outlets = uniqueBy(
    eligible
      .flatMap((entry) => entry.outlet ? [entry.outlet] : [])
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((outlet) => ({
        broadlister_outlet_id: outlet.id,
        name: outlet.name,
        slug: outlet.slug,
        home_url: outlet.home_url,
        home_url_host: outlet.home_url_host,
        outlet_type: outlet.outlet_type,
        region: outlet.region,
        country: outlet.country,
        tabulator_metadata: {
          siteName: outlet.name,
          source_kind: "media_outlet" as const
        }
      })),
    (outlet) => outlet.broadlister_outlet_id
  );

  const bylines = uniqueBy(
    eligible
      .flatMap((entry) => entry.bylines ?? [])
      .sort((a, b) => a.article_id.localeCompare(b.article_id) || (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id))
      .map((byline) => ({
        broadlister_byline_id: byline.id,
        broadlister_article_id: byline.article_id,
        broadlister_journalist_id: byline.journalist_id,
        journalist_display_name: byline.journalist_display_name,
        position: byline.position ?? 0,
        confidence: byline.confidence ?? "medium",
        provenance_ids: byline.provenance_ids ?? [],
        tabulator_metadata: {
          relation: "authored_by" as const,
          export_as_metadata_only: true
        }
      })),
    (byline) => byline.broadlister_byline_id
  );

  const tags = uniqueBy(
    eligible
      .flatMap((entry) => entry.tags ?? [])
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((tag) => ({
        broadlister_tag_id: tag.id,
        slug: tag.slug,
        name: tag.name,
        kind: tag.kind,
        confidence: tag.confidence ?? "medium",
        source: tag.source ?? "article_tag",
        ontology_core_id: tag.ontology_core_id,
        ontology_core_slug: tag.ontology_core_slug,
        tabulator_tag_id: tag.tabulator_tag_id,
        relationship_to_ontology: tag.relationship_to_ontology,
        tabulator_tag_hint: {
          name: tag.name,
          normalized_name: normalizeForTabulator(tag.name),
          tag_type: "system" as const,
          link_tag_source: "broadlister" as const
        }
      })),
    (tag) => tag.broadlister_tag_id
  );

  const provenance = uniqueBy(
    eligible
      .flatMap((entry) => entry.provenance)
      .sort((a, b) => a.citation_id.localeCompare(b.citation_id) || a.target_id.localeCompare(b.target_id))
      .map((packet) => ({
        packet_id: packet.packet_id ?? `broadlister:provenance:${packet.citation_id}:${packet.target_model}:${packet.target_id}:${packet.target_field ?? "record"}`,
        citation_id: packet.citation_id,
        provenance_link_id: packet.provenance_link_id,
        source_type: packet.source_type,
        source_url: packet.source_url,
        source_local_path: packet.source_local_path,
        observed_at: packet.observed_at,
        captured_by: packet.captured_by,
        payload_hash: packet.payload_hash,
        target: {
          broadlister_model: packet.target_model,
          broadlister_id: packet.target_id,
          field: packet.target_field
        },
        assertion_kind: packet.assertion_kind ?? "supports",
        confidence: packet.confidence ?? "medium",
        tabulator_provenance_json: {
          source_system: "broadlister" as const,
          citation_id: packet.citation_id,
          observed_at: packet.observed_at,
          target_field: packet.target_field,
          explanation: `BroadLister ${packet.target_model} ${packet.target_id} ${packet.assertion_kind ?? "supports"} ${packet.target_field ?? "record"}`
        }
      })),
    (packet) => packet.packet_id
  );

  const artifacts = eligible.map((entry) => {
    const article = articles.find((candidate) => candidate.broadlister_article_id === entry.article.id)!;
    const artifactProvenance = provenance.filter((packet) => packet.target.broadlister_id === entry.article.id);
    return {
      schema: "BroadListerReviewedMediaArtifact.v1" as const,
      artifact_id: `broadlister:artifact:article:${entry.article.id}`,
      stable_export_key: stableArticleExportKey(entry.article.id, entry.article.canonical_url),
      review_state: "reviewed" as const,
      exported_at: input.exportedAt,
      source_system: "broadlister" as const,
      article,
      outlet: outlets.find((outlet) => outlet.broadlister_outlet_id === entry.outlet?.id),
      bylines: bylines.filter((byline) => byline.broadlister_article_id === entry.article.id),
      tags: (entry.tags ?? []).map((tag) => tags.find((candidate) => candidate.broadlister_tag_id === tag.id)!).filter(Boolean),
      provenance: artifactProvenance.length > 0 ? artifactProvenance : provenance.filter((packet) => entry.provenance.some((source) => source.citation_id === packet.citation_id)),
      tabulator_target: {
        preferred_entity: "Link" as const,
        link_source_type: "broadlister_export" as const,
        link_content_type: "article" as const,
        external_source_system: "broadlister" as const,
        external_source_record_id: entry.article.id,
        source_path: ["BroadLister", "ReviewedMedia", entry.article.id] as const
      }
    };
  });

  return {
    schema: "BroadListerReviewedMediaExportBundle.v1" as const,
    export_schema_version: "v1" as const,
    export_id: input.exportId,
    exported_at: input.exportedAt,
    exported_by: input.exportedBy,
    source_system: "broadlister" as const,
    export_scope: "reviewed_public_media" as const,
    source_tag_or_commit: input.sourceTagOrCommit,
    source_instance: {
      repo: "BroadLister" as const,
      git_commit: input.sourceTagOrCommit
    },
    validation_limits: [
      "local JSON contract scaffold only",
      "no Tabulator API writes",
      "no client overlay fields",
      "no contact methods"
    ],
    eligibility_policy: {
      requires_reviewed_records: true as const,
      requires_provenance: true as const,
      excludes_client_overlays: true as const,
      excludes_outreach_fields: true as const
    },
    articles,
    outlets,
    bylines,
    tags,
    provenance,
    artifacts,
    omitted,
    redaction_report: {
      policy: "deny_client_overlay_fields" as const,
      redacted_field_count: 0,
      denied_fields_checked: [...tabulatorExportForbiddenFields],
      omitted_record_count: omitted.length
    },
    summary: {
      article_count: articles.length,
      outlet_count: outlets.length,
      byline_count: bylines.length,
      tag_count: tags.length,
      provenance_packet_count: provenance.length
    }
  };
}

export function assertNoForbiddenFields(value: unknown): void {
  const hits = findForbiddenFieldPaths(value);
  if (hits.length > 0) {
    throw new Error(`Forbidden Tabulator export fields present: ${hits.join(", ")}`);
  }
}

export function findForbiddenFieldPaths(value: unknown): string[] {
  const hits = new Set<string>();
  walkValue(value, [], hits);
  return Array.from(hits).sort();
}

export function stableArticleExportKey(articleId: string, canonicalUrl: string): string {
  return `broadlister:article:${articleId}:${createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 16)}`;
}

function walkValue(value: unknown, path: string[], hits: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkValue(item, [...path, String(index)], hits));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (isForbiddenPath(nextPath)) hits.add(nextPath.join("."));
    walkValue(child, nextPath, hits);
  }
}

function isForbiddenPath(path: string[]): boolean {
  const joined = path.join(".");
  const key = path.at(-1);
  return tabulatorExportForbiddenFields.some((field) => field.includes(".") ? joined.endsWith(field) : key === field);
}

function normalizeForTabulator(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
