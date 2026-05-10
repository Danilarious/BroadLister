import { createHash } from "node:crypto";
import { findForbiddenFieldPaths } from "./tabulator-export-contract.js";

type Severity = "error" | "warning";

type Finding = {
  severity: Severity;
  code: string;
  path: string;
  message: string;
};

type IdempotencyKey = {
  entity: "Link" | "ExternalSourceRecord" | "Tag" | "LinkTag" | "ResearchArtifact" | "OntologyProposal";
  source_id: string;
  key: string;
};

type DryRunOperation = {
  op:
    | "upsert_link"
    | "upsert_external_source_record"
    | "upsert_tag"
    | "attach_link_tag"
    | "create_research_artifact"
    | "queue_ontology_proposal";
  entity: IdempotencyKey["entity"];
  idempotency_key: string;
  source: Record<string, string | number | null>;
  preview: Record<string, unknown>;
};

type RejectedRecord = {
  source_id: string;
  reason: string;
  path: string;
};

export type TabulatorOfflineImportDryRun = {
  schema: "BroadListerTabulatorOfflineImportDryRun.v1";
  mode: "validate_dry_run";
  validation: {
    ok: boolean;
    errors: Finding[];
    warnings: Finding[];
  };
  source_bundle: {
    schema?: string;
    export_schema_version?: string;
    export_id?: string;
    exported_at?: string;
    bundle_sha256: string;
  };
  idempotency: {
    duplicate_findings: Finding[];
    keys: IdempotencyKey[];
  };
  mapping_preview: {
    operations: DryRunOperation[];
    proposals: DryRunOperation[];
    rejected_records: RejectedRecord[];
    omitted_records: Array<Record<string, unknown>>;
  };
  counts: {
    links: number;
    external_source_records: number;
    tags: number;
    link_tags: number;
    research_artifacts: number;
    ontology_proposals: number;
    rejected_records: number;
  };
  safety: {
    tabulator_api_called: false;
    tabulator_runtime_dependency_used: false;
    external_writes_performed: false;
    contacts_imported: false;
    client_private_fields_imported: false;
  };
};

const expectedSchema = "BroadListerReviewedMediaExportBundle.v1";
const expectedVersion = "v1";

const offlineForbiddenKeys = [
  "contact_method",
  "contactMethods",
  "contact_methods",
  "email",
  "emails",
  "phone",
  "phones",
  "social_handle",
  "social_handles",
  "client_id",
  "campaign_id",
  "campaign_list_id",
  "pitch_angle",
  "target_rationale",
  "suitability_note",
  "narrative_fit_json",
  "relationship_warmth",
  "exclusion_flag",
  "exclusion_reason",
  "embargo_note",
  "outreach_status"
];

