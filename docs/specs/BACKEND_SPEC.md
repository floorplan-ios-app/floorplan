# BACKEND_SPEC.md

Date: 2026-01-22


## Scope

This document specifies the cloud backend for an iOS-first interior design / floor plan / 3D / AR product.
It assumes:
- Offline-first clients with deterministic local persistence.
- A modular monolith backend initially (with a clean split path).
- Postgres + object storage + realtime gateway + background workers.

---

## Responsibilities

### Core responsibilities
- Identity and authentication (Sign in with Apple + passkeys; device pairing for “web companion”).
- Authorization: org/workspace/projects, roles (owner/editor/viewer), sharing links.
- Project persistence (operation logs + snapshots + version history).
- Asset library: upload, validate, dedupe, transform, distribute.
- Realtime sync sequencing and presence (WebSocket).
- Job orchestration: conversion, rendering, AI tasks.
- Audit logs, rate limiting, abuse controls.

### Non-goals
- Doing interactive editing server-side.
- Shipping secrets (AI keys, catalog keys) to clients.
- Microservices-first.

---

## Deployment shape (monolith-first)

We implement a **modular monolith** with clear internal module boundaries and interfaces.
This aligns with “MonolithFirst” guidance: start with a monolith, split only once boundaries are proven.

---

## Logical modules

1. **Auth & Accounts**
   - Sign in with Apple, passkeys, email magic link (optional).
   - Device registry, sessions, token rotation, revocation.
   - Pairing flows (for companion web app) as a special case.
   - Pairing security requirements are defined in `DEVICE_PAIRING_SPEC.md`.

2. **Projects**
   - Project metadata: title, owners, last modified, schema version.
   - Operation log append, fetch ranges, snapshots.
   - Version history, restore, branching (optional advanced).

3. **Assets**
   - Catalog assets (curated) + user imports.
   - Upload, malware scanning (where feasible), format validation, metadata extraction.
   - Conversion pipelines (glTF/GLB/USDZ), LOD generation, thumbnails.

4. **Realtime & Collaboration**
   - WebSocket gateway: presence, live ops, typing indicators, cursors.
   - Server sequencing of ops and broadcast fanout.

5. **Jobs**
   - Unified job queue abstraction (SQS/Redis/Temporal).
   - Workers for:
     - asset conversion and optimization
     - render exports
     - AI pipelines (generation + evaluation)
     - long-running ML inference

6. **AI Integration**
   - Mediates requests to external AI providers with policy.
   - Stores prompts/outputs with consent + retention rules.

7. **Observability & Compliance**
   - Structured logs, traces, metrics.
   - Auditing access to sensitive layout data.
   - Data deletion and retention enforcement.

---

## API design

### API surfaces
- REST (or JSON-RPC) for CRUD and large payloads.
- WebSocket for realtime:
  - presence/pings
  - op delivery
  - server acknowledgements
  - ephemeral signals (cursor/selection)

### Recommended conventions
- All requests are authenticated (except public share links).
- Mutating endpoints are idempotent where possible (idempotency keys).
- Entities use stable IDs (ULID/UUIDv7) for client-side creation.
- Binary uploads use pre-signed URLs; metadata in the API.

### Core endpoints (illustrative)
- `POST /v1/auth/apple` → session
- `POST /v1/auth/refresh` → rotate
- `POST /v1/pairing/create` → short code (see DEVICE_PAIRING_SPEC)
- `POST /v1/pairing/complete` → web session (see DEVICE_PAIRING_SPEC)
- `GET /v1/devices` / `POST /v1/devices/:id/revoke`
- `GET /v1/projects` / `POST /v1/projects`
- `GET /v1/projects/:id/ops?after=<seq>` (paged)
- `POST /v1/projects/:id/ops` (batch append)
- `GET /v1/projects/:id/snapshots` / `POST /v1/projects/:id/snapshots`
- `POST /v1/assets/uploads` → pre-signed upload
- `POST /v1/assets/ingest` → validate+index
- `GET /v1/assets/:id` (signed URL)
- `GET /v1/assets/:id/content?format=glb|usdz` (signed URL; allow on-demand conversion)
- `POST /v1/jobs` (admin/debug)

