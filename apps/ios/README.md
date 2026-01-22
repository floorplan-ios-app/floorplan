# iOS App Scaffold

This folder uses **XcodeGen** so the repo stays text-first and reproducible.

## Generate the Xcode project
```bash
bunx xcodegen generate
open FloorPlanTracer.xcodeproj
```

## Notes
- SwiftUI app entry point is in `Sources/App/FloorPlanTracerApp.swift`.
- 3D/AR modules are stubbed; follow `docs/specs/IOS_APP_SPEC.md`.
