import Link from "next/link";
import { notFound } from "next/navigation";
import { Box } from "lucide-react";
import AppShell from "@/components/app-shell";
import WorkspaceViewer from "@/components/workspace-viewer";
import { requireCurrentUser } from "@/lib/current-user";
import { listObjectsForProject, listProjectsForUser, listSitesForProject } from "@/lib/records";
import { listSpatialAnnotations, listWorkspaceRepresentations } from "@/lib/spatial";
import styles from "./workspace.module.css";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ project?: string; record?: string }> }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const projects = await listProjectsForUser(user.localUserId);
  if (!projects.length) notFound();
  const requestedSlug = params.project && projects.some((project) => project.slug === params.project) ? params.project : null;
  const selectedSlug = requestedSlug || (projects.some((project) => project.slug === "casignana") ? "casignana" : projects[0].slug);
  const selectedProject = projects.find((project) => project.slug === selectedSlug) || projects[0];
  const [representations, sites, objects] = await Promise.all([
    listWorkspaceRepresentations(selectedSlug, user.localUserId),
    listSitesForProject(selectedProject.id),
    listObjectsForProject(selectedProject.id)
  ]);
  const annotations = await listSpatialAnnotations(selectedProject.id, user.localUserId);
  const viewerKey = `${selectedProject.id}:${representations.map((item) => `${item.id}:${item.webAssetId || "none"}:${item.sourceAssetId || "none"}`).join("|")}:${annotations.length}`;

  return (
    <AppShell user={user} active="3D Workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">3D evidence workspace</p>
          <h1>Survey layers in one spatial context</h1>
          <p>Navigate the survey, place observations directly on the evidence, review existing annotations and keep the spatial link connected to the Catalog record.</p>
        </div>
        <div className={styles.switcher}>
          <span className={styles.label}><Box size={15} /> Project</span>
          <div className={styles.links}>
            {projects.map((project) => <Link key={project.slug} className={project.slug === selectedSlug ? styles.active : ""} href={`/workspace?project=${encodeURIComponent(project.slug)}`}>{project.name}</Link>)}
          </div>
        </div>
      </header>

      <WorkspaceViewer
        key={viewerKey}
        project={{ id: selectedProject.id, slug: selectedProject.slug, name: selectedProject.name, role: selectedProject.role, currentUserEmail: user.email }}
        representations={representations}
        annotations={annotations}
        sites={sites.map((site) => ({ id: String(site.id), code: site.code ? String(site.code) : null, name: String(site.name) }))}
        objects={objects.map((object) => ({
          id: String(object.id),
          siteId: String(object.site_id),
          parentObjectId: object.parent_object_id ? String(object.parent_object_id) : null,
          objectType: String(object.object_type),
          code: object.code ? String(object.code) : null,
          name: String(object.name)
        }))}
        focusRecordId={params.record || null}
      />
    </AppShell>
  );
}