### WebSocket channels
- `wss://.../v1/rt?projectId=...`
- Messages:
  - `hello` (auth + cursor)
  - `presence` (join/leave/heartbeat)
  - `ops` (client→server ops + client ids)
  - `ack` (server seq range)
  - `broadcast_ops` (server→clients ops)
  - `signal` (cursor, selection, chat)

---

## Data storage

### Database: Postgres (authoritative)
Use Postgres with a hybrid relational + JSONB approach:
- Relational for accounts, membership, ACLs, billing, audit.
- JSONB for flexible, evolving per-project documents and certain metadata.
- Op-log stored in an append-only table with strong constraints.

#### Recommended core tables
- `users(id, apple_sub, email, created_at, ...)`
- `devices(id, user_id, name, platform, created_at, last_seen_at, revoked_at)`
- `pairing_codes(id, code, user_id, expires_at, created_at, used_at)`
- `sessions(id, user_id, device_id, refresh_token_hash, expires_at, ...)`
- `projects(id, owner_id, title, schema_version, created_at, updated_at, ...)`
- `project_members(project_id, user_id, role, invited_by, ...)`
- `project_ops(project_id, seq bigint, client_op_id, actor_id, ts, op_type, op_json jsonb)`
- `project_snapshots(project_id, seq bigint, snapshot_json jsonb, created_at, ...)`
- `assets(id, owner_id, kind, format, byte_size, sha256, storage_key, metadata_json jsonb, ...)`
- `asset_variants(asset_id, variant, storage_key, byte_size, ...)`
- `audit_log(id, actor_id, action, resource_type, resource_id, ip, ua, ts, meta jsonb)`

#### Constraints and indexing
- Primary key on `(project_id, seq)` for ops.
- Unique `(project_id, client_op_id)` to ensure idempotency.
- GIN indexes on JSONB where needed (search tags/materials).
- Enforce foreign keys and cascading deletes with explicit retention policies.

### Object storage (S3/GCS compatible)
Store large binaries:
- Model sources (original), optimized variants, USDZ exports.
- Textures and atlases.
- Thumbnails.
- Render exports (still/video).
- Project export packages (ZIP/JSON/GLB bundles).

Use pre-signed URLs to upload and download; do not proxy large binaries through the API unless necessary.

---

## Job system

### Why a job system is required
- Asset conversions and renders can take seconds to minutes.
- AI calls can be expensive and rate-limited.
- GPU workloads must be isolated and retryable.

### Queue choices (choose one initially)
- **SQS**: managed, simple at-least-once, scales.
- **Redis-based** (BullMQ): good for dev and simpler ops, but requires Redis ops discipline.
- **Temporal**: best for complex workflows and durable orchestration, higher adoption cost.

Recommendation: start with **SQS (or Cloud Tasks/PubSub equivalent)** for production simplicity, with an abstraction layer so a later move to Temporal is feasible.

### Worker types
- CPU workers: validation, metadata extraction, thumbnails, mesh optimization.
- GPU workers: photoreal rendering, heavy AI (if self-hosting).
- Integrator workers: orchestrate external AI providers and post-process results.

---

## Realtime at scale

### Baseline
A single-region realtime gateway that:
- authenticates connections
- subscribes clients to project rooms
- broadcasts ops and presence
- forwards persisted ops through the sequencer

### Scale path
- Sticky routing by project_id.
- Stateless gateway with shared pubsub (Redis/NATS) OR managed realtime (Ably/Pusher) if operational burden is too high.
- Connection fanout offload via managed platforms if needed.

---

## Observability & operations

- Structured logs (JSON) with request IDs.
- Tracing (OpenTelemetry) across API + workers.
- Metrics: latency p50/p95, queue depth, op ingestion rate, WS connections.
- Backups:
  - daily logical backups (Postgres) + PITR
  - object storage versioning where feasible
- Disaster recovery:
  - multi-AZ DB
  - restore runbooks and periodic drills


## References (URLs + access date)

