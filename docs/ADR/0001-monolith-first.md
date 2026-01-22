# ADR 0001: Monolith-first backend

## Context
We need to ship quickly and discover correct boundaries before splitting services.

## Decision
Start with a modular monolith (Bun + TS) and extract services later if justified.

## Consequences
- Faster iteration, simpler deployment.
- Requires internal module boundaries and strict interfaces to avoid a “big ball of mud”.
