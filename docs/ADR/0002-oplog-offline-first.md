# ADR 0002: Offline-first via op-log

## Context
Floorplan editing must work offline and sync later across devices and collaborators.

## Decision
Represent all edits as a deterministic op-log (event stream). Store locally and sync to server.
Merge uses per-entity causal ordering + deterministic conflict rules and explicit conflict UX where needed.

## Consequences
- Works well with intermittent connectivity.
- Requires careful design of op schema and merge rules for geometry.
