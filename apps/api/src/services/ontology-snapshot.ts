import { z } from "zod";
import { normalizeText, slugify } from "../core/normalize.js";
import { prisma } from "../db/prisma.js";

const tagKinds = ["beat", "topic", "format", "region", "language", "broad", "specific"] as const;
const sourceSystems = ["ontology-core", "tabulator", "operator-curated"] as const;

const conceptSchema = z.object({
  source_record_id: z.string().min(1).optional(),
  concept_id: z.string().min(1).optional(),
  concept_slug: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(tagKinds),
  description: z.string().optional(),
  relationship_to_ontology: z.enum(["exact", "broader", "narrower", "related", "none"]).default("exact"),
  ontology_core_id: z.string().min(1).optional(),
  ontology_core_slug: z.string().min(1).optional(),
  tabulator_tag_id: z.string().min(1).optional(),
  tabulator_normalized_name: z.string().min(1).optional(),
  broadlister_tag_slug: z.string().min(1).optional(),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  rationale: z.string().optional(),
  provenance: z.record(z.unknown()).optional()
});

const snapshotSchema = z.object({
  schema: z.literal("BroadListerOntologySnapshot.v1"),
  snapshot_id: z.string().min(1).optional(),
  source_system: z.enum(sourceSystems),
  source_version: z.string().min(1),
  exported_at: z.string().min(1).optional(),
  concepts: z.array(conceptSchema).min(1).max(500)
});

export type OntologySnapshot = z.infer<typeof snapshotSchema>;
export type OntologySnapshotConcept = z.infer<typeof conceptSchema>;

export type OntologyMappingPreviewRow = {
  source_system: OntologySnapshot["source_system"];
  source_version: string;
  source_snapshot_id?: string;
  source_snapshot_label?: string;
  source_record_id: string;
  source_concept_id?: string;
  name: string;
  kind: OntologySnapshotConcept["kind"];
  source_kind: OntologySnapshotConcept["kind"];
  suggested_tag_kind: OntologySnapshotConcept["kind"];
  external_id?: string;
  concept_slug: string;
  suggested_tag_slug: string;
  mapping_status: "already_mapped" | "match_existing" | "create_new" | "conflict" | "duplicate_in_snapshot";
  suggested_match?: {
    id: string;
    slug: string;
    name: string;
    kind: string;
  };
  confidence: "low" | "medium" | "high";
  reason: string;
  conflict_reasons: string[];
  field_changes: Array<{
    field: string;
    current?: unknown;
    proposed: unknown;
    action: "create" | "update" | "unchanged" | "add_external_id" | "conflict";
  }>;
  external_ids_to_add: Record<string, string>;
  provenance_summary: {
    source_system: string;
    source_version: string;
    source_snapshot_id?: string;
    source_snapshot_label?: string;
    exported_at?: string;
    observed_at: string;
    rationale?: string;
  };
};

export type OntologySnapshotPreview = {
  schema: "BroadListerOntologySnapshotPreview.v1";
  source_system: OntologySnapshot["source_system"];
  source_version: string;
  concept_count: number;
  rows: OntologyMappingPreviewRow[];
};

export function parseOntologySnapshot(input: unknown): OntologySnapshot {
  const parsed = typeof input === "string" ? JSON.parse(input) as unknown : input;
  return snapshotSchema.parse(parsed);
}

export async function previewOntologySnapshot(input: unknown, label?: string): Promise<OntologySnapshotPreview> {
  const snapshot = parseOntologySnapshot(input);
  const sourceRecordCounts = countSourceRecords(snapshot);
  const rows = await Promise.all(snapshot.concepts.map((concept) => previewConcept(snapshot, concept, sourceRecordCounts, label)));
  return {
    schema: "BroadListerOntologySnapshotPreview.v1",
    source_system: snapshot.source_system,
    source_version: snapshot.source_version,
    concept_count: rows.length,
    rows
  };
}

