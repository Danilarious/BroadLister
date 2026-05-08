import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { globalModels } from "../core/invariants/scope.js";

const schema = await readFile(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const failures: string[] = [];

for (const model of globalModels) {
  const match = schema.match(new RegExp(`model\\s+${model}\\s+\\{([\\s\\S]*?)\\n\\}`, "m"));
  if (!match) {
    failures.push(`${model}: model not found`);
    continue;
  }
  if (/\bclient_id\b/.test(match[1])) {
    failures.push(`${model}: global model must not contain client_id`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Global model scope check passed.");

