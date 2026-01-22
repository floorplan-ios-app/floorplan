# Floor Plan Tracer Next (Scaffold)

This repo is a **from-scratch reimplementation** of an iOS-first interior design / floorplan / 3D / AR application.
The legacy project is used **only for requirements mining**; this codebase is the new canonical implementation.

## Monorepo layout

- `apps/ios` — iOS/iPadOS app (SwiftUI + RealityKit/ARKit). Uses XcodeGen to generate the Xcode project.
- `apps/web` — web companion app (React + Vite).
- `services/api` — Bun + TypeScript API (REST + WebSocket).
- `services/workers` — background jobs (asset conversion, AI tasks, rendering).
- `packages/shared` — shared schemas, types, and validation.
- `packages/sync` — offline-first op-log + merge helpers (client + server).
- `docs/` — specifications, ADRs, dev guide.

## Quickstart (local dev)

### 1) Prereqs
- macOS for iOS builds (Xcode required).
- Bun for TS workspace tooling.

### 2) Bring up local infra
```bash
docker compose up -d
```

### 3) Run API + web
```bash
bun install
bun run dev
```

### 4) Generate iOS Xcode project (macOS)
```bash
bun run ios:gen
open apps/ios/FloorPlanTracer.xcodeproj
```

## Documentation

Start here:
- `docs/specs/OVERARCHING_ARCHITECTURE_SPEC.md`
- `docs/specs/IOS_APP_SPEC.md`
- `docs/specs/BACKEND_SPEC.md`
- `docs/specs/SYNC_AND_OFFLINE_SPEC.md`
- `docs/specs/SECURITY_AND_PRIVACY_SPEC.md`

## Status
This is scaffolding/boilerplate: it compiles the repo structure and minimal “Hello API/Web” runnable targets.
iOS project generation is wired but the app modules are stubbed.
