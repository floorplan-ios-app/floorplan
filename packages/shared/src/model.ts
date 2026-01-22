import { z } from "zod";

/**
 * Core domain model (scaffold).
 * Kept intentionally small; expand according to docs/specs.
 */

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

export type Project = z.infer<typeof Project>;
