ALTER TABLE archeology_representations
  ADD COLUMN IF NOT EXISTS parent_representation_id UUID REFERENCES archeology_representations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acquisition_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_format TEXT,
  ADD COLUMN IF NOT EXISTS web_format TEXT,
  ADD COLUMN IF NOT EXISTS point_count BIGINT,
  ADD COLUMN IF NOT EXISTS nominal_resolution_mm DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS registration_rmse_mm DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS registration_uncertainty_mm DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'unregistered',
  ADD COLUMN IF NOT EXISTS registration_notes TEXT,
  ADD COLUMN IF NOT EXISTS opacity_default DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_visible_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'archeology_representations_registration_status_check'
  ) THEN
    ALTER TABLE archeology_representations
      ADD CONSTRAINT archeology_representations_registration_status_check
      CHECK (registration_status IN ('unregistered', 'approximate', 'registered', 'verified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'archeology_representations_opacity_default_check'
  ) THEN
    ALTER TABLE archeology_representations
      ADD CONSTRAINT archeology_representations_opacity_default_check
      CHECK (opacity_default >= 0 AND opacity_default <= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS archeology_representations_parent_idx
  ON archeology_representations(parent_representation_id);

CREATE INDEX IF NOT EXISTS archeology_representations_layer_order_idx
  ON archeology_representations(project_id, sort_order, created_at);

UPDATE archeology_representations
SET source_format = COALESCE(source_format, NULLIF(LOWER(metadata->>'sourceFormat'), '')),
    web_format = COALESCE(web_format, NULLIF(LOWER(metadata->>'webDerivative'), '')),
    point_count = COALESCE(point_count, NULLIF(metadata->>'pointCount', '')::bigint),
    registration_status = CASE
      WHEN registration_status = 'unregistered' AND representation_type IN ('photogrammetry', 'mesh') THEN 'registered'
      ELSE registration_status
    END,
    registration_notes = COALESCE(registration_notes,
      CASE
        WHEN coordinate_system ILIKE '%no CRS%' THEN 'Registered only in the supplied local model coordinate frame; external CRS and survey accuracy are unknown.'
        ELSE NULL
      END)
WHERE TRUE;

UPDATE archeology_representations
SET source_format = 'obj',
    web_format = 'glb',
    nominal_resolution_mm = NULL,
    registration_rmse_mm = NULL,
    registration_uncertainty_mm = NULL,
    registration_status = 'registered',
    registration_notes = 'Identity registration in the supplied Casignana local model frame. No external CRS or survey registration uncertainty was supplied.'
WHERE name = 'Casignana 2017 photogrammetry';
