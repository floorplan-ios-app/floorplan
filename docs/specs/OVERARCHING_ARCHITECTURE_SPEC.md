# OVERARCHING_ARCHITECTURE_SPEC.md

Date: 2026-01-22


## Mission

Build a **best-in-class iOS-first interior design + floor plan + 3D/AR** product that:
- Works **fully offline** (core editing always available).
- Syncs reliably across devices and supports **real-time collaboration**.
- Handles large 3D asset libraries with robust streaming/caching.
- Provides AI assistance without compromising security or privacy.
- Can be deployed to the cloud with a clean path from monolith → services as needed.

The legacy repo is used only to mine requirements (see `REQUIREMENTS_FROM_REPO.md`).

---

## Guiding principles

1. **iOS-first performance**: the editor must feel instantaneous on iPad-class hardware.
2. **Offline-first correctness**: local changes are durable; network is optional.
3. **Data model clarity**: the project format is stable, versioned, and portable.
4. **Monolith-first backend**: modular monolith until boundaries are proven.
5. **Security by default**: no client-shipped secrets; strong auth; least privilege.
6. **Asset pipeline discipline**: deterministic conversions, caching, and metadata.

---

## High-level product surface

### Core editor experiences
- 2D floor plan editor (walls, rooms, openings, measurements).
- 3D furnishing and walkthrough (snap, collisions, layers).
- Material/lighting system (wall/floor/ceiling materials, HDRI, lights).
- Rendering/export (fast preview; high-quality stills; optionally video).
- AR preview/placement and room scanning on supported devices.

### Supporting experiences
- Asset library (catalog + imports; tagging; favorites).
- Project sharing & collaboration.
- Version history & rollback.
- AI assistants: layout suggestions, auto-furnish, style transfer, material generation.
- Cross-platform web companion (optional; secondary to iOS).

---

## System components

### Client apps
1. **iOS/iPadOS App (primary)**  
   SwiftUI + high-performance rendering + AR scanning/preview.

2. **Web App (secondary)**  
   Desktop editing and review; can share most business logic via a shared schema and deterministic data model.

### Cloud backend
3. **API + Realtime service (monolithic)**  
   User/auth, projects, assets, sync, collaboration presence, job orchestration.

4. **Job workers**  
   Asset conversion, rendering, AI pipelines (GPU/CPU depending on task).

5. **Object storage**  
   Models, textures, thumbnails, renders, project exports.

6. **Database**  
   Postgres for authoritative metadata + project operation logs; optional analytics store.

---

## Architecture diagram

```mermaid
flowchart LR
  IOS[iOS App] -->|HTTPS REST| API[Backend API]
  WEB[Web App] -->|HTTPS REST| API
  IOS -->|WSS Realtime| RT[Realtime Gateway]
  WEB -->|WSS Realtime| RT

  API --> DB[(Postgres)]
  API --> OBJ[(Object Storage)]
  API --> Q[(Queue)]
  Q --> W[Workers]
  W --> OBJ
  W --> DB

  API --> AI[AI Providers
(LLM/Image/3D)]
```

---

## Core data model (conceptual)

A **Project** is a versioned document composed of:
- **FloorPlan graph**: nodes/edges representing walls, with openings (doors/windows), room regions, and constraints.
- **Scene graph**: placed objects with transforms, materials, and lighting.
- **Asset refs**: links to catalog/imported 3D assets and textures.
- **Metadata**: units, scale, floors, levels, camera bookmarks, user annotations.

### Key requirements for the data model
- Deterministic serialization (stable ordering, canonical floats/ints).
- Explicit schema versioning + migrations.
- IDs stable across merges (UUIDs/ULIDs).
- Support both “semantic ops” (edit events) and snapshot exports.

---

## Offline-first sync strategy (selected approach)

We choose a **domain-specific operation log (“op-log”)** + deterministic reducer model:

- Each project change is an **operation** (e.g., `AddWall`, `MoveNode`, `SetMaterial`, `PlaceObject`, `DeleteObject`).
- Clients apply operations locally immediately (optimistic), persisting them durably.
- When online, clients **push ops** to the server; server assigns a monotonically increasing sequence per project.
- Clients **pull ops** from server to converge, rebase as needed, and resolve conflicts deterministically where possible.
- For conflict cases that cannot be auto-resolved safely (e.g., concurrent topology edits), the app surfaces a conflict UI with suggested resolutions.

Why this approach:
- Easier to reason about than general-purpose OT/CRDT for a heterogeneous scene graph.
- Natural fit for “undo/redo” and version history.
- Aligns with event-sourcing patterns (append-only log + projections).  
  (See References.)

We still use CRDTs for specific subdocuments where they excel (e.g., shared notes, comments, checklists).

---

## Collaboration model

Real-time collaboration is an overlay on the offline-first system:
- Presence (who is in the project; cursors/selection).
- Realtime delivery of ops via WebSocket for low latency.
- Server acts as **sequencer** and policy gate (ACL checks, rate limits).

---

## Centralized vs client-local responsibilities

### Best kept on clients (iOS/web)
- Core editing (2D/3D) and immediate feedback loops.
- Local persistence and offline operation.
- Rendering previews (interactive).
- AR tracking/placement (iOS only).

### Best on the backend / workers
- Identity, sharing, access control, audit logs.
- Sync sequencing, conflict policy enforcement.
- Asset ingestion, validation, deduplication.
- Heavy conversion and rendering tasks.
- AI inference that requires secrets, large compute, or non-local data.

---

## Decision log (summary)

