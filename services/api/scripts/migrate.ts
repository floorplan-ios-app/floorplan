#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const DATABASE_URL = mustEnv("DATABASE_URL");
const sql = postgres(DATABASE_URL, { max: 1 });

const migrationsDir = path.join(import.meta.dir, "..", "migrations");

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

async function appliedIds(): Promise<Set<string>> {
  const rows = await sql<{ id: string }[]>`SELECT id FROM schema_migrations ORDER BY id`;
  return new Set(rows.map((r) => r.id));
}

async function main() {
  await ensureTable();
  const applied = await appliedIds();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.match(/^\d+_.*\.sql$/))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const full = path.join(migrationsDir, file);
    const sqlText = fs.readFileSync(full, "utf-8");

    await sql.begin(async (tx) => {
      // Apply migration SQL
      await tx.unsafe(sqlText);
      // Record as applied
      await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
    });

    ran++;
    console.log(`Applied migration: ${file}`);
  }

  console.log(`Done. Applied ${ran} migration(s).`);
}

main()
  .then(() => sql.end({ timeout: 2 }))
  .catch(async (err) => {
    console.error(err);
    await sql.end({ timeout: 2 });
    process.exit(1);
  });
