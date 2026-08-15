import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { listConservationItems } from "@/lib/conservation";
import { getProjectForUser } from "@/lib/records";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function csv(value:unknown){const text=value===null||value===undefined?"":String(value);return `"${text.replace(/"/g,'""')}"`;}

export async function GET(request:Request){
  const user=await requireCurrentUser();
  const url=new URL(request.url); const slug=url.searchParams.get("project")||"casignana";
  const project=await getProjectForUser(slug,user.localUserId);
  if(!project) return NextResponse.json({error:"Project not found."},{status:404});
  const items=await listConservationItems(String(project.id),user.localUserId);
  const header=["record_id","type","date","title","site","object","category","severity","confidence","priority","intervention_type","intervention_status","method","materials","outcome","author","visibility"];
  const rows=items.map((item)=>[
    item.recordId,item.recordType,item.acquisitionAt,item.title||"",item.siteName||"",item.objectName||"",item.category||"",item.severity||"",item.confidence||"",item.treatmentPriority||"",item.interventionType||"",item.interventionStatus||"",item.method||"",item.materials||"",item.outcome||"",item.authorName||item.authorEmail,item.visibility
  ].map(csv).join(","));
  const content=[header.join(","),...rows].join("\n");
  return new Response(content,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${String(project.slug)}-conservation.csv"`,`Cache-Control":"private, no-store"}});
}
