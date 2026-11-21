import { Pool } from "pg";
import { supabaseCa } from "./supabase-ca";

let pool: Pool | undefined;

export function roomDb(connectionString: string) {
  if (pool) return pool;
  const host = new URL(connectionString).hostname;
  pool = new Pool({
    connectionString,
    ssl: host.endsWith(".supabase.co") || host.endsWith(".supabase.com") ? { ca: supabaseCa } : undefined,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on("error", (error) => console.error("Morris idle database connection closed", "code" in error ? error.code : error.name));
  return pool;
}
