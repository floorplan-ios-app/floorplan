# IOS_APP_SPEC.md

Date: 2026-01-22


## Scope

This document specifies the **iOS/iPadOS app**, which is the primary product surface.
It includes:
- 2D floor plan editor
- 3D furnishing editor + walkthrough
- AR scanning and AR preview/placement
- offline persistence + sync engine integration
- asset loading/caching and performance handling

---

## Product goals (iOS)

1. **Fast editing**: 60 fps interactions on recent iPads; graceful degradation on older devices.
2. **Offline-first**: create/edit/export without network.
3. **Accurate geometry**: measurements are precise; constraints are enforced.
4. **High-quality visuals**: good lighting/materials; excellent AR previews.
5. **Battery & thermal aware**: avoid runaway GPU/CPU usage.

---

## UI architecture

### Recommended approach
- SwiftUI for UI composition and navigation.
- Observation-based models + unidirectional data flow for the editor state.
- Heavy interaction surfaces use dedicated renderers (Metal/RealityKit), hosted in SwiftUI.

Rationale:
- SwiftUI scales well for complex apps, but large editors require disciplined state management.
- Apple’s Observation framework reduces boilerplate and improves performance by tracking dependencies.
- A unidirectional architecture (reducer + effects) simplifies undo/redo and sync integration.

### Suggested module boundaries (feature slices)
- **Project Home**: list/create/duplicate/import/export projects.
- **Editor Shell**: tabs/modes, toolbars, inspectors, history panel.
- **2D Floorplan Editor**: drawing, snapping, constraints, measurement overlays.
- **3D Scene Editor**: object placement, transforms, lighting/material editing.
- **AR Scan**: RoomPlan capture pipeline, review/correct results.
- **AR Preview/Placement**: place furniture/scene in real space.
- **Assets**: catalog, search, favorites, downloads, local imports.
- **Account/Sharing**: sign-in, sharing, collaborator management.
- **Settings**: units, performance quality, privacy, cache management.
- **Device Pairing**: optional QR/code pairing flow for web companion sessions (see DEVICE_PAIRING_SPEC).
- **Export/Share**: export PDF/PNG/USDZ and share links.

### Interaction and layout notes (best-of spec2)
- 2D/3D are presentations of the same project state; editors share a single source of truth.
- iPad uses split/side panels for tools/inspectors; iPhone uses modal cards or bottom sheets.
- Contextual inspector appears when an element is selected (walls, rooms, furniture).
- Asset library supports search + categories; allow tap-to-place and (on iPad) drag-to-canvas.

---

## Rendering architecture

### 2D editor
The 2D editor needs crisp lines, fast panning/zoom, and accurate snapping.

Recommended rendering stack:
- **SwiftUI** for the surrounding UI and inspectors.
- A dedicated **Metal-backed renderer** (or CoreGraphics/Quartz initially) for the canvas:
  - Draw walls, nodes, openings, room fills, measurement overlays.
  - Render on an integer millimeter grid to avoid drift.
  - Maintain a spatial index for hit-testing and snapping.

Key interactive behaviors:
- Grid and angle snapping.
- Constraint maintenance:
  - orthogonal/45-degree modes
  - wall thickness
  - wall joins and corners
- Measurement overlays with selectable reference edges.
- Gesture expectations:
  - drag to create walls and nodes
  - tap to select; drag to move; handles for resize/rotate where relevant
  - on selection, show inline dimension labels for precise edits

### 3D editor (non-AR)
Use **RealityKit** for the primary 3D scene:
- Load furniture as `ModelEntity` from USDZ (preferred on iOS) or converted assets.
- Use anchors for floors/rooms and parenting to manage transforms.
- Keep “editor gizmos” (selection outline, transform handles) in a separate render layer or overlay.
- Provide quick camera modes: orbit, dollhouse, and first-person walkthrough.
- Use hit-testing to select entities; surface a contextual inspector for transforms/materials.

