import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL?.trim();
const sslEnabled = ["1", "true", "yes", "on"].includes((process.env.ARCHEOLOGY_DATABASE_SSL || "").toLowerCase());

if (!connectionString) {
  console.error("DATABASE_URL is required before Archeology Notes can start.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS archeology_schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationDir = path.join(process.cwd(), "db", "migrations");
  const files = (await fs.readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();

  for (const name of files) {
    const existing = await client.query("SELECT 1 FROM archeology_schema_migrations WHERE name=$1", [name]);
    if (existing.rowCount) continue;

    const sql = await fs.readFile(path.join(migrationDir, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO archeology_schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Applied migration ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
