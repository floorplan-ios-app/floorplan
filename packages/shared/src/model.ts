import { z } from "zod";

/**
 * Core domain model (scaffold).
 * Kept intentionally small; expand according to docs/specs.
 */

// SPEC: docs/specs/OVERARCHING_ARCHITECTURE_SPEC.md#core-data-model
export const IntMM = z.number().int();

export const Node = z.object({
  id: z.string(),
  x: IntMM,
  y: IntMM,
});

export const Opening = z.object({
  id: z.string(),
  type: z.enum(["door", "window"]),
  offset: IntMM,
  width: IntMM,
});

export const Wall = z.object({
  id: z.string(),
  startNodeId: z.string(),
  endNodeId: z.string(),
  thickness: IntMM,
  openings: z.array(Opening).default([]),
  metadata: z.record(z.any()).optional(),
});

export const FloorPlan = z.object({
  id: z.string(),
  nodes: z.array(Node),
  walls: z.array(Wall),
  metadata: z.record(z.any()).optional(),
});

export const Project = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  floorPlan: FloorPlan,
  // sceneGraph: ...
  metadata: z.record(z.any()).optional(),
});

export type FloorPlan = z.infer<typeof FloorPlan>;
export type Project = z.infer<typeof Project>;

export type FloorPlanValidationIssue = {
  code:
    | "duplicate-id"
    | "missing-node"
    | "invalid-opening-span"
    | "degenerate-wall"
    | "invalid-wall-thickness"
    | "opening-exceeds-wall";
  message: string;
  path: string;
};

const byId = <T extends { id: string }>(items: T[]) =>
  [...items].sort((a, b) => a.id.localeCompare(b.id));

const wallLengthSquared = (wall: Wall, nodesById: Map<string, Node>): number | null => {
  const start = nodesById.get(wall.startNodeId);
  const end = nodesById.get(wall.endNodeId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return dx * dx + dy * dy;
};

export const normalizeFloorPlan = (input: FloorPlan): FloorPlan => {
  const parsed = FloorPlan.parse(input);
  return {
    ...parsed,
    nodes: byId(parsed.nodes),
    walls: byId(parsed.walls).map((wall) => ({
      ...wall,
      openings: byId(wall.openings),
    })),
  };
};

export const validateFloorPlan = (input: FloorPlan): FloorPlanValidationIssue[] => {
  const issues: FloorPlanValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const wallIds = new Set<string>();
  const nodesById = new Map<string, Node>();

  input.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "duplicate-id",
        message: `Duplicate node id: ${node.id}`,
        path: `nodes[${index}].id`,
      });
    }
    nodeIds.add(node.id);
    nodesById.set(node.id, node);
  });

  input.walls.forEach((wall, index) => {
    if (wallIds.has(wall.id)) {
      issues.push({
        code: "duplicate-id",
        message: `Duplicate wall id: ${wall.id}`,
        path: `walls[${index}].id`,
      });
    }
    wallIds.add(wall.id);
    if (wall.thickness <= 0) {
      issues.push({
        code: "invalid-wall-thickness",
        message: `Wall ${wall.id} thickness must be positive`,
        path: `walls[${index}].thickness`,
      });
    }
    if (!nodeIds.has(wall.startNodeId)) {
      issues.push({
        code: "missing-node",
        message: `Wall ${wall.id} missing start node ${wall.startNodeId}`,
        path: `walls[${index}].startNodeId`,
      });
    }
    if (!nodeIds.has(wall.endNodeId)) {
      issues.push({
        code: "missing-node",
        message: `Wall ${wall.id} missing end node ${wall.endNodeId}`,
        path: `walls[${index}].endNodeId`,
      });
    }
    if (wall.startNodeId === wall.endNodeId) {
      issues.push({
        code: "degenerate-wall",
        message: `Wall ${wall.id} start and end nodes are identical`,
        path: `walls[${index}]`,
      });
    }
    const lengthSquared = wallLengthSquared(wall, nodesById);
    if (lengthSquared !== null && lengthSquared === 0) {
      issues.push({
        code: "degenerate-wall",
        message: `Wall ${wall.id} has zero length`,
        path: `walls[${index}]`,
      });
    }
    const openingIds = new Set<string>();
    wall.openings.forEach((opening, openingIndex) => {
      if (openingIds.has(opening.id)) {
        issues.push({
          code: "duplicate-id",
          message: `Duplicate opening id: ${opening.id}`,
          path: `walls[${index}].openings[${openingIndex}].id`,
        });
      }
      openingIds.add(opening.id);
      if (opening.width < 0 || opening.offset < 0) {
        issues.push({
          code: "invalid-opening-span",
          message: `Opening ${opening.id} has negative span`,
          path: `walls[${index}].openings[${openingIndex}]`,
        });
      }
      if (lengthSquared !== null) {
        const span = opening.offset + opening.width;
        if (span > 0 && span * span > lengthSquared) {
          issues.push({
            code: "opening-exceeds-wall",
            message: `Opening ${opening.id} exceeds wall length`,
            path: `walls[${index}].openings[${openingIndex}]`,
          });
        }
      }
    });
  });

  return issues;
};

// SPEC: docs/specs/OVERARCHING_ARCHITECTURE_SPEC.md#core-data-model
export const deriveFloorPlanBounds = (input: FloorPlan) => {
  const parsed = FloorPlan.parse(input);
  const xs = parsed.nodes.map((node) => node.x);
  const ys = parsed.nodes.map((node) => node.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  return { minX, maxX, minY, maxY };
};
