"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Camera, Crosshair, Eye, Focus, Layers3, MapPin, ScanLine, Upload } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { SpatialAnnotation, WorkspaceRepresentation } from "@/lib/spatial";
import styles from "./workspace-viewer.module.css";

type ViewMode = "photo" | "points" | "hybrid";
type CameraPreset = "overview" | "top" | "apse" | "floor" | "wall";

function bytesLabel(value: number | null) {
  if (!value) return "Not uploaded";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

export default function WorkspaceViewer({
  representation,
  annotations,
  focusRecordId
}: {
  representation: WorkspaceRepresentation;
  annotations: SpatialAnnotation[];
  focusRecordId?: string | null;
}) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRootRef = useRef<THREE.Object3D | null>(null);
  const pointsRootRef = useRef<THREE.Group | null>(null);
  const raycastMeshesRef = useRef<THREE.Mesh[]>([]);
  const pinsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingPinRef = useRef<HTMLButtonElement | null>(null);
  const annotateRef = useRef(false);
  const [mode, setMode] = useState<ViewMode>("photo");
  const [annotate, setAnnotate] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<[number, number, number] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => annotations.find((item) => item.recordId === focusRecordId)?.id || annotations[0]?.id || null);
  const [loading, setLoading] = useState(Boolean(representation.webAssetId));
  const [loadError, setLoadError] = useState("");
  const [modelStats, setModelStats] = useState({ meshes: 0, vertices: 0 });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("project");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const selected = useMemo(() => annotations.find((item) => item.id === selectedId) || null, [annotations, selectedId]);
  const modelUrl = representation.webAssetId ? `/api/workspace/model/${representation.id}` : null;

  useEffect(() => { annotateRef.current = annotate; }, [annotate]);

  useEffect(() => {
    const root = meshRootRef.current;
    const points = pointsRootRef.current;
    if (!root || !points) return;
    root.visible = mode !== "points";
    points.visible = mode !== "photo";
    points.traverse((object) => {
      if (object instanceof THREE.Points) {
        const material = object.material as THREE.PointsMaterial;
        material.opacity = mode === "hybrid" ? 0.32 : 0.92;
        material.size = mode === "hybrid" ? 0.025 : 0.045;
      }
    });
  }, [mode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !modelUrl) return;
    let active = true;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101713);
    scene.fog = new THREE.FogExp2(0x101713, 0.012);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 180);
    camera.position.set(18, 10, 20);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xf5f0e6, 0x25332e, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(8, 18, 12);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8e8df, 0.7);
    fill.position.set(-12, 7, -8);
    scene.add(fill);

    const grid = new THREE.GridHelper(34, 34, 0x516259, 0x27362f);
    grid.position.y = -3.08;
    scene.add(grid);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      camera.aspect = Math.max(0.1, rect.width / Math.max(rect.height, 1));
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const focusPoint = (point: THREE.Vector3, distance = 5.5) => {
      const direction = new THREE.Vector3(1, 0.7, 1).normalize();
      controls.target.copy(point);
      camera.position.copy(point.clone().add(direction.multiplyScalar(distance)));
      camera.lookAt(point);
      controls.update();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handleClick = (event: MouseEvent) => {
      if (!annotateRef.current || !raycastMeshesRef.current.length) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(raycastMeshesRef.current, false)[0];
      if (!hit) return;
      setPendingPoint([hit.point.x, hit.point.y, hit.point.z]);
      setSelectedId(null);
      setSaveError("");
    };
    renderer.domElement.addEventListener("click", handleClick);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (!active) return;
        const root = gltf.scene;
        root.name = "Casignana photographic model";
        scene.add(root);
        meshRootRef.current = root;
        const raycastMeshes: THREE.Mesh[] = [];
        const pointGroup = new THREE.Group();
        pointGroup.name = "Dense vertices";
        let vertices = 0;
        let meshCount = 0;
        root.updateWorldMatrix(true, true);
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          meshCount += 1;
          raycastMeshes.push(object);
          const source = object.geometry.getAttribute("position");
          if (!source) return;
          vertices += source.count;
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(source.count * 3);
          const point = new THREE.Vector3();
          for (let index = 0; index < source.count; index += 1) {
            point.fromBufferAttribute(source, index).applyMatrix4(object.matrixWorld);
            positions[index * 3] = point.x;
            positions[index * 3 + 1] = point.y;
            positions[index * 3 + 2] = point.z;
          }
          geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          const material = new THREE.PointsMaterial({ color: 0xe9ddbf, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.92 });
          pointGroup.add(new THREE.Points(geometry, material));
        });
        raycastMeshesRef.current = raycastMeshes;
        scene.add(pointGroup);
        pointsRootRef.current = pointGroup;
        pointGroup.visible = false;

        const bounds = new THREE.Box3().setFromObject(root);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z);
        controls.target.copy(center);
        camera.position.copy(center.clone().add(new THREE.Vector3(radius * 0.9, radius * 0.55, radius * 0.95)));
        camera.lookAt(center);
        controls.update();
        setModelStats({ meshes: meshCount, vertices });
        setLoading(false);

        const focus = focusRecordId ? annotations.find((item) => item.recordId === focusRecordId) : null;
        if (focus) focusPoint(new THREE.Vector3(focus.x, focus.y, focus.z), Math.max(2.6, radius * 0.24));
      },
      undefined,
      (error) => {
        if (!active) return;
        console.error("[workspace.gltf]", error);
        setLoadError("The photographic GLB could not be loaded. The R2 asset is retained; try reloading or replace the web derivative.");
        setLoading(false);
      }
    );

    const animate = () => {
      controls.update();
      const rect = mount.getBoundingClientRect();
      for (const annotation of annotations) {
        const element = pinsRef.current[annotation.id];
        if (!element) continue;
        const vector = new THREE.Vector3(annotation.x, annotation.y, annotation.z).project(camera);
        element.style.left = `${(vector.x * 0.5 + 0.5) * rect.width}px`;
        element.style.top = `${(-vector.y * 0.5 + 0.5) * rect.height}px`;
        element.style.display = vector.z > -1 && vector.z < 1 ? "block" : "none";
      }
      if (pendingPoint && pendingPinRef.current) {
        const vector = new THREE.Vector3(...pendingPoint).project(camera);
        pendingPinRef.current.style.left = `${(vector.x * 0.5 + 0.5) * rect.width}px`;
        pendingPinRef.current.style.top = `${(-vector.y * 0.5 + 0.5) * rect.height}px`;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      pointsRootRef.current?.traverse((object) => {
        if (object instanceof THREE.Points) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      cameraRef.current = null;
      controlsRef.current = null;
      meshRootRef.current = null;
      pointsRootRef.current = null;
      raycastMeshesRef.current = [];
    };
  }, [annotations, focusRecordId, modelUrl, pendingPoint]);

  function setCameraPreset(preset: CameraPreset) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const target = preset === "apse" ? new THREE.Vector3(-8.3, -0.6, 0)
      : preset === "floor" ? new THREE.Vector3(-0.5, -2.1, 0)
      : preset === "wall" ? new THREE.Vector3(5.8, 0.1, 4.1)
      : new THREE.Vector3(-1, -0.4, 0);
    const position = preset === "top" ? new THREE.Vector3(-1, 25, 0)
      : preset === "apse" ? new THREE.Vector3(-17, 5, 11)
      : preset === "floor" ? new THREE.Vector3(7, 7.5, 12)
      : preset === "wall" ? new THREE.Vector3(15, 6, 13)
      : new THREE.Vector3(17, 10, 20);
    camera.up.set(0, 1, 0);
    if (preset === "top") camera.up.set(0, 0, -1);
    camera.position.copy(position);
    controls.target.copy(target);
    camera.lookAt(target);
    controls.update();
  }

  function focusAnnotation(annotation: SpatialAnnotation) {
    setSelectedId(annotation.id);
    setPendingPoint(null);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const point = new THREE.Vector3(annotation.x, annotation.y, annotation.z);
    controls.target.copy(point);
    camera.position.copy(point.clone().add(new THREE.Vector3(3.2, 2.4, 3.2)));
    camera.lookAt(point);
    controls.update();
  }

  async function saveAnnotation() {
    if (!pendingPoint) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/workspace/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: representation.projectId,
          representationId: representation.id,
          siteId: representation.siteId,
          physicalObjectId: representation.physicalObjectId,
          title,
          description,
          visibility,
          point: pendingPoint
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save the spatial observation.");
      setTitle("");
      setDescription("");
      setPendingPoint(null);
      setAnnotate(false);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the spatial observation.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadModel() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadMessage("Uploading photographic GLB to private R2...");
    try {
      const formData = new FormData();
      formData.append("projectSlug", representation.projectSlug);
      formData.append("representationId", representation.id);
      formData.append("file", uploadFile);
      const response = await fetch("/api/workspace/model", { method: "POST", body: formData });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Model upload failed.");
      setUploadMessage("Uploaded. Reloading photographic workspace...");
      router.refresh();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Model upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.viewerShell}>
        <div ref={mountRef} className={styles.canvas} />
        {modelUrl ? (
          <>
            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <button className={mode === "photo" ? styles.active : ""} onClick={() => setMode("photo")}><Camera size={14} /> Photo</button>
                <button className={mode === "points" ? styles.active : ""} onClick={() => setMode("points")}><ScanLine size={14} /> Points</button>
                <button className={mode === "hybrid" ? styles.active : ""} onClick={() => setMode("hybrid")}><Layers3 size={14} /> Hybrid</button>
              </div>
              <div className={styles.toolbarGroup}>
                <button onClick={() => setCameraPreset("overview")}><Eye size={14} /> Overview</button>
                <button onClick={() => setCameraPreset("top")}>Top</button>
                <button onClick={() => setCameraPreset("apse")}>Apse</button>
                <button onClick={() => setCameraPreset("floor")}>Floor</button>
                <button onClick={() => setCameraPreset("wall")}>Wall</button>
              </div>
              <div className={styles.toolbarGroup}>
                <button className={annotate ? styles.annotate : ""} onClick={() => { setAnnotate((value) => !value); setPendingPoint(null); }}><Crosshair size={14} /> {annotate ? "Cancel annotation" : "Annotate in 3D"}</button>
              </div>
            </div>
            {loading ? <div className={styles.loading}><div><strong>Loading Casignana</strong><span>Full textured photogrammetry derivative from private R2.</span></div></div> : null}
            {loadError ? <div className={styles.loading}><div><strong>Model unavailable</strong><span>{loadError}</span></div></div> : null}
            {annotations.map((annotation) => <button key={annotation.id} ref={(element) => { pinsRef.current[annotation.id] = element; }} className={`${styles.pin} ${selectedId === annotation.id ? styles.selected : ""}`} onClick={() => focusAnnotation(annotation)} aria-label={annotation.title || "Spatial annotation"}><span>{annotation.title}</span></button>)}
            {pendingPoint ? <button ref={pendingPinRef} className={`${styles.pin} ${styles.pendingPin}`} aria-label="Pending spatial annotation" /> : null}
            <div className={styles.viewerStatus}>{annotate ? "Annotation mode: click the photographic surface to anchor evidence." : `${representation.name} · ${modelStats.vertices ? modelStats.vertices.toLocaleString() : "…"} model vertices`}</div>
          </>
        ) : (
          <div className={styles.noModel}>
            <div className={styles.noModelInner}>
              <Box size={46} />
              <h2>Photographic representation ready for upload</h2>
              <p>The Casignana representation exists in the knowledge model, but its browser GLB derivative has not yet been stored in this project&apos;s private R2 bucket.</p>
              {representation.canManage ? <div className={styles.uploadBox}><label><span>Browser-ready GLB derivative</span><input type="file" accept=".glb,model/gltf-binary" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} /></label><button disabled={!uploadFile || uploading} onClick={() => void uploadModel()}><Upload size={14} /> {uploading ? "Uploading..." : "Upload to R2"}</button>{uploadMessage ? <span className={styles.uploadMessage}>{uploadMessage}</span> : null}</div> : <p>Ask a project owner or admin to upload the GLB derivative.</p>}
            </div>
          </div>
        )}
      </section>

      <aside className={styles.sidebar}>
        <section className={styles.panel}>
          <p className={styles.eyebrow}>Representation</p>
          <h2>{representation.name}</h2>
          <p className={styles.detailText}>{representation.coordinateSystem || "Local coordinates"}</p>
          <div className={styles.meta}>
            <div><span>Type</span><strong>{representation.representationType}</strong></div>
            <div><span>Source</span><strong>{String(representation.metadata.sourceFormat || "Unknown")}</strong></div>
            <div><span>Triangles</span><strong>{Number(representation.metadata.sourceTriangles || 0).toLocaleString()}</strong></div>
            <div><span>Web model</span><strong>{bytesLabel(representation.webAssetSize)}</strong></div>
            <div><span>Context</span><strong>{representation.objectName || representation.siteName || representation.projectName}</strong></div>
          </div>
          {representation.canManage && modelUrl ? <div className={styles.uploadBox}><label><span>Replace web derivative</span><input type="file" accept=".glb,model/gltf-binary" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} /></label><button disabled={!uploadFile || uploading} onClick={() => void uploadModel()}><Upload size={14} /> {uploading ? "Uploading..." : "Replace GLB"}</button>{uploadMessage ? <span className={styles.uploadMessage}>{uploadMessage}</span> : null}</div> : null}
        </section>

        {pendingPoint ? <section className={styles.panel}><p className={styles.eyebrow}>New spatial observation</p><h3>Anchor evidence here</h3><form className={styles.annotationForm} onSubmit={(event) => { event.preventDefault(); void saveAnnotation(); }}><span className={styles.pointReadout}>XYZ {pendingPoint.map((value) => value.toFixed(4)).join(", ")}</span><label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. mortar loss at wall edge" /></label><label><span>Observation</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Record what is visible. Interpretation can follow later." /></label><label><span>Visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Private</option><option value="project">Project</option><option value="public">Public</option></select></label>{saveError ? <div className={styles.notice}>{saveError}</div> : null}<button disabled={saving}>{saving ? "Saving..." : "Create linked record"}</button></form></section> : selected ? <section className={styles.panel}><p className={styles.eyebrow}>Selected evidence</p><h3>{selected.title || "Spatial observation"}</h3><p className={styles.detailText}>{selected.description || "No description yet."}</p><div className={styles.meta}><div><span>Author</span><strong>{selected.authorName || selected.authorEmail}</strong></div><div><span>Visibility</span><strong>{selected.visibility}</strong></div><div><span>Status</span><strong>{selected.status}</strong></div><div><span>XYZ</span><strong>{[selected.x, selected.y, selected.z].map((value) => value.toFixed(3)).join(", ")}</strong></div></div><Link className={styles.recordLink} href={`/records/${selected.recordId}`}>Open full record →</Link></section> : <section className={styles.panel}><MapPin size={22} /><h3>Spatial evidence</h3><p className={styles.detailText}>Select a pin, or activate Annotate in 3D and click directly on the photographed surface.</p></section>}

        <section className={styles.panel}>
          <p className={styles.eyebrow}>Linked observations</p>
          <div className={styles.annotationList}>{annotations.length ? annotations.map((annotation) => <button key={annotation.id} className={`${styles.annotationButton} ${selectedId === annotation.id ? styles.active : ""}`} onClick={() => focusAnnotation(annotation)}><strong>{annotation.title || "Spatial observation"}</strong><span>{annotation.objectName || annotation.siteName || "Spatial anchor"} · {annotation.visibility}</span></button>) : <p className={styles.detailText}>No spatial observations yet. The first annotation will also create a normal Catalog record.</p>}</div>
        </section>
      </aside>
    </div>
  );
}
