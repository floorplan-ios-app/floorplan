import { sql } from "./sql";
import { randomUUID } from "node:crypto";
import type { Op } from "@floorplan/sync";
import { synthesizeOpId } from "@floorplan/sync";
import type { AssetJob, AssetJobStatus, AssetVariantType } from "@floorplan/shared";

export type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  metadata: any;
};

export type AssetJobRow = {
  id: string;
  project_id: string;
  asset_id: string;
  type: AssetJob["type"];
  status: AssetJobStatus;
  payload: AssetJob;
  attempts: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type AssetVariantRow = {
  id: string;
  project_id: string;
  asset_id: string;
  variant_type: AssetVariantType;
  object_key: string;
  mime: string | null;
  byte_size: number | null;
  sha256: string | null;
  pipeline_version: string;
  metadata: any;
  created_at: string;
};

export async function createProject(args: { name: string; ownerUserId?: string | null }) {
  const id = randomUUID();
  const rows = await sql<ProjectRow[]>`
    INSERT INTO projects (id, owner_user_id, name)
    VALUES (${id}::uuid, ${args.ownerUserId ?? null}::uuid, ${args.name})
    RETURNING id, name, created_at, updated_at, metadata
  `;
  return rows[0]!;
}

export async function getProject(id: string) {
  const rows = await sql<ProjectRow[]>`
    SELECT id, name, created_at, updated_at, metadata
    FROM projects
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listProjects(ownerUserId?: string | null) {
  if (!ownerUserId) {
    const rows = await sql<ProjectRow[]>`
      SELECT id, name, created_at, updated_at, metadata
      FROM projects
      ORDER BY updated_at DESC
      LIMIT 50
    `;
    return rows;
  }
  const rows = await sql<ProjectRow[]>`
    SELECT id, name, created_at, updated_at, metadata
    FROM projects
    WHERE owner_user_id = ${ownerUserId}::uuid
    ORDER BY updated_at DESC
    LIMIT 50
  `;
  return rows;
}

export async function appendOps(projectId: string, ops: Op[]) {
  // Insert ops idempotently.
  // NOTE: For performance, batch insert with VALUES + UNNEST later.
  let accepted = 0;

  for (const op of ops) {
    const opId = synthesizeOpId(op);
    const res = await sql`
      INSERT INTO project_ops (project_id, op_id, actor_id, client_seq, lamport, ts_client, type, payload)
      VALUES (
        ${projectId}::uuid,
        ${opId},
        ${op.actorId},
        ${op.clientSeq},
        ${op.lamport},
        ${op.ts}::timestamptz,
        ${op.type},
        ${sql.json(op)}
      )
      ON CONFLICT DO NOTHING
    `;
    // postgres.js returns a Result; count isn't reliable across versions,
    // so we just increment accepted if no conflict checking. Keep skeleton simple.
    accepted++;
  }

  const rows = await sql<{ server_seq_max: number }[]>`
    SELECT COALESCE(MAX(server_seq), 0)::bigint AS server_seq_max
    FROM project_ops
    WHERE project_id = ${projectId}::uuid
  `;
  return { accepted, serverSeqMax: Number(rows[0]?.server_seq_max ?? 0) };
}

export async function getOpsAfter(projectId: string, afterServerSeq: number, limit: number) {
  const rows = await sql<{ server_seq: number; payload: any }[]>`
    SELECT server_seq, payload
    FROM project_ops
    WHERE project_id = ${projectId}::uuid
      AND server_seq > ${afterServerSeq}
    ORDER BY server_seq ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ serverSeq: Number(r.server_seq), op: r.payload }));
}

export async function enqueueAssetJob(job: AssetJob) {
  const id = randomUUID();
  const rows = await sql<AssetJobRow[]>`
    INSERT INTO asset_jobs (id, project_id, asset_id, type, status, payload)
    VALUES (
      ${id}::uuid,
      ${job.projectId}::uuid,
      ${job.assetId}::uuid,
      ${job.type},
      'pending',
      ${sql.json(job)}
    )
    RETURNING id, project_id, asset_id, type, status, payload, attempts, created_at, updated_at, started_at, finished_at
  `;
  return rows[0]!;
}

export async function listAssetVariants(projectId: string, assetId: string) {
  const rows = await sql<AssetVariantRow[]>`
    SELECT id, project_id, asset_id, variant_type, object_key, mime, byte_size, sha256, pipeline_version, metadata, created_at
    FROM asset_variants
    WHERE project_id = ${projectId}::uuid
      AND asset_id = ${assetId}::uuid
    ORDER BY created_at DESC
  `;
  return rows;
}
