import { expect, test } from "bun:test";
import { applyFloorPlanOp, applyFloorPlanOps } from "../src/reducer";
import type { FloorPlan } from "../src/model";

const basePlan: FloorPlan = {
  schemaVersion: 1,
  id: "fp1",
  nodes: [
    { id: "n1", x: 0, y: 0 },
    { id: "n2", x: 1000, y: 0 },
  ],
  walls: [
    { id: "w1", startNodeId: "n1", endNodeId: "n2", thickness: 100, openings: [] },
  ],
};

test("applyFloorPlanOp adds and moves nodes", () => {
  const add = applyFloorPlanOp(basePlan, {
    type: "AddNode",
    node: { id: "n3", x: 200, y: 300 },
  });
  expect(add.applied).toBe(true);
  expect(add.floorPlan.nodes.some((node) => node.id === "n3")).toBe(true);

  const move = applyFloorPlanOp(add.floorPlan, {
    type: "MoveNode",
    nodeId: "n3",
    dx: 50,
    dy: -50,
  });
  const moved = move.floorPlan.nodes.find((node) => node.id === "n3");
  expect(moved?.x).toBe(250);
  expect(moved?.y).toBe(250);
});

test("applyFloorPlanOp deletes node and attached walls", () => {
  const result = applyFloorPlanOp(basePlan, {
    type: "DeleteNode",
    nodeId: "n1",
  });
  expect(result.floorPlan.nodes.some((node) => node.id === "n1")).toBe(false);
  expect(result.floorPlan.walls.length).toBe(0);
});

test("applyFloorPlanOps updates opening offsets and types", () => {
  const opsResult = applyFloorPlanOps(basePlan, [
    {
      type: "AddOpening",
      wallId: "w1",
      opening: { id: "o1", type: "door", offset: 100, width: 800 },
    },
    {
      type: "MoveOpening",
      wallId: "w1",
      openingId: "o1",
      offset: 150,
    },
    {
      type: "SetOpeningType",
      wallId: "w1",
      openingId: "o1",
      openingType: "window",
    },
  ]);

  const wall = opsResult.floorPlan.walls.find((item) => item.id === "w1");
  const opening = wall?.openings.find((item) => item.id === "o1");
  expect(opening?.offset).toBe(150);
  expect(opening?.type).toBe("window");
});

