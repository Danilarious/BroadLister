import type { FastifyInstance } from "fastify";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { normalizeText, slugify } from "../core/normalize.js";
import { prisma } from "../db/prisma.js";

const csvBody = z.object({
  label: z.string().min(1),
  csv: z.string().min(1),
  mapping: z.record(z.string()).default({})
});

const supportedMappings = new Set(["display_name", "outlet_name", "email", "tag"]);

export async function registerImportRoutes(app: FastifyInstance): Promise<void> {
  app.post("/imports/csv", async (request, reply) => {
    const body = csvBody.parse(request.body);
    const records = parse(body.csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    const unsupported = Object.values(body.mapping).filter((field) => !supportedMappings.has(field));
    if (unsupported.length > 0) {
      return reply.code(400).send({ error: `Unsupported mapped fields: ${unsupported.join(", ")}` });
    }

    const batch = await prisma.importBatch.create({
      data: { source_type: "csv", label: body.label, row_count: records.length }
    });

    for (const [index, row] of records.entries()) {
      const mapped = Object.fromEntries(
        Object.entries(body.mapping)
          .filter(([column]) => row[column] !== undefined)
          .map(([column, field]) => [field, row[column]])
      );

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
                name_variants_json: "[]"
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
    }

    return reply.code(201).send(batch);
  });

  app.get("/imports/:id/rows", async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return prisma.importBatchRow.findMany({ where: { batch_id: id }, orderBy: { row_index: "asc" } });
  });
}

