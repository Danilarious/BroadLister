import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import {
  assertNoForbiddenFields,
  buildTabulatorReviewedMediaExportBundle,
  type ReviewedArticleInput,
  type TabulatorReviewedMediaExportBundle
} from "./tabulator-export-contract.js";

type ExportableModel = "Article" | "Outlet" | "Journalist" | "Byline" | "Tag" | "ArticleTag";

type ExportPreviewOptions = {
  exportId: string;
  exportedAt: string;
  exportedBy: string;
  sourceTagOrCommit?: string;
  articleIds?: string[];
  prismaClient?: PrismaClient;
};

type OmittedRecord = {
  broadlister_model: ExportableModel;
  id: string;
  reason: "not_approved" | "missing_provenance";
  detail: string;
};

type ExternalTagIds = {
  ontology_core_id?: string;
  ontology_core_slug?: string;
  tabulator_tag_id?: string;
  relationship_to_ontology?: "exact" | "broader" | "narrower" | "related" | "none";
};

export type TabulatorExportPreview = {
  bundle: TabulatorReviewedMediaExportBundle;
  metadata: {
    schema: "BroadListerTabulatorExportPreview.v1";
    export_id: string;
    generated_at: string;
    mode: "service_only_preview";
    included_article_ids: string[];
    omitted_records: OmittedRecord[];
    safety: {
      route_added: false;
      ui_added: false;
      file_writer_added: false;
      network_calls_allowed: false;
      tabulator_runtime_dependency_allowed: false;
      contacts_exported: false;
      client_overlay_fields_excluded: true;
    };
  };
};

const approvedReviewKindsByModel: Record<ExportableModel, string[]> = {
  Article: ["article_candidate"],
  Outlet: ["outlet_candidate", "bulk_import_row"],
  Journalist: ["journalist_candidate", "new_journalist", "bulk_import_row"],
  Byline: ["byline_candidate"],
  Tag: ["tag_candidate", "ontology_mapping_candidate"],
  ArticleTag: ["article_tag_candidate"]
};

