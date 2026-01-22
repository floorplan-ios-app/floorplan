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
2. `docker compose up -d`
3. `bun run dev` (API + web)

## iOS build
- Generate project: `bun run ios:gen`
- Open in Xcode and run.

## Repo health
- Markdown lint: `bun run docs:lint`
- Unit tests: `bun run test`


## Database migrations (scaffold)

Bring up local dependencies:
```bash
docker compose up -d
```

Run migrations:
```bash
bun run db:migrate
```
