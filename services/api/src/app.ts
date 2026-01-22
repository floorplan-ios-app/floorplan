import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { OpBatchUpload, Op } from "@floorplan/sync";
import {
  appendOps,
  createProject,
  createProjectShare,
  getOpsAfter,
  getProject,
  getProjectShareByToken,
  listProjects,
} from "./db/repos";

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

const UUID = z.string().uuid();
const ShareMode = z.enum(["view", "review"]);

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

app.post("/v1/projects/:id/shares", async (c) => {
  const id = c.req.param("id");
  const parsed = UUID.safeParse(id);
  if (!parsed.success) return c.json({ error: "invalid id" }, 400);

  const body = await c.req.json().catch(() => null);
  const mode = ShareMode.safeParse(body?.mode);
  if (!mode.success) return c.json({ error: "invalid share mode" }, 400);

  const project = await getProject(id);
  if (!project) return c.json({ error: "not found" }, 404);

  const userId = userFromHeaders(c.req.raw);
  const share = await createProjectShare({
    projectId: id,
    mode: mode.data,
    createdByUserId: userId,
  });
  return c.json({ share }, 201);
});

app.get("/v1/shares/:token", async (c) => {
  const token = c.req.param("token");
  const parsed = z.string().min(8).safeParse(token);
  if (!parsed.success) return c.json({ error: "invalid token" }, 400);

  const share = await getProjectShareByToken(parsed.data);
  if (!share) return c.json({ error: "not found" }, 404);

  return c.json({ share });
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

export { app };