export async function buildTabulatorExportPreview(options: ExportPreviewOptions): Promise<TabulatorExportPreview> {
  const db = options.prismaClient ?? prisma;
  const approvedIds = await loadApprovedRecordIds(db);
  const articles = await db.article.findMany({
    where: options.articleIds?.length ? { id: { in: options.articleIds } } : undefined,
    orderBy: [{ url_canonical: "asc" }, { id: "asc" }],
    include: {
      outlet: true,
      bylines: {
        include: { journalist: true },
        orderBy: [{ position: "asc" }, { id: "asc" }]
      },
      tag_links: {
        include: { tag: true },
        orderBy: { id: "asc" }
      }
    }
  });

  const targetIds = new Set<string>();
  for (const article of articles) {
    targetIds.add(article.id);
    targetIds.add(article.outlet_id);
    for (const byline of article.bylines) {
      targetIds.add(byline.id);
      targetIds.add(byline.journalist_id);
    }
    for (const tagLink of article.tag_links) {
      targetIds.add(tagLink.id);
      targetIds.add(tagLink.tag_id);
    }
  }

  const provenanceLinks = targetIds.size > 0
    ? await db.provenanceLink.findMany({
      where: { target_id: { in: [...targetIds] } },
      include: { citation: true },
      orderBy: [{ target_id: "asc" }, { id: "asc" }]
    })
    : [];
  const provenanceByTarget = groupProvenanceByTarget(provenanceLinks);

  const omittedRecords: OmittedRecord[] = [];
  const reviewedArticles: ReviewedArticleInput[] = [];

  for (const article of articles) {
    const articleApproved = approvedIds.Article.has(article.id);
    const articleProvenance = provenanceByTarget.get(article.id) ?? [];

    if (!articleApproved) {
      omittedRecords.push({
        broadlister_model: "Article",
        id: article.id,
        reason: "not_approved",
        detail: "Article was not produced by an approved review item."
      });
      continue;
    }

    if (articleProvenance.length === 0) {
      omittedRecords.push({
        broadlister_model: "Article",
        id: article.id,
        reason: "missing_provenance",
        detail: "Article has no supporting Citation/ProvenanceLink."
      });
      continue;
    }

    const bylines = article.bylines
      .filter((byline) => approvedIds.Byline.has(byline.id) && (provenanceByTarget.get(byline.id)?.length ?? 0) > 0)
      .map((byline) => ({
        id: byline.id,
        article_id: byline.article_id,
        journalist_id: byline.journalist_id,
        journalist_display_name: byline.journalist.display_name,
        position: byline.position,
        confidence: confidence(byline.confidence),
        provenance_ids: (provenanceByTarget.get(byline.id) ?? []).map((packet) => packet.citation_id)
      }));

    for (const byline of article.bylines) {
      if (!approvedIds.Byline.has(byline.id)) {
        omittedRecords.push({ broadlister_model: "Byline", id: byline.id, reason: "not_approved", detail: "Byline was not produced by an approved review item." });
      } else if ((provenanceByTarget.get(byline.id)?.length ?? 0) === 0) {
        omittedRecords.push({ broadlister_model: "Byline", id: byline.id, reason: "missing_provenance", detail: "Byline has no supporting Citation/ProvenanceLink." });
      }
    }

    const tags = article.tag_links
      .filter((tagLink) => approvedIds.ArticleTag.has(tagLink.id) && approvedIds.Tag.has(tagLink.tag_id) && (provenanceByTarget.get(tagLink.id)?.length ?? 0) > 0)
      .map((tagLink) => ({
        id: tagLink.tag.id,
        slug: tagLink.tag.slug,
        name: tagLink.tag.name,
        kind: tagKind(tagLink.tag.kind),
        confidence: confidence(tagLink.confidence),
        source: "article_tag" as const,
        ...externalTagIds(tagLink.tag.external_ids_json)
      }));

    for (const tagLink of article.tag_links) {
      if (!approvedIds.ArticleTag.has(tagLink.id) || !approvedIds.Tag.has(tagLink.tag_id)) {
        omittedRecords.push({ broadlister_model: "ArticleTag", id: tagLink.id, reason: "not_approved", detail: "Article tag edge or tag was not produced by an approved review item." });
      } else if ((provenanceByTarget.get(tagLink.id)?.length ?? 0) === 0) {
        omittedRecords.push({ broadlister_model: "ArticleTag", id: tagLink.id, reason: "missing_provenance", detail: "Article tag edge has no supporting Citation/ProvenanceLink." });
      }
    }

    reviewedArticles.push({
      review_state: "reviewed",
      article: {
        id: article.id,
        canonical_url: article.url_canonical,
        original_url: article.url,
        title: article.title,
        description: article.excerpt ?? undefined,
        published_at: article.published_at?.toISOString(),
        language: article.language ?? undefined,
        outlet_id: article.outlet_id,
        outlet_name: article.outlet.name
      },
      outlet: {
        id: article.outlet.id,
        name: article.outlet.name,
        slug: article.outlet.slug,
        home_url: article.outlet.home_url ?? undefined,
        home_url_host: article.outlet.home_url_host ?? undefined,
        outlet_type: article.outlet.outlet_type,
        region: article.outlet.region ?? undefined,
        country: article.outlet.country ?? undefined
      },
      bylines,
      tags,
      provenance: articleProvenance
    });
  }

  const bundle = buildTabulatorReviewedMediaExportBundle({
    exportId: options.exportId,
    exportedAt: options.exportedAt,
    exportedBy: options.exportedBy,
    sourceTagOrCommit: options.sourceTagOrCommit,
    articles: reviewedArticles
  });
  const preview: TabulatorExportPreview = {
    bundle,
    metadata: {
      schema: "BroadListerTabulatorExportPreview.v1",
      export_id: options.exportId,
      generated_at: options.exportedAt,
      mode: "service_only_preview",
      included_article_ids: bundle.articles.map((article) => article.broadlister_article_id),
      omitted_records: omittedRecords.sort((a, b) => a.broadlister_model.localeCompare(b.broadlister_model) || a.id.localeCompare(b.id)),
      safety: {
        route_added: false,
        ui_added: false,
        file_writer_added: false,
        network_calls_allowed: false,
        tabulator_runtime_dependency_allowed: false,
        contacts_exported: false,
        client_overlay_fields_excluded: true
      }
    }
  };
  assertNoForbiddenFields(preview);
  return preview;
}

