import { getDatabase } from "@/lib/db";
import { createRecord, writeAuditEvent, type Visibility } from "@/lib/records";

export type WorkspaceRepresentation = {
  id: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  siteId: string | null;
  siteName: string | null;
  physicalObjectId: string | null;
  objectName: string | null;
  name: string;
  representationType: string;
  coordinateSystem: string | null;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  metadata: Record<string, unknown>;
  webAssetId: string | null;
  webAssetFilename: string | null;
  webAssetSize: number | null;
  canManage: boolean;
};

export type SpatialAnnotation = {
  id: string;
  recordId: string;
  representationId: string;
  title: string | null;
  description: string | null;
  visibility: Visibility;
  status: string;
  authorEmail: string;
  authorName: string | null;
  x: number;
  y: number;
  z: number;
  label: string | null;
  siteId: string | null;
  siteName: string | null;
  physicalObjectId: string | null;
  objectName: string | null;
};

export async function getWorkspaceRepresentation(slug: string, userId: string): Promise<WorkspaceRepresentation | null> {
  const result = await getDatabase().query(
    `SELECT representation.id,
            representation.project_id,
            project.slug AS project_slug,
            project.name AS project_name,
            representation.site_id,
            site.name AS site_name,
            representation.physical_object_id,
            object.name AS object_name,
            representation.name,
            representation.representation_type,
            representation.coordinate_system,
            representation.bounds,
            representation.metadata,
            representation.web_asset_id,
            web_asset.original_filename AS web_asset_filename,
            web_asset.file_size AS web_asset_size,
            membership.role,
            membership.role IN ('owner', 'admin') AS can_manage
     FROM archeology_representations representation
     JOIN archeology_projects project ON project.id = representation.project_id
     JOIN archeology_project_memberships membership ON membership.project_id = project.id AND membership.user_id = $2::uuid
     LEFT JOIN archeology_sites site ON site.id = representation.site_id
     LEFT JOIN archeology_physical_objects object ON object.id = representation.physical_object_id
     LEFT JOIN archeology_digital_assets web_asset ON web_asset.id = representation.web_asset_id
     WHERE project.slug = $1
     ORDER BY representation.is_primary DESC, representation.created_at
     LIMIT 1`,
    [slug, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const bounds = row.bounds && typeof row.bounds === "object" ? row.bounds as { min?: unknown; max?: unknown } : null;
  const validTuple = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number");
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    projectSlug: String(row.project_slug),
    projectName: String(row.project_name),
    siteId: row.site_id ? String(row.site_id) : null,
    siteName: row.site_name ? String(row.site_name) : null,
    physicalObjectId: row.physical_object_id ? String(row.physical_object_id) : null,
    objectName: row.object_name ? String(row.object_name) : null,
    name: String(row.name),
    representationType: String(row.representation_type),
    coordinateSystem: row.coordinate_system ? String(row.coordinate_system) : null,
    bounds: bounds && validTuple(bounds.min) && validTuple(bounds.max) ? { min: bounds.min, max: bounds.max } : null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {},
    webAssetId: row.web_asset_id ? String(row.web_asset_id) : null,
    webAssetFilename: row.web_asset_filename ? String(row.web_asset_filename) : null,
    webAssetSize: row.web_asset_size === null || row.web_asset_size === undefined ? null : Number(row.web_asset_size),
    canManage: Boolean(row.can_manage)
  };
}

export async function listSpatialAnnotations(projectId: string, userId: string): Promise<SpatialAnnotation[]> {
  const result = await getDatabase().query(
    `SELECT annotation.id,
            annotation.record_id,
            annotation.representation_id,
            annotation.label,
            ST_X(annotation.local_point) AS x,
            ST_Y(annotation.local_point) AS y,
            ST_Z(annotation.local_point) AS z,
            record.title,
            record.description,
            record.visibility,
            record.status,
            author.email AS author_email,
            author.display_name AS author_name,
            record.site_id,
            site.name AS site_name,
            record.physical_object_id,
            object.name AS object_name
     FROM archeology_spatial_annotations annotation
     JOIN archeology_records record ON record.id = annotation.record_id
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
     JOIN archeology_users author ON author.id = record.author_id
     LEFT JOIN archeology_sites site ON site.id = record.site_id
     LEFT JOIN archeology_physical_objects object ON object.id = record.physical_object_id
     WHERE annotation.project_id = $1::uuid
       AND (record.visibility <> 'private' OR record.author_id = $2::uuid)
     ORDER BY record.acquisition_at DESC, annotation.created_at DESC`,
    [projectId, userId]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    recordId: String(row.record_id),
    representationId: String(row.representation_id),
    title: row.title ? String(row.title) : null,
    description: row.description ? String(row.description) : null,
    visibility: row.visibility as Visibility,
    status: String(row.status),
    authorEmail: String(row.author_email),
    authorName: row.author_name ? String(row.author_name) : null,
    x: Number(row.x),
    y: Number(row.y),
    z: Number(row.z),
    label: row.label ? String(row.label) : null,
    siteId: row.site_id ? String(row.site_id) : null,
    siteName: row.site_name ? String(row.site_name) : null,
    physicalObjectId: row.physical_object_id ? String(row.physical_object_id) : null,
    objectName: row.object_name ? String(row.object_name) : null
  }));
}

