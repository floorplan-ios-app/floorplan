import { createApp } from "./app";
import { createWebsocketHub } from "./ws";

const port = Number(process.env.PORT ?? 8787);
const hub = createWebsocketHub();
const app = createApp({ publishEvent: hub.publish });

export default {
  port,
  fetch(req: Request, server: any) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return;
      return new Response("Upgrade required", { status: 426 });
    }
    return app.fetch(req);
  },
  websocket: hub.handlers,
};
