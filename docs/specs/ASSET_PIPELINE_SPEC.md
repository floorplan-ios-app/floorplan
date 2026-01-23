# ASSET_PIPELINE_SPEC.md

Date: 2026-01-22


## Scope

This document specifies:
- asset ingestion, validation, and metadata extraction
- conversion and optimization pipelines
- storage layout and caching strategy
- delivery formats for iOS (USDZ) and web (glTF/GLB)

---

## Requirements

1. Support common import formats: GLB/glTF (preferred), USDZ, OBJ, FBX (ingest then convert).
   - Accept PNG/JPEG/HEIC for textures and normalize to PNG/JPEG during ingest.
2. Produce optimized delivery variants:
   - iOS: USDZ (preferred), plus texture variants
   - web: GLB + meshopt/draco variants, KTX2 textures
3. Deterministic processing:
   - same input produces identical variants (versioned toolchain)
4. Strong metadata:
   - dimensions, bounding boxes, pivot, materials, texture usage, polycount
5. Safety:
   - reject malformed files; scan uploads where feasible

---

## Asset lifecycle

### 1) Ingest
- Client uploads original asset to object storage via pre-signed URL.
- Backend creates an `asset` record and enqueues an ingest job.
- Ingest job:
  - downloads the asset
  - validates format
  - computes SHA-256 for dedupe
  - extracts metadata
  - stores source as immutable
  - detects archives (zip) and resolves a single canonical model file

### 2) Normalize
Canonical internal representation:
- Convert everything to glTF/GLB internally as the working format
- Normalize:
  - units and scale
  - coordinate system conventions
  - pivot/origin rules
  - texture color space tagging (sRGB/linear)
  - strip unused extras (cameras, animations) unless explicitly requested

### 3) Optimize
Produce variants:
- Mesh compression:
  - meshopt for fast decode
  - optional Draco for size (trade decode time)
- LOD generation:
  - generate 2–4 LOD levels per mesh
- Texture processing:
  - resize to tiers (e.g., 512/1k/2k/4k)
  - transcode to KTX2/Basis for web
  - keep original PNG/JPEG where needed

### 4) Convert for iOS
- Convert canonical GLB to USDZ.
- Validate that materials map correctly (PBR).
- Generate iOS-friendly variants:
  - avoid extremely large textures by default
  - ensure USDZ is loadable by RealityKit
 - Allow **on-demand** USDZ conversion if a variant is missing at request time.

### 5) Thumbnail/render previews
- Render thumbnails with deterministic lighting/camera.
- Produce:
  - square thumbnail
  - hero preview
  - optional turntable GIF/video
 - Prefer server-side thumbnail generation for consistency; allow client-side temporary thumbnails before server render completes.

### 6) Publish
- Store all variants in object storage with content-addressable keys.
- Update DB records with variant availability and metadata.

---

## Storage layout (suggested)

- `assets/src/<sha256>/source.<ext>`
- `assets/norm/<sha256>/canonical.glb`
- `assets/variants/<sha256>/web/meshopt.glb`
- `assets/variants/<sha256>/web/draco.glb` (optional)
- `assets/variants/<sha256>/web/textures/<tier>.ktx2`
- `assets/variants/<sha256>/ios/model.usdz`
- `assets/thumbs/<sha256>/thumb.png`
- `assets/previews/<sha256>/hero.jpg`

---

## Validation rules (examples)

- Reject assets above a size threshold unless explicitly allowed.
- Enforce maximum texture dimensions tiered by subscription/setting.
- Enforce triangle counts tiered by device class.
- Verify PBR material completeness.
- Verify no external URL references inside glTF (must be self-contained after ingest).

---

## Delivery strategy

### iOS delivery
- Prefer USDZ for RealityKit.
- Support progressive loading:
  - low-res textures first
  - higher tiers on demand
- Cache on disk with LRU eviction.

### Web delivery
- Serve GLB variants with compression.
- Decode in worker threads.
- Use KTX2 textures when supported.

---

## References (URLs + access date)

> Access date for all references: 2026-01-22

- Khronos — glTF 2.0 Specification: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- meshoptimizer (meshopt) documentation: https://meshoptimizer.org/
- Google Draco documentation: https://google.github.io/draco/
- Khronos — KTX 2.0: https://www.khronos.org/ktx/
- Basis Universal: https://github.com/BinomialLLC/basis_universal
- Apple Developer Documentation — Model I/O: https://developer.apple.com/documentation/modelio
- Apple Developer Documentation — RealityKit: https://developer.apple.com/documentation/realitykit
- Apple Developer Documentation — USDZ (RealityKit asset loading entry points): https://developer.apple.com/documentation/realitykit/modelentity
- OpenUSD documentation: https://openusd.org/release/index.html


---

## Appendix A — Toolchain versioning and reproducibility


Determinism requires pinning:
- mesh optimizer version
- draco encoder/decoder version
- texture transcoders (basisu) version
- USD toolchain / converter versions

Record in metadata:
```json
{
  "pipelineVersion": "2026-01-22.1",
  "tools": {
    "meshoptimizer": "x.y.z",
    "draco": "x.y.z",
    "basisu": "x.y.z",
    "usd": "x.y.z"
  }
}
```

---

## Appendix B — Variant policy (example tiers)

| Tier | Target | Triangle budget | Texture max | Notes |
|---|---|---:|---:|---|
| mobile-low | older iPads | 50k | 1k | fast loads |
| mobile-high | recent iPads | 200k | 2k | default |
| desktop | web high end | 500k | 4k | optional |
