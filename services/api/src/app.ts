import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { OpBatchUpload, Op } from "@floorplan/sync";
import { AssetJob, AssetJobRequest } from "@floorplan/shared";
import {
  createProject,
  getProject,
  listProjects,
  appendOps,
  getOpsAfter,
  enqueueAssetJob,
  listAssetVariants,
} from "./db/repos";

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

const UUID = z.string().uuid();

function actorFromHeaders(req: Request): string | null {
  // DEV stub: client provides actor id
  return req.headers.get("x-actor-id");
}

function userFromHeaders(req: Request): string | null {
  // DEV stub: client provides user id (uuid)
  return req.headers.get("x-user-id");
}

app.get("/v1/projects", async (c) => {
  const userId = userFromHeaders(c.req.raw);
  const rows = await listProjects(userId);
  return c.json({ projects: rows });
});

app.post("/v1/projects", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ name: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const userId = userFromHeaders(c.req.raw);
  const project = await createProject({ name: parsed.data.name, ownerUserId: userId });
  return c.json({ project }, 201);
});

app.get("/v1/projects/:id", async (c) => {
  const id = c.req.param("id");
  const parsed = UUID.safeParse(id);
  if (!parsed.success) return c.json({ error: "invalid id" }, 400);

  const project = await getProject(id);
  if (!project) return c.json({ error: "not found" }, 404);
  return c.json({ project });
});

// Upload ops
app.post("/v1/projects/:id/ops", async (c) => {
  const id = c.req.param("id");
  const parsed = UUID.safeParse(id);
  if (!parsed.success) return c.json({ error: "invalid id" }, 400);

  const actorId = actorFromHeaders(c.req.raw);
  if (!actorId) return c.json({ error: "missing x-actor-id" }, 401);

  const body = await c.req.json().catch(() => null);
  const batch = OpBatchUpload.safeParse(body);
  if (!batch.success) return c.json({ error: "invalid ops batch" }, 400);

  // Ensure ops actorId matches header (basic sanity).
  for (const op of batch.data.ops) {
    const opActor = (op as any).actorId;
    if (opActor !== actorId) {
      return c.json({ error: "actor mismatch" }, 400);
    }
  }

  const result = await appendOps(id, batch.data.ops);
  return c.json({ accepted: result.accepted, serverSeqMax: result.serverSeqMax });
});

// Download ops after cursor
app.get("/v1/projects/:id/ops", async (c) => {
  const id = c.req.param("id");
  const parsed = UUID.safeParse(id);
  if (!parsed.success) return c.json({ error: "invalid id" }, 400);

  const after = Number(c.req.query("afterServerSeq") ?? "0");
  const limit = Math.min(Number(c.req.query("limit") ?? "200"), 1000);

  const items = await getOpsAfter(id, after, limit);
  const ops = items.map((i) => i.op);
  const serverSeqMax = items.length ? items[items.length - 1]!.serverSeq : after;

  return c.json({ ops, serverSeqMax });
});

app.post("/v1/projects/:id/assets/:assetId/jobs", async (c) => {
  const projectId = c.req.param("id");
  const assetId = c.req.param("assetId");
  if (!UUID.safeParse(projectId).success) return c.json({ error: "invalid project id" }, 400);
  if (!UUID.safeParse(assetId).success) return c.json({ error: "invalid asset id" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = AssetJobRequest.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid job payload" }, 400);

  const job = AssetJob.parse({
    ...parsed.data,
    projectId,
    assetId,
  });
  const row = await enqueueAssetJob(job);
  return c.json({ job: row }, 201);
});

app.get("/v1/projects/:id/assets/:assetId/variants", async (c) => {
  const projectId = c.req.param("id");
  const assetId = c.req.param("assetId");
  if (!UUID.safeParse(projectId).success) return c.json({ error: "invalid project id" }, 400);
  if (!UUID.safeParse(assetId).success) return c.json({ error: "invalid asset id" }, 400);

  const variants = await listAssetVariants(projectId, assetId);
  return c.json({ variants });
});

export { app };
