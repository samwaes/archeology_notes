import { Pool } from "pg";

let pool: Pool | null = null;

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value || !value.trim()) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function databaseConfiguration() {
  const connectionString = process.env.DATABASE_URL?.trim() || "";
  return {
    connectionString,
    configured: Boolean(connectionString),
    ssl: parseBoolean(process.env.ARCHEOLOGY_DATABASE_SSL, false)
  };
}

export function getDatabase() {
  const config = databaseConfiguration();
  if (!config.configured) throw new Error("Archeology Notes database is not configured.");

  if (!pool) {
    pool = new Pool({
      connectionString: config.connectionString,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  return pool;
}

export async function validateDatabaseConnection() {
  const result = await getDatabase().query("SELECT current_database() AS database, PostGIS_Version() AS postgis");
  return { database: String(result.rows[0]?.database || ""), postgis: String(result.rows[0]?.postgis || "") };
}

export async function upsertApplicationUser(input: {
  huplaUserId: string | null;
  email: string;
  displayName?: string | null;
}) {
  if (!databaseConfiguration().configured) return null;
  const result = await getDatabase().query(
    `INSERT INTO archeology_users (hupla_user_id, email, display_name, last_seen_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (email) DO UPDATE SET
       hupla_user_id = COALESCE(EXCLUDED.hupla_user_id, archeology_users.hupla_user_id),
       display_name = COALESCE(EXCLUDED.display_name, archeology_users.display_name),
       last_seen_at = NOW(),
       updated_at = NOW()
     RETURNING id`,
    [input.huplaUserId, input.email, input.displayName || null]
  );
  return String(result.rows[0]?.id || "");
}
