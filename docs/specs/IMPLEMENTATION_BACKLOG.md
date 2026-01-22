# IMPLEMENTATION_BACKLOG.md

Date: 2026-01-22

## Purpose

Translate the core specs into an execution-ready backlog with clear ownership, API contracts, shared data model
alignment, dependencies, and acceptance criteria. Each epic maps to at least one API contract and one shared data
model item from `packages/shared`.

## Assumptions

- The initial backend surface is the modular monolith described in the specs, with REST for CRUD and WebSocket for
  realtime; the REST endpoints listed below are the current contract baseline.
- The shared data model in `packages/shared` is the source of truth for floor plan primitives, with `Project` and
  `FloorPlan` as the minimum viable shared schema.
- The op-log in `packages/sync` is the single mechanism for convergence; any client-side mutations flow through ops.
- Assets and scene graph data are stored in `Project.metadata` until dedicated schemas land.
- Workers will be introduced as needed for heavy workloads (conversion, rendering), but the initial backlog focuses on
  core editing + sync correctness.

## Rubric (5–7 items)

1. Every epic has at least one API contract and one `packages/shared` data model reference.
2. Acceptance criteria are verifiable and written in clear, testable statements.
3. Dependencies capture cross-module ordering (e.g., sync relies on project CRUD).
4. Ownership explicitly covers: `apps/ios`, `apps/web`, `services/api`, `services/workers`, `packages/shared`,
   `packages/sync`.
5. Epic scopes align with the specs (offline-first, op-log, modular monolith, performance).
6. Backlog is implementable in slices (vertical increments) with clear MVP boundaries.

## High-level implementation plan (from spec review)

**Evaluated approaches (most promising choices from specs)**
- **Sync model**: domain op-log + deterministic reducer (chosen over OT/CRDT for geometry).  
  - Best for semantic edits, undo/redo, and explainable conflict UX.
- **Backend shape**: modular monolith-first with clear internal modules.  
  - Minimizes distributed complexity while preserving a split path later.
- **Rendering stack**: RealityKit + Metal for iOS; WebGL baseline with optional WebGPU for web.  
  - Meets performance targets and accommodates current platform maturity.

**Execution plan (3–6 steps)**
1. **Schema foundation**: finalize `Project` + `FloorPlan` schemas; add validation/normalization helpers.
2. **API baseline**: project CRUD + op append/download with sequencing and idempotency.
3. **Client editors**: 2D editor flows with deterministic reducer + local persistence.
4. **Offline sync**: background uploader + conflict records and resolution UI.
5. **Realtime overlay**: presence + op streaming with REST fallback.
6. **Asset/render workflows**: ingestion, conversion, thumbnails, and export jobs.

## Epic backlog

### Epic 1 — Project lifecycle + metadata foundation

**Ownership**
- `apps/ios`: project list/create/open UI
- `apps/web`: project list/create/open UI
- `services/api`: project CRUD
- `packages/shared`: `Project` schema
- `packages/sync`: op-log integration for project rename

**API contracts**
- `GET /v1/projects`
- `POST /v1/projects`
- `GET /v1/projects/:id`
- `POST /v1/projects/:id/ops` (`project.rename`)

**Shared data model items**
- `Project` (name, metadata, timestamps)

**Dependencies**
- None (foundational)

**Acceptance criteria**
- Users can create and list projects in iOS and web.
- Project rename is persisted via op-log and reflected on reload.
- API validates UUID project IDs and returns 404 for missing projects.

---

### Epic 2 — Floor plan core modeling (nodes, walls, openings)

**Ownership**
- `apps/ios`: 2D editor interactions + validation UX
- `apps/web`: 2D editor interactions + validation UX
- `services/api`: op ingestion and retrieval
- `packages/shared`: `Node`, `Wall`, `Opening`, `FloorPlan` schemas
- `packages/sync`: floorplan op types + reducer hooks

**API contracts**
- `POST /v1/projects/:id/ops` (floorplan upsert/delete)
- `GET /v1/projects/:id/ops?afterServerSeq=...`