If RealityKit falls short for specific rendering features:
- Add a specialized **Metal** path for a subset of needs (e.g., custom selection highlighting, CAD-like overlays).
- Avoid mixing engines unnecessarily; prefer one primary runtime.

### AR scan (RoomPlan)
RoomPlan can generate a structured “captured room” representation on supported devices.
Pipeline:
1. Start capture session and guide user through scan (HIG-compliant coaching).
2. Receive captured room result.
3. Convert to internal floorplan graph:
   - walls, openings, room bounds, ceiling height
4. Present correction UI:
   - snap/adjust walls
   - label rooms
   - add missing openings

Fallbacks:
- On devices without RoomPlan support:
  - manual measurement mode
  - ARKit-based plane detection for rough layout (optional)

### AR preview/placement
Use ARKit with RealityKit:
- Place individual furniture items or the full room scene.
- Support scaling and alignment tools.
- Provide occlusion and scene understanding when available.

Best practices:
- Manage AR session lifecycle, handle interruptions and tracking quality changes.
- Limit per-frame CPU and avoid excessive entity counts.
- Stream in assets progressively and show placeholders during loads.
- Use a focus-square style placement indicator and tracking-quality messaging.
- Constrain object movement to detected planes; prefer rotate/translate gestures over free-scale.

---

## Data layer (offline-first)

### Local persistence
Store:
- Project snapshots (materialized state)
- Op-log entries (pending + applied)
- Asset cache metadata
- Download/upload queues
- Auth state (anonymous identity + tokens)

Recommended storage:
- SQLite (Core Data or a lightweight wrapper).
- Binary assets in app sandbox file storage.
- Tokens + anonymous identity in Keychain (private key + device auth metadata).
- Optional: iCloud Keychain/app data for restoring anonymous identity across devices.

### Sync engine integration
The sync engine:
- subscribes to local op commits
- batches ops and uploads
- applies remote ops deterministically
- produces conflict records when preconditions fail

The UI must treat sync as “always running in the background”:
- show “synced / syncing / offline” state
- surface conflicts as actionable tasks, not modal blockers

---

## Asset loading, caching, and memory pressure

### Asset caching strategy
- Use a multi-tier cache:
  1. In-memory LRU for recently used decoded textures/meshes.
  2. On-disk cache for asset bundles and variants.
  3. Cloud source of truth.

### Streaming and progressive loads
- Load low LOD first, then refine.
- Use background tasks to prefetch assets for the current project.
- Avoid blocking UI on asset decode; use async loading pipelines.

### Memory pressure handling
- Respond to low-memory signals by:
  - clearing in-memory caches
  - reducing texture resolution tier
  - unloading distant/hidden entities
- Provide a user-facing “Clear cache” and “Reduce quality” toggle.

---

## Performance budgets and guardrails

Suggested targets (tune per device class):
- 60 fps for 2D interactions.
- 30–60 fps for 3D walkthrough depending on quality settings.
- Avoid loading more than a safe entity count per frame (use chunked scene activation).
- Keep thermal pressure low by:
  - capping render resolution in editor mode
  - pausing heavy background tasks when on battery/thermal warning

---

## Testing and automation

- Unit tests for:
  - geometry validity and normalization
  - op reducer correctness (apply ops = expected state)
  - migration logic for schema upgrades
- UI tests:
  - smoke flows (create project, draw walls, place furniture, export)
- Performance regression tests:
  - load large scenes
  - asset cache thrash scenarios
- Optional: Appium hooks for device automation (especially for AR flows where possible).
- Appium manual flow: prefer a real Appium driver session + Simulator on screen and observe behavior
  via live UI + screenshots/logs. Use direct Appium API calls rather than scripted flows when
  evaluating UX (see DEV_GUIDE for local run steps).
- Appium scripted flow: the TypeScript runner must pass `API_BASE` into the simulator environment
  so the app can reach the local API server. Default to simulator loopback (`http://127.0.0.1:8787`);
  fall back to the host LAN IP when explicitly requested.

