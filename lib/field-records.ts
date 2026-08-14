import { getDatabase } from "@/lib/db";
import { createRecord, writeAuditEvent, type RecordType, type Visibility } from "@/lib/records";
import type { TranscriptionStatus } from "@/lib/transcription";

export type FieldCaptureLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
};

export async function createFieldRecord(input: {
  projectId: string;
  projectSlug: string;
  siteId?: string | null;
  physicalObjectId?: string | null;
  recordType: RecordType;
  title?: string | null;
  description?: string | null;
  additionalInformation?: string | null;
  acquisitionAt?: string | null;
  visibility: Visibility;
  authorId: string;
  location?: FieldCaptureLocation | null;
  metadata?: Record<string, unknown>;
  transcriptionStatus?: TranscriptionStatus;
}) {
  const recordId = await createRecord({
    projectId: input.projectId,
    siteId: input.siteId || null,
    physicalObjectId: input.physicalObjectId || null,
    recordType: input.recordType,
    title: input.title || null,
    description: input.description || null,
    additionalInformation: input.additionalInformation || null,
    acquisitionAt: input.acquisitionAt || null,
    visibility: input.visibility,
    authorId: input.authorId
  });

  const location = input.location;
  await getDatabase().query(
    `UPDATE archeology_records
     SET captured_in_field = TRUE,
         capture_location = CASE
           WHEN $1::double precision IS NULL OR $2::double precision IS NULL THEN NULL
           ELSE ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography
         END,
         capture_accuracy_m = $3::double precision,
         transcription_status = $4,
         metadata = metadata || $5::jsonb,
         updated_at = NOW()
     WHERE id = $6::uuid`,
    [
      location?.latitude ?? null,
      location?.longitude ?? null,
      location?.accuracyMeters ?? null,
      input.transcriptionStatus || "not_requested",
      JSON.stringify({
        fieldCapture: {
          source: "field",
          projectSlug: input.projectSlug,
          capturedAt: input.acquisitionAt || new Date().toISOString()
        },
        ...(input.metadata || {})
      }),
      recordId
    ]
  );

  await writeAuditEvent(input.projectId, input.authorId, "field.capture", "record", recordId, {
    recordType: input.recordType,
    hasLocation: Boolean(location),
    transcriptionStatus: input.transcriptionStatus || "not_requested"
  });

  return recordId;
}

export async function updateFieldTranscription(input: {
  recordId: string;
  projectId: string;
  actorId: string;
  status: TranscriptionStatus;
  transcription?: string | null;
  provider?: string | null;
  model?: string | null;
  error?: string | null;
}) {
  await getDatabase().query(
    `UPDATE archeology_records
     SET transcription = $1,
         transcription_status = $2,
         metadata = metadata || $3::jsonb,
         updated_at = NOW()
     WHERE id = $4::uuid`,
    [
      input.transcription || null,
      input.status,
      JSON.stringify({
        transcription: {
          provider: input.provider || null,
          model: input.model || null,
          error: input.error || null,
          updatedAt: new Date().toISOString()
        }
      }),
      input.recordId
    ]
  );

  await writeAuditEvent(input.projectId, input.actorId, `transcription.${input.status}`, "record", input.recordId, {
    provider: input.provider || null,
    model: input.model || null,
    error: input.error || null
  });
}

export async function listRecentFieldRecordsForUser(userId: string, limit = 12) {
  const result = await getDatabase().query(
    `SELECT record.id,
            record.record_type,
            record.title,
            record.description,
            record.acquisition_at,
            record.visibility,
            record.transcription_status,
            record.transcription,
            project.slug AS project_slug,
            project.name AS project_name,
            site.name AS site_name,
            object.name AS object_name,
            ST_Y(record.capture_location::geometry) AS latitude,
            ST_X(record.capture_location::geometry) AS longitude,
            record.capture_accuracy_m
     FROM archeology_records record
     JOIN archeology_projects project ON project.id = record.project_id
     JOIN archeology_project_memberships membership
       ON membership.project_id = record.project_id AND membership.user_id = $1::uuid
     LEFT JOIN archeology_sites site ON site.id = record.site_id
     LEFT JOIN archeology_physical_objects object ON object.id = record.physical_object_id
     WHERE record.captured_in_field = TRUE
       AND (record.visibility <> 'private' OR record.author_id = $1::uuid)
     ORDER BY record.acquisition_at DESC, record.created_at DESC
     LIMIT $2`,
    [userId, Math.max(1, Math.min(limit, 50))]
  );
  return result.rows;
}

export async function getFieldMetadataForRecord(recordId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT record.captured_in_field,
            record.transcription,
            record.transcription_status,
            record.capture_accuracy_m,
            ST_Y(record.capture_location::geometry) AS latitude,
            ST_X(record.capture_location::geometry) AS longitude,
            record.metadata
     FROM archeology_records record
     JOIN archeology_project_memberships membership
       ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
     WHERE record.id = $1::uuid
       AND (record.visibility <> 'private' OR record.author_id = $2::uuid)
     LIMIT 1`,
    [recordId, userId]
  );
  return result.rows[0] || null;
}
