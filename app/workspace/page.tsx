import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Database, MapPin } from "lucide-react";
import AppShell from "@/components/app-shell";
import WorkspaceViewer from "@/components/workspace-viewer";
import { requireCurrentUser } from "@/lib/current-user";
import { listProjectsForUser } from "@/lib/records";
import { getWorkspaceRepresentation, listSpatialAnnotations } from "@/lib/spatial";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ project?: string; record?: string }> }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const projects = await listProjectsForUser(user.localUserId);
  if (!projects.length) notFound();
  const requestedSlug = params.project && projects.some((project) => project.slug === params.project) ? params.project : null;
  const selectedSlug = requestedSlug || (projects.some((project) => project.slug === "casignana") ? "casignana" : projects[0].slug);
  const representation = await getWorkspaceRepresentation(selectedSlug, user.localUserId);
  const annotations = representation ? await listSpatialAnnotations(representation.projectId, user.localUserId) : [];
  const selectedProject = projects.find((project) => project.slug === selectedSlug) || projects[0];

  return (
    <AppShell user={user} active="3D Workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Phase 3 · spatial workspace</p>
          <h1>Photographic 3D workspace</h1>
          <p>Navigate the real survey, switch representation views, and attach normal Catalog records directly to XYZ positions on the physical scene.</p>
        </div>
        <div className="workspace-project-switcher">
          <span><Box size={15} /> Project</span>
          <div className="workspace-project-links">
            {projects.map((project) => <Link key={project.slug} className={project.slug === selectedSlug ? "active" : ""} href={`/workspace?project=${encodeURIComponent(project.slug)}`}>{project.name}</Link>)}
          </div>
        </div>
      </header>

      {representation ? <WorkspaceViewer representation={representation} annotations={annotations} focusRecordId={params.record || null} /> : (
        <section className="future-workspace">
          <div className="future-scene"><Box size={64} /><span>No 3D representation yet</span><small>{selectedProject.name}</small></div>
          <div className="future-notes">
            <div><MapPin size={19} /><span><strong>Create the spatial context first</strong><small>Phase 3 currently seeds the supplied Casignana photogrammetry representation. Other projects can receive representations in the next ingestion slice.</small></span></div>
            <div><Database size={19} /><span><strong>Catalog remains available</strong><small>Records can already be captured and classified before a 3D representation is registered.</small></span></div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
