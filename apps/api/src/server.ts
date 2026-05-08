import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db/prisma.js";

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));

await app.listen({ host: config.host, port: config.port });

