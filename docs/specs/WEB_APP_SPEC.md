# WEB_APP_SPEC.md

Date: 2026-01-22


## Scope

This document specifies the **web app** as a secondary surface:
- Desktop editing and review
- Sharing links and collaboration
- Admin and asset browsing

The web app must be compatible with the same project model and sync semantics as iOS.

---

## Goals

1. **Parity for core editing**: floor plan + 3D placement basics.
2. **Collaboration and review**: share links, comments, cursors, presence.
3. **Performance**: load large scenes via streaming and progressive assets.
4. **Offline tolerance**: allow editing while temporarily offline (op-log + local persistence).

---

## Architecture

### Stack
- React + TypeScript
- Shared schema package for:
  - project model types
  - op definitions
  - deterministic reducer
  - validation and normalization
- Rendering:
  - WebGL via Three.js / React Three Fiber for 3D
  - 2D editor using Canvas2D or WebGL (for large scenes)
- State:
  - unidirectional store (Redux-like or custom reducer) aligned with op-log model
- Persistence:
  - IndexedDB for snapshots and pending ops
  - Cache Storage for binary assets via Service Worker
- Concurrency:
  - Web Workers for heavy decode (meshopt/draco), geometry computations, thumbnail generation

### Auth
- Primary: standard web login (Sign in with Apple via OAuth).
- Optional: pairing code flow from iOS device for “companion mode”.
  - Web UI includes pairing code entry and device session management (see DEVICE_PAIRING_SPEC).

### Realtime
- WebSocket to backend:
  - presence
  - op streaming
  - cursors/selections
  - notifications (render finished, asset processed)

---

## Rendering considerations

### WebGPU
WebGPU can improve performance and enable advanced rendering, but browser support varies and the ecosystem is still evolving.
Design for:
- WebGL baseline renderer
- WebGPU optional renderer behind a capability flag

### Asset formats
- Prefer glTF/GLB for web delivery.
- Use KTX2/Basis for textures where possible.
- Use meshopt and/or Draco compression variants and decode in workers.

---

## Offline strategy (web)

- Snapshot + op-log stored in IndexedDB.
- Service Worker:
  - cache asset variants and thumbnails
  - provide “offline mode” UI
- Sync engine mirrors iOS:
  - apply local ops optimistically
  - push/pull ops when online
  - handle conflicts with same semantics and UI patterns

---

## Sharing and collaboration UX

- View-only share links for quick review.
- Commenting anchored to:
  - a room
  - a wall segment
  - a 3D object
  - a camera bookmark
- Presence shows active users and what they are editing.

---

## References (URLs + access date)

> Access date for all references: 2026-01-22

- MDN — WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- Three.js documentation: https://threejs.org/docs/
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber/getting-started/introduction
- MDN — Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- MDN — IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- MDN — Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API


---

## Appendix A — Web app module map


- `/app/projects`: project list, import/export
- `/app/editor/:id`: editor shell
  - `/floorplan`: 2D editor
  - `/scene`: 3D editor
  - `/render`: render requests/history
  - `/comments`: anchored comments
- `/app/assets`: asset browser
- `/app/account`: account/session controls
- `/share/:token`: view-only share link

Build concerns:
- code-splitting by route
- lazy-load 3D/editor bundles
- keep initial route fast for share links
