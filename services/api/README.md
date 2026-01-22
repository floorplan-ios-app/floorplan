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
- `GET /v1/projects`
- `POST /v1/projects` body: `{ "name": "My Project" }`
- `GET /v1/projects/:id`
- `POST /v1/projects/:id/ops` body: `{ "ops": [Op...] }` with header `x-actor-id`
- `GET /v1/projects/:id/ops?afterServerSeq=0&limit=200`
- `GET /ws` (WebSocket skeleton)
