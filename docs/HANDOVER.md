# Handover — FloorPlan iOS App

## Purpose
This document orients the next developer/AI agent to continue the project quickly and safely.

## Current status (Jan 23, 2026)
Core flows are working and tested via Appium:
- Create project → open editor → draw wall → add opening → pan → pinch zoom.
- Settings screen shows server URL + device id, device list, and pairing code.

Recent fixes:
- Anonymous device identity stored in Keychain and used for auth.
- Backend now creates device records for anonymous sessions so device list loads.
- Settings tab now loads devices reliably under TabView (`onAppear`).
- Appium scripted flow hardened and now captures Settings/pairing state.

Key files involved:
- iOS auth/identity: `apps/ios/Sources/App/Networking/ApiClient.swift`, `apps/ios/Sources/App/Networking/DeviceIdentity.swift`
- Settings UI: `apps/ios/Sources/Features/Settings/SettingsView.swift`, `apps/ios/Sources/Features/Settings/SettingsViewModel.swift`
- Backend auth + devices: `services/api/src/app.ts`, `services/api/src/db/repos.ts`, `services/api/src/storage/db.ts`
- Appium runner: `tools/appium/run-ios.ts`

## How to run locally

### Dependencies (Apple container)
```bash
container system start
container start floorplan-postgres
```

### API server
```bash
cd services/api
HOST=0.0.0.0 PORT=8787 DATABASE_URL="postgres://postgres:postgres@192.168.64.2:5432/floorplan" bun run dev
```

### Build iOS app (Simulator)
```bash
cd apps/ios
xcodebuild -project FloorPlanTracer.xcodeproj -scheme FloorPlanTracer -destination 'platform=iOS Simulator,name=iPhone 12 mini' -configuration Debug -derivedDataPath build build
```

### Appium (manual + scripted)
```bash
cd tools/appium
npx appium --base-path /
```
Then:
```bash
cd tools/appium
IOS_APP_PATH="/.../apps/ios/build/Build/Products/Debug-iphonesimulator/FloorPlanTracer.app" \
IOS_UDID="60E079A7-DE74-43A0-88B7-50C567D277D2" \
IOS_DEVICE_NAME="iPhone 12 mini" \
API_BASE="http://127.0.0.1:8787" \
bun run ios
```
Artifacts are saved in `tools/appium/appium-artifacts/`.

## How to choose work (priority guidance)
1. **Highest-usage flows**: Projects list → create/open → draw/edit → settings/pairing.
2. **Stability**: crashers, failed API calls, or Appium regressions.
3. **Spec alignment**: ensure features match `docs/specs/IOS_APP_SPEC.md`, `docs/specs/DEVICE_PAIRING_SPEC.md`.
4. **Efficiency**: prefer smaller, testable increments that can be verified with Appium.

## Technical decision guidelines
- Prefer iOS-first UX, keep TabView/SwiftUI state simple and testable.
- Keep offline-first and op-log design in mind; avoid server-coupled UI assumptions.
- For auth/session: pairing is optional; anonymous identity must not block usage.
- If you change auth/session behavior, update specs (BACKEND + SECURITY + DEVICE_PAIRING).

## Known issues / limitations
- Appium depends on a stable Appium server; restart if sessions fail.
- API requires local Postgres; ensure container is running.
- Xcode logs can include warnings about old physical devices (ignore; simulator builds OK).
- `tools/appium/appium-artifacts/` is ignored; use it for diagnostics but don't commit.

## Working tree hygiene
- Keep `.data/` and `tools/appium/appium-artifacts/` untracked (already in `.gitignore`).
- Build output lives in `apps/ios/build/`; also ignored.

## Specs to consult
- `docs/specs/IOS_APP_SPEC.md`
- `docs/specs/DEVICE_PAIRING_SPEC.md`
- `docs/specs/SECURITY_AND_PRIVACY_SPEC.md`
- `docs/specs/BACKEND_SPEC.md`
- `docs/ROADMAP.md`

## App structure (iOS)
- App shell: `apps/ios/Sources/App/ContentView.swift`
- Projects: `apps/ios/Sources/Features/Projects/*`
- Editor: `apps/ios/Sources/Features/Editor/*`
- Settings: `apps/ios/Sources/Features/Settings/*`
- Networking: `apps/ios/Sources/App/Networking/*`

## Backend structure (API)
- Routes: `services/api/src/app.ts`
- DB repos: `services/api/src/db/repos.ts`
- Storage wiring: `services/api/src/storage/db.ts`

## Recent test evidence
- Appium screenshots show device list + pairing code (see latest artifacts).

## Next suggested work
- Implement node selection/move + snapping polish in 2D editor.
- Add simple room measurement overlays.
- Continue scripted Appium assertions for Settings devices list and pairing code.
