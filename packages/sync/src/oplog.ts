import { z } from "zod";

/**
 * Offline-first op-log primitives (implementation skeleton).
 *
 * Goals:
 * - Represent user edits as an append-only stream of operations.
 * - Make operations idempotent (dedupe by (projectId, actorId, clientSeq)).
 * - Allow server to assign a global ordering (serverSeq) for streaming.
 *
 * The full protocol & UX expectations are specified in:
 *   docs/specs/SYNC_AND_OFFLINE_SPEC.md
 */

export const ProjectId = z.string().uuid();
export const ActorId = z.string().min(1);

// Client-local, monotonic per actor within a project.
export const ClientSeq = z.number().int().nonnegative();

// Lamport clock (client-side monotonic per actor)
export const Lamport = z.number().int().nonnegative();

// Opaque deterministic ID (optional); server can also compute one.
export const OpId = z.string().min(1);

// For server streaming
export const ServerSeq = z.number().int().nonnegative();

export const BaseOp = z.object({
  projectId: ProjectId,
  actorId: ActorId,
  clientSeq: ClientSeq,
  lamport: Lamport,
  ts: z.string(), // ISO time; client clock
  // Optional opId; if omitted server can synthesize (actorId:clientSeq)
  opId: OpId.optional(),
});

// NOTE: In a real implementation we'd strongly type payloads.
// For scaffolding, we enumerate a few representative operations and keep payload extensible.
export const Op = z.discriminatedUnion("type", [
  BaseOp.extend({
    type: z.literal("project.rename"),
    name: z.string().min(1),
  }),

  // Floorplan edits
  BaseOp.extend({
    type: z.literal("floorplan.node.upsert"),
    node: z.any(),
  }),
  BaseOp.extend({
    type: z.literal("floorplan.node.delete"),
    nodeId: z.string(),
  }),
  BaseOp.extend({
    type: z.literal("floorplan.wall.upsert"),
    wall: z.any(),
  }),
  BaseOp.extend({
    type: z.literal("floorplan.wall.delete"),
    wallId: z.string(),
  }),

  // Scene graph edits (furniture/materials) - placeholders
  BaseOp.extend({
    type: z.literal("scene.entity.upsert"),
    entity: z.any(),
  }),
  BaseOp.extend({
    type: z.literal("scene.entity.delete"),
    entityId: z.string(),
  }),
]);

export type Op = z.infer<typeof Op>;

export const OpBatchUpload = z.object({
  ops: z.array(Op).min(1),
});

export type OpBatchUpload = z.infer<typeof OpBatchUpload>;

export const OpBatchDownload = z.object({
  ops: z.array(Op),
  // The highest serverSeq included in this response (cursor for next page)
  serverSeqMax: ServerSeq,
});

export type OpBatchDownload = z.infer<typeof OpBatchDownload>;

/**
 * Deterministic apply placeholder.
 * Real implementation should:
 * - validate geometric constraints,
 * - enforce determinism,
 * - maintain derived data (rooms, adjacency, etc),
 * - be safe under partial order / replays.
 */
export function applyOps(state: any, ops: Op[]): any {
  return {
    ...state,
    _appliedOps: (state?._appliedOps ?? 0) + ops.length,
    _lastLamport: Math.max(state?._lastLamport ?? 0, ...ops.map((o) => o.lamport)),
  };
}

export function synthesizeOpId(op: Pick<Op, "opId" | "actorId" | "clientSeq">): string {
  return op.opId ?? `${op.actorId}:${op.clientSeq}`;
}