export async function createSpatialObservation(input: {
  projectId: string;
  representationId: string;
  siteId?: string | null;
  physicalObjectId?: string | null;
  authorId: string;
  title?: string | null;
  description?: string | null;
  visibility: Visibility;
  x: number;
  y: number;
  z: number;
}) {
  const access = await getDatabase().query(
    `SELECT membership.role
     FROM archeology_representations representation
     JOIN archeology_project_memberships membership ON membership.project_id = representation.project_id
     WHERE representation.id = $1::uuid
       AND representation.project_id = $2::uuid
       AND membership.user_id = $3::uuid
     LIMIT 1`,
    [input.representationId, input.projectId, input.authorId]
  );
  if (!access.rowCount) throw new Error("You do not have access to this 3D representation.");
  if (![input.x, input.y, input.z].every(Number.isFinite)) throw new Error("The spatial anchor is invalid.");

  const recordId = await createRecord({
    projectId: input.projectId,
    siteId: input.siteId || null,
    physicalObjectId: input.physicalObjectId || null,
    recordType: "observation",
    title: input.title || null,
    description: input.description || null,
    visibility: input.visibility,
    authorId: input.authorId
  });

  const result = await getDatabase().query(
    `INSERT INTO archeology_spatial_annotations (
       project_id, representation_id, record_id, site_id, physical_object_id,
       local_point, label, created_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
       ST_SetSRID(ST_MakePoint($6, $7, $8), 0), $9, $10::uuid
     )
     RETURNING id`,
    [
      input.projectId,
      input.representationId,
      recordId,
      input.siteId || null,
      input.physicalObjectId || null,
      input.x,
      input.y,
      input.z,
      input.title || null,
      input.authorId
    ]
  );
  const annotationId = String(result.rows[0].id);
  await writeAuditEvent(input.projectId, input.authorId, "spatial_annotation.created", "spatial_annotation", annotationId, {
    recordId,
    representationId: input.representationId,
    point: [input.x, input.y, input.z]
  });
  return { recordId, annotationId };
}

export async function getSpatialAnchorForRecord(recordId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT annotation.id,
            annotation.representation_id,
            project.slug AS project_slug,
            representation.name AS representation_name,
            ST_X(annotation.local_point) AS x,
            ST_Y(annotation.local_point) AS y,
            ST_Z(annotation.local_point) AS z
     FROM archeology_spatial_annotations annotation
     JOIN archeology_records record ON record.id = annotation.record_id
     JOIN archeology_projects project ON project.id = record.project_id
     JOIN archeology_representations representation ON representation.id = annotation.representation_id
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
     WHERE record.id = $1::uuid
       AND (record.visibility <> 'private' OR record.author_id = $2::uuid)
     LIMIT 1`,
    [recordId, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    representationId: String(row.representation_id),
    projectSlug: String(row.project_slug),
    representationName: String(row.representation_name),
    point: [Number(row.x), Number(row.y), Number(row.z)] as [number, number, number]
  };
}

export async function attachWebAssetToRepresentation(input: {
  representationId: string;
  projectId: string;
  assetId: string;
  actorId: string;
}) {
  const access = await getDatabase().query(
    `SELECT membership.role
     FROM archeology_representations representation
     JOIN archeology_project_memberships membership ON membership.project_id = representation.project_id
     WHERE representation.id = $1::uuid
       AND representation.project_id = $2::uuid
       AND membership.user_id = $3::uuid
     LIMIT 1`,
    [input.representationId, input.projectId, input.actorId]
  );
  if (!access.rowCount || !["owner", "admin"].includes(String(access.rows[0].role))) throw new Error("You cannot replace the web model for this project.");
  await getDatabase().query(
    `UPDATE archeology_representations
     SET web_asset_id = $1::uuid, updated_at = NOW()
     WHERE id = $2::uuid`,
    [input.assetId, input.representationId]
  );
  await writeAuditEvent(input.projectId, input.actorId, "representation.web_asset.updated", "representation", input.representationId, { assetId: input.assetId });
}

export async function getRepresentationWebAsset(representationId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT asset.r2_key, asset.mime_type, asset.original_filename, asset.file_size
     FROM archeology_representations representation
     JOIN archeology_project_memberships membership ON membership.project_id = representation.project_id AND membership.user_id = $2::uuid
     JOIN archeology_digital_assets asset ON asset.id = representation.web_asset_id
     WHERE representation.id = $1::uuid
     LIMIT 1`,
    [representationId, userId]
  );
  return result.rows[0] || null;
}
