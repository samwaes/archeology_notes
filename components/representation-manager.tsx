"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileArchive, FileUp, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import type { RegistrationStatus, WorkspaceRepresentation } from "@/lib/spatial";
import styles from "./workspace-viewer.module.css";

type ProjectRef = { id: string; slug: string; name: string; role: string };
type SiteRef = { id: string; code: string | null; name: string };
type ObjectRef = { id: string; siteId: string; parentObjectId: string | null; objectType: string; code: string | null; name: string };

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseMatrix(value: string) {
  const numbers = value.split(/[\s,;]+/).filter(Boolean).map(Number);
  return numbers.length === 16 && numbers.every(Number.isFinite) ? numbers : null;
}

export default function RepresentationManager({
  project,
  representations,
  activeRepresentation,
  sites,
  objects
}: {
  project: ProjectRef;
  representations: WorkspaceRepresentation[];
  activeRepresentation: WorkspaceRepresentation | null;
  sites: SiteRef[];
  objects: ObjectRef[];
}) {
  const router = useRouter();
  const canManage = ["owner", "admin"].includes(project.role);
  const [createOpen, setCreateOpen] = useState(!representations.length);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState("point_cloud");
  const [createSiteId, setCreateSiteId] = useState("");
  const [createObjectId, setCreateObjectId] = useState("");
  const [createParentId, setCreateParentId] = useState("");
  const [createAcquisitionAt, setCreateAcquisitionAt] = useState("");
  const [createCoordinateSystem, setCreateCoordinateSystem] = useState("");
  const [createSourceFormat, setCreateSourceFormat] = useState("e57");
  const [createStatus, setCreateStatus] = useState<RegistrationStatus>("unregistered");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [webFile, setWebFile] = useState<File | null>(null);
  const [useSourceAsWeb, setUseSourceAsWeb] = useState(false);
  const [uploadBusy, setUploadBusy] = useState<"source" | "web" | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");

  const [matrixText, setMatrixText] = useState(() => (activeRepresentation?.transformMatrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).join(" "));
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>(activeRepresentation?.registrationStatus || "unregistered");
  const [registrationRmse, setRegistrationRmse] = useState(activeRepresentation?.registrationRmseMm?.toString() || "");
  const [registrationUncertainty, setRegistrationUncertainty] = useState(activeRepresentation?.registrationUncertaintyMm?.toString() || "");
  const [resolution, setResolution] = useState(activeRepresentation?.nominalResolutionMm?.toString() || "");
  const [registrationNotes, setRegistrationNotes] = useState(activeRepresentation?.registrationNotes || "");
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");

  const siteObjects = useMemo(() => objects.filter((object) => !createSiteId || object.siteId === createSiteId), [objects, createSiteId]);

  async function createLayer() {
    if (!createName.trim()) return;
    setCreateBusy(true);
    setCreateMessage("");
    try {
      const response = await fetch("/api/workspace/representations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: project.slug,
          name: createName,
          representationType: createType,
          siteId: createSiteId || null,
          physicalObjectId: createObjectId || null,
          parentRepresentationId: createParentId || null,
          acquisitionAt: createAcquisitionAt || null,
          coordinateSystem: createCoordinateSystem || null,
          sourceFormat: createSourceFormat || null,
          webFormat: createType === "point_cloud" ? "copc.laz" : createType === "photogrammetry" || createType === "mesh" ? "glb" : null,
          registrationStatus: createStatus
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not create representation.");
      setCreateMessage("Representation created.");
      router.refresh();
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : "Could not create representation.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function uploadAsset(kind: "source" | "web") {
    if (!activeRepresentation) return;
    const file = kind === "source" ? sourceFile : webFile;
    if (!file) return;
    setUploadBusy(kind);
    setUploadMessage(kind === "source" ? "Preserving source in private R2..." : "Uploading browser derivative...");
    try {
      const data = new FormData();
      data.append("projectSlug", project.slug);
      data.append("representationId", activeRepresentation.id);
      data.append("assetKind", kind);
      data.append("file", file);
      if (kind === "source" && useSourceAsWeb) data.append("useAsWeb", "true");
      const response = await fetch("/api/workspace/model", { method: "POST", body: data });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed.");
      setUploadMessage("Stored in private R2. Reloading layer metadata...");
      router.refresh();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadBusy(null);
    }
  }

  async function saveRegistration() {
    if (!activeRepresentation) return;
    const matrix = parseMatrix(matrixText);
    if (!matrix) {
      setRegistrationMessage("Enter exactly 16 finite matrix values.");
      return;
    }
    setRegistrationBusy(true);
    setRegistrationMessage("");
    try {
      const response = await fetch("/api/workspace/representations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          representationId: activeRepresentation.id,
          transformMatrix: matrix,
          registrationStatus,
          registrationRmseMm: numberOrNull(registrationRmse),
          registrationUncertaintyMm: numberOrNull(registrationUncertainty),
          nominalResolutionMm: numberOrNull(resolution),
          registrationNotes: registrationNotes || null
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save registration.");
      setRegistrationMessage("Registration metadata saved.");
      router.refresh();
    } catch (error) {
      setRegistrationMessage(error instanceof Error ? error.message : "Could not save registration.");
    } finally {
      setRegistrationBusy(false);
    }
  }

  if (!canManage) return null;

  return <section className={styles.panel}>
    <div className={styles.panelHeading}>
      <div><p className={styles.eyebrow}>Representation management</p><h3>Survey assets and registration</h3></div>
      <button className={styles.smallButton} onClick={() => setCreateOpen((value) => !value)}><Plus size={13} /> Add layer</button>
    </div>

    {createOpen ? <form className={styles.managerForm} onSubmit={(event) => { event.preventDefault(); void createLayer(); }}>
      <label><span>Name</span><input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="e.g. East wall TLS 2026" /></label>
      <div className={styles.formGrid2}>
        <label><span>Type</span><select value={createType} onChange={(event) => setCreateType(event.target.value)}><option value="point_cloud">Point cloud</option><option value="photogrammetry">Photogrammetry</option><option value="mesh">Mesh</option><option value="other">Other</option></select></label>
        <label><span>Source format</span><select value={createSourceFormat} onChange={(event) => setCreateSourceFormat(event.target.value)}><option value="e57">E57</option><option value="las">LAS</option><option value="laz">LAZ</option><option value="copc.laz">COPC</option><option value="obj">OBJ</option><option value="ply">PLY</option><option value="glb">GLB</option></select></label>
      </div>
      <div className={styles.formGrid2}>
        <label><span>Site</span><select value={createSiteId} onChange={(event) => { setCreateSiteId(event.target.value); setCreateObjectId(""); }}><option value="">Project level</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.code ? `${site.code} · ` : ""}{site.name}</option>)}</select></label>
        <label><span>Physical object</span><select value={createObjectId} onChange={(event) => setCreateObjectId(event.target.value)}><option value="">Not object-specific</option>{siteObjects.map((object) => <option key={object.id} value={object.id}>{object.code ? `${object.code} · ` : ""}{object.name}</option>)}</select></label>
      </div>
      <div className={styles.formGrid2}>
        <label><span>Detail of representation</span><select value={createParentId} onChange={(event) => setCreateParentId(event.target.value)}><option value="">Independent layer</option>{representations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Acquisition date</span><input type="datetime-local" value={createAcquisitionAt} onChange={(event) => setCreateAcquisitionAt(event.target.value)} /></label>
      </div>
      <label><span>Coordinate system / local frame</span><input value={createCoordinateSystem} onChange={(event) => setCreateCoordinateSystem(event.target.value)} placeholder="EPSG:xxxx or local scan coordinates" /></label>
      <label><span>Registration state</span><select value={createStatus} onChange={(event) => setCreateStatus(event.target.value as RegistrationStatus)}><option value="unregistered">Unregistered</option><option value="approximate">Approximate</option><option value="registered">Registered</option><option value="verified">Verified</option></select></label>
      <button disabled={createBusy}><Plus size={14} /> {createBusy ? "Creating..." : "Create representation"}</button>
      {createMessage ? <span className={styles.uploadMessage}>{createMessage}</span> : null}
    </form> : null}

    {activeRepresentation ? <div className={styles.managerSections}>
      <div className={styles.managerSection}>
        <h4><FileArchive size={15} /> Preservation source</h4>
        <p>{activeRepresentation.sourceAssetFilename || "No source file preserved yet."}</p>
        <input type="file" accept=".obj,.glb,.ply,.e57,.las,.laz,.copc.laz" onChange={(event) => setSourceFile(event.target.files?.[0] || null)} />
        {sourceFile?.name.toLowerCase().endsWith(".copc.laz") ? <label className={styles.inlineCheck}><input type="checkbox" checked={useSourceAsWeb} onChange={(event) => setUseSourceAsWeb(event.target.checked)} /> Use this COPC source directly as the web stream</label> : null}
        <button className={styles.secondaryAction} disabled={!sourceFile || uploadBusy !== null} onClick={() => void uploadAsset("source")}><FileUp size={14} /> {uploadBusy === "source" ? "Uploading..." : "Preserve source"}</button>
      </div>
      <div className={styles.managerSection}>
        <h4><FileUp size={15} /> Browser derivative</h4>
        <p>{activeRepresentation.webAssetFilename || "No web derivative yet."} {activeRepresentation.webFormat ? `(${activeRepresentation.webFormat})` : ""}</p>
        <input type="file" accept=".glb,.copc.laz" onChange={(event) => setWebFile(event.target.files?.[0] || null)} />
        <button className={styles.secondaryAction} disabled={!webFile || uploadBusy !== null} onClick={() => void uploadAsset("web")}><RefreshCw size={14} /> {uploadBusy === "web" ? "Uploading..." : activeRepresentation.webAssetId ? "Replace derivative" : "Upload derivative"}</button>
      </div>
      {uploadMessage ? <span className={styles.uploadMessage}>{uploadMessage}</span> : null}
      <details className={styles.registrationDetails}>
        <summary><ShieldCheck size={14} /> Registration and uncertainty</summary>
        <div className={styles.managerForm}>
          <div className={styles.formGrid2}>
            <label><span>Status</span><select value={registrationStatus} onChange={(event) => setRegistrationStatus(event.target.value as RegistrationStatus)}><option value="unregistered">Unregistered</option><option value="approximate">Approximate</option><option value="registered">Registered</option><option value="verified">Verified</option></select></label>
            <label><span>Nominal resolution (mm)</span><input inputMode="decimal" value={resolution} onChange={(event) => setResolution(event.target.value)} /></label>
          </div>
          <div className={styles.formGrid2}>
            <label><span>Registration RMSE (mm)</span><input inputMode="decimal" value={registrationRmse} onChange={(event) => setRegistrationRmse(event.target.value)} /></label>
            <label><span>Registration uncertainty (mm)</span><input inputMode="decimal" value={registrationUncertainty} onChange={(event) => setRegistrationUncertainty(event.target.value)} /></label>
          </div>
          <label><span>4×4 source-to-project transform</span><textarea rows={4} className={styles.matrixInput} value={matrixText} onChange={(event) => setMatrixText(event.target.value)} /></label>
          <label><span>Registration notes</span><textarea rows={3} value={registrationNotes} onChange={(event) => setRegistrationNotes(event.target.value)} placeholder="Control points, ICP method, reference layer, unresolved uncertainty..." /></label>
          <button disabled={registrationBusy} onClick={() => void saveRegistration()}><ShieldCheck size={14} /> {registrationBusy ? "Saving..." : "Save registration"}</button>
          {registrationMessage ? <span className={styles.uploadMessage}>{registrationMessage}</span> : null}
        </div>
      </details>
      <p className={styles.managerLimitNote}>Prototype upload limits are 220 MB for source files and 140 MB for browser derivatives. Multi-gigabyte institutional survey ingestion will use multipart upload and a conversion worker rather than browser form upload.</p>
    </div> : <p className={styles.detailText}>Create a representation before uploading survey assets.</p>}
  </section>;
}
