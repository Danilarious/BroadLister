import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerCrudRoutes } from "./routes/crud.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerImportRoutes } from "./routes/imports.js";
import { registerReviewRoutes } from "./routes/review.js";
import { registerUrlIngestRoutes } from "./routes/url-ingest.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "validation_error", message: error.message });
    }
    return reply.send(error);
  });
  await app.register(cors, { origin: ["http://127.0.0.1:4100", "http://localhost:4100"] });
  await app.register(multipart);
  await registerHealthRoutes(app);
  await registerCrudRoutes(app);
  await registerReviewRoutes(app);
  await registerImportRoutes(app);
  await registerUrlIngestRoutes(app);
  return app;
}
