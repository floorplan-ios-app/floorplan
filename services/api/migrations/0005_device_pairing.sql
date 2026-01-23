-- 0005_device_pairing.sql
-- Device pairing codes + device revocation support.

BEGIN;

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_type TEXT;

CREATE TABLE IF NOT EXISTS pairing_codes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  device_name TEXT,
  device_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_user
  ON pairing_codes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_expires
  ON pairing_codes(expires_at);

COMMIT;
