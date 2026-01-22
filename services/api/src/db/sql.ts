import postgres from "postgres";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const DATABASE_URL = mustEnv("DATABASE_URL");

/**
 * postgres.js client (Bun compatible).
 * Keep pool small in dev; scale in prod.
 */
export const sql = postgres(DATABASE_URL, {
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idle_timeout: 20,
});
