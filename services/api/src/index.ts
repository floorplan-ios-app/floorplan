import { app } from "./app";
import { websocketHandlers } from "./ws";

const port = Number(process.env.PORT ?? 8787);
const ws = websocketHandlers();

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
  websocket: ws,
};
