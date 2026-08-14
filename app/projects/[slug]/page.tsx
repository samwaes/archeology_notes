import Link from "next/link";
import { ArrowRight, Box, Database, MapPinned, Users } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectForUser, listCatalogRecords, listObjectsForProject, listProjectMembers, listSitesForProject } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireCurrentUser();
  const project = await getProjectForUser(slug, user.localUserId);
  if (!project) notFound();

  const [sites, objects, records, members] = await Promise.all([
    listSitesForProject(String(project.id)),
    listObjectsForProject(String(project.id)),
    listCatalogRecords(String(project.id), user.localUserId),
    listProjectMembers(String(project.id))
  ]);

  return (
    <AppShell user={user} active="Projects">
      <header className="workspace-header project-hero">
        <div><p className="eyebrow">Project · {String(project.role)}</p><h1>{String(project.name)}</h1><p>{project.description ? String(project.description) : ""}</p></div>
        <Link className="primary-button" href="/catalog"><Database size={16} /> Open catalog</Link>
      </header>

      <section className="project-summary-grid">
        <article><MapPinned size={20} /><strong>{sites.length}</strong><span>Sites</span></article>
        <article><Box size={20} /><strong>{objects.length}</strong><span>Physical objects</span></article>
        <article><Database size={20} /><strong>{records.length}</strong><span>Visible records</span></article>
        <article><Users size={20} /><strong>{members.length}</strong><span>Project members</span></article>
      </section>

      <div className="project-detail-grid">
        <section className="content-panel">
          <div className="panel-heading"><div><p className="eyebrow">Physical context</p><h2>Sites and objects</h2></div><p>The physical object is the stable anchor. Scans, photographs and future 3D representations are evidence about it, not replacements for it.</p></div>
          {sites.map((site) => (
            <article className="site-card" key={String(site.id)}>
              <div><span className="site-code">{String(site.code || "SITE")}</span><h3>{String(site.name)}</h3><p>{site.description ? String(site.description) : ""}</p></div>
              <div className="object-list">{objects.filter((object) => String(object.site_id) === String(site.id)).map((object) => <div key={String(object.id)}><Box size={15} /><span><strong>{String(object.name)}</strong><small>{String(object.object_type)}{object.code ? ` · ${String(object.code)}` : ""}</small></span></div>)}</div>
            </article>
          ))}
        </section>

        <aside className="content-panel team-panel">
          <div className="panel-heading"><div><p className="eyebrow">Collaboration</p><h2>People</h2></div></div>
          <div className="member-list">{members.map((member) => <div key={String(member.id)}><span className="member-avatar">{String(member.display_name || member.email).slice(0, 1).toUpperCase()}</span><span><strong>{String(member.display_name || member.email)}</strong><small>{String(member.role)}</small></span></div>)}</div>
          <p className="small-note">Phase 1 automatically enrols Hupla-authorised pilot users into Casignana. Explicit project invitations and role administration will replace this bootstrap behaviour after the first collaboration test.</p>
        </aside>
      </div>

      <section className="content-panel recent-records">
        <div className="panel-heading"><div><p className="eyebrow">Recent evidence</p><h2>Latest records</h2></div><Link href="/catalog">View catalog <ArrowRight size={14} /></Link></div>
        <div className="record-strip">{records.slice(0, 6).map((record) => <Link href={`/records/${record.id}`} key={record.id}><span>{record.recordType}</span><strong>{record.title || record.description || "Untitled record"}</strong><small>{new Date(record.acquisitionAt).toLocaleDateString("en-GB")} · {record.authorName || record.authorEmail}</small></Link>)}</div>
      </section>
    </AppShell>
  );
}
