import { getDatabase } from "@/lib/db";

export type Visibility = "private" | "project" | "public";
export type RecordType = "note" | "photo" | "document" | "observation" | "measurement" | "voice";
export type RecordStatus = "draft" | "reviewed" | "verified";
export type ProjectRole = "owner" | "admin" | "contributor" | "viewer";

export type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  role: string;
  siteCount: number;
  recordCount: number;
};

export type CatalogRecord = {
  id: string;
  recordType: RecordType;
  title: string | null;
  description: string | null;
  filterName: string | null;
  enhancement: string | null;
  additionalInformation: string | null;
  acquisitionAt: string;
  visibility: Visibility;
  status: RecordStatus;
  authorId: string;
  authorEmail: string;
  authorName: string | null;
  siteId: string | null;
  siteName: string | null;
  physicalObjectId: string | null;
  objectName: string | null;
  assetId: string | null;
  assetFilename: string | null;
  assetMimeType: string | null;
  assetR2Key: string | null;
  createdAt: string;
  canEdit: boolean;
};

export async function ensurePilotMembership(userId: string) {
  await getDatabase().query(
    `INSERT INTO archeology_project_memberships (project_id, user_id, role)
     SELECT p.id,
            $1::uuid,
            CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM archeology_project_memberships existing WHERE existing.project_id = p.id
              ) THEN 'owner'
              ELSE 'contributor'
            END
     FROM archeology_projects p
     WHERE p.slug = 'casignana'
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [userId]
  );
}

export async function listProjectsForUser(userId: string): Promise<ProjectSummary[]> {
  const result = await getDatabase().query(
    `SELECT p.id,
            p.slug,
            p.name,
            p.description,
            membership.role,
            COUNT(DISTINCT site.id)::int AS site_count,
            COUNT(DISTINCT record.id)::int AS record_count
     FROM archeology_project_memberships membership
     JOIN archeology_projects p ON p.id = membership.project_id
     LEFT JOIN archeology_sites site ON site.project_id = p.id
     LEFT JOIN archeology_records record ON record.project_id = p.id
       AND (record.visibility <> 'private' OR record.author_id = $1::uuid)
     WHERE membership.user_id = $1::uuid
     GROUP BY p.id, membership.role
     ORDER BY p.name`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    role: String(row.role),
    siteCount: Number(row.site_count || 0),
    recordCount: Number(row.record_count || 0)
  }));
}

export async function getProjectForUser(slug: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT p.id, p.slug, p.name, p.description, membership.role
     FROM archeology_projects p
     JOIN archeology_project_memberships membership ON membership.project_id = p.id
     WHERE p.slug = $1 AND membership.user_id = $2::uuid
     LIMIT 1`,
    [slug, userId]
  );
  return result.rows[0] || null;
}

