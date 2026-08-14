import Link from "next/link";
import { ArrowRight, MapPinned, Users } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { listProjectsForUser } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireCurrentUser();
  const projects = await listProjectsForUser(user.localUserId);

  return (
    <AppShell user={user} active="Projects">
      <header className="workspace-header">
        <div><p className="eyebrow">Projects</p><h1>Sites and working contexts</h1><p>A project is the collaboration boundary. Sites, physical objects and records live inside it, while each contribution keeps its own author and visibility.</p></div>
      </header>
      <section className="project-grid">
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <div className="project-card-top"><MapPinned size={24} /><span className="role-badge"><Users size={13} /> {project.role}</span></div>
            <p className="eyebrow">Pilot project</p>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
            <div className="project-metrics"><span><strong>{project.siteCount}</strong> site</span><span><strong>{project.recordCount}</strong> visible records</span></div>
            <Link href={`/projects/${project.slug}`}>Open project <ArrowRight size={15} /></Link>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
