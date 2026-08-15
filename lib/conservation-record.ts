import { getDatabase } from "@/lib/db";
import { writeAuditEvent } from "@/lib/records";

export async function getConservationMetadataForRecord(recordId:string,userId:string){
  const result=await getDatabase().query(
    `SELECT r.project_id,r.record_type,
            c.category,c.severity,c.confidence,c.extent,c.treatment_priority,c.active,c.assessed_at,
            i.condition_record_id,i.intervention_type,i.method,i.materials,i.outcome,i.intervention_status,i.intervention_date
     FROM archeology_records r
     JOIN archeology_project_memberships m ON m.project_id=r.project_id AND m.user_id=$2::uuid
     LEFT JOIN archeology_condition_assessments c ON c.record_id=r.id
     LEFT JOIN archeology_conservation_interventions i ON i.record_id=r.id
     WHERE r.id=$1::uuid AND (r.visibility<>'private' OR r.author_id=$2::uuid) LIMIT 1`,[recordId,userId]);
  if(!result.rows[0]||!["condition","intervention"].includes(String(result.rows[0].record_type)))return null;
  const links=await getDatabase().query(
    `SELECT rel.relationship_type,target.id,target.record_type,target.title,target.description,target.acquisition_at
     FROM archeology_record_relationships rel
     JOIN archeology_records target ON target.id=rel.target_record_id
     WHERE rel.source_record_id=$1::uuid AND (target.visibility<>'private' OR target.author_id=$2::uuid)
     ORDER BY target.acquisition_at`,[recordId,userId]);
  return {...result.rows[0],links:links.rows};
}

export async function linkEvidenceToIntervention(input:{interventionRecordId:string;projectId:string;actorId:string;beforeRecordId?:string|null;afterRecordId?:string|null}){
  for(const [relationshipType,targetRecordId] of [["before",input.beforeRecordId],["after",input.afterRecordId]] as const){
    if(!targetRecordId)continue;
    const check=await getDatabase().query(`SELECT 1 FROM archeology_records WHERE id=$1::uuid AND project_id=$2::uuid`,[targetRecordId,input.projectId]);
    if(!check.rowCount)throw new Error(`${relationshipType} evidence does not belong to this project.`);
    await getDatabase().query(`INSERT INTO archeology_record_relationships (source_record_id,target_record_id,relationship_type,created_by) VALUES ($1::uuid,$2::uuid,$3,$4::uuid) ON CONFLICT DO NOTHING`,[input.interventionRecordId,targetRecordId,relationshipType,input.actorId]);
  }
  await writeAuditEvent(input.projectId,input.actorId,"intervention.evidence_linked","record",input.interventionRecordId,{beforeRecordId:input.beforeRecordId||null,afterRecordId:input.afterRecordId||null});
}
