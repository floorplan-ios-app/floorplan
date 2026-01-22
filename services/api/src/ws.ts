/**
 * WebSocket sync channel (skeleton).
 *
 * For collaboration we eventually want:
 * - per-project channels
 * - auth/session binding
 * - op broadcast with ack cursors
 * - presence (cursor, selection)
 *
 * For now: accepts JSON messages and echoes basic acks.
 */

import type { Logger } from "./observability";

type WS = {
  send(data: string | Uint8Array): void;
  close?: () => void;
  data: {
    id?: string;
    userId?: string;
    projectId?: string;
    projectRole?: string;
    traceId?: string;
  };
};

export function websocketHandlers(logger: Logger) {
  return {
    open(ws: WS) {
      if (!ws.data.userId || !ws.data.projectId || !ws.data.projectRole) {
        logger.warn("ws.reject", {
          traceId: ws.data.traceId,
          reason: "missing auth headers",
        });
        ws.send(JSON.stringify({ type: "error", error: "unauthorized" }));
        ws.close?.();
        return;
      }

      ws.data.id = crypto.randomUUID();
      logger.info("ws.open", {
        traceId: ws.data.traceId,
        wsId: ws.data.id,
        userId: ws.data.userId,
        projectId: ws.data.projectId,
        projectRole: ws.data.projectRole,
      });
      ws.send(JSON.stringify({ type: "hello", wsId: ws.data.id }));
    },
    message(ws: WS, message: string | Uint8Array) {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      ws.send(JSON.stringify({ type: "ack", wsId: ws.data.id, bytes: text.length }));
    },
    close(ws: WS) {
      logger.info("ws.close", {
        traceId: ws.data.traceId,
        wsId: ws.data.id,
        userId: ws.data.userId,
        projectId: ws.data.projectId,
      });
    },
  };
}
