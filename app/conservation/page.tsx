import Link from "next/link";
import AppShell from "@/components/app-shell";
import ConservationWorkspace from "@/components/conservation-workspace";
import { requireCurrentUser } from "@/lib/current-user";
import { listCaptureTemplates, listConservationItems } from "@/lib/conservation";
import { listCatalogRecords, listObjectsForProject, listProjectsForUser, listSitesForProject } from "@/lib/records";

export const dynamic="force-dynamic";

export default async function ConservationPage({searchParams}:{searchParams:Promise<{project?:string}>}) {
  const user=await requireCurrentUser();const params=await searchParams;const projects=await listProjectsForUser(user.localUserId);
  const project=projects.find((item)=>item.slug===params.project)||projects.find((item)=>item.slug==="casignana")||projects[0];
  if(!project) throw new Error("Create a project before using conservation workflows.");
  const [sitesRaw,objectsRaw,items,templates,records]=await Promise.all([
    listSitesForProject(project.id),listObjectsForProject(project.id),listConservationItems(project.id,user.localUserId),listCaptureTemplates(project.id,user.localUserId),listCatalogRecords(project.id,user.localUserId)
  ]);
  const sites=sitesRaw.map((item)=>({id:String(item.id),name:String(item.name)}));const objects=objectsRaw.map((item)=>({id:String(item.id),siteId:String(item.site_id),name:String(item.name)}));
  const evidence=records.filter((record)=>record.recordType!=="intervention").slice(0,150).map((record)=>({id:record.id,label:record.title||record.description||record.assetFilename||`${record.recordType} ${record.id.slice(0,8)}`,type:record.recordType,date:record.acquisitionAt}));
  return <AppShell user={user} active="Conservation"><header className="workspace-header"><div><p className="eyebrow">Conservation & evidence workflow</p><h1>Condition, intervention and history</h1><p>Record what is observed, assess its significance, link treatment actions and keep the evidence traceable through time.</p></div></header>{projects.length>1?<nav className="project-switcher" aria-label="Conservation project">{projects.map((item)=><Link className={item.id===project.id?"active":""} href={`/conservation?project=${encodeURIComponent(item.slug)}`} key={item.id}>{item.name}</Link>)}</nav>:null}<ConservationWorkspace projectSlug={project.slug} projectName={project.name} sites={sites} objects={objects} items={items} templates={templates} evidence={evidence}/></AppShell>;
}
