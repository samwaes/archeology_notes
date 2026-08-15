import { getDatabase } from "@/lib/db";

export async function searchEvidence(input:{userId:string;query?:string;projectId?:string|null;recordType?:string|null;limit?:number}){
  const query=(input.query||"").trim();const limit=Math.max(1,Math.min(input.limit||100,250));
  const result=await getDatabase().query(
    `SELECT r.id,r.record_type,r.title,r.description,r.acquisition_at,r.visibility,r.status,
            p.id AS project_id,p.slug AS project_slug,p.name AS project_name,
            author.email AS author_email,author.display_name AS author_name,
            site.name AS site_name,obj.name AS object_name,
            c.category,c.severity,c.treatment_priority,
            i.intervention_type,i.intervention_status,
            CASE WHEN $2='' THEN 0 ELSE ts_rank(
              to_tsvector('simple',coalesce(r.title,'')||' '||coalesce(r.description,'')||' '||coalesce(r.additional_information,'')||' '||coalesce(c.category,'')||' '||coalesce(i.intervention_type,'')||' '||coalesce(i.method,'')||' '||coalesce(i.materials,'')),
              websearch_to_tsquery('simple',$2)
            ) END AS rank
     FROM archeology_records r
     JOIN archeology_projects p ON p.id=r.project_id
     JOIN archeology_project_memberships m ON m.project_id=p.id AND m.user_id=$1::uuid
     JOIN archeology_users author ON author.id=r.author_id
     LEFT JOIN archeology_sites site ON site.id=r.site_id
     LEFT JOIN archeology_physical_objects obj ON obj.id=r.physical_object_id
     LEFT JOIN archeology_condition_assessments c ON c.record_id=r.id
     LEFT JOIN archeology_conservation_interventions i ON i.record_id=r.id
     WHERE (r.visibility<>'private' OR r.author_id=$1::uuid)
       AND ($3::uuid IS NULL OR p.id=$3::uuid)
       AND ($4='' OR r.record_type=$4)
       AND ($2='' OR
         to_tsvector('simple',coalesce(r.title,'')||' '||coalesce(r.description,'')||' '||coalesce(r.additional_information,'')||' '||coalesce(c.category,'')||' '||coalesce(i.intervention_type,'')||' '||coalesce(i.method,'')||' '||coalesce(i.materials,'')) @@ websearch_to_tsquery('simple',$2)
         OR author.email ILIKE '%'||$2||'%' OR coalesce(author.display_name,'') ILIKE '%'||$2||'%' OR coalesce(site.name,'') ILIKE '%'||$2||'%' OR coalesce(obj.name,'') ILIKE '%'||$2||'%')
     ORDER BY rank DESC,r.acquisition_at DESC
     LIMIT $5`,
    [input.userId,query,input.projectId||null,input.recordType||"",limit]
  );
  return result.rows;
}