async function loadApprovedRecordIds(db: PrismaClient): Promise<Record<ExportableModel, Set<string>>> {
  const approved: Record<ExportableModel, Set<string>> = {
    Article: new Set(),
    Outlet: new Set(),
    Journalist: new Set(),
    Byline: new Set(),
    Tag: new Set(),
    ArticleTag: new Set()
  };
  const items = await db.reviewItem.findMany({
    where: { status: "approved" },
    select: { kind: true, current_payload_json: true },
    orderBy: { decided_at: "asc" }
  });

  for (const item of items) {
    if (!item.current_payload_json) continue;
    const model = modelForReviewKind(item.kind);
    if (!model) continue;
    const id = recordIdFromPayload(item.current_payload_json);
    if (id) approved[model].add(id);
  }
  return approved;
}

function modelForReviewKind(kind: string): ExportableModel | null {
  for (const [model, kinds] of Object.entries(approvedReviewKindsByModel) as Array<[ExportableModel, string[]]>) {
    if (kinds.includes(kind)) return model;
  }
  return null;
}

function recordIdFromPayload(payloadJson: string): string | null {
  try {
    const payload = JSON.parse(payloadJson) as { id?: unknown };
    return typeof payload.id === "string" ? payload.id : null;
  } catch {
    return null;
  }
}

function groupProvenanceByTarget(links: Array<{
  id: string;
  citation_id: string;
  target_type: string;
  target_id: string;
  target_field: string | null;
  assertion_kind: string;
  confidence: string;
  citation: {
    source_type: string;
    source_url: string | null;
    source_local_path: string | null;
    observed_at: Date;
    captured_by: string | null;
    notes: string | null;
  };
}>): Map<string, ReviewedArticleInput["provenance"]> {
  const grouped = new Map<string, ReviewedArticleInput["provenance"]>();
  for (const link of links) {
    const packets = grouped.get(link.target_id) ?? [];
    packets.push({
      citation_id: link.citation_id,
      provenance_link_id: link.id,
      source_type: link.citation.source_type,
      source_url: link.citation.source_url ?? undefined,
      source_local_path: link.citation.source_local_path ?? undefined,
      observed_at: link.citation.observed_at.toISOString(),
      captured_by: link.citation.captured_by ?? undefined,
      target_model: targetModel(link.target_type),
      target_id: link.target_id,
      target_field: link.target_field ?? undefined,
      assertion_kind: assertionKind(link.assertion_kind),
      confidence: confidence(link.confidence)
    });
    grouped.set(link.target_id, packets);
  }
  return grouped;
}

function targetModel(value: string): "Article" | "Outlet" | "Journalist" | "Byline" | "Tag" {
  if (["Article", "Outlet", "Journalist", "Byline", "Tag"].includes(value)) return value as "Article" | "Outlet" | "Journalist" | "Byline" | "Tag";
  if (value === "ArticleTag") return "Tag";
  return "Article";
}

function assertionKind(value: string): "supports" | "contradicts" | "proposes" {
  return value === "contradicts" || value === "proposes" ? value : "supports";
}

function confidence(value: string): "low" | "medium" | "high" {
  return value === "low" || value === "high" ? value : "medium";
}

function tagKind(value: string): "beat" | "topic" | "format" | "region" | "language" | "broad" | "specific" {
  return ["beat", "topic", "format", "region", "language", "broad", "specific"].includes(value)
    ? value as "beat" | "topic" | "format" | "region" | "language" | "broad" | "specific"
    : "specific";
}

function externalTagIds(input: string | null): ExternalTagIds {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    return {
      ontology_core_id: stringValue(parsed.ontology_core_id),
      ontology_core_slug: stringValue(parsed.ontology_core_slug),
      tabulator_tag_id: stringValue(parsed.tabulator_tag_id),
      relationship_to_ontology: relationshipValue(parsed.relationship_to_ontology)
    };
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function relationshipValue(value: unknown): "exact" | "broader" | "narrower" | "related" | "none" | undefined {
  return value === "exact" || value === "broader" || value === "narrower" || value === "related" || value === "none" ? value : undefined;
}