**Shared data model items**
- `FloorPlan`, `Node`, `Wall`, `Opening`

**Dependencies**
- Epic 1 (project lifecycle)

**Acceptance criteria**
- Users can add/move/delete nodes and walls; openings validate against wall length.
- Deterministic normalization preserves stable ordering for nodes/walls/openings.
- Invalid floor plans surface validation issues with precise paths.

---

### Epic 3 — Offline-first persistence + sync engine parity

**Ownership**
- `apps/ios`: local persistence + background sync
- `apps/web`: IndexedDB + Service Worker cache integration
- `services/api`: op sequencing + idempotency handling
- `packages/shared`: `Project`, `FloorPlan` snapshot schema
- `packages/sync`: op-log envelope, batching, apply reducer

**API contracts**
- `POST /v1/projects/:id/ops` (batch append)
- `GET /v1/projects/:id/ops?afterServerSeq=...&limit=...`

**Shared data model items**
- `Project`, `FloorPlan`

**Dependencies**
- Epic 1 (project lifecycle), Epic 2 (floorplan ops)

**Acceptance criteria**
- Clients can edit offline, then sync ops on reconnect without data loss.
- Server returns `serverSeqMax` for paginated op downloads.
- Duplicate client ops are idempotent and do not corrupt state.

---

### Epic 4 — Collaboration overlay (presence + realtime ops)

**Ownership**
- `apps/ios`: presence UI, conflict indicators
- `apps/web`: presence UI, conflict indicators
- `services/api`: op sequencing (REST) + WebSocket gateway (realtime)
- `packages/shared`: `Project` + `FloorPlan` for convergence
- `packages/sync`: realtime op streaming semantics

**API contracts**
- `GET /v1/projects/:id/ops` (initial catch-up)
- `POST /v1/projects/:id/ops` (fallback when WS unavailable)
- `wss://.../v1/rt?projectId=...` (presence + op streaming)

**Shared data model items**
- `Project`, `FloorPlan`

**Dependencies**
- Epic 3 (offline sync engine)

**Acceptance criteria**
- Two clients see each other’s presence and receive ops within a live session.
- Realtime delivery falls back to REST polling when WS is unavailable.
- Conflict cards surface when ops cannot be applied deterministically.

---

### Epic 5 — Asset library ingestion + cache coordination

**Ownership**
- `apps/ios`: asset browser + cache management UI
- `apps/web`: asset browser + cache management UI
- `services/api`: asset upload/ingest metadata endpoints
- `services/workers`: conversion + thumbnails
- `packages/shared`: `Project.metadata` asset references
- `packages/sync`: op types to attach assets to scenes

**API contracts**
- `POST /v1/assets/uploads`
- `POST /v1/assets/ingest`
- `GET /v1/assets/:id`
- `POST /v1/projects/:id/ops` (scene entity upsert with asset refs)

**Shared data model items**
- `Project` (metadata for asset refs)

**Dependencies**
- Epic 1 (project lifecycle), Epic 3 (sync engine)

**Acceptance criteria**
- Assets can be uploaded and ingested, producing downloadable variants.
- Projects can reference assets via metadata fields without schema drift.
- Cache eviction controls exist on both iOS and web.

---

### Epic 6 — Rendering/export job pipeline

**Ownership**
- `apps/ios`: export request UI + download handling
- `apps/web`: export request UI + download handling
- `services/api`: job orchestration API
- `services/workers`: render jobs and artifact storage
- `packages/shared`: `Project` + `FloorPlan` for render inputs
- `packages/sync`: op-log for render requests history

**API contracts**
- `POST /v1/jobs` (render/export enqueue)
- `GET /v1/projects/:id/ops` (render history ops)

**Shared data model items**
- `Project`, `FloorPlan`

**Dependencies**
- Epic 3 (sync engine), Epic 5 (assets)

**Acceptance criteria**
- Render/export job can be enqueued and tracked to completion.
- Render outputs are stored in object storage and linked to the project.
- Clients can view render history and re-download artifacts.
