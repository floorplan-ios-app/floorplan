import { expect, test } from "bun:test";
import { OpEnvelope, applyOps } from "../src/oplog";

test("applyOps increments counter", () => {
  const ops: OpEnvelope[] = [
    {
      schemaVersion: 1,
      projectId: "p",
      clientOpId: "client-1",
      actorId: "a",
      deviceId: "device-1",
      clientTime: 1730000000,
      baseSeq: 0,
      op: {
        type: "SetRoomLabel",
        roomId: "r1",
        label: "Kitchen"
      },
      opId: "1",
      clientSeq: 1,
      lamport: 0
    }
  ];
  const s = applyOps({}, ops);
  expect(s._appliedOps).toBe(1);
});