> Access date for all references: 2026-01-22


- Martin Fowler — MonolithFirst: https://martinfowler.com/bliki/MonolithFirst.html
- Martin Fowler — Event Sourcing: https://martinfowler.com/eaaDev/EventSourcing.html
- PostgreSQL docs — JSON types: https://www.postgresql.org/docs/current/datatype-json.html
- Amazon S3 User Guide: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
- Amazon SQS Developer Guide: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html
- AWS API Gateway — WebSocket APIs: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html
- Temporal documentation: https://docs.temporal.io/
- BullMQ documentation: https://docs.bullmq.io/
- Supabase Realtime docs: https://supabase.com/docs/guides/realtime
- Ably docs: https://ably.com/docs


---

## Appendix A — Detailed API surface (draft)


This appendix is intentionally verbose to make backend build-out mechanical.

### Authentication & sessions
- `POST /v1/auth/apple`
  - input: apple identity token
  - output: access token + refresh token + user profile
- `POST /v1/auth/refresh`
  - input: refresh token (and optional DPoP proof)
  - output: rotated refresh token + new access token
- `POST /v1/auth/revoke`
  - revoke current refresh token family
- `GET /v1/account`
  - returns profile, devices, plan

### Device management
- `GET /v1/devices`
- `POST /v1/devices/:id/revoke`
- `POST /v1/devices/:id/rename`

### Pairing (web companion)
- `POST /v1/pairing/create`
  - output: short code + expires_at
- `POST /v1/pairing/complete`
  - input: code
  - output: web session (scoped)
- `POST /v1/pairing/approve`
  - device confirms pairing completion
- `POST /v1/pairing/cancel`

### Projects
- `GET /v1/projects` (cursor pagination)
- `POST /v1/projects`
- `GET /v1/projects/:id`
- `PATCH /v1/projects/:id` (rename, metadata, settings)
- `POST /v1/projects/:id/duplicate`
- `POST /v1/projects/:id/delete` (soft delete + retention timer)
- `POST /v1/projects/:id/restore`
- `GET /v1/projects/:id/members`
- `POST /v1/projects/:id/invite`
- `POST /v1/projects/:id/members/:userId/role`
- `POST /v1/projects/:id/members/:userId/remove`

### Sync
- `GET /v1/projects/:id/snapshot`
- `POST /v1/projects/:id/snapshots`
- `GET /v1/projects/:id/ops?after=<seq>&limit=<n>`
- `POST /v1/projects/:id/ops` (batch, idempotent)
  - returns assigned seq range and per-op status

### Assets
- `GET /v1/assets` (filter by owner, tag, category)
- `POST /v1/assets/uploads`
  - returns pre-signed upload URL + assetId
- `POST /v1/assets/:id/ingest`
  - queues ingest
- `GET /v1/assets/:id`
  - metadata + available variants
- `GET /v1/assets/:id/download?variant=<...>`
  - returns signed URL

### Jobs & exports
- `POST /v1/projects/:id/export` (zip/glb/usdz/pdf)
- `GET /v1/jobs/:id`
- `GET /v1/projects/:id/renders` (render history)
- `POST /v1/projects/:id/renders` (request render)

### Errors and idempotency
- Every mutating endpoint accepts:
  - `Idempotency-Key` header (client-generated)
- Standard error payload:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfterMs": 3000,
    "requestId": "..."
  }
}
```

### Pagination
Prefer cursor-based pagination:
- request: `?cursor=<opaque>&limit=<n>`
- response: `{ items: [...], nextCursor: "..." }`

---

## Appendix B — Sequencer invariants

The server sequencer must ensure:
- ops are assigned strictly increasing `seq` per project
- ops are either accepted (persisted) or rejected with a stable reason code
- accepted ops are durable before ack is emitted
- the `clientOpId` uniqueness constraint enforces idempotency

---

## Appendix C — Multi-region notes (future)

Multi-region realtime is expensive. A pragmatic path:
- start single-region
- replicate DB read replicas for latency
- keep WS connections region-sticky
- enable “project region pinning” if needed
