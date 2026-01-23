# Developer Guide

## Goals
- iOS-first: feature parity and UX excellence on iPad/iPhone comes first.
- Offline-first: local edits always work; sync is eventual with explicit conflict UX for geometry.
- Clean domain model: floorplan/scene graph is shared across clients and server.
- Security: never ship secrets; sensitive home layout data handled with care.

## Conventions
- TypeScript workspace uses Bun and `packages/*` shared modules.
- All geometry uses integer millimetres.
- All edits are expressed as op-log events (see `packages/sync`).

## Local development
1. `bun install`
2. Start local dependencies using Apple `container`:
   - `container system start`
   - `container start floorplan-postgres`
3. Run the API (in one terminal):
   - `cd services/api`
   - `HOST=0.0.0.0 PORT=8787 DATABASE_URL="postgres://postgres:postgres@192.168.64.2:5432/floorplan" bun run dev`
4. Optional: run web (when implemented): `bun run dev`

## iOS build
- Generate project: `bun run ios:gen`
- Open in Xcode and run on the iOS Simulator.

## Appium testing (manual + scripted)
1. Start Appium server:
   - `cd tools/appium`
   - `npx appium --base-path /`
2. Build app for simulator:
   - `cd apps/ios`
   - `xcodebuild -project FloorPlanTracer.xcodeproj -scheme FloorPlanTracer -destination 'platform=iOS Simulator,name=iPhone 12 mini' -configuration Debug -derivedDataPath build build`
3. Run scripted flow (captures screenshots in `tools/appium/appium-artifacts/`):
   - `cd tools/appium`
   - `IOS_APP_PATH=".../apps/ios/build/Build/Products/Debug-iphonesimulator/FloorPlanTracer.app" IOS_UDID="iPhone 12 mini UDID" IOS_DEVICE_NAME="iPhone 12 mini" API_BASE="http://127.0.0.1:8787" bun run ios`

## Repo health
- Markdown lint: `bun run docs:lint`
- Unit tests: `bun run test`


## Database migrations (scaffold)

Bring up local dependencies:
```bash
container system start
container start floorplan-postgres
```

Run migrations:
```bash
bun run db:migrate
```
