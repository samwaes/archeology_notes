import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import RecordEvidenceEditor from "@/components/record-evidence-editor";
import { requireCurrentUser } from "@/lib/current-user";
import { listRecordAssetsForUser, listRecordLinkCandidates, listRecordLinksForUser } from "@/lib/record-evidence";
import { getRecordForUser, listObjectsForProject, listSitesForProject } from "@/lib/records";
import { updateRecordAction } from "./actions";

export const dynamic = "force-dynamic";
function localInputValue(value: string | Date) { const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }

export default async function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const record = await getRecordForUser(id, user.localUserId);
  if (!record || !record.can_edit) notFound();
  const [sites, objects, assets, links, candidates] = await Promise.all([
    listSitesForProject(String(record.project_id)),
    listObjectsForProject(String(record.project_id)),
    listRecordAssetsForUser(id, user.localUserId),
    listRecordLinksForUser(id, user.localUserId),
    listRecordLinkCandidates(id, user.localUserId)
  ]);
  const isConservation = ["condition", "intervention"].includes(String(record.record_type));

  return <AppShell user={user} active={isConservation ? "Conservation" : "Catalog"}>
    <div className="record-detail-header edit-header"><Link href={`/records/${id}`} className="back-link"><ArrowLeft size={15} /> Record</Link><div className="record-detail-title"><p className="eyebrow">Edit catalog record</p><h1>{record.title ? String(record.title) : "Untitled record"}</h1></div></div>
    <section className="quick-add-panel record-edit-panel"><div className="panel-heading"><div><p className="eyebrow">Metadata and interpretation</p><h2>Edit record</h2></div><p>The original author and original files stay unchanged. Add supporting evidence below instead of replacing provenance.</p></div><form action={updateRecordAction} className="record-form"><input type="hidden" name="recordId" value={id}/><label><span>Type</span><select name="recordType" defaultValue={String(record.record_type)}><option value="note">Note</option><option value="photo">Photo</option><option value="document">Document</option><option value="observation">Observation</option><option value="measurement">Measurement</option><option value="voice">Voice</option><option value="condition">Condition</option><option value="intervention">Intervention</option></select></label><label><span>Visibility</span><select name="visibility" defaultValue={String(record.visibility)}><option value="private">Private</option><option value="project">Project</option><option value="public">Public</option></select></label><label><span>Status</span><select name="status" defaultValue={String(record.status)}><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="verified">Verified</option></select></label><label><span>Acquisition date</span><input type="datetime-local" name="acquisitionAt" required defaultValue={localInputValue(record.acquisition_at)}/></label><label><span>Site</span><select name="siteId" defaultValue={record.site_id?String(record.site_id):""}><option value="">No site</option>{sites.map((site)=><option value={String(site.id)} key={String(site.id)}>{String(site.name)}</option>)}</select></label><label><span>Physical object</span><select name="physicalObjectId" defaultValue={record.physical_object_id?String(record.physical_object_id):""}><option value="">Link later</option>{objects.map((object)=><option value={String(object.id)} key={String(object.id)}>{String(object.name)}</option>)}</select></label><label className="wide"><span>Title</span><input name="title" defaultValue={record.title?String(record.title):""}/></label><label className="wide"><span>Description / note</span><textarea name="description" rows={5} defaultValue={record.description?String(record.description):""}/></label><label><span>Filter</span><input name="filterName" defaultValue={record.filter_name?String(record.filter_name):""} placeholder="Visible, UV, IR..."/></label><label><span>Enhancement</span><input name="enhancement" defaultValue={record.enhancement?String(record.enhancement):""} placeholder="None, inverted..."/></label><label className="wide"><span>Additional information</span><textarea name="additionalInformation" rows={3} defaultValue={record.additional_information?String(record.additional_information):""}/></label><div className="wide edit-provenance-note"><strong>Preserved</strong><span>Author: {String(record.author_name||record.author_email)} · original creation: {new Date(record.created_at).toLocaleString("en-GB")}</span></div>{isConservation?<div className="wide form-note">Use the Conservation workspace to add or review condition severity, confidence, priority, intervention method and linked before/after evidence.</div>:null}<button className="primary-button" type="submit"><Save size={16}/> Save metadata</button></form></section>

    <RecordEvidenceEditor
      record={{ id, projectSlug: String(record.project_slug), siteId: record.site_id ? String(record.site_id) : null, physicalObjectId: record.physical_object_id ? String(record.physical_object_id) : null, visibility: String(record.visibility) }}
      assets={assets.map((asset) => ({ id: String(asset.id), original_filename: String(asset.original_filename), mime_type: asset.mime_type ? String(asset.mime_type) : null, file_size: asset.file_size === null || asset.file_size === undefined ? null : Number(asset.file_size), role: String(asset.role) }))}
      links={links.map((link) => ({ related_record_id: String(link.related_record_id), related_record_type: String(link.related_record_type), related_title: link.related_title ? String(link.related_title) : null, related_description: link.related_description ? String(link.related_description) : null, related_acquisition_at: new Date(link.related_acquisition_at).toISOString(), related_author_name: link.related_author_name ? String(link.related_author_name) : null, related_author_email: String(link.related_author_email), relationship_type: String(link.relationship_type), direction: String(link.direction) }))}
      candidates={candidates.map((candidate) => ({ id: String(candidate.id), record_type: String(candidate.record_type), title: candidate.title ? String(candidate.title) : null, description: candidate.description ? String(candidate.description) : null, acquisition_at: new Date(candidate.acquisition_at).toISOString(), site_name: candidate.site_name ? String(candidate.site_name) : null, object_name: candidate.object_name ? String(candidate.object_name) : null }))}
    />
  </AppShell>;
}