export async function commitOntologySnapshot(input: unknown, label?: string) {
  const snapshot = parseOntologySnapshot(input);
  const preview = await previewOntologySnapshot(snapshot, label);
  const batch = await prisma.importBatch.create({
    data: {
      source_type: "ontology_snapshot",
      label: label ?? `${snapshot.source_system} ${snapshot.source_version}`,
      row_count: snapshot.concepts.length,
      notes: JSON.stringify({
        schema: snapshot.schema,
        snapshot_id: snapshot.snapshot_id,
        source_system: snapshot.source_system,
        source_version: snapshot.source_version,
        exported_at: snapshot.exported_at,
        label
      }),
      finished_at: new Date()
    }
  });

  const reviewItems = [];
  for (const [index, concept] of snapshot.concepts.entries()) {
    const rowPreview = preview.rows[index];
    const batchRow = await prisma.importBatchRow.create({
      data: {
        batch_id: batch.id,
        row_index: index,
        raw_json: JSON.stringify(concept),
        mapped_json: JSON.stringify(rowPreview)
      }
    });

    const existingReview = await findExistingOntologyReviewItem(rowPreview);
    if (existingReview) {
      reviewItems.push(existingReview);
      continue;
    }

    reviewItems.push(await prisma.reviewItem.create({
      data: {
        kind: "ontology_mapping_candidate",
        source_import_batch_id: batch.id,
        proposal_payload_json: JSON.stringify({
          action: "apply_external_ids",
          model: "ontologyMapping",
          data: {
            ...rowPreview,
            description: concept.description,
            relationship_to_ontology: concept.relationship_to_ontology,
            ontology_core_id: concept.ontology_core_id ?? concept.concept_id,
            ontology_core_slug: concept.ontology_core_slug ?? concept.concept_slug,
            tabulator_tag_id: concept.tabulator_tag_id,
            tabulator_normalized_name: concept.tabulator_normalized_name,
            provenance: concept.provenance,
            observed_at: rowPreview.provenance_summary.observed_at,
            source_snapshot_id: rowPreview.source_snapshot_id,
            source_snapshot_label: rowPreview.source_snapshot_label,
            source_snapshot_exported_at: snapshot.exported_at,
            import_batch_row_id: batchRow.id
          }
        })
      }
    }));
  }

  return { import_batch: batch, review_items: reviewItems, preview };
}

async function previewConcept(
  snapshot: OntologySnapshot,
  concept: OntologySnapshotConcept,
  sourceRecordCounts: Map<string, number>,
  label?: string
): Promise<OntologyMappingPreviewRow> {
  const suggestedTagSlug = concept.broadlister_tag_slug ?? `${concept.kind}:${slugify(concept.label)}`;
  const normalizedName = normalizeText(concept.label);
  const sourceConceptId = concept.ontology_core_id ?? concept.concept_id ?? concept.tabulator_tag_id;
  const sourceRecordId = concept.source_record_id ?? sourceConceptId ?? concept.concept_slug;
  const sourceRecordKey = sourceRecordKeyFor(snapshot.source_system, sourceRecordId);
  const duplicateInSnapshot = sourceRecordCounts.get(sourceRecordKey) && sourceRecordCounts.get(sourceRecordKey)! > 1;
  const externalIdsToAdd = externalIdsFor(snapshot, concept);
  const allTags = await prisma.tag.findMany({ orderBy: { created_at: "asc" } });
  const externalIdMatches = allTags.filter((tag) => tagHasExternalIds(tag.external_ids_json, externalIdsToAdd));
  const match = await prisma.tag.findFirst({
    where: {
      OR: [
        { slug: suggestedTagSlug },
        { slug: concept.concept_slug },
        { name: concept.label },
        { name: { equals: normalizedName } }
      ]
    },
    orderBy: { created_at: "asc" }
  });
  const normalizedMatch = match ?? allTags.find((tag) => tag.kind === concept.kind && normalizeText(tag.name) === normalizedName);
  const selectedMatch = externalIdMatches[0] ?? normalizedMatch;
  const conflicts = [
    selectedMatch && selectedMatch.kind !== concept.kind ? `Suggested match kind ${selectedMatch.kind} differs from source kind ${concept.kind}` : undefined,
    selectedMatch && selectedMatch.external_ids_json ? tagOwnExternalIdConflicts(selectedMatch.external_ids_json, externalIdsToAdd) : undefined
  ].flat().filter((reason): reason is string => Boolean(reason));
  const mappingStatus = duplicateInSnapshot
    ? "duplicate_in_snapshot"
    : conflicts.length > 0
      ? "conflict"
      : externalIdMatches.length > 0
        ? "already_mapped"
        : selectedMatch
          ? "match_existing"
          : "create_new";
  const fieldChanges = buildFieldChanges(selectedMatch, concept, suggestedTagSlug, externalIdsToAdd);
  const observedAt = new Date().toISOString();
  return {
    source_system: snapshot.source_system,
    source_version: snapshot.source_version,
    source_snapshot_id: snapshot.snapshot_id,
    source_snapshot_label: label,
    source_record_id: sourceRecordId,
    source_concept_id: sourceConceptId,
    name: concept.label,
    kind: concept.kind,
    source_kind: concept.kind,
    suggested_tag_kind: concept.kind,
    external_id: sourceConceptId,
    concept_slug: concept.concept_slug,
    suggested_tag_slug: suggestedTagSlug,
    mapping_status: mappingStatus,
    suggested_match: selectedMatch ? { id: selectedMatch.id, slug: selectedMatch.slug, name: selectedMatch.name, kind: selectedMatch.kind } : undefined,
    confidence: selectedMatch?.slug === suggestedTagSlug || selectedMatch?.slug === concept.concept_slug || externalIdMatches.length > 0 ? "high" : selectedMatch?.name && normalizeText(selectedMatch.name) === normalizedName ? "medium" : concept.confidence,
    reason: reasonFor(mappingStatus, selectedMatch, suggestedTagSlug, concept),
    conflict_reasons: conflicts,
    field_changes: fieldChanges,
    external_ids_to_add: externalIdsToAdd,
    provenance_summary: {
      source_system: snapshot.source_system,
      source_version: snapshot.source_version,
      source_snapshot_id: snapshot.snapshot_id,
      source_snapshot_label: label,
      exported_at: snapshot.exported_at,
      observed_at: observedAt,
      rationale: concept.rationale
    }
  };
}

