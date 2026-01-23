import { z } from "zod";
import { Operation, OperationType } from "@floorplan/shared";

/**
 * Offline-first op-log primitives (implementation skeleton).
 *
 * Goals:
 * - Represent user edits as an append-only stream of operations.
 * - Make operations idempotent (dedupe by (projectId, actorId, clientOpId)).
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

export const OpEnvelope = Operation.extend({
  lamport: Lamport,
  clientSeq: ClientSeq,
  opId: OpId.optional(),
});

export type OpEnvelope = z.infer<typeof OpEnvelope>;

export const OpLogEntry = OpEnvelope.extend({
  serverSeq: ServerSeq,
  serverTime: z.number().int().nonnegative(),
});

export type OpLogEntry = z.infer<typeof OpLogEntry>;

export const MergeStrategy = z.enum([
  "commutative",
  "lww",
  "delete-wins",
  "rebase",
  "manual",
]);

export const ConflictResolutionRule = z.object({
  id: z.string().min(1),
  opType: OperationType,
  strategy: MergeStrategy,
  description: z.string().min(1),
  userFacingMessage: z.string().min(1),
});

export type ConflictResolutionRule = z.infer<typeof ConflictResolutionRule>;

export const DEFAULT_CONFLICT_RULES: ConflictResolutionRule[] = [
  {
    id: "topology.split-vs-move",
    opType: "SplitWall",
    strategy: "rebase",
    description: "Apply split then attempt to reattach move if node still exists.",
    userFacingMessage: "Corner changed by another user; reattach move to nearest corner?",
  },
  {
    id: "delete-vs-opening",
    opType: "MoveOpening",
    strategy: "delete-wins",
    description: "Delete wins when update targets removed entity.",
    userFacingMessage: "Door target wall no longer exists; choose a new wall or discard.",
  },
  {
    id: "object-move-lww",
    opType: "MoveObject",
    strategy: "lww",
    description: "Use last-writer-wins by server seq and actor id.",
    userFacingMessage: "Object moved by another user; keep theirs or keep yours.",
  },
  {
    id: "material-set-lww",
    opType: "SetMaterial",
    strategy: "lww",
    description: "Use last-writer-wins on material changes.",
    userFacingMessage: "Material updated by another collaborator.",
  },
];

export const OpBatchUpload = z.object({
  ops: z.array(OpEnvelope).min(1),
});

export type OpBatchUpload = z.infer<typeof OpBatchUpload>;

export const OpBatchDownload = z.object({
  ops: z.array(OpLogEntry),
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
export function applyOps(state: any, ops: OpEnvelope[]): any {
  const maxLamport = ops.length
    ? Math.max(state?._lastLamport ?? 0, ...ops.map((o) => o.lamport))
    : state?._lastLamport ?? 0;
  return {
    ...state,
    _appliedOps: (state?._appliedOps ?? 0) + ops.length,
    _lastLamport: maxLamport,
  };
}

export function synthesizeOpId(op: Pick<OpEnvelope, "opId" | "actorId" | "clientSeq">): string {
  return op.opId ?? `${op.actorId}:${op.clientSeq}`;
}
