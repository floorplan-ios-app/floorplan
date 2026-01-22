# REQUIREMENTS_FROM_REPO.md

Date: 2026-01-22


## Purpose of this document

This document **only** mines requirements and feature hints from the provided legacy repo (`source_code.tar.gz` extracted to `/mnt/data/source_code`).
It intentionally **does not** treat the implementation as an architecture blueprint.

All quoted evidence points to specific files with **SHA-256** hashes for traceability.

---

## Evidence inventory (key files)

- **ROOT_README**: `/mnt/data/source_code/README.md` (6292 bytes, sha256 `0a3f0ee28ffb0447772f83ac9925a50a210389874da116860d98aa8b47ceba15`)
- **ROOT_REQUIREMENTS**: `/mnt/data/source_code/REQUIREMENTS.md` (5439 bytes, sha256 `45ddaa167dc0d68d89482a7565f001b90a2a789e38b3a8303c3a0ebc335a3221`)
- **IOS_README**: `/mnt/data/source_code/packages/ios-app/README.md` (3908 bytes, sha256 `c18d91c8e90d5055f2b7704f5a60859b631e1a871a38f7f5da3f3b6081da614a`)
- **ML_README**: `/mnt/data/source_code/packages/ml-service/README.md` (1422 bytes, sha256 `1955f2604b2bde2b3a4b36f0d46bf56d17fd52d4ad2036bc3ff053fc1b5684c5`)
- **FRONTEND_WEBGPU_DOC**: `/mnt/data/source_code/packages/frontend/docs/webgpu-feasibility.md` (11939 bytes, sha256 `5b2dee39487f317653aced92db90ce29c605f67b2b7c903ac9b09b0d61ebd976`)
- **SERVER_USERDATA_CONTROLLER**: `/mnt/data/source_code/packages/server/src/controllers/UserDataController.ts` (6610 bytes, sha256 `3dc2ac1714216f92cced34916772038e3939bff1a731c966fa85cef6a48ff638`)


## Answers to the four clarifying questions in the screenshot (derived from the repo)

### 1) Primary purpose / domain
**Interior design + floor plan tracing + 3D/AR visualization**.

Evidence:
- Root README describes “Floor Plan Tracer Pro” for “2D floor plan tracing and interior design” with an iOS companion for AR interactions (see `README.md`).
- `packages/ios-app/README.md` explicitly describes “AR room scanning”, “3D model placement”, and “real-time sync”.

### 2) Is the project complete or partial?
**Partial / evolving prototype**, with many advanced subsystems present but not productized.

Evidence:
- The repo contains multiple experimental subsystems (ML service, generation services, remote tab/exec controllers, webgpu feasibility doc) and dev tooling.
- Requirement documents and package READMEs read like active development notes, not a stabilized release.
- Several components are clearly “companion” or “service adapters”, suggesting the architecture is mid-iteration.

### 3) Cloud-first preference or infrastructure constraints
The repo itself is **local-first developer-centric** (local sqlite DBs, local certs, `.env.local`), but it already has a clear **server role** and “real-time sync”, making it naturally portable to cloud hosting.

Evidence:
- `packages/server/` ships with `db.sqlite` and `floorplan.sqlite` plus local certs, indicating a local/dev configuration.
- Server controllers include “RTC”, “WebSocket server”, and project/asset services, matching an eventual cloud backend.

No explicit AWS/Firebase preference is encoded in the repo; the project is structured so the backend could be deployed on any mainstream cloud.

### 4) Existing authentication / privacy requirements
The repo uses **device pairing** and per-device **access tokens** rather than a full account system.

Evidence:
- `packages/server/src/controllers/UserDataController.ts` implements endpoints for:
  - `POST /api/pairing/create` (pairing code)
  - `POST /api/pairing/complete` (code → session)
  - `POST /api/pairing/verify` (session token verification)
  - `GET /api/user/devices` (device list)
  - token issuance / expiry / device metadata

Privacy/security requirements are not fully formalized in the repo (e.g., no explicit encryption policy, retention rules, or regulatory posture), so these must be defined in the redesign.

---

## Mined feature hints by subsystem