export async function createProject(input: { slug: string; name: string; description?: string | null; ownerId: string }) {
  const database = getDatabase();
  await database.query("BEGIN");
  try {
    const projectResult = await database.query(
      `INSERT INTO archeology_projects (slug, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, slug`,
      [input.slug, input.name, input.description || null]
    );
    const projectId = String(projectResult.rows[0].id);
    await database.query(
      `INSERT INTO archeology_project_memberships (project_id, user_id, role)
       VALUES ($1::uuid, $2::uuid, 'owner')`,
      [projectId, input.ownerId]
    );
    await database.query("COMMIT");
    await writeAuditEvent(projectId, input.ownerId, "project.created", "project", projectId, { name: input.name, slug: input.slug });
    return { id: projectId, slug: String(projectResult.rows[0].slug) };
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
}

export async function userCanManageProject(projectId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT role
     FROM archeology_project_memberships
     WHERE project_id = $1::uuid AND user_id = $2::uuid
     LIMIT 1`,
    [projectId, userId]
  );
  return ["owner", "admin"].includes(String(result.rows[0]?.role || ""));
}

export async function updateProject(input: { projectId: string; actorId: string; name: string; description?: string | null }) {
  if (!(await userCanManageProject(input.projectId, input.actorId))) throw new Error("You cannot edit this project.");
  await getDatabase().query(
    `UPDATE archeology_projects
     SET name = $1, description = $2, updated_at = NOW()
     WHERE id = $3::uuid`,
    [input.name, input.description || null, input.projectId]
  );
  await writeAuditEvent(input.projectId, input.actorId, "project.updated", "project", input.projectId, { name: input.name });
}

export async function createSite(input: { projectId: string; actorId: string; code?: string | null; name: string; description?: string | null }) {
  if (!(await userCanManageProject(input.projectId, input.actorId))) throw new Error("You cannot add sites to this project.");
  const result = await getDatabase().query(
    `INSERT INTO archeology_sites (project_id, code, name, description)
     VALUES ($1::uuid, $2, $3, $4)
     RETURNING id`,
    [input.projectId, input.code || null, input.name, input.description || null]
  );
  const id = String(result.rows[0].id);
  await writeAuditEvent(input.projectId, input.actorId, "site.created", "site", id, { name: input.name, code: input.code || null });
  return id;
}

export async function createPhysicalObject(input: {
  projectId: string;
  siteId: string;
  actorId: string;
  parentObjectId?: string | null;
  objectType: string;
  code?: string | null;
  name: string;
  description?: string | null;
}) {
  if (!(await userCanManageProject(input.projectId, input.actorId))) throw new Error("You cannot add physical objects to this project.");
  const siteCheck = await getDatabase().query(
    `SELECT 1 FROM archeology_sites WHERE id = $1::uuid AND project_id = $2::uuid`,
    [input.siteId, input.projectId]
  );
  if (!siteCheck.rowCount) throw new Error("The selected site does not belong to this project.");
  const result = await getDatabase().query(
    `INSERT INTO archeology_physical_objects (site_id, parent_object_id, object_type, code, name, description)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
     RETURNING id`,
    [input.siteId, input.parentObjectId || null, input.objectType, input.code || null, input.name, input.description || null]
  );
  const id = String(result.rows[0].id);
  await writeAuditEvent(input.projectId, input.actorId, "physical_object.created", "physical_object", id, {
    name: input.name,
    objectType: input.objectType,
    siteId: input.siteId
  });
  return id;
}

export async function listSitesForProject(projectId: string) {
  const result = await getDatabase().query(
    `SELECT id, code, name, description
     FROM archeology_sites
     WHERE project_id = $1::uuid
     ORDER BY name`,
    [projectId]
  );
  return result.rows;
}

export async function listObjectsForProject(projectId: string) {
  const result = await getDatabase().query(
    `SELECT object.id, object.site_id, object.parent_object_id, object.object_type, object.code, object.name, object.description
     FROM archeology_physical_objects object
     JOIN archeology_sites site ON site.id = object.site_id
     WHERE site.project_id = $1::uuid
     ORDER BY object.name`,
    [projectId]
  );
  return result.rows;
}

export async function listCatalogRecords(projectId: string, userId: string): Promise<CatalogRecord[]> {
  const result = await getDatabase().query(
    `SELECT record.id,
            record.record_type,
            record.title,
            record.description,
            record.filter_name,
            record.enhancement,
            record.additional_information,
            record.acquisition_at,
            record.visibility,
            record.status,
            record.author_id,
            record.created_at,
            author.email AS author_email,
            author.display_name AS author_name,
            site.id AS site_id,
            site.name AS site_name,
            object.id AS object_id,
            object.name AS object_name,
            asset.id AS asset_id,
            asset.original_filename AS asset_filename,
            asset.mime_type AS asset_mime_type,
            asset.r2_key AS asset_r2_key,
            (record.author_id = $2::uuid OR membership.role IN ('owner', 'admin')) AS can_edit
     FROM archeology_records record
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
     JOIN archeology_users author ON author.id = record.author_id
     LEFT JOIN archeology_sites site ON site.id = record.site_id
     LEFT JOIN archeology_physical_objects object ON object.id = record.physical_object_id
     LEFT JOIN LATERAL (
       SELECT digital_asset.id, digital_asset.original_filename, digital_asset.mime_type, digital_asset.r2_key
       FROM archeology_record_assets link
       JOIN archeology_digital_assets digital_asset ON digital_asset.id = link.asset_id
       WHERE link.record_id = record.id
       ORDER BY CASE link.role WHEN 'original' THEN 0 WHEN 'preview' THEN 1 ELSE 2 END, digital_asset.created_at
       LIMIT 1
     ) asset ON TRUE
     WHERE record.project_id = $1::uuid
       AND (record.visibility <> 'private' OR record.author_id = $2::uuid)
     ORDER BY record.acquisition_at DESC, record.created_at DESC`,
    [projectId, userId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    recordType: row.record_type as RecordType,
    title: row.title ? String(row.title) : null,
    description: row.description ? String(row.description) : null,
    filterName: row.filter_name ? String(row.filter_name) : null,
    enhancement: row.enhancement ? String(row.enhancement) : null,
    additionalInformation: row.additional_information ? String(row.additional_information) : null,
    acquisitionAt: new Date(row.acquisition_at).toISOString(),
    visibility: row.visibility as Visibility,
    status: row.status as RecordStatus,
    authorId: String(row.author_id),
    authorEmail: String(row.author_email),
    authorName: row.author_name ? String(row.author_name) : null,
    siteId: row.site_id ? String(row.site_id) : null,
    siteName: row.site_name ? String(row.site_name) : null,
    physicalObjectId: row.object_id ? String(row.object_id) : null,
    objectName: row.object_name ? String(row.object_name) : null,
    assetId: row.asset_id ? String(row.asset_id) : null,
    assetFilename: row.asset_filename ? String(row.asset_filename) : null,
    assetMimeType: row.asset_mime_type ? String(row.asset_mime_type) : null,
    assetR2Key: row.asset_r2_key ? String(row.asset_r2_key) : null,
    createdAt: new Date(row.created_at).toISOString(),
    canEdit: Boolean(row.can_edit)
  }));
}

export async function createRecord(input: {
  projectId: string;
  siteId?: string | null;
  physicalObjectId?: string | null;
  recordType: RecordType;
  title?: string | null;
  description?: string | null;
  filterName?: string | null;
  enhancement?: string | null;
  additionalInformation?: string | null;
  acquisitionAt?: string | null;
  visibility: Visibility;
  authorId: string;
}) {
  const result = await getDatabase().query(
    `INSERT INTO archeology_records (
       project_id, site_id, physical_object_id, record_type, title, description,
       filter_name, enhancement, additional_information, acquisition_at, visibility, author_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()), $11, $12::uuid)
     RETURNING id`,
    [
      input.projectId,
      input.siteId || null,
      input.physicalObjectId || null,
      input.recordType,
      input.title || null,
      input.description || null,
      input.filterName || null,
      input.enhancement || null,
      input.additionalInformation || null,
      input.acquisitionAt || null,
      input.visibility,
      input.authorId
    ]
  );
  const recordId = String(result.rows[0].id);
  await writeAuditEvent(input.projectId, input.authorId, "record.created", "record", recordId, {
    recordType: input.recordType,
    visibility: input.visibility
  });
  return recordId;
}

export async function updateRecord(input: {
  recordId: string;
  actorId: string;
  siteId?: string | null;
  physicalObjectId?: string | null;
  recordType: RecordType;
  title?: string | null;
  description?: string | null;
  filterName?: string | null;
  enhancement?: string | null;
  additionalInformation?: string | null;
  acquisitionAt: string;
  visibility: Visibility;
  status: RecordStatus;
}) {
  const access = await getDatabase().query(
    `SELECT record.project_id, record.author_id, membership.role
     FROM archeology_records record
     JOIN archeology_project_memberships membership ON membership.project_id = record.project_id AND membership.user_id = $2::uuid
     WHERE record.id = $1::uuid
     LIMIT 1`,
    [input.recordId, input.actorId]
  );
  const row = access.rows[0];
  if (!row) throw new Error("Record not found.");
  const canEdit = String(row.author_id) === input.actorId || ["owner", "admin"].includes(String(row.role));
  if (!canEdit) throw new Error("You cannot edit this record.");

  await getDatabase().query(
    `UPDATE archeology_records
     SET site_id = $1::uuid,
         physical_object_id = $2::uuid,
         record_type = $3,
         title = $4,
         description = $5,
         filter_name = $6,
         enhancement = $7,
         additional_information = $8,
         acquisition_at = $9::timestamptz,
         visibility = $10,
         status = $11,
         updated_at = NOW()
     WHERE id = $12::uuid`,
    [
      input.siteId || null,
      input.physicalObjectId || null,
      input.recordType,
      input.title || null,
      input.description || null,
      input.filterName || null,
      input.enhancement || null,
      input.additionalInformation || null,
      input.acquisitionAt,
      input.visibility,
      input.status,
      input.recordId
    ]
  );
  await writeAuditEvent(String(row.project_id), input.actorId, "record.updated", "record", input.recordId, {
    recordType: input.recordType,
    visibility: input.visibility,
    status: input.status
  });
}

export async function createDigitalAsset(input: {
  projectId: string;
  originalFilename: string;
  mimeType?: string | null;
  format?: string | null;
  r2Key: string;
  checksumSha256?: string | null;
  fileSize?: number | null;
  createdBy: string;
}) {
  const result = await getDatabase().query(
    `INSERT INTO archeology_digital_assets (
       project_id, original_filename, mime_type, format, r2_key, checksum_sha256, file_size, created_by
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)
     RETURNING id`,
    [input.projectId, input.originalFilename, input.mimeType || null, input.format || null, input.r2Key, input.checksumSha256 || null, input.fileSize || null, input.createdBy]
  );
  return String(result.rows[0].id);
}

export async function attachAssetToRecord(recordId: string, assetId: string, role: "original" | "derivative" | "attachment" | "preview" = "original") {
  await getDatabase().query(
    `INSERT INTO archeology_record_assets (record_id, asset_id, role)
     VALUES ($1::uuid, $2::uuid, $3)
     ON CONFLICT (record_id, asset_id) DO UPDATE SET role = EXCLUDED.role`,
    [recordId, assetId, role]
  );
}

export async function getRecordForUser(recordId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT record.*,
            author.email AS author_email,
            author.display_name AS author_name,
            project.slug AS project_slug,
            project.name AS project_name,
            site.name AS site_name,
            object.name AS object_name,
            membership.role AS viewer_role,
            (record.author_id = $2::uuid OR membership.role IN ('owner', 'admin')) AS can_edit,
            asset.id AS asset_id,
            asset.original_filename AS asset_filename,
            asset.mime_type AS asset_mime_type,
            asset.r2_key AS asset_r2_key,
            asset.file_size AS asset_file_size,
            asset.checksum_sha256 AS asset_checksum
     FROM archeology_records record
     JOIN archeology_projects project ON project.id = record.project_id
     JOIN archeology_project_memberships membership ON membership.project_id = project.id AND membership.user_id = $2::uuid
     JOIN archeology_users author ON author.id = record.author_id
     LEFT JOIN archeology_sites site ON site.id = record.site_id
     LEFT JOIN archeology_physical_objects object ON object.id = record.physical_object_id
     LEFT JOIN LATERAL (
       SELECT digital_asset.*
       FROM archeology_record_assets link
       JOIN archeology_digital_assets digital_asset ON digital_asset.id = link.asset_id
       WHERE link.record_id = record.id
       ORDER BY CASE link.role WHEN 'original' THEN 0 ELSE 1 END, digital_asset.created_at
       LIMIT 1
     ) asset ON TRUE
     WHERE record.id = $1::uuid
       AND (record.visibility <> 'private' OR record.author_id = $2::uuid)
     LIMIT 1`,
    [recordId, userId]
  );
  return result.rows[0] || null;
}

export async function listProjectMembers(projectId: string) {
  const result = await getDatabase().query(
    `SELECT user.id, user.email, user.display_name, membership.role, membership.created_at
     FROM archeology_project_memberships membership
     JOIN archeology_users user ON user.id = membership.user_id
     WHERE membership.project_id = $1::uuid
     ORDER BY CASE membership.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'contributor' THEN 2 ELSE 3 END, user.email`,
    [projectId]
  );
  return result.rows;
}

export async function writeAuditEvent(projectId: string | null, actorId: string | null, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  await getDatabase().query(
    `INSERT INTO archeology_audit_events (project_id, actor_id, action, entity_type, entity_id, details)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::jsonb)`,
    [projectId, actorId, action, entityType, entityId, JSON.stringify(details)]
  );
}
