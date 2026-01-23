# SYNC_AND_OFFLINE_SPEC.md

Date: 2026-01-22


## Scope

This document specifies:
- Offline-first persistence on iOS and web.
- Sync primitives and protocols.
- Collaboration (realtime) overlay.
- Conflict detection & resolution UX, with an emphasis on **geometry/topology edits**.

---

## Core requirements

1. **No data loss offline**: edits are durable locally immediately.
2. **Eventual convergence**: devices converge to the same project state.
3. **Low-latency collaboration**: realtime op delivery for active sessions.
4. **Scalable**: projects can have large scenes and many assets.
5. **Conflict UX**: conflicts are explainable and recoverable.

---

## Strategy comparison (CRDT vs OT vs op-log vs state sync)

| Approach | Strengths | Weaknesses | Best fit in this product | Representative sources |
|---|---|---|---|---|
| **CRDT** (e.g., Automerge/Yjs) | Strong offline support; automatic convergence | Can be heavy; generic data types may not model geometry invariants well | Great for notes/comments/checklists; possible for some scene properties with careful modeling | Automerge, Yjs |
| **OT** (Operational Transform) | Proven in text editors; good realtime UX | Complex to implement correctly; central server typical; domain transforms required | Possible for specific structured ops, but high complexity for geometry | Figma multiplayer post; OT literature |
| **Event-sourcing / op-log** (domain ops) | Natural history; robust offline; deterministic projections | Requires careful op design; conflicts still exist | **Primary approach**: semantic ops for floorplan/scene + deterministic reducer | Fowler Event Sourcing |
| **State-based sync** (LWW) | Simple | Loses edits; conflicts hidden; poor collaboration | Only for low-value settings (e.g., ephemeral UI prefs) | Common practice |

### Selected approach
A **domain-specific op-log** with:
- Server sequencing and validation.
- Deterministic reducer (apply ops to derive current state).
- Conflict detection for non-commutative ops.
- Optional CRDT subdocuments for text-like data.

---

## Data structures

### Operation envelope
Each op uses a common envelope:

```json
{
  "projectId": "ulid",
  "clientOpId": "ulid",
  "actorId": "user/device id",
  "deviceId": "device id",
  "clientTime": 1730000000,
  "baseSeq": 1234,
  "op": { "type": "MoveNode", "payload": { "nodeId": "n1", "dx": 10, "dy": 0 } }
}
```

Server adds:
- `seq` (monotonic per project)
- `serverTime`

### Operation taxonomy
Operations are semantic and constrained. Examples:
- `AddNode`, `MoveNode`, `DeleteNode`
- `AddWall`, `SplitWall`, `DeleteWall`
- `AddOpening`, `MoveOpening`, `SetOpeningType`
- `SetRoomLabel`, `SetRoomType`
- `PlaceObject`, `MoveObject`, `RotateObject`, `DeleteObject`
- `SetMaterial`, `SetLight`, `SetEnvironment`

Operations MUST:
- Reference stable IDs.
- Validate invariants (walls connect; openings on walls).
- Be small and composable (avoid “replace entire project”).

---

## Client offline persistence

### Local database
Clients store:
- Latest snapshot (materialized project state).
- Op log (locally authored + remote applied).
- Asset cache metadata (variants, LOD, last access).
- Upload/download queues.

On iOS:
- SQLite via Core Data or a lightweight wrapper.
- Store binary assets on disk; metadata in DB.
- Use Keychain for session tokens.

### Snapshots and compaction
To prevent unbounded logs:
- Periodically generate a snapshot at `seq=N`.
- Prune ops older than snapshot once all devices have acknowledged (or retain for explicit history tiers).

---

## Sync protocol

### States
- **Offline**: append ops locally, mark as “pending upload”.
- **Online**: background uploader pushes pending ops in batches.
- **Catch-up**: client requests remote ops after last known `seq`.
- **Realtime session**: use WS to stream ops and presence.

### REST flow (baseline)
1. Client opens project:
   - `GET /projects/:id/meta`
   - `GET /projects/:id/snapshot` (or last snapshot)
   - `GET /projects/:id/ops?after=seq`
2. Client applies ops to reach current state.
3. Client pushes local pending ops:
   - `POST /projects/:id/ops` (batch)
4. Server returns acked seq range.

### WebSocket flow (realtime)
1. Client connects with auth token.
2. `hello` includes last known seq.
3. Server sends missing ops, then streams new ops.
4. Client sends new ops; server sequences + broadcasts.

