import { getDatabase } from "@/lib/db";
import { createRecord, writeAuditEvent, type Visibility } from "@/lib/records";

export type RegistrationStatus = "unregistered" | "approximate" | "registered" | "verified";

export type WorkspaceRepresentation = {
  id: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  siteId: string | null;
  siteName: string | null;
  physicalObjectId: string | null;
  objectName: string | null;
  parentRepresentationId: string | null;
  name: string;
  representationType: string;
  coordinateSystem: string | null;
  transformMatrix: number[];
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  metadata: Record<string, unknown>;
  acquisitionAt: string | null;
  sourceFormat: string | null;
  webFormat: string | null;
  pointCount: number | null;
  nominalResolutionMm: number | null;
  registrationRmseMm: number | null;
  registrationUncertaintyMm: number | null;
  registrationStatus: RegistrationStatus;
  registrationNotes: string | null;
  opacityDefault: number;
  visibleByDefault: boolean;
  sortOrder: number;
  isPrimary: boolean;
  sourceAssetId: string | null;
  sourceAssetFilename: string | null;
  sourceAssetSize: number | null;
  webAssetId: string | null;
  webAssetFilename: string | null;
  webAssetSize: number | null;
  webAssetMimeType: string | null;
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

const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function matrixFrom(value: unknown) {
  if (Array.isArray(value) && value.length === 16 && value.every((item) => Number.isFinite(Number(item)))) {
    return value.map(Number);
  }
  return [...IDENTITY_MATRIX];
}

function mapRepresentation(row: Record<string, unknown>): WorkspaceRepresentation {
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
    parentRepresentationId: row.parent_representation_id ? String(row.parent_representation_id) : null,
    name: String(row.name),
    representationType: String(row.representation_type),
    coordinateSystem: row.coordinate_system ? String(row.coordinate_system) : null,
    transformMatrix: matrixFrom(row.transform_matrix),
    bounds: bounds && validTuple(bounds.min) && validTuple(bounds.max) ? { min: bounds.min, max: bounds.max } : null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {},
    acquisitionAt: row.acquisition_at ? new Date(String(row.acquisition_at)).toISOString() : null,
    sourceFormat: row.source_format ? String(row.source_format) : null,
    webFormat: row.web_format ? String(row.web_format) : null,
    pointCount: numberOrNull(row.point_count),
    nominalResolutionMm: numberOrNull(row.nominal_resolution_mm),
    registrationRmseMm: numberOrNull(row.registration_rmse_mm),
    registrationUncertaintyMm: numberOrNull(row.registration_uncertainty_mm),
    registrationStatus: (row.registration_status || "unregistered") as RegistrationStatus,
    registrationNotes: row.registration_notes ? String(row.registration_notes) : null,
    opacityDefault: numberOrNull(row.opacity_default) ?? 1,
    visibleByDefault: row.is_visible_by_default !== false,
    sortOrder: Number(row.sort_order || 0),
    isPrimary: Boolean(row.is_primary),
    sourceAssetId: row.source_asset_id ? String(row.source_asset_id) : null,
    sourceAssetFilename: row.source_asset_filename ? String(row.source_asset_filename) : null,
    sourceAssetSize: numberOrNull(row.source_asset_size),
    webAssetId: row.web_asset_id ? String(row.web_asset_id) : null,
    webAssetFilename: row.web_asset_filename ? String(row.web_asset_filename) : null,
    webAssetSize: numberOrNull(row.web_asset_size),
    webAssetMimeType: row.web_asset_mime_type ? String(row.web_asset_mime_type) : null,
    canManage: Boolean(row.can_manage)
  };
}

