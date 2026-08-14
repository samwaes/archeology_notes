import Link from "next/link";
import { Camera, FileText, Mic, Pencil, Plus, Shield, Users } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { listCatalogRecords, listObjectsForProject, listProjectsForUser, listSitesForProject } from "@/lib/records";
import { signedAssetUrl } from "@/lib/r2";
import { createRecordAction } from "./actions";

export const dynamic = "force-dynamic";

function recordIcon(type: string) {
  if (type === "photo") return Camera;
  if (type === "voice") return Mic;
  return FileText;
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const projects = await listProjectsForUser(user.localUserId);
  const selectedProject = projects.find((project) => project.slug === params.project) || projects.find((project) => project.slug === "casignana") || projects[0];
  if (!selectedProject) throw new Error("Create a project before adding catalog records.");

  const [records, sites, objects] = await Promise.all([
    listCatalogRecords(selectedProject.id, user.localUserId),
    listSitesForProject(selectedProject.id),
    listObjectsForProject(selectedProject.id)
  ]);

  const previews = new Map<string, string>();
  await Promise.all(records.map(async (record) => {
    if (record.assetR2Key && record.assetMimeType?.startsWith("image/")) {
      previews.set(record.id, await signedAssetUrl(record.assetR2Key, 600));
    }
  }));

  return (
    <AppShell user={user} active="Catalog">
      <header className="workspace-header catalog-header">
        <div><p className="eyebrow">{selectedProject.name} · Phase 1</p><h1>Catalog</h1><p>One overview for field notes, photographs, documents and observations. Authorship, visibility and project context stay attached to every record.</p></div>
        <div className="header-stat"><strong>{records.length}</strong><span>visible records</span></div>
      </header>

      {projects.length > 1 ? <nav className="project-switcher" aria-label="Catalog project">{projects.map((project) => <Link className={project.id === selectedProject.id ? "active" : ""} href={`/catalog?project=${encodeURIComponent(project.slug)}`} key={project.id}>{project.name}</Link>)}</nav> : null}

      <section className="quick-add-panel">
        <div className="panel-heading"><div><p className="eyebrow">Capture</p><h2>Add a record</h2></div><p>Capture now and refine later. The record is created inside {selectedProject.name}.</p></div>
        <form action={createRecordAction} className="record-form">
          <input type="hidden" name="projectSlug" value={selectedProject.slug} />
          <label><span>Type</span><select name="recordType" defaultValue="note"><option value="note">Note</option><option value="photo">Photo</option><option value="document">Document</option><option value="observation">Observation</option><option value="measurement">Measurement</option><option value="voice">Voice</option></select></label>
          <label><span>Visibility</span><select name="visibility" defaultValue="project"><option value="private">Private</option><option value="project">Project</option><option value="public">Public</option></select></label>
          <label><span>Acquisition date</span><input type="datetime-local" name="acquisitionAt" /><small>Leave empty to use the capture time.</small></label>
          <label><span>Site</span><select name="siteId" defaultValue={String(sites[0]?.id || "")}><option value="">No site</option>{sites.map((site) => <option value={String(site.id)} key={String(site.id)}>{String(site.name)}</option>)}</select></label>
          <label><span>Physical object</span><select name="physicalObjectId" defaultValue={String(objects[0]?.id || "")}><option value="">Link later</option>{objects.map((object) => <option value={String(object.id)} key={String(object.id)}>{String(object.name)}</option>)}</select></label>
          <label className="wide"><span>Title</span><input name="title" placeholder="Optional short title" /></label>
          <label className="wide"><span>Description / note</span><textarea name="description" rows={3} placeholder="What did you observe?" /></label>
          <label><span>Filter</span><input name="filterName" placeholder="Visible, UV, IR..." /></label>
          <label><span>Enhancement</span><input name="enhancement" placeholder="None, inverted..." /></label>
          <label className="wide"><span>Additional information</span><input name="additionalInformation" placeholder="Optional catalog remarks" /></label>
          <label className="wide file-field"><span>Photo or document</span><input type="file" name="file" accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> Save record</button>
        </form>
        <p className="form-note"><Shield size={13} /> Private records remain visible only to their author. Project records are visible to project members. External anonymous publishing remains disabled during the pilot.</p>
      </section>

      <section className="catalog-section">
        <div className="panel-heading"><div><p className="eyebrow">Evidence overview</p><h2>Records</h2></div><p><Users size={14} /> Authors and project owners/admins can edit metadata. Original files and authorship remain preserved.</p></div>
        {records.length ? (
          <>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead><tr><th>ID</th><th>Preview</th><th>Type</th><th>Filter</th><th>Enhancement</th><th>Description</th><th>Acquisition</th><th>Author</th><th>Visibility</th><th>Context</th><th>Status</th><th></th></tr></thead>
                <tbody>{records.map((record) => {
                  const Icon = recordIcon(record.recordType);
                  const preview = previews.get(record.id);
                  return <tr key={record.id}>
                    <td><Link href={`/records/${record.id}`} className="record-id">{record.id.slice(0, 8)}</Link></td>
                    <td>{preview ? <img className="record-thumb" src={preview} alt="" /> : <span className="record-placeholder"><Icon size={17} /></span>}</td>
                    <td>{record.recordType}</td>
                    <td>{record.filterName || "Not set"}</td>
                    <td>{record.enhancement || "Not set"}</td>
                    <td><Link href={`/records/${record.id}`} className="record-title">{record.title || record.description || "Untitled record"}</Link></td>
                    <td>{new Date(record.acquisitionAt).toLocaleDateString("en-GB")}</td>
                    <td>{record.authorName || record.authorEmail}</td>
                    <td><span className={`visibility-badge ${record.visibility}`}>{record.visibility}</span></td>
                    <td>{record.objectName || record.siteName || "Unlinked"}</td>
                    <td>{record.status}</td>
                    <td>{record.canEdit ? <Link className="icon-action" href={`/records/${record.id}/edit`} title="Edit record"><Pencil size={14} /></Link> : null}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <div className="catalog-cards">{records.map((record) => {
              const Icon = recordIcon(record.recordType);
              const preview = previews.get(record.id);
              return <article className="catalog-card" key={record.id}>
                <Link href={`/records/${record.id}`} className="catalog-card-main">
                  {preview ? <img src={preview} alt="" /> : <div className="catalog-card-placeholder"><Icon size={22} /></div>}
                  <div><span className="catalog-meta">{record.recordType} · {new Date(record.acquisitionAt).toLocaleDateString("en-GB")}</span><strong>{record.title || record.description || "Untitled record"}</strong><p>{record.objectName || record.siteName || "Not linked yet"}</p><span className={`visibility-badge ${record.visibility}`}>{record.visibility}</span></div>
                </Link>
                {record.canEdit ? <Link className="catalog-card-edit" href={`/records/${record.id}/edit`}><Pencil size={14} /> Edit</Link> : null}
              </article>;
            })}</div>
          </>
        ) : <div className="empty-state"><h3>No records yet</h3><p>Add the first note, photograph or document for {selectedProject.name} above.</p></div>}
      </section>
    </AppShell>
  );
}
