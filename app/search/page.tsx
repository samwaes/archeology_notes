import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { listProjectsForUser } from "@/lib/records";
import { searchEvidence } from "@/lib/search";

export const dynamic="force-dynamic";

export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string;project?:string;type?:string}>}){
  const user=await requireCurrentUser();const params=await searchParams;const projects=await listProjectsForUser(user.localUserId);
  const selectedProject=projects.find((item)=>item.slug===params.project)||null;const type=params.type||"";
  const results=await searchEvidence({userId:user.localUserId,query:params.q||"",projectId:selectedProject?.id||null,recordType:type||null,limit:150});
  const types=["note","photo","document","observation","measurement","voice","condition","intervention"];
  return <AppShell user={user} active="Search"><header className="workspace-header"><div><p className="eyebrow">Evidence search</p><h1>Search across projects</h1><p>Search record text, conservation classifications, intervention methods, authors and physical context while preserving project and private-record permissions.</p></div></header>
    <form className="search-form"><SearchIcon size={18}/><input name="q" defaultValue={params.q||""} placeholder="cracking, mortar, author, wall, treatment..." autoFocus/><select name="project" defaultValue={selectedProject?.slug||""}><option value="">All projects</option>{projects.map((project)=><option key={project.id} value={project.slug}>{project.name}</option>)}</select><select name="type" defaultValue={type}><option value="">All types</option>{types.map((item)=><option key={item}>{item}</option>)}</select><button type="submit">Search</button></form>
    <section className="search-results"><p>{results.length} result{results.length===1?"":"s"}{params.q?` for “${params.q}”`:""}</p>{results.map((record)=><Link href={`/records/${String(record.id)}`} key={String(record.id)}><span>{String(record.project_name)} · {String(record.record_type)}</span><strong>{String(record.title||record.description||record.category||record.intervention_type||"Untitled record")}</strong><small>{String(record.object_name||record.site_name||"Unlinked")} · {String(record.author_name||record.author_email)} · {String(record.visibility)}{record.severity?` · severity ${String(record.severity)}`:""}</small></Link>)}</section>
  </AppShell>;
}
