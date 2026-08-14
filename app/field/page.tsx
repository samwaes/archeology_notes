import Link from "next/link";
import { MapPin, Mic, Navigation, Smartphone } from "lucide-react";
import AppShell from "@/components/app-shell";
import FieldCapture from "@/components/field-capture";
import { requireCurrentUser } from "@/lib/current-user";
import { listRecentFieldRecordsForUser } from "@/lib/field-records";
import { listObjectsForProject, listProjectsForUser, listSitesForProject } from "@/lib/records";
import { transcriptionConfiguration } from "@/lib/transcription";

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  const user = await requireCurrentUser();
  const summaries = await listProjectsForUser(user.localUserId);
  const projects = await Promise.all(summaries.map(async (project) => {
    const [sites, objects] = await Promise.all([
      listSitesForProject(project.id),
      listObjectsForProject(project.id)
    ]);
    return {
      slug: project.slug,
      name: project.name,
      sites: sites.map((site) => ({
        id: String(site.id),
        name: String(site.name),
        code: site.code ? String(site.code) : null
      })),
      objects: objects.map((object) => ({
        id: String(object.id),
        siteId: String(object.site_id),
        name: String(object.name),
        code: object.code ? String(object.code) : null
      }))
    };
  }));
  const recent = await listRecentFieldRecordsForUser(user.localUserId, 12);
  const transcription = transcriptionConfiguration();

  return (
    <AppShell user={user} active="Field">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Phase 2 · field prototype</p>
          <h1>Capture first. Catalogue later.</h1>
          <p>Keep the project, site and object selected while you move through the field. Photos, voice notes, observations, measurements, author, time and GPS can be captured in one short workflow.</p>
        </div>
        <div className="header-stat"><strong>{recent.length}</strong><span>recent field records</span></div>
      </header>

      <FieldCapture projects={projects} transcriptionConfigured={transcription.configured} />

      <section className="content-panel" style={{ marginTop: 28 }}>
        <div className="panel-heading">
          <div><p className="eyebrow">Field inbox</p><h2>Captured onsite</h2></div>
          <p><Smartphone size={14} /> These entries can stay rough in the field. Use Catalog later to refine metadata, visibility, status and context.</p>
        </div>
        {recent.length ? (
          <div className="record-strip">
            {recent.map((record) => (
              <Link href={`/records/${String(record.id)}`} key={String(record.id)}>
                <span>{String(record.record_type)} · {new Date(record.acquisition_at).toLocaleString("en-GB")}</span>
                <strong>{String(record.title || record.description || "Untitled field record")}</strong>
                <small>{String(record.project_name)} · {String(record.object_name || record.site_name || "Link later")}</small>
                <small>{record.latitude !== null ? <><MapPin size={11} /> GPS attached</> : <><Navigation size={11} /> No GPS</>} {String(record.record_type) === "voice" ? <> · <Mic size={11} /> {String(record.transcription_status)}</> : null}</small>
              </Link>
            ))}
          </div>
        ) : <div className="empty-state"><h3>No field records yet</h3><p>Use the capture controls above to create the first onsite observation.</p></div>}
      </section>

      <p className="small-note" style={{ marginTop: 16 }}>Field context is retained on the device between captures. Linking a record directly to a point or region in the 3D model arrives in Phase 3.</p>
    </AppShell>
  );
}
