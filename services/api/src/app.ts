import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { OpBatchUpload } from "@floorplan/sync";
import { createProject, getProject, listProjects, appendOps, getOpsAfter } from "./db/repos";
import { createLogger, requestTracing } from "./observability";

const app = new Hono();
const logger = createLogger("api");
app.use("*", cors());
app.use("*", requestTracing(logger));

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

const ProjectRole = z.enum(["owner", "editor", "viewer"]);
type ProjectRole = z.infer<typeof ProjectRole>;

function requireUser(c: any): string | null {
  const userId = userFromHeaders(c.req.raw);
  if (!userId) {
    return null;
  }
  return userId;
}

function requireProjectRole(c: any, allowed: ProjectRole[]): ProjectRole | null {
  const role = c.req.header("x-project-role");
  const parsed = ProjectRole.safeParse(role);
  if (!parsed.success || !allowed.includes(parsed.data)) {
    return null;
  }
  return parsed.data;
}

app.get("/v1/projects", async (c) => {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "missing x-user-id" }, 401);
  const rows = await listProjects(userId);
  return c.json({ projects: rows });
});

app.post("/v1/projects", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ name: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "missing x-user-id" }, 401);
  const project = await createProject({ name: parsed.data.name, ownerUserId: userId });
  return c.json({ project }, 201);
});

app.get("/v1/projects/:id", async (c) => {
  const id = c.req.param("id");
  const parsed = UUID.safeParse(id);
  if (!parsed.success) return c.json({ error: "invalid id" }, 400);
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "missing x-user-id" }, 401);
  if (!requireProjectRole(c, ["owner", "editor", "viewer"])) {
    return c.json({ error: "insufficient role" }, 403);
  }

  const project = await getProject(id);
  if (!project) return c.json({ error: "not found" }, 404);
  return c.json({ project });
});

// Upload ops
app.post("/v1/projects/:id/ops", async (c) => {
  const id = c.req.param("id");
  const parsed = UUID.safeParse(id);
  if (!parsed.success) return c.json({ error: "invalid id" }, 400);

  const userId = requireUser(c);
  if (!userId) return c.json({ error: "missing x-user-id" }, 401);
  if (!requireProjectRole(c, ["owner", "editor"])) {
    return c.json({ error: "insufficient role" }, 403);
  }

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
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "missing x-user-id" }, 401);
  if (!requireProjectRole(c, ["owner", "editor", "viewer"])) {
    return c.json({ error: "insufficient role" }, 403);
  }

  const after = Number(c.req.query("afterServerSeq") ?? "0");
  const limit = Math.min(Number(c.req.query("limit") ?? "200"), 1000);

  const items = await getOpsAfter(id, after, limit);
  const ops = items.map((i) => i.op);
  const serverSeqMax = items.length ? items[items.length - 1]!.serverSeq : after;

  return c.json({ ops, serverSeqMax });
});

export { app };
