import { expect, test } from "bun:test";
import { Op, applyOps } from "../src/oplog";

test("applyOps increments counter", () => {
  const ops: Op[] = [
    { type: "project.rename", opId: "1", actorId: "a", lamport: 0, ts: "2026-01-22T00:00:00Z", projectId: "p", name: "X" }
  ];
  const s = applyOps({}, ops);
  expect(s._appliedOps).toBe(1);
});
