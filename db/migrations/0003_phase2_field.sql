ALTER TABLE archeology_records
  ADD COLUMN IF NOT EXISTS captured_in_field BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS capture_location GEOGRAPHY(Point, 4326),
  ADD COLUMN IF NOT EXISTS capture_accuracy_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS transcription_status TEXT NOT NULL DEFAULT 'not_requested';

DO $$
BEGIN
  ALTER TABLE archeology_records
    ADD CONSTRAINT archeology_records_transcription_status_check
    CHECK (transcription_status IN ('not_requested', 'pending', 'completed', 'failed', 'disabled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS archeology_records_capture_location_idx
  ON archeology_records USING GIST (capture_location);

CREATE INDEX IF NOT EXISTS archeology_records_field_idx
  ON archeology_records (project_id, acquisition_at DESC)
  WHERE captured_in_field = TRUE;
