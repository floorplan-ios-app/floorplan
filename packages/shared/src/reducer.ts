import type { FloorPlan, FloorPlanValidationIssue, Node, Opening, Wall } from "./model";
import { normalizeFloorPlan, validateFloorPlan } from "./model";

export type ApplyResult = {
  floorPlan: FloorPlan;
  applied: boolean;
  issues: FloorPlanValidationIssue[];
};

const issue = (code: FloorPlanValidationIssue["code"], message: string, path: string): FloorPlanValidationIssue => ({
  code,
  message,
  path,
});

const findNode = (nodes: Node[], nodeId: string) => nodes.find((node) => node.id === nodeId) ?? null;
const findWall = (walls: Wall[], wallId: string) => walls.find((wall) => wall.id === wallId) ?? null;
const findOpening = (wall: Wall, openingId: string) =>
  wall.openings.find((opening) => opening.id === openingId) ?? null;

export type FloorPlanOp =
  | { type: "AddNode"; node: Node }
  | { type: "MoveNode"; nodeId: string; dx: number; dy: number }
  | { type: "DeleteNode"; nodeId: string }
  | { type: "AddWall"; wall: Wall }
  | { type: "DeleteWall"; wallId: string }
  | { type: "AddOpening"; wallId: string; opening: Opening }
  | { type: "MoveOpening"; wallId: string; openingId: string; offset: number }
  | { type: "SetOpeningType"; wallId: string; openingId: string; openingType: Opening["type"] };

export const applyFloorPlanOp = (floorPlan: FloorPlan, op: FloorPlanOp): ApplyResult => {
  let applied = false;
  let next: FloorPlan = floorPlan;
  let issues: FloorPlanValidationIssue[] = [];

  switch (op.type) {
    case "AddNode": {
      if (findNode(next.nodes, op.node.id)) {
        issues.push(issue("duplicate-id", `Duplicate node id: ${op.node.id}`, "nodes"));
        break;
      }
      next = {
        ...next,
        nodes: [...next.nodes, op.node],
      };
      applied = true;
      break;
    }
    case "MoveNode": {
      if (!findNode(next.nodes, op.nodeId)) {
        issues.push(issue("missing-node", `Missing node id: ${op.nodeId}`, "nodes"));
        break;
      }
      next = {
        ...next,
        nodes: next.nodes.map((node) =>
          node.id === op.nodeId
            ? {
                ...node,
                x: node.x + op.dx,
                y: node.y + op.dy,
              }
            : node
        ),
      };
      applied = true;
      break;
    }
    case "DeleteNode": {
      if (!findNode(next.nodes, op.nodeId)) {
        issues.push(issue("missing-node", `Missing node id: ${op.nodeId}`, "nodes"));
        break;
      }
      next = {
        ...next,
        nodes: next.nodes.filter((node) => node.id !== op.nodeId),
        walls: next.walls.filter((wall) => wall.startNodeId !== op.nodeId && wall.endNodeId !== op.nodeId),
      };
      applied = true;
      break;
    }
    case "AddWall": {
      if (findWall(next.walls, op.wall.id)) {
        issues.push(issue("duplicate-id", `Duplicate wall id: ${op.wall.id}`, "walls"));
        break;
      }
      if (!findNode(next.nodes, op.wall.startNodeId) || !findNode(next.nodes, op.wall.endNodeId)) {
        issues.push(issue("missing-node", `Missing node for wall ${op.wall.id}`, "walls"));
        break;
      }
      if (op.wall.thickness <= 0) {
        issues.push(issue("invalid-wall-thickness", `Wall ${op.wall.id} thickness must be positive`, "walls"));
        break;
      }
      next = {
        ...next,
        walls: [...next.walls, { ...op.wall, openings: op.wall.openings ?? [] }],
      };
      applied = true;
      break;
    }
    case "DeleteWall": {
      if (!findWall(next.walls, op.wallId)) {
        issues.push(issue("missing-wall", `Missing wall id: ${op.wallId}`, "walls"));
        break;
      }
      next = {
        ...next,
        walls: next.walls.filter((wall) => wall.id !== op.wallId),
      };
      applied = true;
      break;
    }
    case "AddOpening": {
      const wall = findWall(next.walls, op.wallId);
      if (!wall) {
        issues.push(issue("missing-wall", `Missing wall id: ${op.wallId}`, "walls"));
        break;
      }
      if (findOpening(wall, op.opening.id)) {
        issues.push(issue("duplicate-id", `Duplicate opening id: ${op.opening.id}`, "walls"));
        break;
      }
      next = {
        ...next,
        walls: next.walls.map((item) =>
          item.id === op.wallId
            ? {
                ...item,
                openings: [...item.openings, op.opening],
              }
            : item
        ),
      };
      applied = true;
      break;
    }
    case "MoveOpening": {
      const wall = findWall(next.walls, op.wallId);
      if (!wall) {
        issues.push(issue("missing-wall", `Missing wall id: ${op.wallId}`, "walls"));
        break;
      }
      if (!findOpening(wall, op.openingId)) {
        issues.push(issue("missing-opening", `Missing opening id: ${op.openingId}`, "walls"));
        break;
      }
      next = {
        ...next,
        walls: next.walls.map((item) =>
          item.id === op.wallId
            ? {
                ...item,
                openings: item.openings.map((opening) =>
                  opening.id === op.openingId ? { ...opening, offset: op.offset } : opening
                ),
              }
            : item
        ),
      };
      applied = true;
      break;
    }
    case "SetOpeningType": {
      const wall = findWall(next.walls, op.wallId);
      if (!wall) {
        issues.push(issue("missing-wall", `Missing wall id: ${op.wallId}`, "walls"));
        break;
      }
      if (!findOpening(wall, op.openingId)) {
        issues.push(issue("missing-opening", `Missing opening id: ${op.openingId}`, "walls"));
        break;
      }
      next = {
        ...next,
        walls: next.walls.map((item) =>
          item.id === op.wallId
            ? {
                ...item,
                openings: item.openings.map((opening) =>
                  opening.id === op.openingId ? { ...opening, type: op.openingType } : opening
                ),
              }
            : item
        ),
      };
      applied = true;
      break;
    }
    default:
      break;
  }

  const normalized = normalizeFloorPlan(next);
  const validationIssues = validateFloorPlan(normalized);
  if (validationIssues.length) {
    return {
      floorPlan: normalized,
      applied,
      issues: validationIssues,
    };
  }

  return {
    floorPlan: normalized,
    applied,
    issues,
  };
};

export const applyFloorPlanOps = (floorPlan: FloorPlan, ops: FloorPlanOp[]): ApplyResult => {
  let current = floorPlan;
  let appliedAny = false;
  const issues: FloorPlanValidationIssue[] = [];

  for (const op of ops) {
    const result = applyFloorPlanOp(current, op);
    current = result.floorPlan;
    appliedAny = appliedAny || result.applied;
    issues.push(...result.issues);
  }

  return {
    floorPlan: current,
    applied: appliedAny,
    issues,
  };
};
