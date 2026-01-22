-- 0002_asset_pipeline.sql
-- Asset pipeline queue + variants metadata for retrieval.

BEGIN;

CREATE TABLE IF NOT EXISTS asset_jobs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_asset_jobs_status_created
  ON asset_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS asset_variants (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime TEXT,
  byte_size BIGINT,
  sha256 TEXT,
  pipeline_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (asset_id, variant_type, pipeline_version, object_key)
);

CREATE INDEX IF NOT EXISTS idx_asset_variants_asset
  ON asset_variants(asset_id, created_at DESC);

COMMIT;
