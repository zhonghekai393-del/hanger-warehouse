import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db";

const currentFile = fileURLToPath(import.meta.url);
const migrationDirectory = path.join(path.dirname(currentFile), "migrations");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );

    const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const alreadyApplied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [file]);
      if (alreadyApplied.rowCount) continue;
      await client.query(await readFile(path.join(migrationDirectory, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      console.log(`Applied ${file}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await migrate();
