import type { FastifyInstance } from "fastify";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { normalizeText, slugify } from "../core/normalize.js";
import { prisma } from "../db/prisma.js";
import { commitOntologySnapshot, previewOntologySnapshot } from "../services/ontology-snapshot.js";

const csvBody = z.object({
  label: z.string().min(1),
  csv: z.string().min(1),
  mapping: z.record(z.string()).default({})
});

const ontologySnapshotBody = z.object({
  label: z.string().min(1).optional(),
  snapshot_json: z.string().min(1)
});

const supportedMappings = new Set([
  "display_name",
  "outlet_name",
  "role_title",
  "email",
  "tag",
  "location_region",
  "profile_url",
  "notes"
]);

const fieldAliases: Record<string, string> = {
  name: "display_name",
  "full name": "display_name",
  journalist: "display_name",
  author: "display_name",
  outlet: "outlet_name",
  publication: "outlet_name",
  company: "outlet_name",
  role: "role_title",
  title: "role_title",
  "job title": "role_title",
  email: "email",
  beat: "tag",
  topic: "tag",
  topics: "tag",
  location: "location_region",
  region: "location_region",
  "profile url": "profile_url",
  linkedin: "profile_url",
  "x": "profile_url",
  twitter: "profile_url",
  notes: "notes"
};

function parseCsv(csv: string): Record<string, string>[] {
  return parse(csv, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }) as Record<string, string>[];
}

function detectMapping(columns: string[]): Record<string, string> {
  return Object.fromEntries(
    columns
      .map((column) => [column, fieldAliases[column.trim().toLowerCase()]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function mapRow(row: Record<string, string>, mapping: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mapping)
      .filter(([column]) => row[column] !== undefined && row[column] !== "")
      .map(([column, field]) => [field, row[column]])
  );
}

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.post("/imports/ontology/preview", async (request, reply) => {
    const body = ontologySnapshotBody.parse(request.body);
    try {
      return await previewOntologySnapshot(body.snapshot_json, body.label);
    } catch (error) {
      return reply.code(400).send({ error: "malformed_ontology_snapshot", message: (error as Error).message });
    }
  });

  app.post("/imports/ontology", async (request, reply) => {
    const body = ontologySnapshotBody.parse(request.body);
    try {
      return reply.code(201).send(await commitOntologySnapshot(body.snapshot_json, body.label));
    } catch (error) {
      return reply.code(400).send({ error: "malformed_ontology_snapshot", message: (error as Error).message });
    }
  });

  app.post("/imports/csv/preview", async (request, reply) => {
    const body = csvBody.parse(request.body);
    try {
      const records = parseCsv(body.csv);
      const columns = records[0] ? Object.keys(records[0]) : [];
      const mapping = Object.keys(body.mapping).length > 0 ? body.mapping : detectMapping(columns);
      const unsupported = Object.values(mapping).filter((field) => !supportedMappings.has(field));
      if (unsupported.length > 0) {
        return reply.code(400).send({ error: `Unsupported mapped fields: ${unsupported.join(", ")}` });
      }
      return {
        row_count: records.length,
        columns,
        detected_mapping: mapping,
        sample: records.slice(0, 5).map((row) => ({ raw: row, mapped: mapRow(row, mapping) }))
      };
    } catch (error) {
      return reply.code(400).send({ error: "malformed_csv", message: (error as Error).message });
    }
  });

  app.post("/imports/csv", async (request, reply) => {
    const body = csvBody.parse(request.body);
    let records: Record<string, string>[];
    try {
      records = parseCsv(body.csv);
    } catch (error) {
      return reply.code(400).send({ error: "malformed_csv", message: (error as Error).message });
    }
    const columns = records[0] ? Object.keys(records[0]) : [];
    const mapping = Object.keys(body.mapping).length > 0 ? body.mapping : detectMapping(columns);
    const unsupported = Object.values(mapping).filter((field) => !supportedMappings.has(field));
    if (unsupported.length > 0) {
      return reply.code(400).send({ error: `Unsupported mapped fields: ${unsupported.join(", ")}` });
    }

    const batch = await prisma.importBatch.create({
      data: { source_type: "csv", label: body.label, row_count: records.length }
    });

    for (const [index, row] of records.entries()) {
      const mapped = mapRow(row, mapping);

      const batchRow = await prisma.importBatchRow.create({
        data: {
          batch_id: batch.id,
          row_index: index,
          raw_json: JSON.stringify(row),
          mapped_json: JSON.stringify(mapped)
        }
      });

      if (mapped.display_name) {
        const displayName = String(mapped.display_name);
        await prisma.reviewItem.create({
          data: {
            kind: "bulk_import_row",
            source_import_batch_id: batch.id,
            proposal_payload_json: JSON.stringify({
              action: "create",
              model: "journalist",
              data: {
                display_name: displayName,
                display_name_norm: normalizeText(displayName),
                name_variants_json: "[]",
                bio_short: [mapped.role_title, mapped.location_region, mapped.notes].filter(Boolean).join(" | ") || undefined,
                external_handles_json: mapped.profile_url ? JSON.stringify({ profile_url: mapped.profile_url }) : undefined
              },
              import_batch_row_id: batchRow.id
            })
          }
        });
      }

      if (mapped.outlet_name) {
        const name = String(mapped.outlet_name);
        await prisma.reviewItem.create({
          data: {
            kind: "bulk_import_row",
            source_import_batch_id: batch.id,
            proposal_payload_json: JSON.stringify({
              action: "create",
              model: "outlet",
              data: {
                name,
                name_norm: normalizeText(name),
                slug: slugify(name),
                outlet_type: "other"
              },
              import_batch_row_id: batchRow.id
            })
          }
        });
      }

      if (mapped.email) {
        await prisma.reviewItem.create({
          data: {
            kind: "contact_method_candidate",
            source_import_batch_id: batch.id,
            proposal_payload_json: JSON.stringify({
              action: "attach_after_journalist_review",
              model: "contactMethod",
              data: {
                subject_type: "journalist",
                journalist_display_name: mapped.display_name,
                kind: "email",
                value: mapped.email,
                verification_state: "unverified",
                lawful_to_store: false,
                notes: [mapped.display_name ? `candidate for ${mapped.display_name}` : "", mapped.notes].filter(Boolean).join(" | ") || undefined
              },
              import_batch_row_id: batchRow.id
            })
          }
        });
      }

      if (mapped.tag) {
        await prisma.reviewItem.create({
          data: {
            kind: "tag_candidate",
            source_import_batch_id: batch.id,
            proposal_payload_json: JSON.stringify({
              action: "create",
              model: "tag",
              data: {
                name: mapped.tag,
                slug: `topic:${slugify(mapped.tag)}`,
                kind: "topic"
              },
              import_batch_row_id: batchRow.id
            })
          }
        });
      }
    }

    return reply.code(201).send(batch);
  });

  app.get("/imports/:id/rows", async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return prisma.importBatchRow.findMany({ where: { batch_id: id }, orderBy: { row_index: "asc" } });
  });
}
