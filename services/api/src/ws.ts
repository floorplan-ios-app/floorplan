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

type WS = {
  send(data: string | Uint8Array): void;
  data: { id: string };
};

export function websocketHandlers() {
  return {
    open(ws: WS) {
      ws.data.id = crypto.randomUUID();
      ws.send(JSON.stringify({ type: "hello", wsId: ws.data.id }));
    },
    message(ws: WS, message: string | Uint8Array) {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      ws.send(JSON.stringify({ type: "ack", wsId: ws.data.id, bytes: text.length }));
    },
    close(_ws: WS) {
      // no-op
    },
  };
}
