import type { Prisma } from "@prisma/client";
import { normalizeText, sha256 } from "../core/normalize.js";
import { prisma } from "../db/prisma.js";

type ReviewModel = "journalist" | "outlet" | "article" | "tag" | "contactMethod" | "byline" | "articleTag" | "clientRelevance" | "ontologyMapping";

type ReviewProposal =
  | { action: "create"; model: "journalist" | "outlet" | "article" | "tag" | "contactMethod"; data: Record<string, any> }
  | { action: "update"; model: "journalist" | "outlet" | "article" | "tag" | "contactMethod"; id: string; data: Record<string, any> }
  | { action: "create_after_outlet_review"; model: "article"; data: Record<string, any>; blocked_reason: string }
  | { action: "attach_after_journalist_review"; model: "contactMethod"; data: Record<string, any>; blocked_reason?: string }
  | { action: "create_after_article_and_journalist_review"; model: "byline"; data: Record<string, any>; blocked_reason?: string }
  | { action: "advisory"; model: "clientRelevance" | "articleTag"; data: Record<string, any>; blocked_reason?: string }
  | { action: "apply_external_ids"; model: "ontologyMapping"; data: Record<string, any> };

type Match = {
  model: ReviewModel;
  id: string;
  label: string;
  confidence: "low" | "medium" | "high";
  reason: string;
};

type Dependency = {
  model: ReviewModel | "client";
  status: "resolved" | "missing";
  label: string;
  id?: string;
  reason: string;
};

export type ReviewContext = {
  proposal: ReviewProposal;
  summary: string;
  matches: Match[];
  dependencies: Dependency[];
  recommended_action: "create_new" | "match_existing" | "resolve_dependencies" | "advisory_apply" | "reject_or_defer";
};

export async function getReviewContext(id: string): Promise<ReviewContext> {
  const item = await prisma.reviewItem.findUnique({ where: { id } });
  if (!item) throw new Error("Review item not found.");
  return buildReviewContext(JSON.parse(item.proposal_payload_json) as ReviewProposal);
}

export async function applyReviewItem(id: string, decidedBy = "operator") {
  const item = await prisma.reviewItem.findUnique({ where: { id } });
  if (!item) throw new Error("Review item not found.");
  if (item.status !== "pending") throw new Error("Review item is not pending.");

  const proposal = JSON.parse(item.proposal_payload_json) as ReviewProposal;
  const result = await applyProposal(proposal);

  await prisma.reviewItem.update({
    where: { id },
    data: {
      status: "approved",
      decided_at: new Date(),
      decided_by: decidedBy,
      current_payload_json: JSON.stringify(result)
    }
  });

  return result;
}

async function applyProposal(proposal: ReviewProposal): Promise<unknown> {
  if (proposal.action === "update") {
    const model = (prisma as any)[proposal.model];
    if (!model) throw new Error(`Unsupported review model: ${proposal.model}`);
    return model.update({ where: { id: proposal.id }, data: proposal.data });
  }

  if (proposal.model === "outlet" && proposal.action === "create") return createOrMatchOutlet(proposal.data);
  if (proposal.model === "journalist" && proposal.action === "create") return createOrMatchJournalist(proposal.data);
  if (proposal.model === "tag" && proposal.action === "create") return createOrMatchTag(proposal.data);
  if (proposal.model === "article" && (proposal.action === "create" || proposal.action === "create_after_outlet_review")) return createOrMatchArticle(proposal.data);
  if (proposal.model === "contactMethod" && proposal.action === "attach_after_journalist_review") return createOrMatchContactMethod(proposal.data);
  if (proposal.model === "contactMethod" && proposal.action === "create") return createOrMatchContactMethod(proposal.data);
  if (proposal.model === "byline" && proposal.action === "create_after_article_and_journalist_review") return createOrMatchByline(proposal.data);
  if (proposal.model === "articleTag" && proposal.action === "advisory") return createOrMatchArticleTag(proposal.data);
  if (proposal.model === "clientRelevance" && proposal.action === "advisory") return createClientRelevanceNote(proposal.data);
  if (proposal.model === "ontologyMapping" && proposal.action === "apply_external_ids") return applyOntologyMapping(proposal.data);

  throw new Error("Unsupported review proposal action.");
}

