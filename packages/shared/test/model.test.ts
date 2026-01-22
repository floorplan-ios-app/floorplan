import { expect, test } from "bun:test";
import { Project } from "../src/model";

test("Project schema parses minimal project", () => {
  const p = Project.parse({
    id: "p1",
    name: "Test",
    createdAt: "2026-01-22T00:00:00Z",
    updatedAt: "2026-01-22T00:00:00Z",
    floorPlan: {
      id: "fp1",
      nodes: [{ id: "n1", x: 0, y: 0 }, { id: "n2", x: 1000, y: 0 }],
      walls: [{ id: "w1", startNodeId: "n1", endNodeId: "n2", thickness: 100, openings: [] }]
    }
  });
  expect(p.floorPlan.walls.length).toBe(1);
});
