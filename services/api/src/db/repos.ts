import { sql } from "./sql";
import { randomUUID } from "node:crypto";
import type { Op } from "@floorplan/sync";
import { synthesizeOpId } from "@floorplan/sync";

export type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  metadata: any;
};

export type ProjectShareRow = {
  id: string;
  project_id: string;
  token: string;
  mode: "view" | "review";
  created_at: string;
  created_by_user_id: string | null;
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

export async function createProjectShare(args: {
  projectId: string;
  mode: "view" | "review";
  createdByUserId?: string | null;
}) {
  const id = randomUUID();
  const token = randomUUID();
  const rows = await sql<ProjectShareRow[]>`
    INSERT INTO project_shares (id, project_id, token, mode, created_by_user_id)
    VALUES (
      ${id}::uuid,
      ${args.projectId}::uuid,
      ${token},
      ${args.mode},
      ${args.createdByUserId ?? null}::uuid
    )
    RETURNING id, project_id, token, mode, created_at, created_by_user_id
  `;
  return rows[0]!;
}

export async function getProjectShareByToken(token: string) {
  const rows = await sql<ProjectShareRow[]>`
    SELECT id, project_id, token, mode, created_at, created_by_user_id
    FROM project_shares
    WHERE token = ${token}
    LIMIT 1
  `;
  return rows[0] ?? null;
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
