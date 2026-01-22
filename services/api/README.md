# @floorplan/api

Bun + TypeScript API service (scaffold).

## Run
```bash
cd services/api
bun install
bun run dev
```

## Database
Start Postgres (from repo root):
```bash
docker compose up -d
```

Run migrations (from repo root):
```bash
bun run db:migrate
```

## Endpoints
- `GET /health`
- `POST /v1/auth/session`
- `POST /v1/auth/refresh`
- `DELETE /v1/auth/session`
- `GET /v1/auth/me`
- `GET /v1/projects`
- `POST /v1/projects` body: `{ "name": "My Project" }`
- `GET /v1/projects/:id`
- `PATCH /v1/projects/:id`
- `DELETE /v1/projects/:id`
- `POST /v1/projects/:id/ops` body: `{ "ops": [Op...] }` with header `x-actor-id`
- `GET /v1/projects/:id/ops?afterServerSeq=0&limit=200`
- `GET /v1/assets?projectId=<project_id>`
- `POST /v1/assets/uploads`
- `GET /v1/assets/:id`
- `PATCH /v1/assets/:id/metadata`
- `POST /v1/assets/:id/variants`
- `POST /v1/jobs`
- `GET /v1/jobs?assetId=<asset_id>`
- `GET /ws` (WebSocket topics: auth, projects, assets, sync)