async function buildReviewContext(proposal: ReviewProposal): Promise<ReviewContext> {
  const matches: Match[] = [];
  const dependencies: Dependency[] = [];
  const data = proposal.data;

  if (proposal.model === "outlet") matches.push(...await outletMatches(data));
  if (proposal.model === "article") {
    matches.push(...await articleMatches(data));
    dependencies.push(...await articleDependencies(data));
  }
  if (proposal.model === "journalist") matches.push(...await journalistMatches(data));
  if (proposal.model === "tag") matches.push(...await tagMatches(data));
  if (proposal.model === "contactMethod") {
    matches.push(...await contactMethodMatches(data));
    dependencies.push(...await contactMethodDependencies(data));
  }
  if (proposal.model === "byline") dependencies.push(...await bylineDependencies(data));
  if (proposal.model === "articleTag") dependencies.push(...await articleTagDependencies(data));
  if (proposal.model === "clientRelevance") dependencies.push(...await clientRelevanceDependencies(data));
  if (proposal.model === "ontologyMapping") matches.push(...await ontologyMappingMatches(data));

  const missing = dependencies.some((dependency) => dependency.status === "missing");
  const requiresManualResolution = proposal.model === "ontologyMapping" && ["conflict", "duplicate_in_snapshot"].includes(String(data.mapping_status ?? ""));
  return {
    proposal,
    summary: summarizeProposal(proposal),
    matches,
    dependencies,
    recommended_action: requiresManualResolution
      ? "reject_or_defer"
      : missing
      ? "resolve_dependencies"
      : matches.length > 0
        ? "match_existing"
        : proposal.action === "advisory"
          ? "advisory_apply"
          : "create_new"
  };
}

async function createOrMatchOutlet(data: Record<string, any>) {
  const existing = (await outletMatches(data))[0];
  if (existing) return prisma.outlet.findUniqueOrThrow({ where: { id: existing.id } });
  return prisma.outlet.create({ data: data as Prisma.OutletUncheckedCreateInput });
}

async function createOrMatchJournalist(data: Record<string, any>) {
  const existing = (await journalistMatches(data))[0];
  if (existing) return prisma.journalist.findUniqueOrThrow({ where: { id: existing.id } });
  return prisma.journalist.create({ data: data as Prisma.JournalistUncheckedCreateInput });
}

async function createOrMatchTag(data: Record<string, any>) {
  const existing = (await tagMatches(data))[0];
  if (existing) return prisma.tag.findUniqueOrThrow({ where: { id: existing.id } });
  return prisma.tag.create({ data: data as Prisma.TagUncheckedCreateInput });
}

async function createOrMatchArticle(data: Record<string, any>) {
  const existing = (await articleMatches(data))[0];
  if (existing) return prisma.article.findUniqueOrThrow({ where: { id: existing.id } });
  let outletId = data.outlet_id as string | undefined;
  if (!outletId) {
    const outlet = await resolveOutlet(data);
    if (!outlet) throw new Error("Article approval needs an approved or matched outlet first.");
    outletId = outlet.id;
  }
  const { outlet, outlet_name, outlet_slug, outlet_home_url_host, ...articleData } = data;
  void outlet; void outlet_name; void outlet_slug; void outlet_home_url_host;
  return prisma.article.create({ data: { ...articleData, outlet_id: outletId } as Prisma.ArticleUncheckedCreateInput });
}