export function buildTabulatorOfflineImportDryRun(payload: unknown): TabulatorOfflineImportDryRun {
  const bundle = isRecord(payload) ? payload : {};
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const rejectedRecords: RejectedRecord[] = [];

  requireEqual(bundle.schema, expectedSchema, "schema", errors);
  requireEqual(bundle.export_schema_version, expectedVersion, "export_schema_version", errors);
  requireEqual(bundle.source_system, "broadlister", "source_system", errors);
  requireEqual(bundle.export_scope, "reviewed_public_media", "export_scope", errors);

  const eligibility = readRecord(bundle.eligibility_policy);
  requireEqual(eligibility.requires_reviewed_records, true, "eligibility_policy.requires_reviewed_records", errors);
  requireEqual(eligibility.requires_provenance, true, "eligibility_policy.requires_provenance", errors);
  requireEqual(eligibility.excludes_client_overlays, true, "eligibility_policy.excludes_client_overlays", errors);
  requireEqual(eligibility.excludes_outreach_fields, true, "eligibility_policy.excludes_outreach_fields", errors);

  const contractForbidden = findForbiddenFieldPaths(payload);
  for (const path of contractForbidden) {
    errors.push(finding("error", "forbidden_contract_field", path, `Forbidden Tabulator export field found at ${path}.`));
  }
  for (const path of findOfflineForbiddenKeyPaths(payload)) {
    errors.push(finding("error", "forbidden_bridge_field", path, `Forbidden contact/client/private field found at ${path}.`));
  }

  const articles = readArray(bundle.articles);
  const artifacts = readArray(bundle.artifacts);
  const tags = readArray(bundle.tags);
  const provenance = readArray(bundle.provenance);
  const omitted = readArray(bundle.omitted);

  if (articles.length === 0) {
    warnings.push(finding("warning", "empty_articles", "articles", "Bundle has no reviewed articles to map."));
  }
  if (provenance.length === 0) {
    errors.push(finding("error", "missing_bundle_provenance", "provenance", "Bundle must include at least one provenance packet."));
  }

  const artifactByArticleId = new Map<string, Record<string, unknown>>();
  artifacts.forEach((artifact, index) => {
    const item = readRecord(artifact);
    const article = readRecord(item.article);
    const articleId = readString(article.broadlister_article_id);
    const artifactProvenance = readArray(item.provenance);
    if (!articleId) {
      rejectedRecords.push({ source_id: `artifact:${index}`, reason: "missing_article_id", path: `artifacts.${index}.article.broadlister_article_id` });
      return;
    }
    if (artifactProvenance.length === 0) {
      rejectedRecords.push({ source_id: articleId, reason: "missing_provenance", path: `artifacts.${index}.provenance` });
    }
    artifactByArticleId.set(articleId, item);
  });

  const duplicateFindings = [
    ...duplicateFindingsFor(articles, (article) => readString(readRecord(article).broadlister_article_id), "articles", "broadlister_article_id"),
    ...duplicateFindingsFor(articles, (article) => readString(readRecord(article).canonical_url), "articles", "canonical_url"),
    ...duplicateFindingsFor(artifacts, (artifact) => readString(readRecord(artifact).stable_export_key), "artifacts", "stable_export_key"),
    ...duplicateFindingsFor(tags, (tag) => {
      const item = readRecord(tag);
      const hint = readRecord(item.tabulator_tag_hint);
      return readString(hint.normalized_name) && readString(hint.tag_type)
        ? `${readString(hint.normalized_name)}::${readString(hint.tag_type)}`
        : undefined;
    }, "tags", "tabulator_tag_hint.normalized_name"),
    ...duplicateFindingsFor(provenance, (packet) => readString(readRecord(packet).packet_id), "provenance", "packet_id")
  ];
  warnings.push(...duplicateFindings);

  const operations: DryRunOperation[] = [];
  const proposals: DryRunOperation[] = [];
  const keys: IdempotencyKey[] = [];
  const referencedTagIds = new Set<string>();

  for (const artifactValue of artifacts) {
    const artifact = readRecord(artifactValue);
    if (readArray(artifact.provenance).length === 0) continue;
    for (const tagValue of readArray(artifact.tags)) {
      const tagId = readString(readRecord(tagValue).broadlister_tag_id);
      if (tagId) referencedTagIds.add(tagId);
    }
  }

  for (const articleValue of articles) {
    const article = readRecord(articleValue);
    const articleId = readString(article.broadlister_article_id);
    const canonicalUrl = readString(article.canonical_url);
    if (!articleId || !canonicalUrl) {
      rejectedRecords.push({ source_id: articleId ?? "unknown_article", reason: "missing_article_id_or_canonical_url", path: "articles" });
      continue;
    }
    const artifact = artifactByArticleId.get(articleId);
    if (!artifact || readArray(artifact.provenance).length === 0) continue;

    const linkKey = keyFor("link", canonicalUrl);
    operations.push({
      op: "upsert_link",
      entity: "Link",
      idempotency_key: linkKey,
      source: { broadlister_article_id: articleId, canonical_url: canonicalUrl },
      preview: {
        canonicalUrl: canonicalUrl,
        originalUrl: readString(article.original_url),
        title: readString(article.title),
        description: readString(article.description),
        siteName: readString(article.outlet_name),
        contentType: "article",
        sourceType: "broadlister_export",
        provenanceJson: provenancePointer(bundle, articleId)
      }
    });
    keys.push({ entity: "Link", source_id: articleId, key: linkKey });

    const sourceRecordKey = keyFor("external_source_record", `broadlister:${articleId}`);
    operations.push({
      op: "upsert_external_source_record",
      entity: "ExternalSourceRecord",
      idempotency_key: sourceRecordKey,
      source: { broadlister_article_id: articleId, canonical_url: canonicalUrl },
      preview: {
        sourceSystem: "broadlister",
        sourceRecordId: articleId,
        canonicalUrl,
        sourceUrl: readString(article.original_url) ?? canonicalUrl,
        importBatchId: readString(bundle.export_id),
        rawSourceMetadataJson: {
          stable_export_key: readString(artifact.stable_export_key),
          broadlister_artifact_id: readString(artifact.artifact_id)
        },
        provenanceJson: provenancePointer(bundle, articleId)
      }
    });
    keys.push({ entity: "ExternalSourceRecord", source_id: articleId, key: sourceRecordKey });
  }

  for (const tagValue of tags) {
    const tag = readRecord(tagValue);
    const tagId = readString(tag.broadlister_tag_id);
    const hint = readRecord(tag.tabulator_tag_hint);
    const normalizedName = readString(hint.normalized_name);
    const tagType = readString(hint.tag_type) ?? "system";
    if (tagId && !referencedTagIds.has(tagId)) continue;
    if (!tagId || !normalizedName) {
      rejectedRecords.push({ source_id: tagId ?? "unknown_tag", reason: "missing_tag_id_or_normalized_name", path: "tags" });
      continue;
    }
    const tagKey = keyFor("tag", `${normalizedName}:${tagType}`);
    operations.push({
      op: "upsert_tag",
      entity: "Tag",
      idempotency_key: tagKey,
      source: { broadlister_tag_id: tagId, normalized_name: normalizedName },
      preview: {
        name: readString(tag.name),
        normalizedName,
        tagType,
        source: "broadlister"
      }
    });
    keys.push({ entity: "Tag", source_id: tagId, key: tagKey });

    if (!readString(tag.tabulator_tag_id)) {
      const proposalKey = keyFor("ontology_proposal", `create_tag:${normalizedName}:${tagType}`);
      proposals.push({
        op: "queue_ontology_proposal",
        entity: "OntologyProposal",
        idempotency_key: proposalKey,
        source: { broadlister_tag_id: tagId, normalized_name: normalizedName },
        preview: {
          proposalType: "create_tag",
          proposedTerm: readString(tag.name) ?? normalizedName,
          source: "broadlister_offline_import",
          provenance: provenancePointer(bundle, tagId)
        }
      });
      keys.push({ entity: "OntologyProposal", source_id: tagId, key: proposalKey });
    }
  }

  for (const artifactValue of artifacts) {
    const artifact = readRecord(artifactValue);
    const article = readRecord(artifact.article);
    const articleId = readString(article.broadlister_article_id);
    if (!articleId || readArray(artifact.provenance).length === 0) continue;

    for (const tagValue of readArray(artifact.tags)) {
      const tag = readRecord(tagValue);
      const tagId = readString(tag.broadlister_tag_id);
      if (!tagId) continue;
      const linkTagKey = keyFor("link_tag", `${articleId}:${tagId}`);
      operations.push({
        op: "attach_link_tag",
        entity: "LinkTag",
        idempotency_key: linkTagKey,
        source: { broadlister_article_id: articleId, broadlister_tag_id: tagId },
        preview: {
          linkKey: keyFor("link", readString(article.canonical_url) ?? articleId),
          tagKey: keyFor("tag", `${readString(readRecord(tag.tabulator_tag_hint).normalized_name) ?? readString(tag.name) ?? tagId}:${readString(readRecord(tag.tabulator_tag_hint).tag_type) ?? "system"}`),
          source: "broadlister",
          confidence: readString(tag.confidence) ?? "medium"
        }
      });
      keys.push({ entity: "LinkTag", source_id: `${articleId}:${tagId}`, key: linkTagKey });
    }

    const artifactKey = keyFor("research_artifact", readString(artifact.stable_export_key) ?? articleId);
    operations.push({
      op: "create_research_artifact",
      entity: "ResearchArtifact",
      idempotency_key: artifactKey,
      source: { broadlister_article_id: articleId, artifact_id: readString(artifact.artifact_id) ?? null },
      preview: {
        artifactType: "source_pack",
        title: `BroadLister reviewed media artifact ${articleId}`,
        canonicalRef: readString(artifact.artifact_id) ?? `broadlister:article:${articleId}`,
        sourcePath: ["BroadLister", "ReviewedMedia", articleId],
        provenance: provenancePointer(bundle, articleId)
      }
    });
    keys.push({ entity: "ResearchArtifact", source_id: articleId, key: artifactKey });
  }

  const sortedOperations = operations.sort(compareOperations);
  const sortedProposals = proposals.sort(compareOperations);
  const allErrors = [...errors, ...rejectedRecords.map((record) => finding("error", record.reason, record.path, `Rejected ${record.source_id}: ${record.reason}.`))];

  return {
    schema: "BroadListerTabulatorOfflineImportDryRun.v1",
    mode: "validate_dry_run",
    validation: {
      ok: allErrors.length === 0,
      errors: allErrors.sort(compareFindings),
      warnings: warnings.sort(compareFindings)
    },
    source_bundle: {
      schema: readString(bundle.schema),
      export_schema_version: readString(bundle.export_schema_version),
      export_id: readString(bundle.export_id),
      exported_at: readString(bundle.exported_at),
      bundle_sha256: sha256(canonicalJson(payload))
    },
    idempotency: {
      duplicate_findings: duplicateFindings.sort(compareFindings),
      keys: uniqueKeys(keys).sort((a, b) => a.key.localeCompare(b.key) || a.entity.localeCompare(b.entity))
    },
    mapping_preview: {
      operations: sortedOperations,
      proposals: sortedProposals,
      rejected_records: rejectedRecords.sort((a, b) => a.source_id.localeCompare(b.source_id) || a.reason.localeCompare(b.reason)),
      omitted_records: omitted.map((item) => readRecord(item)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    },
    counts: {
      links: sortedOperations.filter((operation) => operation.entity === "Link").length,
      external_source_records: sortedOperations.filter((operation) => operation.entity === "ExternalSourceRecord").length,
      tags: sortedOperations.filter((operation) => operation.entity === "Tag").length,
      link_tags: sortedOperations.filter((operation) => operation.entity === "LinkTag").length,
      research_artifacts: sortedOperations.filter((operation) => operation.entity === "ResearchArtifact").length,
      ontology_proposals: sortedProposals.length,
      rejected_records: rejectedRecords.length
    },
    safety: {
      tabulator_api_called: false,
      tabulator_runtime_dependency_used: false,
      external_writes_performed: false,
      contacts_imported: false,
      client_private_fields_imported: false
    }
  };
}

function requireEqual(actual: unknown, expected: unknown, path: string, errors: Finding[]): void {
  if (actual !== expected) {
    errors.push(finding("error", "invalid_contract", path, `Expected ${path} to equal ${JSON.stringify(expected)}.`));
  }
}

function finding(severity: Severity, code: string, path: string, message: string): Finding {
  return { severity, code, path, message };
}

function duplicateFindingsFor(items: unknown[], keyFor: (item: unknown) => string | undefined, path: string, field: string): Finding[] {
  const seen = new Map<string, number>();
  const findings: Finding[] = [];
  items.forEach((item, index) => {
    const key = keyFor(item);
    if (!key) return;
    const previous = seen.get(key);
    if (previous !== undefined) {
      findings.push(finding("warning", "duplicate_idempotency_key", `${path}.${index}.${field}`, `Duplicate ${field} matches ${path}.${previous}.${field}: ${key}.`));
    } else {
      seen.set(key, index);
    }
  });
  return findings;
}

function findOfflineForbiddenKeyPaths(value: unknown): string[] {
  const hits = new Set<string>();
  walkForbidden(value, [], hits);
  return Array.from(hits).sort();
}

function walkForbidden(value: unknown, path: string[], hits: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbidden(item, [...path, String(index)], hits));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    const isPolicyList = nextPath[0] === "redaction_report" && nextPath[1] === "denied_fields_checked";
    if (!isPolicyList && offlineForbiddenKeys.includes(key)) hits.add(nextPath.join("."));
    walkForbidden(child, nextPath, hits);
  }
}

function provenancePointer(bundle: Record<string, unknown>, sourceId: string) {
  return {
    source_system: "broadlister",
    export_id: readString(bundle.export_id),
    exported_at: readString(bundle.exported_at),
    source_tag_or_commit: readString(bundle.source_tag_or_commit),
    source_id: sourceId
  };
}

function keyFor(kind: string, value: string): string {
  return `tabulator:${kind}:${sha256(value).slice(0, 24)}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortValue(child)]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function uniqueKeys(keys: IdempotencyKey[]): IdempotencyKey[] {
  const seen = new Set<string>();
  return keys.filter((key) => {
    const compound = `${key.entity}:${key.source_id}:${key.key}`;
    if (seen.has(compound)) return false;
    seen.add(compound);
    return true;
  });
}

function compareOperations(a: DryRunOperation, b: DryRunOperation): number {
  return a.entity.localeCompare(b.entity) || a.op.localeCompare(b.op) || a.idempotency_key.localeCompare(b.idempotency_key);
}

function compareFindings(a: Finding, b: Finding): number {
  return a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code) || a.path.localeCompare(b.path);
}
