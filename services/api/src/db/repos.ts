import { sql } from "./sql";
import { randomUUID, createHash } from "node:crypto";
import type { Op } from "@floorplan/sync";
import { synthesizeOpId } from "@floorplan/sync";

export type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  metadata: any;
};

export type AssetRow = {
  id: string;
  owner_user_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  kind: string;
  mime: string | null;
  byte_size: number | null;
  sha256: string | null;
  object_key: string;
  status: string;
  metadata: any;
};

export type AssetVariantRow = {
  id: string;
  asset_id: string;
  variant_key: string;
  mime: string | null;
  byte_size: number | null;
  object_key: string;
  metadata: any;
  created_at: string;
};

export type JobRow = {
  id: string;
  type: string;
  status: string;
  asset_id: string | null;
  project_id: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type AuthSessionRow = {
  id: string;
  user_id: string | null;
  device_id: string | null;
  access_token_hash: string;
  refresh_token_hash: string;
  access_expires_at: string;
  refresh_expires_at: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type AuditLogRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  device_id: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: any;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createProject(args: { name: string; ownerUserId?: string | null }) {
  const id = randomUUID();
  const rows = await sql<ProjectRow[]>`
    INSERT INTO projects (id, owner_user_id, name)
    VALUES (${id}::uuid, ${args.ownerUserId ?? null}::uuid, ${args.name})
    RETURNING id, name, created_at, updated_at, metadata
  `;
  return rows[0]!;
}

export async function updateProject(args: { id: string; name?: string | null; metadata?: any }) {
  const rows = await sql<ProjectRow[]>`
    UPDATE projects
    SET
      name = COALESCE(${args.name ?? null}, name),
      metadata = COALESCE(${args.metadata ? sql.json(args.metadata) : null}, metadata),
      updated_at = now()
    WHERE id = ${args.id}::uuid
    RETURNING id, name, created_at, updated_at, metadata
  `;
  return rows[0] ?? null;
}

export async function deleteProject(id: string) {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM projects
    WHERE id = ${id}::uuid
    RETURNING id
  `;
  return rows[0] ?? null;
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

export async function createAsset(args: {
  ownerUserId?: string | null;
  projectId?: string | null;
  kind: string;
  mime?: string | null;
  byteSize?: number | null;
  sha256?: string | null;
  objectKey: string;
  status?: string;
  metadata?: any;
}) {
  const id = randomUUID();
  const rows = await sql<AssetRow[]>`
    INSERT INTO assets (id, owner_user_id, project_id, kind, mime, byte_size, sha256, object_key, status, metadata)
    VALUES (
      ${id}::uuid,
      ${args.ownerUserId ?? null}::uuid,
      ${args.projectId ?? null}::uuid,
      ${args.kind},
      ${args.mime ?? null},
      ${args.byteSize ?? null},
      ${args.sha256 ?? null},
      ${args.objectKey},
      ${args.status ?? "pending"},
      ${sql.json(args.metadata ?? {})}
    )
    RETURNING id, owner_user_id, project_id, created_at, updated_at, kind, mime, byte_size, sha256, object_key, status, metadata
  `;
  return rows[0]!;
}

export async function getAsset(id: string) {
  const rows = await sql<AssetRow[]>`
    SELECT id, owner_user_id, project_id, created_at, updated_at, kind, mime, byte_size, sha256, object_key, status, metadata
    FROM assets
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listAssets(args: { ownerUserId?: string | null; projectId?: string | null }) {
  if (args.projectId) {
    const rows = await sql<AssetRow[]>`
      SELECT id, owner_user_id, project_id, created_at, updated_at, kind, mime, byte_size, sha256, object_key, status, metadata
      FROM assets
      WHERE project_id = ${args.projectId}::uuid
      ORDER BY updated_at DESC
      LIMIT 50
    `;
    return rows;
  }
  if (args.ownerUserId) {
    const rows = await sql<AssetRow[]>`
      SELECT id, owner_user_id, project_id, created_at, updated_at, kind, mime, byte_size, sha256, object_key, status, metadata
      FROM assets
      WHERE owner_user_id = ${args.ownerUserId}::uuid
      ORDER BY updated_at DESC
      LIMIT 50
    `;
    return rows;
  }
  const rows = await sql<AssetRow[]>`
    SELECT id, owner_user_id, project_id, created_at, updated_at, kind, mime, byte_size, sha256, object_key, status, metadata
    FROM assets
    ORDER BY updated_at DESC
    LIMIT 50
  `;
  return rows;
}

export async function updateAssetMetadata(args: {
  id: string;
  metadata?: any;
  status?: string | null;
  sha256?: string | null;
  byteSize?: number | null;
}) {
  const rows = await sql<AssetRow[]>`
    UPDATE assets
    SET
      metadata = COALESCE(${args.metadata ? sql.json(args.metadata) : null}, metadata),
      status = COALESCE(${args.status ?? null}, status),
      sha256 = COALESCE(${args.sha256 ?? null}, sha256),
      byte_size = COALESCE(${args.byteSize ?? null}, byte_size),
      updated_at = now()
    WHERE id = ${args.id}::uuid
    RETURNING id, owner_user_id, project_id, created_at, updated_at, kind, mime, byte_size, sha256, object_key, status, metadata
  `;
  return rows[0] ?? null;
}

export async function addAssetVariant(args: {
  assetId: string;
  variantKey: string;
  mime?: string | null;
  byteSize?: number | null;
  objectKey: string;
  metadata?: any;
}) {
  const id = randomUUID();
  const rows = await sql<AssetVariantRow[]>`
    INSERT INTO asset_variants (id, asset_id, variant_key, mime, byte_size, object_key, metadata)
    VALUES (
      ${id}::uuid,
      ${args.assetId}::uuid,
      ${args.variantKey},
      ${args.mime ?? null},
      ${args.byteSize ?? null},
      ${args.objectKey},
      ${sql.json(args.metadata ?? {})}
    )
    ON CONFLICT (asset_id, variant_key)
    DO UPDATE SET
      mime = EXCLUDED.mime,
      byte_size = EXCLUDED.byte_size,
      object_key = EXCLUDED.object_key,
      metadata = EXCLUDED.metadata
    RETURNING id, asset_id, variant_key, mime, byte_size, object_key, metadata, created_at
  `;
  return rows[0]!;
}

export async function listAssetVariants(assetId: string) {
  const rows = await sql<AssetVariantRow[]>`
    SELECT id, asset_id, variant_key, mime, byte_size, object_key, metadata, created_at
    FROM asset_variants
    WHERE asset_id = ${assetId}::uuid
    ORDER BY created_at ASC
  `;
  return rows;
}

export async function enqueueJob(args: {
  type: string;
  assetId?: string | null;
  projectId?: string | null;
  payload?: any;
}) {
  const id = randomUUID();
  const rows = await sql<JobRow[]>`
    INSERT INTO jobs (id, type, status, asset_id, project_id, payload)
    VALUES (
      ${id}::uuid,
      ${args.type},
      'queued',
      ${args.assetId ?? null}::uuid,
      ${args.projectId ?? null}::uuid,
      ${sql.json(args.payload ?? {})}
    )
    RETURNING id, type, status, asset_id, project_id, payload, created_at, updated_at, started_at, completed_at
  `;
  return rows[0]!;
}

export async function listJobs(args: { assetId?: string | null; projectId?: string | null; status?: string | null }) {
  if (args.assetId) {
    const rows = await sql<JobRow[]>`
      SELECT id, type, status, asset_id, project_id, payload, created_at, updated_at, started_at, completed_at
      FROM jobs
      WHERE asset_id = ${args.assetId}::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return rows;
  }
  if (args.projectId) {
    const rows = await sql<JobRow[]>`
      SELECT id, type, status, asset_id, project_id, payload, created_at, updated_at, started_at, completed_at
      FROM jobs
      WHERE project_id = ${args.projectId}::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return rows;
  }
  if (args.status) {
    const rows = await sql<JobRow[]>`
      SELECT id, type, status, asset_id, project_id, payload, created_at, updated_at, started_at, completed_at
      FROM jobs
      WHERE status = ${args.status}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return rows;
  }
  const rows = await sql<JobRow[]>`
    SELECT id, type, status, asset_id, project_id, payload, created_at, updated_at, started_at, completed_at
    FROM jobs
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows;
}

export async function createAuthSession(args: {
  userId?: string | null;
  deviceId?: string | null;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}) {
  const id = randomUUID();
  const rows = await sql<AuthSessionRow[]>`
    INSERT INTO auth_sessions (
      id, user_id, device_id, access_token_hash, refresh_token_hash,
      access_expires_at, refresh_expires_at
    )
    VALUES (
      ${id}::uuid,
      ${args.userId ?? null}::uuid,
      ${args.deviceId ?? null}::uuid,
      ${hashToken(args.accessToken)},
      ${hashToken(args.refreshToken)},
      ${args.accessExpiresAt}::timestamptz,
      ${args.refreshExpiresAt}::timestamptz
    )
    RETURNING id, user_id, device_id, access_token_hash, refresh_token_hash,
      access_expires_at, refresh_expires_at, created_at, updated_at, revoked_at
  `;
  return rows[0]!;
}

export async function getSessionByAccessToken(accessToken: string) {
  const rows = await sql<AuthSessionRow[]>`
    SELECT id, user_id, device_id, access_token_hash, refresh_token_hash,
      access_expires_at, refresh_expires_at, created_at, updated_at, revoked_at
    FROM auth_sessions
    WHERE access_token_hash = ${hashToken(accessToken)}
      AND revoked_at IS NULL
      AND access_expires_at > now()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function rotateSessionByRefresh(args: {
  refreshToken: string;
  nextAccessToken: string;
  nextRefreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}) {
  const rows = await sql<AuthSessionRow[]>`
    UPDATE auth_sessions
    SET
      access_token_hash = ${hashToken(args.nextAccessToken)},
      refresh_token_hash = ${hashToken(args.nextRefreshToken)},
      access_expires_at = ${args.accessExpiresAt}::timestamptz,
      refresh_expires_at = ${args.refreshExpiresAt}::timestamptz,
      updated_at = now()
    WHERE refresh_token_hash = ${hashToken(args.refreshToken)}
      AND revoked_at IS NULL
      AND refresh_expires_at > now()
    RETURNING id, user_id, device_id, access_token_hash, refresh_token_hash,
      access_expires_at, refresh_expires_at, created_at, updated_at, revoked_at
  `;
  return rows[0] ?? null;
}

export async function revokeSession(accessToken: string) {
  const rows = await sql<AuthSessionRow[]>`
    UPDATE auth_sessions
    SET revoked_at = now(), updated_at = now()
    WHERE access_token_hash = ${hashToken(accessToken)}
      AND revoked_at IS NULL
    RETURNING id, user_id, device_id, access_token_hash, refresh_token_hash,
      access_expires_at, refresh_expires_at, created_at, updated_at, revoked_at
  `;
  return rows[0] ?? null;
}

export async function createAuditLog(args: {
  userId?: string | null;
  deviceId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: any;
}) {
  const id = randomUUID();
  const rows = await sql<AuditLogRow[]>`
    INSERT INTO audit_logs (
      id, user_id, device_id, actor_id, action, resource_type, resource_id, ip, user_agent, metadata
    )
    VALUES (
      ${id}::uuid,
      ${args.userId ?? null}::uuid,
      ${args.deviceId ?? null}::uuid,
      ${args.actorId ?? null},
      ${args.action},
      ${args.resourceType},
      ${args.resourceId ?? null},
      ${args.ip ?? null},
      ${args.userAgent ?? null},
      ${sql.json(args.metadata ?? {})}
    )
    RETURNING id, created_at, user_id, device_id, actor_id, action, resource_type, resource_id, ip, user_agent, metadata
  `;
  return rows[0]!;
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