async function createOrMatchContactMethod(data: Record<string, any>) {
  const existing = (await contactMethodMatches(data))[0];
  if (existing) return prisma.contactMethod.findUniqueOrThrow({ where: { id: existing.id } });
  let journalistId = data.journalist_id as string | undefined;
  if (!journalistId && data.journalist_display_name) {
    const journalist = await findJournalistByName(String(data.journalist_display_name));
    journalistId = journalist?.id;
  }
  if (!journalistId && data.subject_type === "journalist") throw new Error("Contact method approval needs an approved or matched journalist first.");
  const { journalist_display_name, ...contactData } = data;
  void journalist_display_name;
  return prisma.contactMethod.create({
    data: {
      ...contactData,
      journalist_id: journalistId,
      value_norm: data.value_norm ?? normalizeText(String(data.value)),
      value_hash: data.value_hash ?? sha256(normalizeText(String(data.value))),
      verification_state: data.verification_state ?? "unverified",
      lawful_to_store: data.lawful_to_store ?? false
    } as Prisma.ContactMethodUncheckedCreateInput
  });
}

async function createOrMatchByline(data: Record<string, any>) {
  const article = await findArticleByCanonical(String(data.article_url_canonical ?? ""));
  if (!article) throw new Error("Byline approval needs an approved or matched article first.");
  const journalist = await findJournalistByName(String(data.journalist_display_name ?? ""));
  if (!journalist) throw new Error("Byline approval needs an approved or matched journalist first.");
  const existing = await prisma.byline.findUnique({ where: { article_id_journalist_id: { article_id: article.id, journalist_id: journalist.id } } });
  if (existing) return existing;
  return prisma.byline.create({ data: { article_id: article.id, journalist_id: journalist.id, confidence: data.confidence ?? "medium" } });
}

async function createOrMatchArticleTag(data: Record<string, any>) {
  const article = await findArticleByCanonical(String(data.article_url_canonical ?? ""));
  if (!article) throw new Error("Article tag approval needs an approved or matched article first.");
  const tag = await findTagBySlug(String(data.tag_slug ?? ""));
  if (!tag) throw new Error("Article tag approval needs an approved or matched tag first.");
  const existing = await prisma.articleTag.findUnique({ where: { article_id_tag_id: { article_id: article.id, tag_id: tag.id } } });
  if (existing) return existing;
  return prisma.articleTag.create({ data: { article_id: article.id, tag_id: tag.id, confidence: data.confidence ?? "medium" } });
}

async function createClientRelevanceNote(data: Record<string, any>) {
  const client = await prisma.client.findUnique({ where: { slug: String(data.client_slug ?? "") } });
  if (!client) throw new Error(`Client relevance approval needs client slug ${data.client_slug} to exist first.`);
  return prisma.clientNote.create({
    data: {
      client_id: client.id,
      body_md: [
        `Client relevance candidate: ${data.label ?? "Article relevance"}`,
        `Article: ${data.article_url_canonical ?? "unknown"}`,
        `Confidence: ${data.confidence ?? "unknown"}`,
        `Rationale: ${data.rationale ?? ""}`
      ].join("\n")
    }
  });
}

