import { getDatabase } from "@/lib/db";
import { writeAuditEvent } from "@/lib/records";

export type RecordRelationshipType = "addresses" | "before" | "after" | "supports" | "follows" | "related";

const RELATIONSHIP_TYPES = new Set<RecordRelationshipType>(["addresses", "before", "after", "supports", "follows", "related"]);

export async function assertRecordEditor(recordId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT record.id,
            record.project_id,
            record.site_id,
            record.physical_object_id,
            record.visibility,
            record.author_id,
            project.slug AS project_slug,
            membership.role
     FROM archeology_records record
     JOIN archeology_projects project ON project.id = record.project_id
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
     WHERE record.id = $1::uuid
     LIMIT 1`,
    [recordId, userId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Record not found.");
  const canEdit = String(row.author_id) === userId || ["owner", "admin"].includes(String(row.role));
  if (!canEdit) throw new Error("You cannot edit this record.");
  return {
    recordId: String(row.id),
    projectId: String(row.project_id),
    projectSlug: String(row.project_slug),
    siteId: row.site_id ? String(row.site_id) : null,
    physicalObjectId: row.physical_object_id ? String(row.physical_object_id) : null,
    visibility: String(row.visibility)
  };
}

export async function listRecordAssetsForUser(recordId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT asset.id,
            asset.original_filename,
            asset.mime_type,
            asset.format,
            asset.r2_key,
            asset.checksum_sha256,
            asset.file_size,
            asset.created_at,
            link.role
     FROM archeology_records record
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
     JOIN archeology_record_assets link ON link.record_id = record.id
     JOIN archeology_digital_assets asset ON asset.id = link.asset_id
     WHERE record.id = $1::uuid
       AND (record.visibility <> 'private' OR record.author_id = $2::uuid)
     ORDER BY CASE link.role WHEN 'original' THEN 0 WHEN 'attachment' THEN 1 WHEN 'preview' THEN 2 ELSE 3 END,
              asset.created_at`,
    [recordId, userId]
  );
  return result.rows;
}

export async function listRecordLinksForUser(recordId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT relationship.source_record_id,
            relationship.target_record_id,
            relationship.relationship_type,
            relationship.created_at,
            CASE WHEN relationship.source_record_id = $1::uuid THEN 'outgoing' ELSE 'incoming' END AS direction,
            related.id AS related_record_id,
            related.record_type AS related_record_type,
            related.title AS related_title,
            related.description AS related_description,
            related.acquisition_at AS related_acquisition_at,
            related.visibility AS related_visibility,
            author.email AS related_author_email,
            author.display_name AS related_author_name
     FROM archeology_record_relationships relationship
     JOIN archeology_records current_record ON current_record.id = $1::uuid
     JOIN archeology_project_memberships current_membership ON current_membership.project_id = current_record.project_id AND current_membership.user_id = $2::uuid
     JOIN archeology_records related ON related.id = CASE
       WHEN relationship.source_record_id = $1::uuid THEN relationship.target_record_id
       ELSE relationship.source_record_id
     END
     JOIN archeology_project_memberships related_membership ON related_membership.project_id = related.project_id AND related_membership.user_id = $2::uuid
     JOIN archeology_users author ON author.id = related.author_id
     WHERE (relationship.source_record_id = $1::uuid OR relationship.target_record_id = $1::uuid)
       AND (current_record.visibility <> 'private' OR current_record.author_id = $2::uuid)
       AND (related.visibility <> 'private' OR related.author_id = $2::uuid)
     ORDER BY relationship.created_at DESC`,
    [recordId, userId]
  );
  return result.rows;
}

export async function listRecordLinkCandidates(recordId: string, userId: string, limit = 120) {
  const context = await assertRecordEditor(recordId, userId);
  const result = await getDatabase().query(
    `SELECT record.id,
            record.record_type,
            record.title,
            record.description,
            record.acquisition_at,
            record.visibility,
            site.name AS site_name,
            object.name AS object_name,
            author.email AS author_email,
            author.display_name AS author_name
     FROM archeology_records record
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $3::uuid
     JOIN archeology_users author ON author.id = record.author_id
     LEFT JOIN archeology_sites site ON site.id = record.site_id
     LEFT JOIN archeology_physical_objects object ON object.id = record.physical_object_id
     WHERE record.project_id = $1::uuid
       AND record.id <> $2::uuid
       AND (record.visibility <> 'private' OR record.author_id = $3::uuid)
     ORDER BY record.acquisition_at DESC, record.created_at DESC
     LIMIT $4`,
    [context.projectId, recordId, userId, limit]
  );
  return result.rows;
}

export async function createRecordLink(input: {
  recordId: string;
  targetRecordId: string;
  relationshipType: RecordRelationshipType;
  actorId: string;
}) {
  if (!RELATIONSHIP_TYPES.has(input.relationshipType)) throw new Error("Invalid relationship type.");
  if (input.recordId === input.targetRecordId) throw new Error("A record cannot link to itself.");
  const context = await assertRecordEditor(input.recordId, input.actorId);
  const target = await getDatabase().query(
    `SELECT record.id
     FROM archeology_records record
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $3::uuid
     WHERE record.id = $1::uuid
       AND record.project_id = $2::uuid
       AND (record.visibility <> 'private' OR record.author_id = $3::uuid)
     LIMIT 1`,
    [input.targetRecordId, context.projectId, input.actorId]
  );
  if (!target.rowCount) throw new Error("The selected linked record is not available in this project.");

  await getDatabase().query(
    `INSERT INTO archeology_record_relationships (source_record_id, target_record_id, relationship_type, created_by)
     VALUES ($1::uuid, $2::uuid, $3, $4::uuid)
     ON CONFLICT (source_record_id, target_record_id, relationship_type) DO NOTHING`,
    [input.recordId, input.targetRecordId, input.relationshipType, input.actorId]
  );
  await writeAuditEvent(context.projectId, input.actorId, "record.relationship.added", "record", input.recordId, {
    targetRecordId: input.targetRecordId,
    relationshipType: input.relationshipType
  });
}

export async function removeRecordLink(input: {
  recordId: string;
  targetRecordId: string;
  relationshipType: RecordRelationshipType;
  actorId: string;
}) {
  if (!RELATIONSHIP_TYPES.has(input.relationshipType)) throw new Error("Invalid relationship type.");
  const context = await assertRecordEditor(input.recordId, input.actorId);
  await getDatabase().query(
    `DELETE FROM archeology_record_relationships
     WHERE ((source_record_id = $1::uuid AND target_record_id = $2::uuid)
         OR (source_record_id = $2::uuid AND target_record_id = $1::uuid))
       AND relationship_type = $3`,
    [input.recordId, input.targetRecordId, input.relationshipType]
  );
  await writeAuditEvent(context.projectId, input.actorId, "record.relationship.removed", "record", input.recordId, {
    targetRecordId: input.targetRecordId,
    relationshipType: input.relationshipType
  });
}
