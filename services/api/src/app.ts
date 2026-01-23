import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { OpBatchUpload } from "@floorplan/sync";
import { createDbStorage, createLocalObjectStore } from "./storage";

const UUID = z.string().uuid();
const RefreshTokenSchema = z.string().min(1);
const ShareMode = z.enum(["view", "review"]);

export type AppDeps = {
  publishEvent?: (event: { topic: string; payload: unknown }) => void;
};

function actorFromHeaders(req: Request): string | null {
  return req.headers.get("x-actor-id");
}

function userFromHeaders(req: Request): string | null {
  return req.headers.get("x-user-id");
}

function ipFromRequest(req: Request): string | null {
  return req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
}

function userAgentFromRequest(req: Request): string | null {
  return req.headers.get("user-agent");
}

function tokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function ttlMinutes(value: string | undefined, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono();
  const db = createDbStorage();
  const objectStore = createLocalObjectStore();
  const publishEvent = deps.publishEvent ?? (() => undefined);

  app.use("*", cors());

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/v1/auth/session", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({
        userId: UUID.optional(),
        deviceId: UUID.optional(),
      })
      .safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const userId = parsed.data.userId ?? userFromHeaders(c.req.raw);
    const deviceId = parsed.data.deviceId ?? null;

    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    const accessMinutes = ttlMinutes(process.env.ACCESS_TOKEN_TTL_MINUTES, 15);
    const refreshDays = ttlMinutes(process.env.REFRESH_TOKEN_TTL_DAYS, 30);

    const accessExpiresAt = new Date(Date.now() + accessMinutes * 60 * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000).toISOString();

    await db.auth.createSession({
      userId,
      deviceId,
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
    });

    await db.audit.log({
      userId,
      deviceId,
      actorId: actorFromHeaders(c.req.raw),
      action: "auth.session.create",
      resourceType: "auth_session",
      resourceId: null,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
    });

    publishEvent({
      topic: "auth",
      payload: { type: "auth.session.created", userId, deviceId, accessExpiresAt },
    });

    return c.json({ accessToken, refreshToken, accessExpiresAt, refreshExpiresAt });
  });

  app.post("/v1/auth/refresh", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ refreshToken: RefreshTokenSchema }).safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    const accessMinutes = ttlMinutes(process.env.ACCESS_TOKEN_TTL_MINUTES, 15);
    const refreshDays = ttlMinutes(process.env.REFRESH_TOKEN_TTL_DAYS, 30);
    const accessExpiresAt = new Date(Date.now() + accessMinutes * 60 * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000).toISOString();

    const session = await db.auth.rotateSessionByRefresh({
      refreshToken: parsed.data.refreshToken,
      nextAccessToken: accessToken,
      nextRefreshToken: refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
    });

    if (!session) return c.json({ error: "invalid refresh token" }, 401);

    await db.audit.log({
      userId: session.user_id ?? null,
      deviceId: session.device_id ?? null,
      actorId: actorFromHeaders(c.req.raw),
      action: "auth.session.refresh",
      resourceType: "auth_session",
      resourceId: session.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
    });

    publishEvent({
      topic: "auth",
      payload: { type: "auth.session.refreshed", userId: session.user_id, accessExpiresAt },
    });

    return c.json({ accessToken, refreshToken, accessExpiresAt, refreshExpiresAt });
  });

  app.delete("/v1/auth/session", async (c) => {
    const token = tokenFromRequest(c.req.raw);
    if (!token) return c.json({ error: "missing bearer token" }, 401);

    const session = await db.auth.revokeSession(token);
    if (!session) return c.json({ error: "invalid session" }, 404);

    await db.audit.log({
      userId: session.user_id ?? null,
      deviceId: session.device_id ?? null,
      actorId: actorFromHeaders(c.req.raw),
      action: "auth.session.revoke",
      resourceType: "auth_session",
      resourceId: session.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
    });

    publishEvent({
      topic: "auth",
      payload: { type: "auth.session.revoked", userId: session.user_id },
    });

    return c.json({ revoked: true });
  });

  app.get("/v1/auth/me", async (c) => {
    const token = tokenFromRequest(c.req.raw);
    if (!token) return c.json({ error: "missing bearer token" }, 401);
    const session = await db.auth.getSessionByAccessToken(token);
    if (!session) return c.json({ error: "invalid session" }, 401);
    return c.json({ userId: session.user_id, deviceId: session.device_id, accessExpiresAt: session.access_expires_at });
  });

  app.get("/v1/projects", async (c) => {
    const token = tokenFromRequest(c.req.raw);
    const session = token ? await db.auth.getSessionByAccessToken(token) : null;
    const userId = session?.user_id ?? userFromHeaders(c.req.raw);
    const rows = await db.projects.list(userId);
    return c.json({ projects: rows });
  });

  app.post("/v1/projects", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ name: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);
    const token = tokenFromRequest(c.req.raw);
    const session = token ? await db.auth.getSessionByAccessToken(token) : null;
    const userId = session?.user_id ?? userFromHeaders(c.req.raw);
    const project = await db.projects.create({ name: parsed.data.name, ownerUserId: userId });

    await db.audit.log({
      userId,
      actorId: actorFromHeaders(c.req.raw),
      action: "project.create",
      resourceType: "project",
      resourceId: project.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
    });

    publishEvent({ topic: "projects", payload: { type: "project.created", project } });

    return c.json({ project }, 201);
  });

  app.get("/v1/projects/:id", async (c) => {
    const id = c.req.param("id");
    const parsed = UUID.safeParse(id);
    if (!parsed.success) return c.json({ error: "invalid id" }, 400);

    const project = await db.projects.get(id);
    if (!project) return c.json({ error: "not found" }, 404);
    return c.json({ project });
  });

  app.post("/v1/projects/:id/shares", async (c) => {
    const id = c.req.param("id");
    const parsed = UUID.safeParse(id);
    if (!parsed.success) return c.json({ error: "invalid id" }, 400);

    const body = await c.req.json().catch(() => null);
    const mode = ShareMode.safeParse(body?.mode);
    if (!mode.success) return c.json({ error: "invalid share mode" }, 400);

    const project = await db.projects.get(id);
    if (!project) return c.json({ error: "not found" }, 404);

    const share = await db.shares.create({
      projectId: id,
      mode: mode.data,
      createdByUserId: userFromHeaders(c.req.raw),
    });
    return c.json({ share }, 201);
  });

  app.get("/v1/shares/:token", async (c) => {
    const token = c.req.param("token");
    const parsed = z.string().min(8).safeParse(token);
    if (!parsed.success) return c.json({ error: "invalid token" }, 400);

    const share = await db.shares.getByToken(parsed.data);
    if (!share) return c.json({ error: "not found" }, 404);

    return c.json({ share });
  });

  app.patch("/v1/projects/:id", async (c) => {
    const id = c.req.param("id");
    const parsedId = UUID.safeParse(id);
    if (!parsedId.success) return c.json({ error: "invalid id" }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({ name: z.string().min(1).optional(), metadata: z.record(z.any()).optional() })
      .safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const updated = await db.projects.update({ id, name: parsed.data.name, metadata: parsed.data.metadata });
    if (!updated) return c.json({ error: "not found" }, 404);

    await db.audit.log({
      userId: userFromHeaders(c.req.raw),
      actorId: actorFromHeaders(c.req.raw),
      action: "project.update",
      resourceType: "project",
      resourceId: updated.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
    });

    publishEvent({ topic: "projects", payload: { type: "project.updated", project: updated } });

    return c.json({ project: updated });
  });

  app.delete("/v1/projects/:id", async (c) => {
    const id = c.req.param("id");
    const parsedId = UUID.safeParse(id);
    if (!parsedId.success) return c.json({ error: "invalid id" }, 400);
    const deleted = await db.projects.delete(id);
    if (!deleted) return c.json({ error: "not found" }, 404);

    await db.audit.log({
      userId: userFromHeaders(c.req.raw),
      actorId: actorFromHeaders(c.req.raw),
      action: "project.delete",
      resourceType: "project",
      resourceId: deleted.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
    });

    publishEvent({ topic: "projects", payload: { type: "project.deleted", projectId: deleted.id } });

    return c.json({ deleted: true });
  });

  app.post("/v1/projects/:id/ops", async (c) => {
    const id = c.req.param("id");
    const parsed = UUID.safeParse(id);
    if (!parsed.success) return c.json({ error: "invalid id" }, 400);

    const actorId = actorFromHeaders(c.req.raw);
    if (!actorId) return c.json({ error: "missing x-actor-id" }, 401);

    const body = await c.req.json().catch(() => null);
    const batch = OpBatchUpload.safeParse(body);
    if (!batch.success) return c.json({ error: "invalid ops batch" }, 400);

    for (const op of batch.data.ops) {
      const opActor = (op as any).actorId;
      if (opActor !== actorId) {
        return c.json({ error: "actor mismatch" }, 400);
      }
    }

    const response = await db.projects.appendOps(id, batch.data.ops);

    await db.audit.log({
      userId: userFromHeaders(c.req.raw),
      actorId,
      action: "sync.ops.append",
      resourceType: "project",
      resourceId: id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
      metadata: { count: batch.data.ops.length },
    });

    publishEvent({
      topic: "sync",
      payload: { type: "sync.ops.appended", projectId: id, count: batch.data.ops.length, serverSeqMax: response.serverSeqMax },
    });

    return c.json({ accepted: response.accepted, serverSeqMax: response.serverSeqMax });
  });

  app.get("/v1/projects/:id/ops", async (c) => {
    const id = c.req.param("id");
    const parsed = UUID.safeParse(id);
    if (!parsed.success) return c.json({ error: "invalid id" }, 400);

    const after = Number(c.req.query("afterServerSeq") ?? "0");
    const limit = Math.min(Number(c.req.query("limit") ?? "200"), 1000);

    const items = await db.projects.getOpsAfter(id, after, limit);
    const ops = items.map((i) => i.op);
    const serverSeqMax = items.length ? items[items.length - 1]!.serverSeq : after;

    return c.json({ ops, serverSeqMax });
  });

  app.get("/v1/assets", async (c) => {
    const projectId = c.req.query("projectId") ?? null;
    const ownerUserId = c.req.query("ownerUserId") ?? userFromHeaders(c.req.raw);
    if (projectId && !UUID.safeParse(projectId).success) return c.json({ error: "invalid project id" }, 400);
    const assets = await db.assets.list({ ownerUserId, projectId });
    return c.json({ assets });
  });

  app.post("/v1/assets/uploads", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({
        projectId: UUID.optional(),
        kind: z.string().min(1),
        mime: z.string().optional(),
        byteSize: z.number().int().positive().optional(),
        filename: z.string().optional(),
      })
      .safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const objectKey = objectStore.buildObjectKey({
      prefix: `assets/uploads/${parsed.data.projectId ?? "global"}`,
      filename: parsed.data.filename ?? null,
      contentType: parsed.data.mime ?? null,
    });

    const asset = await db.assets.create({
      ownerUserId: userFromHeaders(c.req.raw),
      projectId: parsed.data.projectId ?? null,
      kind: parsed.data.kind,
      mime: parsed.data.mime ?? null,
      byteSize: parsed.data.byteSize ?? null,
      objectKey,
      status: "uploaded",
      metadata: { filename: parsed.data.filename ?? null },
    });

    const upload = objectStore.createPresignedUpload({ objectKey, contentType: parsed.data.mime ?? null });

    const ingestJob = await db.jobs.enqueue({
      type: "asset.ingest",
      assetId: asset.id,
      projectId: parsed.data.projectId ?? null,
      payload: { objectKey, mime: parsed.data.mime ?? null },
    });

    await db.audit.log({
      userId: asset.owner_user_id ?? null,
      actorId: actorFromHeaders(c.req.raw),
      action: "asset.upload.request",
      resourceType: "asset",
      resourceId: asset.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
      metadata: { objectKey },
    });

    publishEvent({
      topic: "assets",
      payload: { type: "asset.upload.requested", asset, upload, jobId: ingestJob.id },
    });

    return c.json({ asset, upload, job: ingestJob }, 201);
  });

  app.get("/v1/assets/:id", async (c) => {
    const id = c.req.param("id");
    const parsedId = UUID.safeParse(id);
    if (!parsedId.success) return c.json({ error: "invalid id" }, 400);

    const asset = await db.assets.get(id);
    if (!asset) return c.json({ error: "not found" }, 404);

    const variants = await db.assets.listVariants(asset.id);
    const download = objectStore.createPresignedDownload({ objectKey: asset.object_key });

    return c.json({ asset, variants, download });
  });

  app.patch("/v1/assets/:id/metadata", async (c) => {
    const id = c.req.param("id");
    const parsedId = UUID.safeParse(id);
    if (!parsedId.success) return c.json({ error: "invalid id" }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({
        metadata: z.record(z.any()).optional(),
        status: z.string().optional(),
        sha256: z.string().optional(),
        byteSize: z.number().int().positive().optional(),
      })
      .safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const asset = await db.assets.updateMetadata({
      id,
      metadata: parsed.data.metadata,
      status: parsed.data.status,
      sha256: parsed.data.sha256,
      byteSize: parsed.data.byteSize,
    });
    if (!asset) return c.json({ error: "not found" }, 404);

    await db.audit.log({
      userId: asset.owner_user_id ?? null,
      actorId: actorFromHeaders(c.req.raw),
      action: "asset.metadata.update",
      resourceType: "asset",
      resourceId: asset.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
    });

    publishEvent({ topic: "assets", payload: { type: "asset.updated", asset } });

    return c.json({ asset });
  });

  app.post("/v1/assets/:id/variants", async (c) => {
    const id = c.req.param("id");
    const parsedId = UUID.safeParse(id);
    if (!parsedId.success) return c.json({ error: "invalid id" }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({
        variantKey: z.string().min(1),
        mime: z.string().optional(),
        byteSize: z.number().int().positive().optional(),
        objectKey: z.string().min(1),
        metadata: z.record(z.any()).optional(),
      })
      .safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const variant = await db.assets.addVariant({
      assetId: id,
      variantKey: parsed.data.variantKey,
      mime: parsed.data.mime ?? null,
      byteSize: parsed.data.byteSize ?? null,
      objectKey: parsed.data.objectKey,
      metadata: parsed.data.metadata ?? {},
    });

    await db.audit.log({
      userId: userFromHeaders(c.req.raw),
      actorId: actorFromHeaders(c.req.raw),
      action: "asset.variant.upsert",
      resourceType: "asset_variant",
      resourceId: variant.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
      metadata: { assetId: id, variantKey: parsed.data.variantKey },
    });

    publishEvent({ topic: "assets", payload: { type: "asset.variant.upserted", assetId: id, variant } });

    return c.json({ variant }, 201);
  });

  app.post("/v1/jobs", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({
        type: z.enum([
          "asset.ingest",
          "asset.normalize",
          "asset.optimize",
          "asset.convert.ios",
          "asset.thumbnail",
          "asset.publish",
        ]),
        assetId: UUID.optional(),
        projectId: UUID.optional(),
        payload: z.record(z.any()).optional(),
      })
      .safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const job = await db.jobs.enqueue({
      type: parsed.data.type,
      assetId: parsed.data.assetId ?? null,
      projectId: parsed.data.projectId ?? null,
      payload: parsed.data.payload ?? {},
    });

    await db.audit.log({
      userId: userFromHeaders(c.req.raw),
      actorId: actorFromHeaders(c.req.raw),
      action: "job.enqueue",
      resourceType: "job",
      resourceId: job.id,
      ip: ipFromRequest(c.req.raw),
      userAgent: userAgentFromRequest(c.req.raw),
      metadata: { type: job.type },
    });

    publishEvent({ topic: "assets", payload: { type: "job.enqueued", job } });

    return c.json({ job }, 201);
  });

  app.get("/v1/jobs", async (c) => {
    const assetId = c.req.query("assetId") ?? null;
    const projectId = c.req.query("projectId") ?? null;
    const status = c.req.query("status") ?? null;
    if (assetId && !UUID.safeParse(assetId).success) return c.json({ error: "invalid asset id" }, 400);
    if (projectId && !UUID.safeParse(projectId).success) return c.json({ error: "invalid project id" }, 400);

    const jobs = await db.jobs.list({ assetId, projectId, status });
    return c.json({ jobs });
  });

  return app;
}

export const app = createApp();