## Authentication & identity (iOS)

**Goal**: The app must be usable without device pairing. Authentication should be frictionless:
users can start anonymously, and later optionally connect to a full account.

### Anonymous auth (default)
- On first launch, generate a device-local identity:
  - Create a signing keypair in Keychain (Secure Enclave when available).
  - Store public key + derived device identifier; keep private key in Keychain.
- Request an anonymous session from the backend:
  - Exchange the device public key (or a signed nonce) for access + refresh tokens.
  - Persist tokens in Keychain; refresh silently.
- Allow offline-first usage even before an auth session completes; queue ops for upload.

### Optional upgrades
- If user signs in (future): link anonymous identity to an account; retain project history.
- If iCloud Keychain or app data is available:
  - Sync the anonymous identity keypair to allow “same identity on new device”
  - Make it opt-in and explain the privacy impact.

### Requirements
- Pairing is never required to create/edit projects.
- Loss of Keychain identity should not corrupt local projects; only affects sync identity.

---

## References (URLs + access date)

> Access date for all references: 2026-01-22

- Apple Developer Documentation — Managing model data in your app (SwiftUI): https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app
- Apple Developer Documentation — Observation framework: https://developer.apple.com/documentation/observation
- Point-Free — The Composable Architecture: https://github.com/pointfreeco/swift-composable-architecture
- Apple Developer Documentation — RealityKit overview: https://developer.apple.com/documentation/realitykit
- Apple Developer Documentation — Improving the performance of a RealityKit app: https://developer.apple.com/documentation/realitykit/improving-the-performance-of-a-realitykit-app
- Apple Developer Documentation — Reducing CPU utilization in your RealityKit app: https://developer.apple.com/documentation/realitykit/reducing-cpu-utilization-in-your-realitykit-app
- Apple Developer Documentation — ARKit tracking quality & session lifecycle: https://developer.apple.com/documentation/arkit/managing-session-life-cycle-and-tracking-quality
- Apple Human Interface Guidelines — Augmented Reality: https://developer.apple.com/design/human-interface-guidelines/augmented-reality
- Apple Developer Documentation — RoomPlan: https://developer.apple.com/documentation/roomplan
- Apple Developer Documentation — CapturedRoom: https://developer.apple.com/documentation/roomplan/capturedroom
- Apple Developer Documentation — BGTaskScheduler: https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler
- Apple Developer Documentation — Metal: https://developer.apple.com/metal/
- Apple Developer Documentation — SceneKit: https://developer.apple.com/documentation/scenekit


---

## Appendix A — Editor modes and tool behaviors


### 2D tools
- Wall tool: tap to start, tap to end; drag to extend; snap to grid/angles.
- Opening tool: tap wall to add door/window; drag to reposition; show constraints.
- Room labeling: tap room region; set type (kitchen, bedroom) and label.
- Measure tool: select two points/edges; display distance and allow override if scale not known.
- Selection: lasso select; group operations (move/rotate).

### 3D tools
- Place object: drag from asset panel onto floor; snap to walls/edges.
- Transform gizmo: move/rotate/scale; optional “keep on floor” constraint.
- Collision and clearance: show warnings when overlapping or blocking doors.
- Material inspector: assign materials to surfaces; show texture tiling and color.

### Apple Pencil + touch ergonomics
- Pencil draws walls; finger pans/zooms by default.
- Two-finger tap = undo (optional).
- Long-press = context menu (duplicate, align, lock).

---

## Appendix B — Export formats

- Floorplan:
  - JSON (project schema)
  - DXF (future)
  - PDF (2D plan with measurements)
- 3D:
  - USDZ (iOS-first)
  - GLB (web)
- Renders:
  - PNG/JPEG stills
  - MP4 walkthrough (optional)

---

## Appendix C — Accessibility

- VoiceOver labels for all tools and selection states.
- Dynamic Type for inspectors and panels.
- Color-blind-friendly selection indicators.
- Reduced motion mode for transitions.
