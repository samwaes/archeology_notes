CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS archeology_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hupla_user_id UUID,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS archeology_users_hupla_user_id_idx
  ON archeology_users (hupla_user_id)
  WHERE hupla_user_id IS NOT NULL;
