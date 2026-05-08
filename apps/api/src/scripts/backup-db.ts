import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const dbUrl = process.env.BROADLISTER_DB ?? "file:../../data/broadlister.sqlite";
const dbPath = resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
const backupDir = resolve(process.cwd(), "../../data/backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = resolve(backupDir, `broadlister-${timestamp}.sqlite`);

try {
  await stat(dbPath);
  await mkdir(dirname(backupPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  console.log(`Backup written: ${backupPath}`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    console.log(`No database found at ${dbPath}; backup skipped.`);
  } else {
    throw error;
  }
}

