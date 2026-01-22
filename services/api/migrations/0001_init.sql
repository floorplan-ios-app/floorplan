-- 0001_init.sql
-- Initial schema for floor-plan-tracer-next (scaffold).
-- This schema is designed for:
-- - offline-first op-log sync
-- - project storage
-- - assets metadata for object storage
-- - basic user/device primitives (pairing future)
--
-- IMPORTANT: This is a starter schema. Extend per docs/specs.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (future: auth providers, email, etc.)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name TEXT,
  email TEXT
);

-- Devices (for pairing + audit)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  name TEXT
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  -- optional: store a small project header; the full state is from snapshots/oplog
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- Op-log for offline-first sync
-- Dedupe is via (project_id, actor_id, client_seq). server_seq is global ordering.
CREATE TABLE IF NOT EXISTS project_ops (
  server_seq BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  op_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  client_seq BIGINT NOT NULL,
  lamport BIGINT NOT NULL,
  ts_client TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, op_id),
  UNIQUE (project_id, actor_id, client_seq)
);

CREATE INDEX IF NOT EXISTS idx_project_ops_project_server_seq
  ON project_ops(project_id, server_seq);

-- Snapshots for faster loads (optional)
CREATE TABLE IF NOT EXISTS project_snapshots (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  server_seq BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_snapshots_project_server_seq
  ON project_snapshots(project_id, server_seq);

-- Assets metadata (blobs live in object storage)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL, -- e.g. "model", "texture", "thumbnail"
  mime TEXT,
  byte_size BIGINT,
  sha256 TEXT,
  object_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMIT;
