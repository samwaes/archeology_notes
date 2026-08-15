ALTER TABLE archeology_records DROP CONSTRAINT IF EXISTS archeology_records_record_type_check;
ALTER TABLE archeology_records
  ADD CONSTRAINT archeology_records_record_type_check
  CHECK (record_type IN ('note', 'photo', 'document', 'observation', 'measurement', 'voice', 'condition', 'intervention'));

CREATE TABLE IF NOT EXISTS archeology_condition_assessments (
  record_id UUID PRIMARY KEY REFERENCES archeology_records(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  extent TEXT,
  treatment_priority TEXT NOT NULL DEFAULT 'monitor' CHECK (treatment_priority IN ('monitor', 'routine', 'urgent', 'emergency')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES archeology_users(id)
);

CREATE INDEX IF NOT EXISTS archeology_condition_category_idx ON archeology_condition_assessments(category, severity, active);

CREATE TABLE IF NOT EXISTS archeology_conservation_interventions (
  record_id UUID PRIMARY KEY REFERENCES archeology_records(id) ON DELETE CASCADE,
  condition_record_id UUID REFERENCES archeology_records(id) ON DELETE SET NULL,
  intervention_type TEXT NOT NULL,
  method TEXT,
  materials TEXT,
  outcome TEXT,
  intervention_status TEXT NOT NULL DEFAULT 'planned' CHECK (intervention_status IN ('planned', 'in_progress', 'completed', 'monitoring')),
  intervention_date DATE,
  created_by UUID NOT NULL REFERENCES archeology_users(id)
);

CREATE TABLE IF NOT EXISTS archeology_record_relationships (
  source_record_id UUID NOT NULL REFERENCES archeology_records(id) ON DELETE CASCADE,
  target_record_id UUID NOT NULL REFERENCES archeology_records(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('addresses', 'before', 'after', 'supports', 'follows', 'related')),
  created_by UUID REFERENCES archeology_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_record_id, target_record_id, relationship_type),
  CHECK (source_record_id <> target_record_id)
);

CREATE TABLE IF NOT EXISTS archeology_capture_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('note', 'observation', 'measurement', 'condition', 'intervention')),
  default_visibility TEXT NOT NULL DEFAULT 'project' CHECK (default_visibility IN ('private', 'project', 'public')),
  template JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES archeology_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS archeology_sync_receipts (
  client_capture_id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES archeology_records(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES archeology_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS archeology_records_search_idx ON archeology_records USING GIN (
  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(additional_information,'') || ' ' || coalesce(filter_name,'') || ' ' || coalesce(enhancement,''))
);

INSERT INTO archeology_capture_templates (project_id, name, record_type, default_visibility, template, created_by)
SELECT p.id,
       'Condition assessment',
       'condition',
       'project',
       '{"category":"surface loss","severity":"moderate","confidence":"medium","treatmentPriority":"monitor"}'::jsonb,
       membership.user_id
FROM archeology_projects p
JOIN LATERAL (
  SELECT user_id FROM archeology_project_memberships m
  WHERE m.project_id = p.id AND m.role IN ('owner','admin')
  ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.created_at
  LIMIT 1
) membership ON TRUE
WHERE p.slug = 'casignana'
ON CONFLICT (project_id, name) DO NOTHING;
