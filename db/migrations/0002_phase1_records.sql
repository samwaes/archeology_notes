CREATE TABLE IF NOT EXISTS archeology_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES archeology_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archeology_project_memberships (
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES archeology_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('owner', 'admin', 'contributor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS archeology_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  gps_location GEOGRAPHY(Point, 4326),
  created_by UUID REFERENCES archeology_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archeology_physical_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES archeology_sites(id) ON DELETE CASCADE,
  parent_object_id UUID REFERENCES archeology_physical_objects(id) ON DELETE SET NULL,
  object_type TEXT NOT NULL DEFAULT 'feature',
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  local_geometry GEOMETRY(GeometryZ),
  created_by UUID REFERENCES archeology_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archeology_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  site_id UUID REFERENCES archeology_sites(id) ON DELETE SET NULL,
  physical_object_id UUID REFERENCES archeology_physical_objects(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('note', 'photo', 'document', 'observation', 'measurement', 'voice')),
  title TEXT,
  description TEXT,
  filter_name TEXT,
  enhancement TEXT,
  additional_information TEXT,
  acquisition_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'project', 'public')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'verified')),
  author_id UUID NOT NULL REFERENCES archeology_users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS archeology_records_project_idx ON archeology_records(project_id, acquisition_at DESC);
CREATE INDEX IF NOT EXISTS archeology_records_author_idx ON archeology_records(author_id, acquisition_at DESC);
CREATE INDEX IF NOT EXISTS archeology_records_object_idx ON archeology_records(physical_object_id);

CREATE TABLE IF NOT EXISTS archeology_digital_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  format TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  checksum_sha256 TEXT,
  file_size BIGINT,
  parent_asset_id UUID REFERENCES archeology_digital_assets(id) ON DELETE SET NULL,
  derivation_type TEXT,
  created_by UUID NOT NULL REFERENCES archeology_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archeology_record_assets (
  record_id UUID NOT NULL REFERENCES archeology_records(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES archeology_digital_assets(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'original' CHECK (role IN ('original', 'derivative', 'attachment', 'preview')),
  PRIMARY KEY (record_id, asset_id)
);

CREATE TABLE IF NOT EXISTS archeology_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS archeology_record_tags (
  record_id UUID NOT NULL REFERENCES archeology_records(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES archeology_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);

CREATE TABLE IF NOT EXISTS archeology_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES archeology_projects(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES archeology_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO archeology_projects (slug, name, description)
VALUES ('casignana', 'Casignana', 'First real Archeology Notes pilot dataset based on the supplied Casignana photogrammetry model.')
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW();

INSERT INTO archeology_sites (project_id, code, name, description)
SELECT p.id, 'ROOM-01', 'Casignana room', 'Primary pilot scene for records, field observations and later spatial annotation.'
FROM archeology_projects p
WHERE p.slug = 'casignana'
  AND NOT EXISTS (
    SELECT 1 FROM archeology_sites s WHERE s.project_id = p.id AND s.code = 'ROOM-01'
  );

INSERT INTO archeology_physical_objects (site_id, object_type, code, name, description)
SELECT s.id, 'scene', 'ROOM-01', 'Casignana room', 'Physical scene represented by the first Casignana photogrammetry model.'
FROM archeology_sites s
JOIN archeology_projects p ON p.id = s.project_id
WHERE p.slug = 'casignana' AND s.code = 'ROOM-01'
  AND NOT EXISTS (
    SELECT 1 FROM archeology_physical_objects o WHERE o.site_id = s.id AND o.code = 'ROOM-01'
  );
