import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectForUser } from "@/lib/records";
import { linkEvidenceToIntervention } from "@/lib/conservation-record";
import {
  createCaptureTemplate,
  createConditionAssessment,
  createIntervention,
  type ConditionConfidence,
  type ConditionSeverity,
  type InterventionStatus,
  type TreatmentPriority
} from "@/lib/conservation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SEVERITIES = new Set(["low","moderate","high","critical"]);const CONFIDENCES = new Set(["low","medium","high"]);const PRIORITIES = new Set(["monitor","routine","urgent","emergency"]);const INTERVENTION_STATUSES = new Set(["planned","in_progress","completed","monitoring"]);const VISIBILITIES = new Set(["private","project","public"]);
function value(body:Record<string,unknown>,key:string){const item=body[key];return typeof item==="string"?item.trim():"";}

export async function POST(request:Request){
  const user=await requireCurrentUser();
  try{
    const body=await request.json() as Record<string,unknown>;const kind=value(body,"kind");const projectSlug=value(body,"projectSlug");const project=projectSlug?await getProjectForUser(projectSlug,user.localUserId):null;
    if(!project)return NextResponse.json({error:"You do not have access to this project."},{status:403});const visibility=value(body,"visibility")||"project";if(!VISIBILITIES.has(visibility))return NextResponse.json({error:"Invalid visibility."},{status:400});
    let recordId:string|null=null;
    if(kind==="condition"){
      const severity=value(body,"severity")||"moderate";const confidence=value(body,"confidence")||"medium";const treatmentPriority=value(body,"treatmentPriority")||"monitor";const category=value(body,"category");
      if(!category)return NextResponse.json({error:"Condition category is required."},{status:400});if(!SEVERITIES.has(severity)||!CONFIDENCES.has(confidence)||!PRIORITIES.has(treatmentPriority))return NextResponse.json({error:"Invalid condition classification."},{status:400});
      recordId=await createConditionAssessment({projectId:String(project.id),authorId:user.localUserId,siteId:value(body,"siteId")||null,physicalObjectId:value(body,"physicalObjectId")||null,title:value(body,"title")||null,description:value(body,"description")||null,visibility:visibility as "private"|"project"|"public",acquisitionAt:value(body,"acquisitionAt")||null,category,severity:severity as ConditionSeverity,confidence:confidence as ConditionConfidence,extent:value(body,"extent")||null,treatmentPriority:treatmentPriority as TreatmentPriority});
    }else if(kind==="intervention"){
      const interventionType=value(body,"interventionType");const interventionStatus=value(body,"interventionStatus")||"planned";if(!interventionType)return NextResponse.json({error:"Intervention type is required."},{status:400});if(!INTERVENTION_STATUSES.has(interventionStatus))return NextResponse.json({error:"Invalid intervention status."},{status:400});
      recordId=await createIntervention({projectId:String(project.id),authorId:user.localUserId,siteId:value(body,"siteId")||null,physicalObjectId:value(body,"physicalObjectId")||null,title:value(body,"title")||null,description:value(body,"description")||null,visibility:visibility as "private"|"project"|"public",interventionDate:value(body,"interventionDate")||null,interventionType,interventionStatus:interventionStatus as InterventionStatus,method:value(body,"method")||null,materials:value(body,"materials")||null,outcome:value(body,"outcome")||null,conditionRecordId:value(body,"conditionRecordId")||null});
      await linkEvidenceToIntervention({interventionRecordId:recordId,projectId:String(project.id),actorId:user.localUserId,beforeRecordId:value(body,"beforeRecordId")||null,afterRecordId:value(body,"afterRecordId")||null});
    }else if(kind==="template"){
      const name=value(body,"name");const recordType=value(body,"recordType");if(!name||!["note","observation","measurement","condition","intervention"].includes(recordType))return NextResponse.json({error:"Template name and supported type are required."},{status:400});const template=body.template&&typeof body.template==="object"&&!Array.isArray(body.template)?body.template as Record<string,unknown>:{};const id=await createCaptureTemplate({projectId:String(project.id),actorId:user.localUserId,name,recordType,defaultVisibility:visibility,template});revalidatePath("/conservation");revalidatePath("/field");return NextResponse.json({ok:true,id},{status:201});
    }else return NextResponse.json({error:"Unsupported conservation action."},{status:400});
    revalidatePath("/conservation");revalidatePath("/catalog");revalidatePath(`/projects/${project.slug}`);return NextResponse.json({ok:true,recordId,recordUrl:`/records/${recordId}`},{status:201});
  }catch(error){const message=error instanceof Error?error.message:"Conservation action failed.";console.error("[conservation]",{message});return NextResponse.json({error:message},{status:500});}
}