const representationSelect = `SELECT representation.id,
            representation.project_id,
            project.slug AS project_slug,
            project.name AS project_name,
            representation.site_id,
            site.name AS site_name,
            representation.physical_object_id,
            object.name AS object_name,
            representation.parent_representation_id,
            representation.name,
            representation.representation_type,
            representation.coordinate_system,
            representation.transform_matrix,
            representation.bounds,
            representation.metadata,
            representation.acquisition_at,
            representation.source_format,
            representation.web_format,
            representation.point_count,
            representation.nominal_resolution_mm,
            representation.registration_rmse_mm,
            representation.registration_uncertainty_mm,
            representation.registration_status,
            representation.registration_notes,
            representation.opacity_default,
            representation.is_visible_by_default,
            representation.sort_order,
            representation.is_primary,
            representation.source_asset_id,
            source_asset.original_filename AS source_asset_filename,
            source_asset.file_size AS source_asset_size,
            representation.web_asset_id,
            web_asset.original_filename AS web_asset_filename,
            web_asset.file_size AS web_asset_size,
            web_asset.mime_type AS web_asset_mime_type,
            membership.role,
            membership.role IN ('owner', 'admin') AS can_manage
     FROM archeology_representations representation
     JOIN archeology_projects project ON project.id = representation.project_id
     JOIN archeology_project_memberships membership ON membership.project_id = project.id
     LEFT JOIN archeology_sites site ON site.id = representation.site_id
     LEFT JOIN archeology_physical_objects object ON object.id = representation.physical_object_id
     LEFT JOIN archeology_digital_assets source_asset ON source_asset.id = representation.source_asset_id
     LEFT JOIN archeology_digital_assets web_asset ON web_asset.id = representation.web_asset_id`;

export async function listWorkspaceRepresentations(slug: string, userId: string): Promise<WorkspaceRepresentation[]> {
  const result = await getDatabase().query(
    `${representationSelect}
     WHERE project.slug = $1 AND membership.user_id = $2::uuid
     ORDER BY representation.is_primary DESC, representation.sort_order, representation.created_at`,
    [slug, userId]
  );
  return result.rows.map((row) => mapRepresentation(row));
}

export async function getWorkspaceRepresentation(slug: string, userId: string): Promise<WorkspaceRepresentation | null> {
  return (await listWorkspaceRepresentations(slug, userId))[0] || null;
}

export async function getWorkspaceRepresentationById(representationId: string, userId: string): Promise<WorkspaceRepresentation | null> {
  const result = await getDatabase().query(
    `${representationSelect}
     WHERE representation.id = $1::uuid AND membership.user_id = $2::uuid
     LIMIT 1`,
    [representationId, userId]
  );
  return result.rows[0] ? mapRepresentation(result.rows[0]) : null;
}

