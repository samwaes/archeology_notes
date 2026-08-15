import { getDatabase } from "@/lib/db";
import { validateRecordContext } from "@/lib/context-validation";
import { writeAuditEvent } from "@/lib/records";

export type ConditionSeverity = "low" | "moderate" | "high" | "critical";
export type ConditionConfidence = "low" | "medium" | "high";
export type TreatmentPriority = "monitor" | "routine" | "urgent" | "emergency";
export type InterventionStatus = "planned" | "in_progress" | "completed" | "monitoring";

export type ConservationItem = {
  recordId: string;
  recordType: "condition" | "intervention";
  title: string | null;
  description: string | null;
  acquisitionAt: string;
  visibility: string;
  status: string;
  authorName: string | null;
  authorEmail: string;
  siteName: string | null;
  objectName: string | null;
  category: string | null;
  severity: string | null;
  confidence: string | null;
  treatmentPriority: string | null;
  active: boolean | null;
  interventionType: string | null;
  interventionStatus: string | null;
  method: string | null;
  materials: string | null;
  outcome: string | null;
  conditionRecordId: string | null;
};

export type CaptureTemplate = {
  id: string;
  name: string;
  recordType: string;
  defaultVisibility: string;
  template: Record<string, unknown>;
};

async function membership(projectId: string, userId: string) {
  const result = await getDatabase().query(
    `SELECT role FROM archeology_project_memberships WHERE project_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [projectId, userId]
  );
  return result.rows[0]?.role ? String(result.rows[0].role) : null;
}

export async function createConditionAssessment(input: {
  projectId: string;
  siteId?: string | null;
  physicalObjectId?: string | null;
  authorId: string;
  title?: string | null;
  description?: string | null;
  visibility: "private" | "project" | "public";
  acquisitionAt?: string | null;
  category: string;
  severity: ConditionSeverity;
  confidence: ConditionConfidence;
  extent?: string | null;
  treatmentPriority: TreatmentPriority;
}) {
  if (!(await membership(input.projectId, input.authorId))) throw new Error("You do not have access to this project.");
  await validateRecordContext(input.projectId, input.siteId || null, input.physicalObjectId || null);
  const database = getDatabase();
  await database.query("BEGIN");
  try {
    const record = await database.query(
      `INSERT INTO archeology_records (
         project_id, site_id, physical_object_id, record_type, title, description, acquisition_at, visibility, author_id, metadata
       ) VALUES ($1::uuid,$2::uuid,$3::uuid,'condition',$4,$5,COALESCE($6::timestamptz,NOW()),$7,$8::uuid,$9::jsonb)
       RETURNING id`,
      [input.projectId, input.siteId || null, input.physicalObjectId || null, input.title || null, input.description || null, input.acquisitionAt || null, input.visibility, input.authorId, JSON.stringify({ workflow: "conservation-condition" })]
    );
    const recordId = String(record.rows[0].id);
    await database.query(
      `INSERT INTO archeology_condition_assessments (
         record_id, category, severity, confidence, extent, treatment_priority, assessed_at, created_by
       ) VALUES ($1::uuid,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()),$8::uuid)`,
      [recordId, input.category, input.severity, input.confidence, input.extent || null, input.treatmentPriority, input.acquisitionAt || null, input.authorId]
    );
    await database.query("COMMIT");
    await writeAuditEvent(input.projectId, input.authorId, "condition.created", "record", recordId, { category: input.category, severity: input.severity, confidence: input.confidence, treatmentPriority: input.treatmentPriority });
    return recordId;
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
}

export async function createIntervention(input: {
  projectId: string;
  siteId?: string | null;
  physicalObjectId?: string | null;
  authorId: string;
  title?: string | null;
  description?: string | null;
  visibility: "private" | "project" | "public";
  interventionDate?: string | null;
  interventionType: string;
  interventionStatus: InterventionStatus;
  method?: string | null;
  materials?: string | null;
  outcome?: string | null;
  conditionRecordId?: string | null;
}) {
  if (!(await membership(input.projectId, input.authorId))) throw new Error("You do not have access to this project.");
  await validateRecordContext(input.projectId, input.siteId || null, input.physicalObjectId || null);
  if (input.conditionRecordId) {
    const condition = await getDatabase().query(`SELECT 1 FROM archeology_records WHERE id=$1::uuid AND project_id=$2::uuid AND record_type='condition'`, [input.conditionRecordId, input.projectId]);
    if (!condition.rowCount) throw new Error("The linked condition does not belong to this project.");
  }
  const database = getDatabase();
  await database.query("BEGIN");
  try {
    const record = await database.query(
      `INSERT INTO archeology_records (
         project_id, site_id, physical_object_id, record_type, title, description, acquisition_at, visibility, author_id, metadata
       ) VALUES ($1::uuid,$2::uuid,$3::uuid,'intervention',$4,$5,COALESCE($6::date::timestamptz,NOW()),$7,$8::uuid,$9::jsonb)
       RETURNING id`,
      [input.projectId, input.siteId || null, input.physicalObjectId || null, input.title || null, input.description || null, input.interventionDate || null, input.visibility, input.authorId, JSON.stringify({ workflow: "conservation-intervention" })]
    );
    const recordId = String(record.rows[0].id);
    await database.query(
      `INSERT INTO archeology_conservation_interventions (
         record_id, condition_record_id, intervention_type, method, materials, outcome, intervention_status, intervention_date, created_by
       ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::date,$9::uuid)`,
      [recordId, input.conditionRecordId || null, input.interventionType, input.method || null, input.materials || null, input.outcome || null, input.interventionStatus, input.interventionDate || null, input.authorId]
    );
    if (input.conditionRecordId) {
      await database.query(
        `INSERT INTO archeology_record_relationships (source_record_id,target_record_id,relationship_type,created_by)
         VALUES ($1::uuid,$2::uuid,'addresses',$3::uuid) ON CONFLICT DO NOTHING`,
        [recordId, input.conditionRecordId, input.authorId]
      );
    }
    await database.query("COMMIT");
    await writeAuditEvent(input.projectId, input.authorId, "intervention.created", "record", recordId, { interventionType: input.interventionType, interventionStatus: input.interventionStatus, conditionRecordId: input.conditionRecordId || null });
    return recordId;
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
}

export async function listConservationItems(projectId: string, userId: string): Promise<ConservationItem[]> {
  const result = await getDatabase().query(
    `SELECT r.id,r.record_type,r.title,r.description,r.acquisition_at,r.visibility,r.status,
            author.display_name AS author_name,author.email AS author_email,
            site.name AS site_name,obj.name AS object_name,
            c.category,c.severity,c.confidence,c.treatment_priority,c.active,
            i.intervention_type,i.intervention_status,i.method,i.materials,i.outcome,i.condition_record_id
     FROM archeology_records r
     JOIN archeology_project_memberships m ON m.project_id=r.project_id AND m.user_id=$2::uuid
     JOIN archeology_users author ON author.id=r.author_id
     LEFT JOIN archeology_sites site ON site.id=r.site_id
     LEFT JOIN archeology_physical_objects obj ON obj.id=r.physical_object_id
     LEFT JOIN archeology_condition_assessments c ON c.record_id=r.id
     LEFT JOIN archeology_conservation_interventions i ON i.record_id=r.id
     WHERE r.project_id=$1::uuid AND r.record_type IN ('condition','intervention')
       AND (r.visibility <> 'private' OR r.author_id=$2::uuid)
     ORDER BY r.acquisition_at DESC,r.created_at DESC`,
    [projectId,userId]
  );
  return result.rows.map((row) => ({
    recordId:String(row.id), recordType:row.record_type, title:row.title ? String(row.title) : null, description:row.description ? String(row.description) : null,
    acquisitionAt:new Date(row.acquisition_at).toISOString(), visibility:String(row.visibility), status:String(row.status), authorName:row.author_name ? String(row.author_name) : null,
    authorEmail:String(row.author_email), siteName:row.site_name ? String(row.site_name) : null, objectName:row.object_name ? String(row.object_name) : null,
    category:row.category ? String(row.category) : null, severity:row.severity ? String(row.severity) : null, confidence:row.confidence ? String(row.confidence) : null,
    treatmentPriority:row.treatment_priority ? String(row.treatment_priority) : null, active:row.active === null || row.active === undefined ? null : Boolean(row.active),
    interventionType:row.intervention_type ? String(row.intervention_type) : null, interventionStatus:row.intervention_status ? String(row.intervention_status) : null,
    method:row.method ? String(row.method) : null, materials:row.materials ? String(row.materials) : null, outcome:row.outcome ? String(row.outcome) : null,
    conditionRecordId:row.condition_record_id ? String(row.condition_record_id) : null
  }));
}

export async function listObjectTimeline(projectId: string, userId: string, physicalObjectId?: string | null) {
  const result = await getDatabase().query(
    `SELECT r.id,r.record_type,r.title,r.description,r.acquisition_at,r.visibility,r.status,
            author.display_name AS author_name,author.email AS author_email,site.name AS site_name,obj.name AS object_name
     FROM archeology_records r
     JOIN archeology_project_memberships m ON m.project_id=r.project_id AND m.user_id=$2::uuid
     JOIN archeology_users author ON author.id=r.author_id
     LEFT JOIN archeology_sites site ON site.id=r.site_id
     LEFT JOIN archeology_physical_objects obj ON obj.id=r.physical_object_id
     WHERE r.project_id=$1::uuid
       AND ($3::uuid IS NULL OR r.physical_object_id=$3::uuid)
       AND (r.visibility <> 'private' OR r.author_id=$2::uuid)
     ORDER BY r.acquisition_at DESC,r.created_at DESC
     LIMIT 250`,
    [projectId,userId,physicalObjectId || null]
  );
  return result.rows;
}

export async function listCaptureTemplates(projectId: string, userId: string): Promise<CaptureTemplate[]> {
  if (!(await membership(projectId,userId))) return [];
  const result = await getDatabase().query(`SELECT id,name,record_type,default_visibility,template FROM archeology_capture_templates WHERE project_id=$1::uuid ORDER BY name`, [projectId]);
  return result.rows.map((row) => ({ id:String(row.id), name:String(row.name), recordType:String(row.record_type), defaultVisibility:String(row.default_visibility), template:row.template && typeof row.template === "object" ? row.template : {} }));
}

export async function createCaptureTemplate(input:{projectId:string;actorId:string;name:string;recordType:string;defaultVisibility:string;template:Record<string,unknown>}) {
  const role=await membership(input.projectId,input.actorId);
  if (!role || !["owner","admin","contributor"].includes(role)) throw new Error("You cannot create templates in this project.");
  const result=await getDatabase().query(
    `INSERT INTO archeology_capture_templates (project_id,name,record_type,default_visibility,template,created_by)
     VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6::uuid)
     ON CONFLICT (project_id,name) DO UPDATE SET record_type=EXCLUDED.record_type,default_visibility=EXCLUDED.default_visibility,template=EXCLUDED.template,updated_at=NOW()
     RETURNING id`,
    [input.projectId,input.name,input.recordType,input.defaultVisibility,JSON.stringify(input.template),input.actorId]
  );
  return String(result.rows[0].id);
}

export async function lookupSyncReceipt(clientCaptureId:string,userId:string) {
  const result=await getDatabase().query(
    `SELECT receipt.record_id FROM archeology_sync_receipts receipt
     JOIN archeology_project_memberships m ON m.project_id=receipt.project_id AND m.user_id=$2::uuid
     WHERE receipt.client_capture_id=$1 LIMIT 1`,[clientCaptureId,userId]);
  return result.rows[0]?.record_id ? String(result.rows[0].record_id) : null;
}

export async function saveSyncReceipt(clientCaptureId:string,projectId:string,recordId:string,userId:string) {
  await getDatabase().query(
    `INSERT INTO archeology_sync_receipts (client_capture_id,project_id,record_id,created_by)
     VALUES ($1,$2::uuid,$3::uuid,$4::uuid) ON CONFLICT (client_capture_id) DO NOTHING`,
    [clientCaptureId,projectId,recordId,userId]
  );
}
