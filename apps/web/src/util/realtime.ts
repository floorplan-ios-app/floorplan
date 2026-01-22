import { ApiAppendOpsResponse } from "@floorplan/shared";
import { OpBatchDownload } from "@floorplan/sync";
import { getApiHeaders } from "./api";

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
  headers?: Record<string, string>;
}): RealtimeClient {
  const { apiBase, projectId, onEvent } = args;
  const pollInterval = args.pollIntervalMs ?? 5000;
  const headers = args.headers ?? getApiHeaders();

  let closed = false;
  let afterServerSeq = 0;
  let pollTimer: number | null = null;
  let ws: WebSocket | null = null;

  const emit = (event: RealtimeEvent) => {
    if (!closed) {
      onEvent(event);
    }
  };

  const handleOpsPayload = (payload: OpBatchDownload) => {
    if (payload.ops.length) {
      emit({ type: "ops", projectId, payload });
    }
    afterServerSeq = payload.serverSeqMax;
  };

  const handleMessage = (data: unknown) => {
    const opsResult = OpBatchDownload.safeParse(data);
    if (opsResult.success) {
      handleOpsPayload(opsResult.data);
      return;
    }
    const ackResult = ApiAppendOpsResponse.safeParse(data);
    if (ackResult.success) {
      emit({ type: "ack", projectId, payload: ackResult.data });
      return;
    }
    emit({ type: "status", status: "polling", detail: "Ignored realtime payload." });
  };

  const startPolling = () => {
    if (pollTimer) return;
    emit({ type: "status", status: "polling" });
    const tick = async () => {
      if (closed) return;
      try {
        const url = new URL(`${apiBase}/v1/projects/${projectId}/ops`);
        url.searchParams.set("afterServerSeq", String(afterServerSeq));
        url.searchParams.set("limit", "200");
        const response = await fetch(url.toString(), {
          headers,
        });
        if (response.ok) {
          const payload = await response.json();
          handleMessage(payload);
        } else {
          emit({
            type: "status",
            status: "polling",
            detail: `Polling failed: ${response.status} ${response.statusText}`,
          });
        }
      } catch (error) {
        emit({
          type: "status",
          status: "polling",
          detail: `Polling error: ${error instanceof Error ? error.message : String(error)}`,
        });
      } finally {
        if (!closed) {
          pollTimer = window.setTimeout(() => {
            pollTimer = null;
            void tick();
          }, pollInterval);
        }
      }
    };
    pollTimer = window.setTimeout(() => {
      pollTimer = null;
      void tick();
    }, pollInterval);
  };

  const connectWebSocket = () => {
    try {
      const wsUrl = new URL("/v1/rt", apiBase.replace(/^http/, "ws"));
      wsUrl.searchParams.set("projectId", projectId);
      ws = new WebSocket(wsUrl.toString());

      ws.addEventListener("open", () => emit({ type: "status", status: "connected" }));
      ws.addEventListener("close", () => {
        if (closed) return;
        emit({ type: "status", status: "disconnected" });
        ws = null;
        startPolling();
      });
      ws.addEventListener("error", () => {
        if (closed) return;
        emit({ type: "status", status: "disconnected", detail: "WebSocket error." });
        ws?.close();
      });
      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(String(event.data));
          handleMessage(data);
        } catch (error) {
          emit({
            type: "status",
            status: "polling",
            detail: `Message parse error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
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
