import Link from "next/link";
import { ArrowRight, MapPinned, Plus, Users } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { listProjectsForUser } from "@/lib/records";
import { createProjectAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireCurrentUser();
  const projects = await listProjectsForUser(user.localUserId);

  return (
    <AppShell user={user} active="Projects">
      <header className="workspace-header">
        <div><p className="eyebrow">Projects</p><h1>Sites and working contexts</h1><p>A project is the collaboration boundary. Create a project, structure it into sites and physical objects, then connect catalog records to that context.</p></div>
      </header>

      <section className="quick-add-panel compact-project-create">
        <div className="panel-heading"><div><p className="eyebrow">New working context</p><h2>Create project</h2></div><p>Start small. A project can represent one excavation, monument, conservation campaign or research collection.</p></div>
        <form action={createProjectAction} className="record-form project-create-form">
          <label><span>Project name</span><input name="name" required placeholder="e.g. Villa conservation 2026" /></label>
          <label><span>Short URL name</span><input name="slug" placeholder="optional, generated from name" /></label>
          <label className="wide"><span>Description</span><textarea name="description" rows={2} placeholder="Purpose, scope or location" /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> Create project</button>
        </form>
      </section>

      <section className="project-grid project-grid-spaced">
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <div className="project-card-top"><MapPinned size={24} /><span className="role-badge"><Users size={13} /> {project.role}</span></div>
            <p className="eyebrow">Working project</p>
            <h2>{project.name}</h2>
            <p>{project.description || "No project description yet."}</p>
            <div className="project-metrics"><span><strong>{project.siteCount}</strong> {project.siteCount === 1 ? "site" : "sites"}</span><span><strong>{project.recordCount}</strong> visible records</span></div>
            <Link href={`/projects/${project.slug}`}>Manage project <ArrowRight size={15} /></Link>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