async function applyOntologyMapping(data: Record<string, any>) {
  if (data.mapping_status === "conflict" || data.mapping_status === "duplicate_in_snapshot") {
    throw new Error("Ontology mapping has conflicts or duplicate source IDs. Reject or defer for manual resolution.");
  }
  const existing = (await ontologyMappingMatches(data))[0];
  const tag = existing
    ? await prisma.tag.findUniqueOrThrow({ where: { id: existing.id } })
    : await prisma.tag.create({
      data: {
        name: String(data.name),
        slug: String(data.suggested_tag_slug),
        kind: String(data.kind),
        description: data.description ? String(data.description) : undefined
      }
    });
  const currentExternalIds = tag.external_ids_json ? JSON.parse(tag.external_ids_json) as Record<string, unknown> : {};
  for (const [key, value] of Object.entries(data.external_ids_to_add ?? {})) {
    if (typeof currentExternalIds[key] === "string" && currentExternalIds[key] !== value) {
      throw new Error(`Ontology mapping conflicts with existing ${key}. Reject or defer for manual resolution.`);
    }
  }
  const approvedAt = new Date().toISOString();
  const nextExternalIds = {
    ...currentExternalIds,
    ontology_core_id: data.ontology_core_id ?? currentExternalIds.ontology_core_id,
    ontology_core_slug: data.ontology_core_slug ?? data.concept_slug ?? currentExternalIds.ontology_core_slug,
    tabulator_tag_id: data.tabulator_tag_id ?? currentExternalIds.tabulator_tag_id,
    tabulator_normalized_name: data.tabulator_normalized_name ?? currentExternalIds.tabulator_normalized_name,
    mapping_state: "approved",
    mapping_version: data.source_version,
    mapping_source_system: data.source_system,
    relationship_to_ontology: data.relationship_to_ontology ?? "exact",
    source_snapshot_id: data.source_snapshot_id ?? currentExternalIds.source_snapshot_id,
    source_snapshot_label: data.source_snapshot_label ?? currentExternalIds.source_snapshot_label,
    source_snapshot_exported_at: data.source_snapshot_exported_at ?? currentExternalIds.source_snapshot_exported_at,
    import_batch_row_id: data.import_batch_row_id ?? currentExternalIds.import_batch_row_id,
    review_observed_at: data.observed_at ?? currentExternalIds.review_observed_at,
    approval_timestamp: approvedAt,
    mapping_rationale: data.provenance_summary?.rationale ?? data.rationale ?? currentExternalIds.mapping_rationale,
    reviewed_via: "BroadLister review queue"
  };
  return prisma.tag.update({
    where: { id: tag.id },
    data: { external_ids_json: JSON.stringify(nextExternalIds) }
  });
}

async function outletMatches(data: Record<string, any>): Promise<Match[]> {
  const OR = [
    data.home_url_host ? { home_url_host: String(data.home_url_host) } : undefined,
    data.name_norm ? { name_norm: String(data.name_norm) } : undefined,
    data.name ? { name_norm: normalizeText(String(data.name)) } : undefined
  ].filter(Boolean) as any[];
  if (OR.length === 0) return [];
  const outlets = await prisma.outlet.findMany({ where: { OR }, take: 5 });
  return outlets.map((outlet) => ({
    model: "outlet",
    id: outlet.id,
    label: outlet.name,
    confidence: outlet.home_url_host && outlet.home_url_host === data.home_url_host ? "high" : "medium",
    reason: outlet.home_url_host && outlet.home_url_host === data.home_url_host ? "Domain match" : "Normalized name match"
  }));
}

async function articleMatches(data: Record<string, any>): Promise<Match[]> {
  const articles = await prisma.article.findMany({ where: { url_canonical: String(data.url_canonical ?? "") }, take: 5 });
  return articles.map((article) => ({ model: "article", id: article.id, label: article.title, confidence: "high", reason: "Canonical URL match" }));
}

async function journalistMatches(data: Record<string, any>): Promise<Match[]> {
  const name = String(data.display_name_norm ?? (data.display_name ? normalizeText(String(data.display_name)) : data.journalist_display_name ? normalizeText(String(data.journalist_display_name)) : ""));
  if (!name) return [];
  const journalists = await prisma.journalist.findMany({ where: { display_name_norm: name }, take: 5 });
  return journalists.map((journalist) => ({ model: "journalist", id: journalist.id, label: journalist.display_name, confidence: "medium", reason: "Normalized name match" }));
}