type TagLike = { id: string; name: string; slug: string; kind: string; description: string | null; external_ids_json: string | null };

function countSourceRecords(snapshot: OntologySnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const concept of snapshot.concepts) {
    const sourceRecordId = concept.source_record_id ?? concept.ontology_core_id ?? concept.concept_id ?? concept.tabulator_tag_id ?? concept.concept_slug;
    const key = sourceRecordKeyFor(snapshot.source_system, sourceRecordId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function sourceRecordKeyFor(sourceSystem: string, sourceRecordId: string): string {
  return `${sourceSystem}:${sourceRecordId}`;
}

function externalIdsFor(snapshot: OntologySnapshot, concept: OntologySnapshotConcept): Record<string, string> {
  return Object.fromEntries([
    ["ontology_core_id", concept.ontology_core_id ?? (snapshot.source_system === "ontology-core" ? concept.concept_id : undefined)],
    ["ontology_core_slug", concept.ontology_core_slug ?? (snapshot.source_system === "ontology-core" ? concept.concept_slug : undefined)],
    ["tabulator_tag_id", concept.tabulator_tag_id ?? (snapshot.source_system === "tabulator" ? concept.concept_id : undefined)],
    ["tabulator_normalized_name", concept.tabulator_normalized_name]
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0));
}

function parseExternalIds(input: string | null): Record<string, unknown> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function tagHasExternalIds(input: string | null, externalIds: Record<string, string>): boolean {
  const current = parseExternalIds(input);
  return Object.entries(externalIds).some(([key, value]) => current[key] === value);
}

function tagOwnExternalIdConflicts(input: string | null, externalIds: Record<string, string>): string[] {
  const current = parseExternalIds(input);
  return Object.entries(externalIds)
    .filter(([key, value]) => typeof current[key] === "string" && current[key] !== value)
    .map(([key, value]) => `${key} already stores ${String(current[key])}; incoming value is ${value}`);
}

function buildFieldChanges(match: TagLike | undefined, concept: OntologySnapshotConcept, suggestedTagSlug: string, externalIds: Record<string, string>): OntologyMappingPreviewRow["field_changes"] {
  if (!match) {
    return [
      { field: "Tag.name", proposed: concept.label, action: "create" },
      { field: "Tag.slug", proposed: suggestedTagSlug, action: "create" },
      { field: "Tag.kind", proposed: concept.kind, action: "create" },
      ...Object.entries(externalIds).map(([field, value]) => ({ field: `Tag.external_ids_json.${field}`, proposed: value, action: "add_external_id" as const }))
    ];
  }
  const currentExternalIds = parseExternalIds(match.external_ids_json);
  return [
    { field: "Tag.name", current: match.name, proposed: match.name, action: "unchanged" },
    { field: "Tag.slug", current: match.slug, proposed: match.slug, action: "unchanged" },
    { field: "Tag.kind", current: match.kind, proposed: match.kind, action: match.kind === concept.kind ? "unchanged" : "conflict" },
    ...Object.entries(externalIds).map(([field, value]) => ({
      field: `Tag.external_ids_json.${field}`,
      current: currentExternalIds[field],
      proposed: value,
      action: currentExternalIds[field] === value ? "unchanged" as const : currentExternalIds[field] ? "conflict" as const : "add_external_id" as const
    }))
  ];
}

function reasonFor(
  status: OntologyMappingPreviewRow["mapping_status"],
  match: TagLike | undefined,
  suggestedTagSlug: string,
  concept: OntologySnapshotConcept
): string {
  if (status === "duplicate_in_snapshot") return "Same source ID appears more than once in this snapshot; reject or defer duplicates before approval";
  if (status === "conflict") return "Incoming external IDs or kind conflict with an existing local tag; manual review required";
  if (status === "already_mapped") return "External ID is already present on a local BroadLister tag; approval is idempotent";
  if (!match) return "No local tag match; approval can create a local tag and store external references";
  if (match.slug === suggestedTagSlug || match.slug === concept.concept_slug) return "Matched existing BroadLister tag by slug";
  return "Matched existing BroadLister tag by normalized name and kind";
}

async function findExistingOntologyReviewItem(row: OntologyMappingPreviewRow) {
  const pending = await prisma.reviewItem.findMany({
    where: { kind: "ontology_mapping_candidate", status: "pending" },
    orderBy: { created_at: "asc" },
    take: 200
  });
  return pending.find((item) => {
    const payload = JSON.parse(item.proposal_payload_json) as { data?: Record<string, unknown> };
    const data = payload.data ?? {};
    return data.source_system === row.source_system && data.source_record_id === row.source_record_id && data.source_version === row.source_version;
  });
}
