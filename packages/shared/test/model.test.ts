import { expect, test } from "bun:test";
import { Project, deriveFloorPlanBounds, normalizeFloorPlan, validateFloorPlan } from "../src/model";

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

test("normalizeFloorPlan sorts ids deterministically", () => {
  const normalized = normalizeFloorPlan({
    id: "fp1",
    nodes: [
      { id: "n2", x: 1000, y: 0 },
      { id: "n1", x: 0, y: 0 }
    ],
    walls: [
      {
        id: "w2",
        startNodeId: "n2",
        endNodeId: "n1",
        thickness: 100,
        openings: [
          { id: "o2", type: "door", offset: 200, width: 900 },
          { id: "o1", type: "window", offset: 0, width: 500 }
        ]
      },
      {
        id: "w1",
        startNodeId: "n1",
        endNodeId: "n2",
        thickness: 100,
        openings: []
      }
    ]
  });

  expect(normalized.nodes.map((node) => node.id)).toEqual(["n1", "n2"]);
  expect(normalized.walls.map((wall) => wall.id)).toEqual(["w1", "w2"]);
  expect(normalized.walls[1]?.openings.map((opening) => opening.id)).toEqual(["o1", "o2"]);
});

test("validateFloorPlan returns issues for duplicate ids and missing nodes", () => {
  const issues = validateFloorPlan({
    id: "fp1",
    nodes: [{ id: "n1", x: 0, y: 0 }, { id: "n1", x: 1000, y: 0 }],
    walls: [
      {
        id: "w1",
        startNodeId: "missing",
        endNodeId: "n1",
        thickness: 0,
        openings: [
          { id: "o1", type: "door", offset: -10, width: 900 },
          { id: "o1", type: "window", offset: 10, width: 100 }
        ]
      }
    ]
  });

  const codes = issues.map((issue) => issue.code).sort();
  expect(codes).toEqual([
    "duplicate-id",
    "duplicate-id",
    "invalid-opening-span",
    "invalid-wall-thickness",
    "missing-node"
  ]);
});

test("validateFloorPlan flags degenerate walls with identical nodes", () => {
  const issues = validateFloorPlan({
    id: "fp1",
    nodes: [{ id: "n1", x: 0, y: 0 }],
    walls: [
      {
        id: "w1",
        startNodeId: "n1",
        endNodeId: "n1",
        thickness: 100,
        openings: []
      }
    ]
  });

  expect(issues.map((issue) => issue.code)).toEqual(["degenerate-wall", "degenerate-wall"]);
});

test("validateFloorPlan flags openings that exceed wall length", () => {
  const issues = validateFloorPlan({
    id: "fp1",
    nodes: [
      { id: "n1", x: 0, y: 0 },
      { id: "n2", x: 1000, y: 0 }
    ],
    walls: [
      {
        id: "w1",
        startNodeId: "n1",
        endNodeId: "n2",
        thickness: 100,
        openings: [{ id: "o1", type: "door", offset: 900, width: 200 }]
      }
    ]
  });

  expect(issues.map((issue) => issue.code)).toEqual(["opening-exceeds-wall"]);
});

test("deriveFloorPlanBounds returns min and max extents", () => {
  const bounds = deriveFloorPlanBounds({
    id: "fp1",
    nodes: [
      { id: "n1", x: -500, y: 0 },
      { id: "n2", x: 1500, y: 2000 }
    ],
    walls: []
  });

  expect(bounds).toEqual({ minX: -500, maxX: 1500, minY: 0, maxY: 2000 });
});