---

## Conflict detection & resolution

### Typical conflict types
- Concurrent topology changes: split/delete the same wall region.
- Concurrent object transforms: two users move the same object.
- Invariant breaks: referenced entity deleted.

### Automatic merge rules
- Property updates: field-level LWW tie-breaker `(server_seq, actor_id)`.
- Independent entity adds: commutative.
- Deletes vs updates: delete wins when update targets removed entity (unless safe reattach is possible).

### Conflict UI
If an op cannot apply because preconditions fail:
- Show “conflict card” describing what happened and why.
- Provide suggested repair:
  - pick a new target (nearest wall/node)
  - reapply with adjusted parameters
  - discard op
- Offer advanced branching (“keep both versions”) for power users.

---

## Background sync on iOS

Use **BGTaskScheduler** to:
- retry uploads when connectivity returns
- prefetch asset variants for upcoming scenes
- compact logs and create snapshots

Guidance:
- do small batches
- exponential backoff
- persist state before background task completion

Optional enhancement:
- silent push notifications can trigger a lightweight catch-up when another device syncs (opt-in).

---

## Collaboration primitives

- Presence: who is online.
- Live cursors and selections.
- Optional soft reservations (“I’m editing this room”) to reduce conflicts.

---

## CloudKit/Firestore vs custom sync

CloudKit and Firestore provide offline sync primitives but are less suited for:
- deterministic domain op sequencing with custom conflict UX
- a heterogeneous op-log shared across web + iOS + workers
- deeper auditability and custom retention rules

They can still be used for:
- lightweight sub-docs (comments) or small features if desired.


## References (URLs + access date)

> Access date for all references: 2026-01-22


- Figma — How Figma’s multiplayer technology works: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
- Automerge documentation: https://automerge.org/
- Yjs documentation: https://docs.yjs.dev/
- Martin Fowler — Event Sourcing: https://martinfowler.com/eaaDev/EventSourcing.html
- Apple Developer Documentation — BGTaskScheduler: https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler
- Apple Developer Documentation — NSPersistentCloudKitContainer: https://developer.apple.com/documentation/coredata/nspersistentcloudkitcontainer
- Apple Developer Documentation — CKShare: https://developer.apple.com/documentation/cloudkit/ckshare
- Firebase Firestore — Offline persistence (iOS): https://firebase.google.com/docs/firestore/manage-data/enable-offline


---

## Appendix A — Conflict matrix (floorplan/scene)


| Conflict | Example | Auto-resolution | User-facing UX |
|---|---|---|---|
| Node moved vs wall split | A moves corner, B splits adjacent wall | Apply split, then re-evaluate move if node still exists; else produce conflict | “Corner was changed by B; reattach move to nearest corner?” |
| Wall deleted vs opening moved | A deletes wall, B moves door on that wall | delete wins; opening op becomes invalid | “Door target wall no longer exists; choose new wall or discard.” |
| Object moved by 2 users | two users move same sofa | LWW on transform OR merge if deltas non-overlapping (rare) | “Sofa moved by others; keep theirs / keep mine / duplicate.” |
| Material set concurrently | wall material changed by two users | LWW by seq | show toast: “Material updated by X” |
| Room label edits | two users rename room | LWW by seq | show in history |

### Structural conflict reduction tactics
- Soft reservations (“editing this room”) with visible indicators.
- Fine-grained entity ownership in UI (selection shows who is editing).
- Encourage smaller ops (split big edits into local groups).

---

## Appendix B — Vector clocks vs server sequencing

Clients maintain:
- `lastSeenSeq` per project
- `pendingOps` list
- optional vector clock for debugging and conflict explanations

The server sequencing model is the authoritative ordering for merge and playback.
Vector clocks can still help explain concurrency to users (“your edit was made before/after X’s edit”).

---

## Appendix C — Compaction policy (practical)

- Snapshot every N ops or every M minutes while actively editing.
- Keep an “active window” of ops on device (for undo/redo) and a “full history” in backend for premium tiers.
- Prune:
  - device: aggressively (storage)
  - server: per retention policy and subscription tier

---

## Appendix D — Offline UX checklist

- Always show a clear offline indicator.
- Edits never block on network.
- Queued uploads visible (optional detail screen).
- Conflicts are tasks in an inbox, not modal popups.
- “Export” always works offline; uploads happen later.
