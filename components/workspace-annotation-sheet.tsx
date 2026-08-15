"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Crosshair, ExternalLink, Focus, Pencil, Save, X } from "lucide-react";
import type { SpatialAnnotation, WorkspaceRepresentation } from "@/lib/spatial";
import styles from "./workspace-viewer.module.css";

type SiteRef = { id: string; code: string | null; name: string };
type ObjectRef = { id: string; siteId: string; parentObjectId: string | null; objectType: string; code: string | null; name: string };
type PendingPoint = { representationId: string; point: [number, number, number] };
type ProjectRef = { id: string; slug: string; name: string; role: string; currentUserEmail: string };

type Props = {
  project: ProjectRef;
  representation: WorkspaceRepresentation;
  sites: SiteRef[];
  objects: ObjectRef[];
  pendingPoint?: PendingPoint | null;
  annotation?: SpatialAnnotation | null;
  onClose: () => void;
  onFocus?: () => void;
  onSaved?: () => void;
};

function statusLabel(status: string) {
  if (status === "verified") return "Verified";
  if (status === "reviewed") return "Reviewed";
  return "Draft";
}

export default function WorkspaceAnnotationSheet({ project, representation, sites, objects, pendingPoint, annotation, onClose, onFocus, onSaved }: Props) {
  const router = useRouter();
  const isNew = Boolean(pendingPoint);
  const canEdit = isNew || Boolean(annotation && (["owner", "admin"].includes(project.role) || annotation.authorEmail.toLowerCase() === project.currentUserEmail.toLowerCase()));
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState(annotation?.title || "");
  const [description, setDescription] = useState(annotation?.description || "");
  const [visibility, setVisibility] = useState(annotation?.visibility || "project");
  const [status, setStatus] = useState(annotation?.status || "draft");
  const [siteId, setSiteId] = useState(annotation?.siteId || representation.siteId || "");
  const [physicalObjectId, setPhysicalObjectId] = useState(annotation?.physicalObjectId || representation.physicalObjectId || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const objectChoices = useMemo(() => objects.filter((item) => !siteId || item.siteId === siteId), [objects, siteId]);

  async function saveNew() {
    if (!pendingPoint) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspace/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: representation.projectId,
          representationId: representation.id,
          siteId: siteId || null,
          physicalObjectId: physicalObjectId || null,
          title,
          description,
          visibility,
          point: pendingPoint.point
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save the spatial observation.");
      onSaved?.();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the spatial observation.");
    } finally {
      setBusy(false);
    }
  }

  async function saveExisting() {
    if (!annotation) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspace/annotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: annotation.recordId,
          title,
          description,
          visibility,
          status,
          siteId: siteId || null,
          physicalObjectId: physicalObjectId || null
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not update the spatial observation.");
      setEditing(false);
      setMessage("Saved");
      onSaved?.();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the spatial observation.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void (isNew ? saveNew() : saveExisting());
  }

  return (
    <aside className={styles.annotationSheet} aria-label={isNew ? "New spatial observation" : "Spatial observation details"}>
      <div className={styles.sheetHandle} aria-hidden="true" />
      <div className={styles.sheetHeader}>
        <div>
          <p className={styles.eyebrow}>{isNew ? "New spatial observation" : "Selected evidence"}</p>
          <h3>{isNew ? "Add evidence at this point" : annotation?.title || "Spatial observation"}</h3>
        </div>
        <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close annotation panel"><X size={18} /></button>
      </div>

      {editing ? (
        <form className={styles.sheetForm} onSubmit={submit}>
          {pendingPoint ? <div className={styles.locationChip}><Crosshair size={13} /> XYZ {pendingPoint.point.map((value) => value.toFixed(3)).join(", ")}</div> : null}
          <label className={styles.sheetWide}><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. mortar loss at wall edge" autoFocus={isNew} /></label>
          <label className={styles.sheetWide}><span>Observation</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Record what is visible. Interpretation can follow later." /></label>
          <div className={styles.sheetGrid}>
            <label><span>Site</span><select value={siteId} onChange={(event) => { setSiteId(event.target.value); setPhysicalObjectId(""); }}><option value="">No site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.code ? `${site.code} · ` : ""}{site.name}</option>)}</select></label>
            <label><span>Object / area</span><select value={physicalObjectId} onChange={(event) => setPhysicalObjectId(event.target.value)}><option value="">Link later</option>{objectChoices.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</option>)}</select></label>
            <label><span>Visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "project" | "public")}><option value="private">Private</option><option value="project">Project</option><option value="public">Public</option></select></label>
            {!isNew ? <label><span>Review state</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="verified">Verified</option></select></label> : null}
          </div>
          {!isNew ? <p className={styles.reviewHint}>Draft = captured but unchecked. Reviewed = assessed by a project member. Verified = confirmed as project evidence.</p> : null}
          {message ? <div className={styles.notice}>{message}</div> : null}
          <div className={styles.sheetActions}>
            {!isNew ? <button className={styles.secondarySheetButton} type="button" onClick={() => setEditing(false)}>Cancel</button> : <button className={styles.secondarySheetButton} type="button" onClick={onClose}>Cancel</button>}
            <button className={styles.primarySheetButton} type="submit" disabled={busy}><Save size={15} /> {busy ? "Saving..." : isNew ? "Save observation" : "Save changes"}</button>
          </div>
        </form>
      ) : annotation ? (
        <div className={styles.sheetBody}>
          <div className={styles.annotationSummaryTop}>
            <span className={`${styles.reviewBadge} ${styles[`review_${annotation.status}`] || ""}`}><CheckCircle2 size={13} /> {statusLabel(annotation.status)}</span>
            <span className={styles.visibilityChip}>{annotation.visibility}</span>
          </div>
          <p className={styles.sheetDescription}>{annotation.description || "No observation text yet."}</p>
          <dl className={styles.sheetMeta}>
            <div><dt>Layer</dt><dd>{representation.name}</dd></div>
            <div><dt>Context</dt><dd>{annotation.objectName || annotation.siteName || "Unlinked"}</dd></div>
            <div><dt>Author</dt><dd>{annotation.authorName || annotation.authorEmail}</dd></div>
            <div><dt>XYZ</dt><dd>{[annotation.x, annotation.y, annotation.z].map((value) => value.toFixed(3)).join(", ")}</dd></div>
          </dl>
          {message ? <div className={styles.successNotice}>{message}</div> : null}
          <div className={styles.sheetActionsWrap}>
            <button className={styles.secondarySheetButton} type="button" onClick={onFocus}><Focus size={15} /> Recenter</button>
            {canEdit ? <button className={styles.secondarySheetButton} type="button" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button> : null}
            <Link className={styles.primarySheetLink} href={`/records/${annotation.recordId}`}><ExternalLink size={15} /> Full record</Link>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
