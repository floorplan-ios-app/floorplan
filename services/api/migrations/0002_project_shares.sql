-- 0002_project_shares.sql
-- Add share links for projects.

BEGIN;

CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('view', 'review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id
  ON project_shares(project_id);

COMMIT;
