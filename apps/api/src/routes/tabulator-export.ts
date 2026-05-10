import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildTabulatorExportPreview } from "../services/tabulator-export-preview.js";

const previewQuery = z.object({
  export_id: z.string().min(1).optional(),
  generated_at: z.string().datetime().optional(),
  exported_by: z.string().min(1).optional(),
  source_tag_or_commit: z.string().min(1).optional(),
  article_ids: z.string().optional()
});

export async function registerTabulatorExportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/tabulator/export/preview", async (request) => {
    const query = previewQuery.parse(request.query);
    const generatedAt = query.generated_at ?? new Date().toISOString();
    const exportId = query.export_id ?? `tabulator-preview-${generatedAt}`;
    return buildTabulatorExportPreview({
      exportId,
      exportedAt: generatedAt,
      exportedBy: query.exported_by ?? "operator",
      sourceTagOrCommit: query.source_tag_or_commit,
      articleIds: parseArticleIds(query.article_ids)
    });
  });
}

function parseArticleIds(input: string | undefined): string[] | undefined {
  if (!input) return undefined;
  const ids = input.split(",").map((id) => id.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}
