/**
 * WebSocket sync channel with topic subscriptions.
 */

type WS = {
  send(data: string | Uint8Array): void;
  data: {
    id: string;
    actorId?: string | null;
    topics?: Set<string>;
    userId?: string;
    projectId?: string;
    projectRole?: string;
    traceId?: string;
  };
};

type HubEvent = {
  topic: string;
  payload: unknown;
};

const DEFAULT_TOPICS = ["auth", "projects", "assets", "sync"] as const;

export function createWebsocketHub() {
  const clients = new Map<string, WS>();

  function publish(event: HubEvent) {
    for (const client of clients.values()) {
      const topics = client.data.topics ?? new Set();
      if (!topics.has(event.topic)) continue;
      client.send(JSON.stringify({ type: "event", topic: event.topic, payload: event.payload }));
    }
  }

  function subscribe(ws: WS, topics: string[]) {
    const allowed = new Set(DEFAULT_TOPICS);
    ws.data.topics = new Set(topics.filter((topic) => allowed.has(topic as any)));
    ws.send(
      JSON.stringify({
        type: "subscribed",
        wsId: ws.data.id,
        topics: Array.from(ws.data.topics),
      }),
    );
  }

  return {
    handlers: {
      open(ws: WS) {
        ws.data.id = crypto.randomUUID();
        ws.data.topics = new Set();
        clients.set(ws.data.id, ws);
        ws.send(JSON.stringify({ type: "hello", wsId: ws.data.id, availableTopics: DEFAULT_TOPICS }));
      },
      message(ws: WS, message: string | Uint8Array) {
        const text = typeof message === "string" ? message : new TextDecoder().decode(message);
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          ws.send(JSON.stringify({ type: "error", wsId: ws.data.id, error: "invalid json" }));
          return;
        }

        if (parsed?.type === "subscribe" && Array.isArray(parsed.topics)) {
          subscribe(ws, parsed.topics);
          return;
        }

        if (parsed?.type === "auth" && typeof parsed.actorId === "string") {
          ws.data.actorId = parsed.actorId;
          ws.send(JSON.stringify({ type: "auth.ack", wsId: ws.data.id, actorId: ws.data.actorId }));
          return;
        }

        ws.send(JSON.stringify({ type: "ack", wsId: ws.data.id, bytes: text.length }));
      },
      close(ws: WS) {
        clients.delete(ws.data.id);
      },
    },
    publish,
  };
}