async function tagMatches(data: Record<string, any>): Promise<Match[]> {
  if (!data.slug && !data.name) return [];
  const tags = await prisma.tag.findMany({
    where: {
      OR: [
        data.slug ? { slug: String(data.slug) } : undefined,
        data.name ? { name: String(data.name) } : undefined
      ].filter(Boolean) as any[]
    },
    take: 5
  });
  return tags.map((tag) => ({ model: "tag", id: tag.id, label: tag.name, confidence: tag.slug === data.slug ? "high" : "medium", reason: tag.slug === data.slug ? "Slug match" : "Name match" }));
}

async function ontologyMappingMatches(data: Record<string, any>): Promise<Match[]> {
  const baseMatches = await tagMatches({
    slug: data.suggested_tag_slug ?? data.broadlister_tag_slug ?? data.concept_slug,
    name: data.name
  });
  const externalIds = data.external_ids_to_add && typeof data.external_ids_to_add === "object" ? data.external_ids_to_add as Record<string, unknown> : {
    ontology_core_id: data.ontology_core_id,
    ontology_core_slug: data.ontology_core_slug,
    tabulator_tag_id: data.tabulator_tag_id,
    tabulator_normalized_name: data.tabulator_normalized_name
  };
  const externalMatches = (await prisma.tag.findMany({ take: 200 }))
    .filter((tag) => tag.external_ids_json && hasAnyExternalId(tag.external_ids_json, externalIds))
    .map((tag) => ({ model: "ontologyMapping" as const, id: tag.id, label: tag.name, confidence: "high" as const, reason: "External ID already mapped" }));
  const byId = new Map([...externalMatches, ...baseMatches].map((match) => [match.id, match]));
  return Array.from(byId.values());
}

function hasAnyExternalId(input: string, externalIds: Record<string, unknown>): boolean {
  try {
    const current = JSON.parse(input) as Record<string, unknown>;
    return Object.entries(externalIds).some(([key, value]) => typeof value === "string" && current[key] === value);
  } catch {
    return false;
  }
}

async function contactMethodMatches(data: Record<string, any>): Promise<Match[]> {
  if (!data.value) return [];
  const valueNorm = data.value_norm ?? normalizeText(String(data.value));
  const valueHash = data.value_hash ?? sha256(valueNorm);
  const contacts = await prisma.contactMethod.findMany({ where: { value_hash: valueHash }, take: 5 });
  return contacts.map((contact) => ({ model: "contactMethod", id: contact.id, label: contact.value, confidence: "high", reason: "Normalized value hash match" }));
}

async function articleDependencies(data: Record<string, any>): Promise<Dependency[]> {
  if (data.outlet_id) return [{ model: "outlet", status: "resolved", label: "Outlet", id: String(data.outlet_id), reason: "Proposal includes outlet_id" }];
  const outlet = await resolveOutlet(data);
  return [{ model: "outlet", status: outlet ? "resolved" : "missing", label: String(data.outlet_name ?? data.outlet?.name ?? "Outlet"), id: outlet?.id, reason: outlet ? "Matched outlet by domain/name" : "Approve or match outlet first" }];
}

async function contactMethodDependencies(data: Record<string, any>): Promise<Dependency[]> {
  if (data.subject_type !== "journalist") return [];
  const journalist = data.journalist_id ? await prisma.journalist.findUnique({ where: { id: String(data.journalist_id) } }) : await findJournalistByName(String(data.journalist_display_name ?? ""));
  return [{ model: "journalist", status: journalist ? "resolved" : "missing", label: String(data.journalist_display_name ?? data.journalist_id ?? "Journalist"), id: journalist?.id, reason: journalist ? "Matched journalist" : "Approve or match journalist first" }];
}

async function bylineDependencies(data: Record<string, any>): Promise<Dependency[]> {
  const article = await findArticleByCanonical(String(data.article_url_canonical ?? ""));
  const journalist = await findJournalistByName(String(data.journalist_display_name ?? ""));
  return [
    { model: "article", status: article ? "resolved" : "missing", label: String(data.article_url_canonical ?? "Article"), id: article?.id, reason: article ? "Canonical URL matched article" : "Approve or match article first" },
    { model: "journalist", status: journalist ? "resolved" : "missing", label: String(data.journalist_display_name ?? "Journalist"), id: journalist?.id, reason: journalist ? "Normalized name matched journalist" : "Approve or match journalist first" }
  ];
}