export async function createRepresentation(input: {
  projectId: string;
  actorId: string;
  name: string;
  representationType: string;
  siteId?: string | null;
  physicalObjectId?: string | null;
  parentRepresentationId?: string | null;
  acquisitionAt?: string | null;
  coordinateSystem?: string | null;
  sourceFormat?: string | null;
  webFormat?: string | null;
  pointCount?: number | null;
  nominalResolutionMm?: number | null;
  registrationRmseMm?: number | null;
  registrationUncertaintyMm?: number | null;
  registrationStatus?: RegistrationStatus;
  registrationNotes?: string | null;
}) {
  const access = await getDatabase().query(
    `SELECT role FROM archeology_project_memberships WHERE project_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [input.projectId, input.actorId]
  );
  if (!access.rowCount || !["owner", "admin"].includes(String(access.rows[0].role))) throw new Error("Only project owners or admins can add survey representations.");

  const result = await getDatabase().query(
    `INSERT INTO archeology_representations (
       project_id, site_id, physical_object_id, parent_representation_id, name, representation_type,
       acquisition_at, coordinate_system, source_format, web_format, point_count, nominal_resolution_mm,
       registration_rmse_mm, registration_uncertainty_mm, registration_status, registration_notes, created_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6,
       $7::timestamptz, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::uuid
     ) RETURNING id`,
    [
      input.projectId,
      input.siteId || null,
      input.physicalObjectId || null,
      input.parentRepresentationId || null,
      input.name,
      input.representationType,
      input.acquisitionAt || null,
      input.coordinateSystem || null,
      input.sourceFormat || null,
      input.webFormat || null,
      input.pointCount || null,
      input.nominalResolutionMm || null,
      input.registrationRmseMm || null,
      input.registrationUncertaintyMm || null,
      input.registrationStatus || "unregistered",
      input.registrationNotes || null,
      input.actorId
    ]
  );
  const id = String(result.rows[0].id);
  await writeAuditEvent(input.projectId, input.actorId, "representation.created", "representation", id, {
    name: input.name,
    representationType: input.representationType,
    sourceFormat: input.sourceFormat || null,
    webFormat: input.webFormat || null
  });
  return id;
}

export async function updateRepresentationRegistration(input: {
  representationId: string;
  actorId: string;
  transformMatrix: number[];
  registrationStatus: RegistrationStatus;
  registrationRmseMm?: number | null;
  registrationUncertaintyMm?: number | null;
  registrationNotes?: string | null;
  nominalResolutionMm?: number | null;
}) {
  if (input.transformMatrix.length !== 16 || !input.transformMatrix.every(Number.isFinite)) throw new Error("Registration transform must be a 4×4 matrix with 16 finite numbers.");
  const access = await getDatabase().query(
    `SELECT representation.project_id, membership.role
     FROM archeology_representations representation
     JOIN archeology_project_memberships membership ON membership.project_id = representation.project_id AND membership.user_id = $2::uuid
     WHERE representation.id = $1::uuid LIMIT 1`,
    [input.representationId, input.actorId]
  );
  if (!access.rowCount || !["owner", "admin"].includes(String(access.rows[0].role))) throw new Error("Only project owners or admins can update registration.");
  const projectId = String(access.rows[0].project_id);
  await getDatabase().query(
    `UPDATE archeology_representations
     SET transform_matrix = $1::jsonb,
         registration_status = $2,
         registration_rmse_mm = $3,
         registration_uncertainty_mm = $4,
         registration_notes = $5,
         nominal_resolution_mm = $6,
         updated_at = NOW()
     WHERE id = $7::uuid`,
    [
      JSON.stringify(input.transformMatrix),
      input.registrationStatus,
      input.registrationRmseMm ?? null,
      input.registrationUncertaintyMm ?? null,
      input.registrationNotes || null,
      input.nominalResolutionMm ?? null,
      input.representationId
    ]
  );
  await writeAuditEvent(projectId, input.actorId, "representation.registration.updated", "representation", input.representationId, {
    status: input.registrationStatus,
    rmseMm: input.registrationRmseMm ?? null,
    uncertaintyMm: input.registrationUncertaintyMm ?? null
  });
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

async function assertRepresentationManager(representationId: string, projectId: string, actorId: string) {
  const access = await getDatabase().query(
    `SELECT membership.role
     FROM archeology_representations representation
     JOIN archeology_project_memberships membership ON membership.project_id = representation.project_id
     WHERE representation.id = $1::uuid
       AND representation.project_id = $2::uuid
       AND membership.user_id = $3::uuid
     LIMIT 1`,
    [representationId, projectId, actorId]
  );
  if (!access.rowCount || !["owner", "admin"].includes(String(access.rows[0].role))) throw new Error("You cannot manage this representation.");
}

export async function attachWebAssetToRepresentation(input: {
  representationId: string;
  projectId: string;
  assetId: string;
  actorId: string;
  webFormat?: string | null;
  pointCount?: number | null;
}) {
  await assertRepresentationManager(input.representationId, input.projectId, input.actorId);
  await getDatabase().query(
    `UPDATE archeology_representations
     SET web_asset_id = $1::uuid,
         web_format = COALESCE($2, web_format),
         point_count = COALESCE($3, point_count),
         updated_at = NOW()
     WHERE id = $4::uuid`,
    [input.assetId, input.webFormat || null, input.pointCount || null, input.representationId]
  );
  await writeAuditEvent(input.projectId, input.actorId, "representation.web_asset.updated", "representation", input.representationId, {
    assetId: input.assetId,
    webFormat: input.webFormat || null,
    pointCount: input.pointCount || null
  });
}

export async function attachSourceAssetToRepresentation(input: {
  representationId: string;
  projectId: string;
  assetId: string;
  actorId: string;
  sourceFormat?: string | null;
}) {
  await assertRepresentationManager(input.representationId, input.projectId, input.actorId);
  await getDatabase().query(
    `UPDATE archeology_representations
     SET source_asset_id = $1::uuid,
         source_format = COALESCE($2, source_format),
         updated_at = NOW()
     WHERE id = $3::uuid`,
    [input.assetId, input.sourceFormat || null, input.representationId]
  );
  await writeAuditEvent(input.projectId, input.actorId, "representation.source_asset.updated", "representation", input.representationId, {
    assetId: input.assetId,
    sourceFormat: input.sourceFormat || null
  });
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
