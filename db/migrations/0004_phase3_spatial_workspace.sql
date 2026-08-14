CREATE TABLE IF NOT EXISTS archeology_representations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  site_id UUID REFERENCES archeology_sites(id) ON DELETE SET NULL,
  physical_object_id UUID REFERENCES archeology_physical_objects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  representation_type TEXT NOT NULL DEFAULT 'photogrammetry' CHECK (representation_type IN ('photogrammetry', 'mesh', 'point_cloud', 'other')),
  source_asset_id UUID REFERENCES archeology_digital_assets(id) ON DELETE SET NULL,
  web_asset_id UUID REFERENCES archeology_digital_assets(id) ON DELETE SET NULL,
  coordinate_system TEXT,
  transform_matrix JSONB NOT NULL DEFAULT '[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]'::jsonb,
  bounds JSONB,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES archeology_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS archeology_representations_project_idx ON archeology_representations(project_id, is_primary DESC, created_at);

CREATE TABLE IF NOT EXISTS archeology_spatial_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES archeology_projects(id) ON DELETE CASCADE,
  representation_id UUID NOT NULL REFERENCES archeology_representations(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES archeology_records(id) ON DELETE CASCADE,
  site_id UUID REFERENCES archeology_sites(id) ON DELETE SET NULL,
  physical_object_id UUID REFERENCES archeology_physical_objects(id) ON DELETE SET NULL,
  local_point GEOMETRY(PointZ) NOT NULL,
  label TEXT,
  created_by UUID NOT NULL REFERENCES archeology_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(record_id, representation_id)
);

CREATE INDEX IF NOT EXISTS archeology_spatial_annotations_project_idx ON archeology_spatial_annotations(project_id);
CREATE INDEX IF NOT EXISTS archeology_spatial_annotations_record_idx ON archeology_spatial_annotations(record_id);
CREATE INDEX IF NOT EXISTS archeology_spatial_annotations_point_idx ON archeology_spatial_annotations USING GIST(local_point);

INSERT INTO archeology_representations (
  project_id,
  site_id,
  physical_object_id,
  name,
  representation_type,
  coordinate_system,
  bounds,
  is_primary,
  metadata
)
SELECT p.id,
       s.id,
       o.id,
       'Casignana 2017 photogrammetry',
       'photogrammetry',
       'Local model coordinates; no CRS supplied with source archive',
       '{"min":[-11.640594,-3.011280,-7.424555],"max":[9.564928,3.391595,7.526895]}'::jsonb,
       TRUE,
       '{"sourceFormat":"OBJ","sourceVertices":244639,"sourceTriangles":486261,"texture":"8000x8000 JPEG","webDerivative":"GLB","sourceArchiveMetadata":"No explicit CRS or acquisition metadata supplied"}'::jsonb
FROM archeology_projects p
JOIN archeology_sites s ON s.project_id = p.id AND s.code = 'ROOM-01'
JOIN archeology_physical_objects o ON o.site_id = s.id AND o.code = 'ROOM-01'
WHERE p.slug = 'casignana'
  AND NOT EXISTS (
    SELECT 1 FROM archeology_representations r
    WHERE r.project_id = p.id AND r.name = 'Casignana 2017 photogrammetry'
  );
