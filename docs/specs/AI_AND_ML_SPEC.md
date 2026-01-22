# AI_AND_ML_SPEC.md

Date: 2026-01-22


## Scope

This document specifies AI/ML capabilities and their integration points:
- floor plan extraction from images (vectorization)
- room scanning ingestion (RoomPlan)
- generative design assistants (layout/material suggestions)
- model/material generation pipelines
- on-device vs server inference split
- governance (consent, retention, evaluation)

---

## Goals

1. AI improves user outcomes (faster, better layouts) without reducing user control.
2. Results are editable and explainable; AI never “locks” the user in.
3. AI usage is safe: no secret leakage, no unsafe remote execution patterns.
4. Provide measurable quality: evaluation harnesses and regression tests.

---

## ML inputs and outputs

### Inputs
- Raster floor plan images (photos, PDFs, scans).
- RoomPlan captured room geometry (supported devices).
- User preferences (style, budget, constraints).
- Catalog metadata (furniture dimensions, categories, materials).

### Outputs
- Structured floor plan graph (walls, rooms, openings).
- Proposed furniture placements with confidence and constraints.
- Material palettes and lighting suggestions.
- Generated textures/materials (where appropriate).
- Render suggestions (camera angles, staging).

---

## Floor plan extraction (image → vectors)

### Pipeline
1. Preprocess input:
   - normalize DPI and perspective
   - binarize/denoise
   - detect scale markers if present
2. Run a detection/segmentation model:
   - detect walls, doors, windows, symbols
   - estimate room regions
3. Postprocess:
   - vectorize (lines, corners)
   - snap to grid and enforce orthogonality constraints where appropriate
   - build a wall graph and infer rooms
4. Confidence-guided correction UI:
   - highlight uncertain segments
   - allow quick fix tools (extend, merge, split, rotate)

### Model options
- Use open-source detection stacks (e.g., MMDetection) with a dataset like CubiCasa5k.
- Provide a “fast local” heuristic mode for low-end devices.
- Consider Core ML deployment for on-device inference where feasible.

---

## RoomPlan ingestion (captured geometry → internal model)

- RoomPlan provides structured room surfaces and objects.
- Convert to:
  - floorplan walls/openings
  - ceiling height
  - coordinate alignment and scale
- Present a correction UI immediately after capture.

Fallback:
- ARKit plane detection and manual measuring mode where RoomPlan is unavailable.

---

## Generative design assistant

### Core assistant abilities
- Ask clarifying questions based on constraints:
  - room function, style, budget, must-keep items
- Generate:
  - suggested layouts with rationales
  - shopping lists (linked to catalog)
  - material and lighting palettes

### Interaction patterns
- “Draft → review → refine” loops.
- Provide multiple candidates with trade-offs.
- Always expose editable structured outputs, not just text.

### Guardrails
- Do not upload room images/layouts to external providers without explicit consent.
- Provide “local-only” mode that disables external calls.

---

## Model/material generation

Use cases:
- generate placeholder furniture or decor objects when catalog lacks something
- generate seamless tileable textures and PBR map sets
- optimize or “clean” user-imported meshes

Workflow:
1. user request triggers a job
2. worker calls external models (or internal GPU models)
3. postprocess:
   - validate geometry and textures
   - generate previews and metadata
4. deliver as a new asset variant with provenance metadata

---

## Evaluation and quality

### Offline evaluation harness
- Maintain a dataset of representative projects and floor plan images.
- For each model/prompt version:
  - measure geometric accuracy (IoU for rooms, wall alignment error)
  - measure edit distance to final user-corrected plan
  - track failure modes

### Human-in-the-loop review tools
- internal review UI for generated assets and layouts
- annotate failures and feed back into dataset

---

## On-device vs server inference split

On-device (preferred when feasible):
- small models for detection/assistance
- privacy-sensitive tasks
- offline mode

Server-side:
- large LLMs or diffusion models
- GPU-heavy rendering/generation
- tasks requiring access to catalog and job orchestration

---

## References (URLs + access date)

> Access date for all references: 2026-01-22

- Apple Developer Documentation — RoomPlan: https://developer.apple.com/documentation/roomplan
- Apple Developer Documentation — ARKit (tracking/session lifecycle): https://developer.apple.com/documentation/arkit/managing-session-life-cycle-and-tracking-quality
- Apple Developer Documentation — Core ML: https://developer.apple.com/documentation/coreml
- Apple Developer Documentation — Create ML: https://developer.apple.com/documentation/createml
- OpenMMLab — MMDetection: https://github.com/open-mmlab/mmdetection
- CubiCasa5k dataset (GitHub): https://github.com/CubiCasa/CubiCasa5k


---

## Appendix A — Prompt / output schemas (example)


The assistant must return structured proposals so the app can apply them mechanically.

Example: layout proposal envelope
```json
{
  "version": 1,
  "projectId": "01HX...",
  "proposal": {
    "summary": "Living room: sofa on north wall, TV opposite, dining set by window",
    "constraintsUsed": ["door_clearance_800mm", "walkway_900mm"],
    "placements": [
      { "assetId": "chair-123", "x": 1200, "y": 800, "rotDeg": 90, "level": 0 },
      { "assetId": "sofa-456", "x": 400, "y": 2200, "rotDeg": 0, "level": 0 }
    ],
    "materials": [
      { "target": "floor", "materialId": "oak-light", "tiling": 1.0 }
    ]
  }
}
```

The reducer converts this proposal into domain ops (place/move/set material), allowing:
- undo/redo
- sync
- conflict handling

