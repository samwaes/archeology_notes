import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { getRecordForUser, listObjectsForProject, listSitesForProject } from "@/lib/records";
import { updateRecordAction } from "./actions";

export const dynamic = "force-dynamic";

function localInputValue(value: string | Date) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const record = await getRecordForUser(id, user.localUserId);
  if (!record || !record.can_edit) notFound();

  const [sites, objects] = await Promise.all([
    listSitesForProject(String(record.project_id)),
    listObjectsForProject(String(record.project_id))
  ]);

  return (
    <AppShell user={user} active="Catalog">
      <div className="record-detail-header edit-header">
        <Link href={`/records/${id}`} className="back-link"><ArrowLeft size={15} /> Record</Link>
        <div className="record-detail-title"><p className="eyebrow">Edit catalog record</p><h1>{record.title ? String(record.title) : "Untitled record"}</h1></div>
      </div>

      <section className="quick-add-panel record-edit-panel">
        <div className="panel-heading"><div><p className="eyebrow">Metadata and interpretation</p><h2>Edit record</h2></div><p>The original author and original file stay unchanged. Edits are written to the project audit history.</p></div>
        <form action={updateRecordAction} className="record-form">
          <input type="hidden" name="recordId" value={id} />
          <label><span>Type</span><select name="recordType" defaultValue={String(record.record_type)}><option value="note">Note</option><option value="photo">Photo</option><option value="document">Document</option><option value="observation">Observation</option><option value="measurement">Measurement</option><option value="voice">Voice</option></select></label>
          <label><span>Visibility</span><select name="visibility" defaultValue={String(record.visibility)}><option value="private">Private</option><option value="project">Project</option><option value="public">Public</option></select></label>
          <label><span>Status</span><select name="status" defaultValue={String(record.status)}><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="verified">Verified</option></select></label>
          <label><span>Acquisition date</span><input type="datetime-local" name="acquisitionAt" required defaultValue={localInputValue(record.acquisition_at)} /></label>
          <label><span>Site</span><select name="siteId" defaultValue={record.site_id ? String(record.site_id) : ""}><option value="">No site</option>{sites.map((site) => <option value={String(site.id)} key={String(site.id)}>{String(site.name)}</option>)}</select></label>
          <label><span>Physical object</span><select name="physicalObjectId" defaultValue={record.physical_object_id ? String(record.physical_object_id) : ""}><option value="">Link later</option>{objects.map((object) => <option value={String(object.id)} key={String(object.id)}>{String(object.name)}</option>)}</select></label>
          <label className="wide"><span>Title</span><input name="title" defaultValue={record.title ? String(record.title) : ""} /></label>
          <label className="wide"><span>Description / note</span><textarea name="description" rows={5} defaultValue={record.description ? String(record.description) : ""} /></label>
          <label><span>Filter</span><input name="filterName" defaultValue={record.filter_name ? String(record.filter_name) : ""} placeholder="Visible, UV, IR..." /></label>
          <label><span>Enhancement</span><input name="enhancement" defaultValue={record.enhancement ? String(record.enhancement) : ""} placeholder="None, inverted..." /></label>
          <label className="wide"><span>Additional information</span><textarea name="additionalInformation" rows={3} defaultValue={record.additional_information ? String(record.additional_information) : ""} /></label>
          <div className="wide edit-provenance-note"><strong>Preserved</strong><span>Author: {String(record.author_name || record.author_email)} · original creation: {new Date(record.created_at).toLocaleString("en-GB")}</span></div>
          <button className="primary-button" type="submit"><Save size={16} /> Save changes</button>
        </form>
      </section>
    </AppShell>
  );
}