### Root README feature bullets
- **2D Floor Plan Editor**: Draw walls, add doors & windows, create rooms
- **3D Visualization**: Real-time 3D preview of your floor plan
- **AI Assistant**: Gemini-powered chat for design help and automation
- **Asset Library**: Import 3D models from Sketchfab
- **History Management**: Full undo/redo support
- **Project Persistence**: Save and load projects with SQLite database
- ✅ Proper referential integrity via foreign keys
- ✅ Improved query performance with indexes
- ✅ Cascade deletions for automatic cleanup
- ✅ Better scalability for large projects
- **projects** - Project metadata (name, scale, timestamps)
- **points** - 2D coordinates for walls and rooms
- **walls** - Wall entities with thickness and height
- **rooms** - Room polygons defined by point sequences
- **openings** - Doors and windows on walls
- **model_instances** - 3D object placements
- **groups** - Hierarchical object grouping
- **calibrations** - Real-world scale calibration
- **scene_settings** - View preferences per project
- **camera_states** - Saved camera positions
- **history_items** - Undo/redo stack
- **project_assets** - Asset library associations
- All entities cascade delete when their parent project is deleted
- Foreign key constraints ensure data integrity
- Indexed on frequently queried columns
- **Frontend**: React 19, TypeScript, Vite
- **3D Rendering**: Three.js with React Three Fiber
- **Backend**: Bun server
- **Database**: SQLite with normalized schema
- **AI**: Google Gemini API
- [Bun](https://bun.sh/) runtime
- Node.js packages installed
- HTTP: <http://localhost:3001>
- HTTPS: <https://localhost:3002>
- **ProjectState**: In-memory representation of the entire project
- **History**: Array of ProjectState snapshots for undo/redo
- **Persistence**: ProjectState decomposed into normalized tables on save
- **Gemini Chat**: Frontdesk agent for user interaction
- **Backroom Agents**: Autonomous task execution
- **Tools**: AI can manipulate scene, search assets, render views
- Point deduplication in geometry utils
- Room detection with tolerant wall merging
- Canvas rendering optimized for large projects
- 3D rendering with Three.js instancing
- Database indexes on foreign keys
- Large projects (>1000 walls) may experience slowdown
- 3D model loading depends on model complexity
- AI responses rate-limited by Gemini API
- Complete feature requirements (REQ-FEATURE-XXX)
- Data model specifications (REQ-DATA-XXX)
- Integration requirements (REQ-AI-XXX)
- Change history

### Root REQUIREMENTS bullets
- **REQ-IDs**: `REQ-FEATURE-001`, `REQ-UX-004`, `REQ-SYSTEM-012`, etc.
- **State**: `Implemented | In-Progress | Planned | Deprecated`
- **Type**: `Functional | Non-Functional | Constraint | Integration | Performance`
- **Acceptance Criteria** are explicit and testable.
- **Dependencies** list upstream/downstream components.
- **Core modules**: Web App (React), Server (Bun/SQLite), iOS App (SwiftUI/RealityKit/SceneKit)
- **Data flows**: User Input → Canvas/Scene (Web) → Server API → SQLite. iOS App ← WebSocket/WebRTC ← Server/Web App.
- **External integrations**: Sketchfab API, Google Gemini API
- AC1: Display all 3D objects (model instances) from the project.
- AC2: Use orthographic projection for the camera.
- AC3: Sync scene data from the server in real-time.
- AC1: Support panning (two-finger drag or one-finger drag if no object selected).
- AC2: Support zooming (pinch).
- AC3: Support rotation (two-finger rotation or orbit).
- AC1: Open an asset picker to select a model.
- AC2: Place the selected model in the center of the view or at a specified coordinate.
- AC3: Notify the server of the new object placement.
- AC1: Select an object by tapping on it.
- AC2: Drag a selected object to move it in the XZ plane.
- AC3: Provide handles or gestures for rotating and scaling selected objects.
- AC4: Sync manipulations to the server in real-time.
- AC1: Requests for material/texture content return `image/png`.
- AC2: Non-PNG assets (e.g., JPEG, WebP) are converted to PNG.
- AC3: Performance impact is minimized by only converting when necessary.
- AC1: Detect the nearest wall segment within a configurable threshold (default 30cm).
- AC2: Align the model's position to the wall's outer surface (half-thickness offset).
- AC3: Automatically rotate the model to face outwards from the wall based on which side it's placed on.
- AC4: Apply snapping during both initial drag-and-drop placement and subsequent gizmo movement.
- **Editor Frame Rate**: Target 60 FPS on modern iOS devices.
- **Sync Latency**: Real-time sync with server (< 100ms lag).
- **Haptic Feedback**: Provide haptic feedback for significant interactions (placement, selection).
- **Responsive UI**: The editor should adapt to different screen sizes (iPhone/iPad).
- Initialized requirements for Native 3D Isometric Project Editor (REQ-FEATURE-100 to REQ-FEATURE-103).
- Added REQ-FEATURE-104: PNG Conversion for Material/Texture Content.
- Added REQ-FEATURE-105: Wall Snapping for 3D Models.

### iOS app README feature bullets
- **AR Room Scanning**: Leverage ARKit to accurately trace floor plans and capture room dimensions.
- **3D Model Placement**: Place and manipulate 3D furniture and assets in the physical space.
- **Real-time Sync**: Bi-directional synchronization with the web-app via WebSockets.
- **Material Editing**: Change wall and floor materials directly from the device.
- **AI Integration**: AI-assisted room analysis and voice-driven interactions.
- **Xcode 15+**: Required for building the SwiftUI/ARKit app.
- **CocoaPods**: For managing Swift dependencies.
- **Bun**: Required for running the Appium tools in `tools/appium`.
- Ensure your development identity is configured in Xcode for physical device deployment.
- The `ios` CLI assumes a single `*.xcworkspace` in the project root.
- Schemes must be shared and visible to `xcodebuild -list`.

### ML service README feature bullets
- Required: `cascade_swin_latest.pth` (~400MB)

### Server controllers (capability hints)
- `AdminController`
- `AssetController`
- `BaseController`
- `GenerationController`
- `ProjectController`
- `RTCController`
- `RemoteExecController`
- `SketchFabController`
- `UserDataController`
- `WebRequestController`
- `WebSearchController`

### Server services (capability hints)
- `._AssetService`
- `._ModelGenerationService`
- `._ProjectService`
- `._SketchFabService`
- `._USDZConversionService`
- `AssetService`
- `BonjourService`
- `FalAIServerService`
- `MaterialDesignerService`
- `MaterialGenerationService`
- `ModelAttributeEstimationService`
- `ModelGenerationService`
- `ModelOptimizerService`
- `ProjectService`
- `RemoteTabService`
- `RenderService`
- `SketchFabService`
- `USDZConversionService`
- `UserDataService`
- `WebRequestService`
- `WebSearchService`

### Frontend TSX files (capability hints)
- `._App.test.tsx`
- `AdminApp.tsx`
- `AdminHome.tsx`
- `AgentProgressPanel.tsx`
- `AnimatedThumbnail.tsx`
- `App.test.tsx`
- `App.tsx`
- `AssetErrorBoundary.tsx`
- `AssetLibrary.tsx`
- `AssetPreview.tsx`
- `AssetQuickLook.tsx`
- `AssetSyncIntegration.test.tsx`
- `CalibrationDialog.tsx`
- `CameraLookControls.tsx`
- `CanvasEditor.tsx`
- `ChatWidgets.tsx`
- `CommandPalette.tsx`
- `CompanionController.tsx`
- `DragOverlay.tsx`
- `DropdownPortal.tsx`
- `Effects.tsx`
- `EnvironmentScene.tsx`
- `FPSOverlayMenu.tsx`
- `FloatingActionMenu.tsx`
- `GeminiPanel.tsx`
- `GenerationProgressPanel.tsx`
- `GlassPanel.tsx`
- `HistoryPanel.tsx`
- `Home.tsx`
- `IconButton.tsx`
- `ImageTo3DDialog.tsx`
- `LazyThumbnail.tsx`
- `LightRenderer.tsx`
- `MaterialDesignerPanel.tsx`
- `MentionInput.tsx`
- `ModelLayer2D.tsx`
- `ObjectDetails.tsx`
- `PairingPanel.tsx`
- `Panel.tsx`
- `PanelContainer.tsx`
- `PhotorealisticRenderer.tsx`
- `PreferencesContext.tsx`
- `PreferencesDialog.tsx`
- `ProjectEditor.tsx`
- `RenderReviewPanel.tsx`
- `RotationKnob.tsx`
- `ScaleIndicator.tsx`
- `Scene3D.tsx`
- `SceneRefsContext.tsx`
- `SceneTree.tsx`
- `SelectionHighlight.tsx`
- `ShortcutsOverlay.tsx`
- `Sidebar.tsx`
- `SkyboxEnvironment.tsx`
- `SkyboxPreview.tsx`
- `SkyboxSettings.tsx`
- `TexturePicker.tsx`
- `ToastContainer.tsx`
- `ToastContext.tsx`
- `ToolGroupButton.tsx`
- `Tooltip.tsx`
- `UnifiedSceneCore.tsx`
- `UnifiedSceneTest.tsx`
- `WebGLContextRecovery.tsx`
- `admin.tsx`
- `index.tsx`
- `panelRegistry.tsx`


## Observations that matter for the redesign

### The “server” is more than sync
Server controllers/services indicate that the backend was used not only for sync and storage, but also for:
- Asset ingestion and delivery (AssetController/AssetService)
- Integration with external model libraries (SketchFabController/SketchFabService)
- Generative pipelines (GenerationController, ModelGenerationService, MaterialGenerationService, ModelOptimizerService)
- Remote rendering (RenderService)
- Web search and web requests (WebSearchService/WebRequestService)
- **Remote execution and remote tab control** (RemoteExecController, RemoteTabService) — this is security-sensitive and should be removed or heavily constrained in any production design.

### ML service exists as a separate Python subsystem
`packages/ml-service` provides an HTTP API for floor plan vectorization using MMDetection / CubiCasa5k-style models. This strongly suggests the product needs:
- A model-serving story (local or cloud)
- A contract for turning raster floorplan images into structured vectors (walls/rooms)
- A way to review and correct ML output inside the editor

### Web client has a sophisticated 2D/3D editor
The frontend includes:
- 3D scene and “photorealistic renderer”
- history/undo panel
- command palette and shortcuts overlay
- environment/skybox and effects pipeline
- admin UI

These imply product requirements around:
- advanced editor UX (keyboard shortcuts, command palette)
- history/undo/redo and time travel
- rendering quality modes (fast vs “photorealistic”)

### iOS companion app is AR-first
The iOS package README frames the iOS app as a “powerful AR-based data collection and visualization tool” with real-time sync. In the redesign, iOS becomes the **primary** app, but AR scanning and AR preview remain central.

---

## Requirements to carry forward into the new design (repo-derived)

This is a conservative set of requirements derived from the legacy repo; the redesign should also incorporate competitor parity and novel features (documented in the other spec files).

### Core
- Project management: create/open/save projects.
- Floor plan representation: walls/rooms, dimensions, materials, openings.
- 3D scene: furniture placement, transforms, collisions/snapping.
- Rendering: interactive + high-quality render export.
- Asset library: browse/import models; preview thumbnails.

### iOS-first
- AR room scanning and/or capture.
- AR placement/preview of furniture and layouts.
- Bi-directional sync with backend.
- Editing of materials from device.
- AI-assisted analysis / voice-driven interactions.

### Server/Cloud
- Project and asset APIs.
- Real-time events channel (WebSockets).
- Job processing for heavy generation/render/convert tasks.
- Secure pairing / authentication system.

---

## Repo-only limitations / gaps

- No clearly defined offline-first sync model (beyond “real-time sync”).
- No clearly defined multi-user access control model (roles, sharing, revocation).
- No explicit privacy policy enforcement (retention, deletion, encryption posture).
- Some features (remote exec/tab automation) are inappropriate by default for production.

---

## Reproducibility

This document was generated from:
- Extracted file metadata captured in `{mined_path}`
- Repository extracted under `{SRC_ROOT}`

