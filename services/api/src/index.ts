import { allowedProjectRoles, createApp } from "./app";
import { createLogger } from "./observability";
import { createWebsocketHub } from "./ws";

const port = Number(process.env.PORT ?? 8787);
const logger = createLogger("api");
const hub = createWebsocketHub();
const allowedProjectRolesSet = new Set(allowedProjectRoles);
const app = createApp({ publishEvent: hub.publish });

export default {
  port,
  fetch(req: Request, server: any) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const userId = req.headers.get("x-user-id");
      const projectRole = req.headers.get("x-project-role");
      const projectId = url.searchParams.get("projectId");
      const traceId = req.headers.get("x-request-id") ?? crypto.randomUUID();

      if (!userId) {
        return new Response("missing x-user-id", { status: 401 });
      }
      if (!projectId) {
        return new Response("missing projectId", { status: 400 });
      }
      if (!projectRole || !allowedProjectRolesSet.has(projectRole)) {
        return new Response("insufficient role", { status: 403 });
      }

      logger.info("ws.upgrade", { traceId, userId, projectId, projectRole });
      if (server.upgrade(req, { data: { userId, projectId, projectRole, traceId } })) return;
      return new Response("Upgrade required", { status: 426 });
    }
    return app.fetch(req);
  },
  websocket: hub.handlers,
};
