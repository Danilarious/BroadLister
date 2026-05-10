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
  source_record_id: string;
  name: string;
  kind: OntologySnapshotConcept["kind"];
  external_id?: string;
  concept_slug: string;
  suggested_tag_slug: string;
  suggested_match?: {
    id: string;
    slug: string;
    name: string;
    kind: string;
  };
  confidence: "low" | "medium" | "high";
  reason: string;
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

export async function previewOntologySnapshot(input: unknown): Promise<OntologySnapshotPreview> {
  const snapshot = parseOntologySnapshot(input);
  const rows = await Promise.all(snapshot.concepts.map((concept) => previewConcept(snapshot, concept)));
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
  const preview = await previewOntologySnapshot(snapshot);
  const batch = await prisma.importBatch.create({
    data: {
      source_type: "ontology_snapshot",
      label: label ?? `${snapshot.source_system} ${snapshot.source_version}`,
      row_count: snapshot.concepts.length,
      notes: JSON.stringify({
        schema: snapshot.schema,
        source_system: snapshot.source_system,
        source_version: snapshot.source_version,
        exported_at: snapshot.exported_at
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
            import_batch_row_id: batchRow.id
          }
        })
      }
    }));
  }

  return { import_batch: batch, review_items: reviewItems, preview };
}

async function previewConcept(snapshot: OntologySnapshot, concept: OntologySnapshotConcept): Promise<OntologyMappingPreviewRow> {
  const suggestedTagSlug = concept.broadlister_tag_slug ?? `${concept.kind}:${slugify(concept.label)}`;
  const normalizedName = normalizeText(concept.label);
  const match = await prisma.tag.findFirst({
    where: {
      OR: [
        { slug: suggestedTagSlug },
        { slug: concept.concept_slug },
        { name: concept.label }
      ]
    },
    orderBy: { created_at: "asc" }
  });
  const externalId = concept.ontology_core_id ?? concept.concept_id ?? concept.tabulator_tag_id;
  return {
    source_system: snapshot.source_system,
    source_version: snapshot.source_version,
    source_record_id: concept.source_record_id ?? externalId ?? concept.concept_slug,
    name: concept.label,
    kind: concept.kind,
    external_id: externalId,
    concept_slug: concept.concept_slug,
    suggested_tag_slug: suggestedTagSlug,
    suggested_match: match ? { id: match.id, slug: match.slug, name: match.name, kind: match.kind } : undefined,
    confidence: match?.slug === suggestedTagSlug || match?.slug === concept.concept_slug ? "high" : match?.name && normalizeText(match.name) === normalizedName ? "medium" : concept.confidence,
    reason: match
      ? match.slug === suggestedTagSlug || match.slug === concept.concept_slug
        ? "Matched existing BroadLister tag by slug"
        : "Matched existing BroadLister tag by normalized name"
      : "No local tag match; approval can create a local tag and store external references"
  };
}
