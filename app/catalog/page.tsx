import Link from "next/link";
import { Camera, FileText, Mic, Plus, Shield, Users } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { getProjectForUser, listCatalogRecords, listObjectsForProject, listSitesForProject } from "@/lib/records";
import { signedAssetUrl } from "@/lib/r2";
import { createRecordAction } from "./actions";

export const dynamic = "force-dynamic";

function recordIcon(type: string) {
  if (type === "photo") return Camera;
  if (type === "voice") return Mic;
  return FileText;
}

export default async function CatalogPage() {
  const user = await requireCurrentUser();
  const project = await getProjectForUser("casignana", user.localUserId);
  if (!project) throw new Error("Casignana pilot project is unavailable.");

  const [records, sites, objects] = await Promise.all([
    listCatalogRecords(String(project.id), user.localUserId),
    listSitesForProject(String(project.id)),
    listObjectsForProject(String(project.id))
  ]);

  const previews = new Map<string, string>();
  await Promise.all(records.map(async (record) => {
    if (record.assetR2Key && record.assetMimeType?.startsWith("image/")) {
      previews.set(record.id, await signedAssetUrl(record.assetR2Key, 600));
    }
  }));

  return (
    <AppShell user={user} active="Catalog">
      <header className="workspace-header">
        <div><p className="eyebrow">Casignana · Phase 1</p><h1>Catalog</h1><p>One overview for field notes, photographs, documents and observations. Authorship and visibility stay attached to every record.</p></div>
        <div className="header-stat"><strong>{records.length}</strong><span>visible records</span></div>
      </header>

      <section className="quick-add-panel">
        <div className="panel-heading"><div><p className="eyebrow">Capture</p><h2>Add a record</h2></div><p>Capture now and refine later. Only the record type, visibility and description are essential for a quick field entry.</p></div>
        <form action={createRecordAction} className="record-form">
          <input type="hidden" name="projectSlug" value="casignana" />
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
        <p className="form-note"><Shield size={13} /> Private records remain visible only to their author. Project records are visible to the Casignana team. Public is modeled now but external anonymous publishing remains disabled during the pilot.</p>
      </section>

      <section className="catalog-section">
        <div className="panel-heading"><div><p className="eyebrow">Evidence overview</p><h2>Records</h2></div><p><Users size={14} /> Each row keeps the original author and acquisition date, even when uploaded or processed later.</p></div>
        {records.length ? (
          <>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead><tr><th>ID</th><th>Preview</th><th>Type</th><th>Filter</th><th>Enhancement</th><th>Description</th><th>Acquisition</th><th>Author</th><th>Visibility</th><th>Context</th><th>Status</th></tr></thead>
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
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <div className="catalog-cards">{records.map((record) => {
              const Icon = recordIcon(record.recordType);
              const preview = previews.get(record.id);
              return <Link href={`/records/${record.id}`} className="catalog-card" key={record.id}>
                {preview ? <img src={preview} alt="" /> : <div className="catalog-card-placeholder"><Icon size={22} /></div>}
                <div><span className="catalog-meta">{record.recordType} · {new Date(record.acquisitionAt).toLocaleDateString("en-GB")}</span><strong>{record.title || record.description || "Untitled record"}</strong><p>{record.objectName || record.siteName || "Not linked yet"}</p><span className={`visibility-badge ${record.visibility}`}>{record.visibility}</span></div>
              </Link>;
            })}</div>
          </>
        ) : <div className="empty-state"><h3>No records yet</h3><p>Add the first Casignana note or photograph above.</p></div>}
      </section>
    </AppShell>
  );
}
