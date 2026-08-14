import Link from "next/link";
import { AlertTriangle, ArrowRight, Box, Database, MapPinned, Plus, Settings2, Users } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectForUser, listCatalogRecords, listObjectsForProject, listProjectMembers, listSitesForProject } from "@/lib/records";
import { createPhysicalObjectAction, createSiteAction, updateProjectAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireCurrentUser();
  const project = await getProjectForUser(slug, user.localUserId);
  if (!project) notFound();

  const projectId = String(project.id);
  const results = await Promise.allSettled([
    listSitesForProject(projectId),
    listObjectsForProject(projectId),
    listCatalogRecords(projectId, user.localUserId),
    listProjectMembers(projectId)
  ]);

  const labels = ["sites", "objects", "records", "members"] as const;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[Archeology Notes] project ${slug}: ${labels[index]} query failed`, result.reason);
    }
  });

  const sites = results[0].status === "fulfilled" ? results[0].value : [];
  const objects = results[1].status === "fulfilled" ? results[1].value : [];
  const records = results[2].status === "fulfilled" ? results[2].value : [];
  const members = results[3].status === "fulfilled" ? results[3].value : [];
  const unavailable = labels.filter((_, index) => results[index].status === "rejected");

  const canManage = ["owner", "admin"].includes(String(project.role));
  const catalogHref = `/catalog?project=${encodeURIComponent(slug)}`;

  return (
    <AppShell user={user} active="Projects">
      <header className="workspace-header project-hero">
        <div><p className="eyebrow">Project · {String(project.role)}</p><h1>{String(project.name)}</h1><p>{project.description ? String(project.description) : "No description yet."}</p></div>
        <Link className="primary-button" href={catalogHref}><Database size={16} /> Open catalog</Link>
      </header>

      {unavailable.length ? (
        <section className="runtime-warning">
          <AlertTriangle size={18} />
          <div><strong>Part of this project could not be loaded.</strong><p>Unavailable now: {unavailable.join(", ")}. The rest of the project remains usable and the detailed error is recorded in the application log.</p></div>
        </section>
      ) : null}

      <section className="project-summary-grid">
        <article><MapPinned size={20} /><strong>{sites.length}</strong><span>Sites</span></article>
        <article><Box size={20} /><strong>{objects.length}</strong><span>Physical objects</span></article>
        <article><Database size={20} /><strong>{records.length}</strong><span>Visible records</span></article>
        <article><Users size={20} /><strong>{members.length}</strong><span>Project members</span></article>
      </section>

      {canManage ? (
        <section className="content-panel project-management-panel">
          <div className="panel-heading"><div><p className="eyebrow">Project setup</p><h2>Manage structure</h2></div><p><Settings2 size={14} /> Owners and admins can edit the project, add sites and define physical objects.</p></div>
          <div className="management-grid">
            <form action={updateProjectAction} className="management-form">
              <input type="hidden" name="slug" value={slug} />
              <h3>Project details</h3>
              <label><span>Name</span><input name="name" defaultValue={String(project.name)} required /></label>
              <label><span>Description</span><textarea name="description" rows={3} defaultValue={project.description ? String(project.description) : ""} /></label>
              <button className="secondary-button" type="submit">Save project</button>
            </form>

            <form action={createSiteAction} className="management-form">
              <input type="hidden" name="slug" value={slug} />
              <h3>Add site</h3>
              <label><span>Name</span><input name="name" required placeholder="e.g. North wing" /></label>
              <label><span>Code</span><input name="code" placeholder="optional code" /></label>
              <label><span>Description</span><textarea name="description" rows={3} placeholder="Site, room, trench or working area" /></label>
              <button className="secondary-button" type="submit"><Plus size={14} /> Add site</button>
            </form>

            <form action={createPhysicalObjectAction} className="management-form">
              <input type="hidden" name="slug" value={slug} />
              <h3>Add physical object</h3>
              <label><span>Site</span><select name="siteId" required defaultValue={String(sites[0]?.id || "")}><option value="" disabled>Select site</option>{sites.map((site) => <option value={String(site.id)} key={String(site.id)}>{String(site.name)}</option>)}</select></label>
              <label><span>Name</span><input name="name" required placeholder="e.g. Mosaic panel A" /></label>
              <label><span>Type</span><input name="objectType" defaultValue="feature" placeholder="feature, wall, room, artefact..." /></label>
              <label><span>Code</span><input name="code" placeholder="optional code" /></label>
              <label><span>Parent object</span><select name="parentObjectId" defaultValue=""><option value="">No parent</option>{objects.map((object) => <option value={String(object.id)} key={String(object.id)}>{String(object.name)}</option>)}</select></label>
              <label><span>Description</span><textarea name="description" rows={3} /></label>
              <button className="secondary-button" type="submit" disabled={!sites.length}><Plus size={14} /> Add object</button>
            </form>
          </div>
        </section>
      ) : null}

      <div className="project-detail-grid">
        <section className="content-panel">
          <div className="panel-heading"><div><p className="eyebrow">Physical context</p><h2>Sites and objects</h2></div><p>The physical object is the stable anchor. Records and later 3D representations connect to this hierarchy.</p></div>
          {sites.length ? sites.map((site) => (
            <article className="site-card" key={String(site.id)}>
              <div><span className="site-code">{String(site.code || "SITE")}</span><h3>{String(site.name)}</h3><p>{site.description ? String(site.description) : "No description yet."}</p></div>
              <div className="object-list">{objects.filter((object) => String(object.site_id) === String(site.id)).map((object) => <div key={String(object.id)}><Box size={15} /><span><strong>{String(object.name)}</strong><small>{String(object.object_type)}{object.code ? ` · ${String(object.code)}` : ""}</small></span></div>)}</div>
            </article>
          )) : <div className="empty-state"><h3>No sites yet</h3><p>Add the first site or working area above.</p></div>}
        </section>

        <aside className="content-panel team-panel">
          <div className="panel-heading"><div><p className="eyebrow">Collaboration</p><h2>People</h2></div></div>
          {members.length ? <div className="member-list">{members.map((member) => <div key={String(member.id)}><span className="member-avatar">{String(member.display_name || member.email).slice(0, 1).toUpperCase()}</span><span><strong>{String(member.display_name || member.email)}</strong><small>{String(member.role)}</small></span></div>)}</div> : <p className="small-note">Membership information is temporarily unavailable.</p>}
          <p className="small-note">Hupla provides identity and application access. Project membership controls collaboration inside Archeology Notes.</p>
        </aside>
      </div>

      <section className="content-panel recent-records">
        <div className="panel-heading"><div><p className="eyebrow">Recent evidence</p><h2>Latest records</h2></div><Link href={catalogHref}>View catalog <ArrowRight size={14} /></Link></div>
        {records.length ? <div className="record-strip">{records.slice(0, 6).map((record) => <Link href={`/records/${record.id}`} key={record.id}><span>{record.recordType}</span><strong>{record.title || record.description || "Untitled record"}</strong><small>{new Date(record.acquisitionAt).toLocaleDateString("en-GB")} · {record.authorName || record.authorEmail}</small></Link>)}</div> : <div className="empty-state"><h3>No records yet</h3><p>Open this project's catalog to add the first note, photograph or document.</p></div>}
      </section>
    </AppShell>
  );
}
