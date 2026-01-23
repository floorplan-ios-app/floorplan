import { ApiAppendOpsResponse } from "@floorplan/shared";
import { OpBatchDownload } from "@floorplan/sync";

export type RealtimeEvent =
  | { type: "ops"; projectId: string; payload: OpBatchDownload }
  | { type: "ack"; projectId: string; payload: ApiAppendOpsResponse }
  | { type: "status"; status: "connected" | "disconnected" | "polling"; detail?: string };

export type RealtimeClient = {
  close: () => void;
};

export function createRealtimeClient(args: {
  apiBase: string;
  projectId: string;
  onEvent: (event: RealtimeEvent) => void;
  pollIntervalMs?: number;
}): RealtimeClient {
  const { apiBase, projectId, onEvent } = args;
  const pollInterval = args.pollIntervalMs ?? 5000;

  let closed = false;
  let afterServerSeq = 0;
  let pollTimer: number | null = null;
  let ws: WebSocket | null = null;

  const emit = (event: RealtimeEvent) => {
    if (!closed) {
      onEvent(event);
    }
  };

  const startPolling = () => {
    emit({ type: "status", status: "polling" });
    const tick = async () => {
      if (closed) return;
      try {
        const url = new URL(`${apiBase}/v1/projects/${projectId}/ops`);
        url.searchParams.set("afterServerSeq", String(afterServerSeq));
        url.searchParams.set("limit", "200");
        const response = await fetch(url.toString(), {
          headers: {
            "x-user-id": "demo-user",
            "x-actor-id": "demo-actor",
          },
        });
        if (response.ok) {
          const payload = (await response.json()) as OpBatchDownload;
          if (payload.ops.length) {
            emit({ type: "ops", projectId, payload });
            afterServerSeq = payload.serverSeqMax;
          }
        }
      } catch {
        // ignore polling errors
      } finally {
        if (!closed) {
          pollTimer = window.setTimeout(tick, pollInterval);
        }
      }
    };
    pollTimer = window.setTimeout(tick, pollInterval);
  };

  const connectWebSocket = () => {
    try {
      const wsUrl = new URL("/v1/rt", apiBase.replace(/^http/, "ws"));
      wsUrl.searchParams.set("projectId", projectId);
      ws = new WebSocket(wsUrl.toString());

      ws.addEventListener("open", () => emit({ type: "status", status: "connected" }));
      ws.addEventListener("close", () => {
        emit({ type: "status", status: "disconnected" });
        ws = null;
        startPolling();
      });
      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(String(event.data)) as OpBatchDownload | ApiAppendOpsResponse;
          if ("ops" in data) {
            emit({ type: "ops", projectId, payload: data });
            afterServerSeq = data.serverSeqMax;
          } else if ("serverSeqMax" in data) {
            emit({ type: "ack", projectId, payload: data });
          }
        } catch {
          // ignore
        }
      });
    } catch {
      startPolling();
    }
  };

  connectWebSocket();

  return {
    close: () => {
      closed = true;
      if (pollTimer) window.clearTimeout(pollTimer);
      if (ws) ws.close();
    },
  };
}
