import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { validateRecordContext } from "@/lib/context-validation";
import { attachAssetToRecord, createDigitalAsset, createRecord, getProjectForUser, type Visibility } from "@/lib/records";
import { putRecordAsset } from "@/lib/r2";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const MAX_FILES=12;
const MAX_FILE=20*1024*1024;
const MAX_TOTAL=100*1024*1024;
function text(fd:FormData,key:string){const value=fd.get(key);return typeof value==="string"?value.trim():"";}
function safe(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"file";}

export async function POST(request:Request){
  const user=await requireCurrentUser();
  try{
    const fd=await request.formData(); const projectSlug=text(fd,"projectSlug"); const project=projectSlug?await getProjectForUser(projectSlug,user.localUserId):null;
    if(!project)return NextResponse.json({error:"Project not found."},{status:403});
    const siteId=text(fd,"siteId")||null;const physicalObjectId=text(fd,"physicalObjectId")||null;await validateRecordContext(String(project.id),siteId,physicalObjectId);
    const visibility=(text(fd,"visibility")||"project") as Visibility;if(!["private","project","public"].includes(visibility))return NextResponse.json({error:"Invalid visibility."},{status:400});
    const files=fd.getAll("files").filter((item):item is File=>item instanceof File&&item.size>0);
    if(!files.length)return NextResponse.json({error:"Choose at least one file."},{status:400});
    if(files.length>MAX_FILES)return NextResponse.json({error:`Upload at most ${MAX_FILES} files per batch.`},{status:413});
    if(files.some((file)=>file.size>MAX_FILE)||files.reduce((sum,file)=>sum+file.size,0)>MAX_TOTAL)return NextResponse.json({error:"Batch is too large. Keep each file under 20 MB and the batch under 100 MB."},{status:413});
    const created:string[]=[];
    for(const file of files){
      const isImage=file.type.startsWith("image/");const recordType=isImage?"photo":"document";
      const recordId=await createRecord({projectId:String(project.id),siteId,physicalObjectId,recordType,title:file.name,description:text(fd,"description")||null,visibility,authorId:user.localUserId});
      const bytes=new Uint8Array(await file.arrayBuffer());const checksum=createHash("sha256").update(bytes).digest("hex");const key=`projects/${project.slug}/records/${recordId}/original/${randomUUID()}-${safe(file.name)}`;
      await putRecordAsset({key,body:bytes,contentType:file.type||"application/octet-stream",metadata:{recordId,authorId:user.localUserId,originalFilename:file.name,source:"bulk-catalog"}});
      const extension=file.name.includes(".")?file.name.split(".").pop()?.toLowerCase()||null:null;
      const assetId=await createDigitalAsset({projectId:String(project.id),originalFilename:file.name,mimeType:file.type||null,format:extension,r2Key:key,checksumSha256:checksum,fileSize:file.size,createdBy:user.localUserId});
      await attachAssetToRecord(recordId,assetId,"original");created.push(recordId);
    }
    revalidatePath("/catalog");revalidatePath(`/projects/${project.slug}`);
    return NextResponse.json({ok:true,count:created.length,recordIds:created},{status:201});
  }catch(error){const message=error instanceof Error?error.message:"Bulk upload failed.";console.error("[catalog.bulk]",{message});return NextResponse.json({error:message},{status:500});}
}