async function articleTagDependencies(data: Record<string, any>): Promise<Dependency[]> {
  const article = await findArticleByCanonical(String(data.article_url_canonical ?? ""));
  const tag = await findTagBySlug(String(data.tag_slug ?? ""));
  return [
    { model: "article", status: article ? "resolved" : "missing", label: String(data.article_url_canonical ?? "Article"), id: article?.id, reason: article ? "Canonical URL matched article" : "Approve or match article first" },
    { model: "tag", status: tag ? "resolved" : "missing", label: String(data.tag_slug ?? "Tag"), id: tag?.id, reason: tag ? "Slug matched tag" : "Approve or match tag first" }
  ];
}

async function clientRelevanceDependencies(data: Record<string, any>): Promise<Dependency[]> {
  const client = await prisma.client.findUnique({ where: { slug: String(data.client_slug ?? "") } });
  const article = await findArticleByCanonical(String(data.article_url_canonical ?? ""));
  return [
    { model: "client", status: client ? "resolved" : "missing", label: String(data.client_slug ?? "Client"), id: client?.id, reason: client ? "Client slug matched" : "Create or select client before applying relevance" },
    { model: "article", status: article ? "resolved" : "missing", label: String(data.article_url_canonical ?? "Article"), id: article?.id, reason: article ? "Canonical URL matched article" : "Approve or match article first" }
  ];
}

async function resolveOutlet(data: Record<string, any>) {
  if (data.outlet_id) return prisma.outlet.findUnique({ where: { id: String(data.outlet_id) } });
  const outletData = data.outlet ?? {
    name: data.outlet_name,
    slug: data.outlet_slug,
    home_url_host: data.outlet_home_url_host
  };
  const match = (await outletMatches(outletData))[0];
  return match ? prisma.outlet.findUnique({ where: { id: match.id } }) : null;
}

async function findArticleByCanonical(url: string) {
  return url ? prisma.article.findUnique({ where: { url_canonical: url } }) : null;
}

async function findJournalistByName(name: string) {
  return name ? prisma.journalist.findFirst({ where: { display_name_norm: normalizeText(name) } }) : null;
}

async function findTagBySlug(slug: string) {
  return slug ? prisma.tag.findUnique({ where: { slug } }) : null;
}

function summarizeProposal(proposal: ReviewProposal): string {
  const data = proposal.data;
  if (proposal.model === "outlet") return `Outlet: ${data.name ?? "unnamed"}`;
  if (proposal.model === "article") return `Article: ${data.title ?? data.url_canonical ?? "untitled"}`;
  if (proposal.model === "journalist") return `Journalist: ${data.display_name ?? data.journalist_display_name ?? "unnamed"}`;
  if (proposal.model === "contactMethod") return `Contact method: ${data.kind ?? "contact"} ${data.value ?? ""}`;
  if (proposal.model === "byline") return `Byline: ${data.journalist_display_name ?? "journalist"} to ${data.article_url_canonical ?? "article"}`;
  if (proposal.model === "tag") return `Tag: ${data.name ?? data.slug ?? "tag"}`;
  if (proposal.model === "articleTag") return `Article tag: ${data.tag_slug ?? "tag"} on ${data.article_url_canonical ?? "article"}`;
  if (proposal.model === "clientRelevance") return `Client relevance: ${data.client_slug ?? "client"} for ${data.article_url_canonical ?? "article"}`;
  if (proposal.model === "ontologyMapping") return `Ontology mapping: ${data.name ?? data.concept_slug ?? "tag mapping"}`;
  return "Review proposal";
}