| Decision | Options considered | Chosen | Rationale | Evidence |
|---|---|---|---|---|
| Editor UI architecture | Ad-hoc MVVM; TCA; Redux-like | **SwiftUI + Observation + unidirectional state** | Complex editors need predictable state, testability, and time-travel; Observation reduces boilerplate | Apple Observation/SwiftUI data flow; Point-Free TCA |
| 3D/AR engine on iOS | SceneKit; RealityKit; Metal | **RealityKit + Metal where needed** | RealityKit is Apple’s modern AR/3D stack; Metal is reserved for specialized rendering | Apple RealityKit docs; Apple Metal docs |
| Room scanning | Custom CV; ARKit mesh; RoomPlan | **RoomPlan + ARKit fallbacks** | RoomPlan provides structured room geometry; ARKit provides tracking quality controls | Apple RoomPlan docs; ARKit session lifecycle docs |
| Sync algorithm | OT; CRDT; op-log; state sync | **Op-log + domain merges; CRDT for text** | Geometry + scene graphs benefit from semantic ops; CRDT used where strong | Figma collab tech; Automerge/Yjs docs; Event Sourcing |
| Backend shape | Microservices; modular monolith | **Modular monolith-first** | Faster iteration, fewer distributed failure modes; split later | Martin Fowler on monolith/microservices |
| Storage | Only JSON; relational; hybrid | **Postgres hybrid (relational + JSONB)** | Queryable metadata + flexible doc storage; strong constraints | PostgreSQL JSONB docs |

This is expanded in the backend/sync/security specs.

---

## References (URLs + access date)

> Access date for all references: {today}

### Apple platform / iOS
- Apple Developer Documentation — RoomPlan overview: https://developer.apple.com/documentation/roomplan
- Apple Developer Documentation — CapturedRoom: https://developer.apple.com/documentation/roomplan/capturedroom
- Apple Developer Documentation — BGTaskScheduler: https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler
- Apple Developer Documentation — Managing session lifecycle & tracking quality (ARKit): https://developer.apple.com/documentation/arkit/managing-session-life-cycle-and-tracking-quality
- Apple Developer Documentation — Improving the performance of a RealityKit app: https://developer.apple.com/documentation/realitykit/improving-the-performance-of-a-realitykit-app
- Apple Developer Documentation — Reducing CPU utilization in your RealityKit app: https://developer.apple.com/documentation/realitykit/reducing-cpu-utilization-in-your-realitykit-app
- Apple Human Interface Guidelines — Augmented Reality: https://developer.apple.com/design/human-interface-guidelines/augmented-reality
- Apple Developer Documentation — Metal: https://developer.apple.com/metal/
- Apple Developer Documentation — SceneKit: https://developer.apple.com/documentation/scenekit

### Collaboration & sync
- Figma Engineering Blog — How Figma’s multiplayer technology works: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
- Automerge documentation: https://automerge.org/
- Yjs documentation: https://docs.yjs.dev/
- Martin Fowler — Event Sourcing: https://martinfowler.com/eaaDev/EventSourcing.html

### Backend architecture
- Martin Fowler — MonolithFirst (Microservices guide): https://martinfowler.com/bliki/MonolithFirst.html
- PostgreSQL documentation — JSON types (JSON/JSONB): https://www.postgresql.org/docs/current/datatype-json.html

### State management
- Point-Free — The Composable Architecture: https://github.com/pointfreeco/swift-composable-architecture


---

## Competitor feature matrix (iOS apps)


This matrix is used for parity planning and “best-in-class” positioning. It is not exhaustive for every niche app.

| App | Core strengths | Notable gaps / opportunity |
|---|---|---|
| Planner 5D | Easy onboarding; broad catalog; 2D→3D; renders | Precision and pro workflows are limited; collaboration depth varies |
| Live Home 3D | Strong 2D/3D editor; exports | Less “guided” AI assistance; AR scanning not the core |
| magicplan | Measurement + estimates; scan-to-plan | Design/furnishing less rich than dedicated design tools |
| RoomScan Pro | Fast scanning workflows | Less full design pipeline; weaker furnishing/storytelling |
| IKEA Kreativ / IKEA Place | AR placement with real products | Locked to IKEA catalog; limited pro editing |
| Roomle | Product-focused room planning | Limited floorplan precision compared to CAD-like tools |
| Houzz | Inspiration + “view in my room” | Editor depth limited; not a full floorplan system |
| Morpholio Board | Moodboards and design workflow | Not a full 2D/3D plan editor |
| Canvas (Scan to CAD) | Scan-to-CAD capture quality | Design/editor tools are not the focus |
| Polycam | 3D scanning power | Not a dedicated interior design editor |

### Sources (product pages / references)
- Planner 5D: https://planner5d.com/
- Live Home 3D: https://www.livehome3d.com/
- magicplan: https://www.magicplan.app/
- RoomScan Pro: https://www.roomscanpro.com/
- IKEA Kreativ: https://www.ikea.com/
- IKEA Place: https://www.ikea.com/
- Roomle: https://www.roomle.com/
- Houzz: https://www.houzz.com/
- Morpholio Board: https://morpholioapps.com/board/
- Canvas (Scan to CAD): https://canvas.io/
- Polycam: https://poly.cam/

## Most-requested missing features (market gaps)


Common gaps across consumer-facing tools (opportunities):
1. **True offline-first collaboration** (edit offline, later merge with intelligible conflicts).
2. **High-fidelity asset pipeline** (accurate dimensions, pivot correctness, material consistency).
3. **Constraint-aware layout AI** (style + function + clearance rules, not just “pretty renders”).
4. **End-to-end workflow**: scan → correct → furnish → lighting → export → shopping list, with professional-grade precision.
5. **Version history / branching** for design iterations.
6. **Accessibility and ergonomics**: one-handed/pen workflows, great snapping, and low cognitive friction.

