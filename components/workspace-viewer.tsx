"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Box, Camera, CheckCircle2, Crosshair, Eye, Layers3, MapPin, ScanLine, SlidersHorizontal } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadCopcPointLayer, type CopcLoadedLayer } from "@/components/copc-point-layer";
import RepresentationManager from "@/components/representation-manager";
import type { SpatialAnnotation, WorkspaceRepresentation } from "@/lib/spatial";
import styles from "./workspace-viewer.module.css";

type ViewMode = "photo" | "points" | "hybrid";
type CameraPreset = "overview" | "top" | "apse" | "floor" | "wall";
type ProjectRef = { id: string; slug: string; name: string; role: string };
type SiteRef = { id: string; code: string | null; name: string };
type ObjectRef = { id: string; siteId: string; parentObjectId: string | null; objectType: string; code: string | null; name: string };
type PendingPoint = { representationId: string; point: [number, number, number] };
type RuntimeStats = { kind: "mesh" | "copc"; loadedPoints?: number; sourcePoints?: number; vertices?: number; nodes?: number; depth?: number };
type RuntimeLayer = {
  representation: WorkspaceRepresentation;
  root: THREE.Group;
  kind: "mesh" | "copc";
  meshRoot: THREE.Object3D | null;
  derivedPoints: THREE.Group | null;
  raycastTargets: THREE.Object3D[];
  bounds: THREE.Box3;
  copc: CopcLoadedLayer | null;
  dispose: () => void;
};

function bytesLabel(value: number | null) {
  if (!value) return "Not uploaded";
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function matrixFor(representation: WorkspaceRepresentation) {
  const matrix = new THREE.Matrix4();
  matrix.fromArray(representation.transformMatrix.length === 16 ? representation.transformMatrix : new THREE.Matrix4().identity().toArray());
  return matrix;
}

function transformedAnnotationPoint(annotation: SpatialAnnotation, representations: Map<string, WorkspaceRepresentation>) {
  const representation = representations.get(annotation.representationId);
  const point = new THREE.Vector3(annotation.x, annotation.y, annotation.z);
  if (representation) point.applyMatrix4(matrixFor(representation));
  return point;
}

function setMaterialOpacity(material: THREE.Material | THREE.Material[], opacity: number) {
  const values = Array.isArray(material) ? material : [material];
  for (const item of values) {
    item.transparent = opacity < 0.995;
    item.opacity = opacity;
    item.depthWrite = opacity >= 0.92;
    item.needsUpdate = true;
  }
}

function pointCloudFormat(representation: WorkspaceRepresentation) {
  const format = (representation.webFormat || "").toLowerCase();
  const filename = (representation.webAssetFilename || "").toLowerCase();
  return format === "copc.laz" || filename.endsWith(".copc.laz");
}

export default function WorkspaceViewer({ project, representations, annotations, sites, objects, focusRecordId }: {
  project: ProjectRef;
  representations: WorkspaceRepresentation[];
  annotations: SpatialAnnotation[];
  sites: SiteRef[];
  objects: ObjectRef[];
  focusRecordId?: string | null;
}) {
  const router = useRouter();
  const representationMap = useMemo(() => new Map(representations.map((item) => [item.id, item])), [representations]);
  const focusedRecordAnnotation = useMemo(() => annotations.find((item) => item.recordId === focusRecordId) || null, [annotations, focusRecordId]);
  const initialActiveId = focusedRecordAnnotation?.representationId || representations.find((item) => item.isPrimary)?.id || representations[0]?.id || null;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const runtimeRef = useRef<Map<string, RuntimeLayer>>(new Map());
  const unionBoundsRef = useRef<THREE.Box3>(new THREE.Box3());
  const pinsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingPinRef = useRef<HTMLButtonElement | null>(null);
  const pendingPointRef = useRef<PendingPoint | null>(null);
  const annotateRef = useRef(false);
  const activeRepresentationRef = useRef<string | null>(initialActiveId);
  const modeRef = useRef<ViewMode>("photo");
  const visibilityRef = useRef<Record<string, boolean>>(Object.fromEntries(representations.map((item) => [item.id, item.visibleByDefault])));
  const opacityRef = useRef<Record<string, number>>(Object.fromEntries(representations.map((item) => [item.id, item.opacityDefault])));

  const [mode, setMode] = useState<ViewMode>(representations.some(pointCloudFormat) ? "hybrid" : "photo");
  const [activeRepresentationId, setActiveRepresentationId] = useState<string | null>(initialActiveId);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => Object.fromEntries(representations.map((item) => [item.id, item.visibleByDefault])));
  const [opacity, setOpacity] = useState<Record<string, number>>(() => Object.fromEntries(representations.map((item) => [item.id, item.opacityDefault])));
  const [pointBudget, setPointBudget] = useState(500_000);
  const [lodDepth, setLodDepth] = useState(5);
  const [layerStats, setLayerStats] = useState<Record<string, RuntimeStats>>({});
  const [layerErrors, setLayerErrors] = useState<Record<string, string>>({});
  const [loadingLayers, setLoadingLayers] = useState(() => representations.filter((item) => item.webAssetId).length);
  const [annotate, setAnnotate] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => focusedRecordAnnotation?.id || annotations[0]?.id || null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recordVisibility, setRecordVisibility] = useState("project");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const activeRepresentation = activeRepresentationId ? representationMap.get(activeRepresentationId) || null : null;
  const selected = useMemo(() => annotations.find((item) => item.id === selectedId) || null, [annotations, selectedId]);

  function applyAppearance() {
    for (const [id, runtime] of runtimeRef.current) {
      const visible = visibilityRef.current[id] !== false;
      const layerOpacity = Math.max(0, Math.min(1, opacityRef.current[id] ?? 1));
      if (runtime.kind === "mesh") {
        if (runtime.meshRoot) runtime.meshRoot.visible = visible && modeRef.current !== "points";
        if (runtime.derivedPoints) runtime.derivedPoints.visible = visible && modeRef.current !== "photo";
        runtime.meshRoot?.traverse((object) => {
          if (object instanceof THREE.Mesh) setMaterialOpacity(object.material, layerOpacity * (modeRef.current === "hybrid" ? 0.62 : 1));
        });
        runtime.derivedPoints?.traverse((object) => {
          if (object instanceof THREE.Points) {
            const material = object.material as THREE.PointsMaterial;
            material.opacity = layerOpacity * (modeRef.current === "hybrid" ? 0.42 : 0.92);
            material.size = modeRef.current === "hybrid" ? 0.025 : 0.045;
          }
        });
      } else {
        runtime.root.visible = visible && modeRef.current !== "photo";
        runtime.root.traverse((object) => {
          if (object instanceof THREE.Points) {
            const material = object.material as THREE.PointsMaterial;
            material.opacity = layerOpacity * (modeRef.current === "hybrid" ? 0.64 : 0.95);
            material.depthWrite = material.opacity >= 0.9;
          }
        });
      }
    }
  }

  useEffect(() => {
    annotateRef.current = annotate;
  }, [annotate]);

  useEffect(() => {
    activeRepresentationRef.current = activeRepresentationId;
  }, [activeRepresentationId]);

  useEffect(() => {
    pendingPointRef.current = pendingPoint;
  }, [pendingPoint]);

  useEffect(() => {
    modeRef.current = mode;
    visibilityRef.current = visibility;
    opacityRef.current = opacity;
    applyAppearance();
  }, [mode, visibility, opacity]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let active = true;
    let frame = 0;
    const abortController = new AbortController();
    const runtimeMap = runtimeRef.current;
    runtimeMap.clear();
    unionBoundsRef.current = new THREE.Box3();
    setLoadingLayers(representations.filter((item) => item.webAssetId).length);
    setLayerErrors({});
    setLayerStats({});

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101713);
    scene.fog = new THREE.FogExp2(0x101713, 0.009);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 100000000);
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
    controls.minDistance = 0.05;
    controls.maxDistance = 100000000;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xf5f0e6, 0x25332e, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(8, 18, 12);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8e8df, 0.65);
    fill.position.set(-12, 7, -8);
    scene.add(fill);
    const grid = new THREE.GridHelper(40, 40, 0x516259, 0x27362f);
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

    const fitBounds = (bounds: THREE.Box3, top = false) => {
      if (bounds.isEmpty()) return;
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 1);
      controls.target.copy(center);
      if (top) {
        camera.up.set(0, 0, -1);
        camera.position.copy(center.clone().add(new THREE.Vector3(0, radius * 1.8, 0)));
      } else {
        camera.up.set(0, 1, 0);
        camera.position.copy(center.clone().add(new THREE.Vector3(radius * 0.9, radius * 0.55, radius * 0.95)));
      }
      camera.near = Math.max(0.001, radius / 100000);
      camera.far = Math.max(1000, radius * 100);
      camera.updateProjectionMatrix();
      camera.lookAt(center);
      controls.update();
    };

    const registerRuntime = (runtime: RuntimeLayer, stats: RuntimeStats) => {
      if (!active) {
        runtime.dispose();
        return;
      }
      runtimeMap.set(runtime.representation.id, runtime);
      scene.add(runtime.root);
      unionBoundsRef.current.union(runtime.bounds);
      setLayerStats((current) => ({ ...current, [runtime.representation.id]: stats }));
      setLoadingLayers((count) => Math.max(0, count - 1));
      applyAppearance();
      if (runtimeMap.size === 1 && !focusedRecordAnnotation) fitBounds(unionBoundsRef.current);
    };

    const failRuntime = (representation: WorkspaceRepresentation, error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : "Could not load representation.";
      console.error("[workspace.layer]", { representationId: representation.id, message });
      setLayerErrors((current) => ({ ...current, [representation.id]: message }));
      setLoadingLayers((count) => Math.max(0, count - 1));
    };

    const loadMesh = (representation: WorkspaceRepresentation) => new Promise<void>((resolve) => {
      const url = `/api/workspace/model/${representation.id}`;
      new GLTFLoader().load(url, (gltf) => {
        try {
          if (!active) return resolve();
          gltf.scene.updateWorldMatrix(true, true);
          const sourceBounds = new THREE.Box3().setFromObject(gltf.scene);
          const layerRoot = new THREE.Group();
          layerRoot.matrixAutoUpdate = false;
          layerRoot.matrix.copy(matrixFor(representation));
          const meshRoot = gltf.scene;
          const pointGroup = new THREE.Group();
          const raycastTargets: THREE.Object3D[] = [];
          let vertices = 0;
          meshRoot.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            raycastTargets.push(object);
            const source = object.geometry.getAttribute("position");
            if (!source) return;
            vertices += source.count;
            const positions = new Float32Array(source.count * 3);
            const point = new THREE.Vector3();
            for (let index = 0; index < source.count; index += 1) {
              point.fromBufferAttribute(source, index).applyMatrix4(object.matrixWorld);
              positions[index * 3] = point.x;
              positions[index * 3 + 1] = point.y;
              positions[index * 3 + 2] = point.z;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe9ddbf, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.92 }));
            pointGroup.add(points);
            raycastTargets.push(points);
          });
          layerRoot.add(meshRoot);
          layerRoot.add(pointGroup);
          const bounds = sourceBounds.clone().applyMatrix4(layerRoot.matrix);
          const runtime: RuntimeLayer = {
            representation,
            root: layerRoot,
            kind: "mesh",
            meshRoot,
            derivedPoints: pointGroup,
            raycastTargets,
            bounds,
            copc: null,
            dispose: () => {
              meshRoot.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                  object.geometry.dispose();
                  const materials = Array.isArray(object.material) ? object.material : [object.material];
                  materials.forEach((material) => material.dispose());
                }
              });
              pointGroup.traverse((object) => {
                if (object instanceof THREE.Points) {
                  object.geometry.dispose();
                  (object.material as THREE.Material).dispose();
                }
              });
              layerRoot.clear();
            }
          };
          registerRuntime(runtime, { kind: "mesh", vertices });
          resolve();
        } catch (error) {
          failRuntime(representation, error);
          resolve();
        }
      }, undefined, (error) => {
        failRuntime(representation, error);
        resolve();
      });
    });

    const loadCopc = async (representation: WorkspaceRepresentation) => {
      try {
        const layer = await loadCopcPointLayer({
          url: `/api/workspace/model/${representation.id}`,
          transformMatrix: representation.transformMatrix,
          pointBudget: Math.max(50_000, Math.floor(pointBudget / Math.max(1, representations.filter((item) => item.webAssetId && pointCloudFormat(item)).length))),
          maxDepth: lodDepth,
          opacity: opacityRef.current[representation.id] ?? representation.opacityDefault,
          signal: abortController.signal
        });
        const raycastTargets: THREE.Object3D[] = [];
        layer.root.traverse((object) => { if (object instanceof THREE.Points) raycastTargets.push(object); });
        registerRuntime({
          representation,
          root: layer.root,
          kind: "copc",
          meshRoot: null,
          derivedPoints: null,
          raycastTargets,
          bounds: layer.bounds,
          copc: layer,
          dispose: layer.dispose
        }, {
          kind: "copc",
          loadedPoints: layer.stats.loadedPoints,
          sourcePoints: layer.stats.sourcePoints,
          nodes: layer.stats.loadedNodes,
          depth: layer.stats.maxLoadedDepth
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        failRuntime(representation, error);
      }
    };

    void Promise.all(representations.filter((item) => item.webAssetId).map((representation) => pointCloudFormat(representation) ? loadCopc(representation) : loadMesh(representation))).then(() => {
      if (!active) return;
      if (!focusedRecordAnnotation && !unionBoundsRef.current.isEmpty()) fitBounds(unionBoundsRef.current);
      if (focusedRecordAnnotation) {
        const point = transformedAnnotationPoint(focusedRecordAnnotation, representationMap);
        controls.target.copy(point);
        const radius = Math.max(1, unionBoundsRef.current.isEmpty() ? 4 : unionBoundsRef.current.getSize(new THREE.Vector3()).length() * 0.08);
        camera.position.copy(point.clone().add(new THREE.Vector3(radius, radius * 0.75, radius)));
        camera.lookAt(point);
        controls.update();
      }
    });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.12;
    const pointer = new THREE.Vector2();
    const handleClick = (event: MouseEvent) => {
      if (!annotateRef.current) return;
      const representationId = activeRepresentationRef.current;
      if (!representationId) return;
      const runtime = runtimeMap.get(representationId);
      if (!runtime?.raycastTargets.length) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(runtime.raycastTargets, false)[0];
      if (!hit) return;
      const local = runtime.root.worldToLocal(hit.point.clone());
      const value: PendingPoint = { representationId, point: [local.x, local.y, local.z] };
      pendingPointRef.current = value;
      setPendingPoint(value);
      setSelectedId(null);
      setSaveError("");
    };
    renderer.domElement.addEventListener("click", handleClick);

    const animate = () => {
      controls.update();
      const rect = mount.getBoundingClientRect();
      for (const annotation of annotations) {
        const element = pinsRef.current[annotation.id];
        if (!element) continue;
        const layerVisible = visibilityRef.current[annotation.representationId] !== false;
        if (!layerVisible) {
          element.style.display = "none";
          continue;
        }
        const vector = transformedAnnotationPoint(annotation, representationMap).project(camera);
        element.style.left = `${(vector.x * 0.5 + 0.5) * rect.width}px`;
        element.style.top = `${(-vector.y * 0.5 + 0.5) * rect.height}px`;
        element.style.display = vector.z > -1 && vector.z < 1 ? "block" : "none";
      }
      const pending = pendingPointRef.current;
      if (pending && pendingPinRef.current) {
        const representation = representationMap.get(pending.representationId);
        const vector = new THREE.Vector3(...pending.point);
        if (representation) vector.applyMatrix4(matrixFor(representation));
        vector.project(camera);
        pendingPinRef.current.style.left = `${(vector.x * 0.5 + 0.5) * rect.width}px`;
        pendingPinRef.current.style.top = `${(-vector.y * 0.5 + 0.5) * rect.height}px`;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      active = false;
      abortController.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      for (const runtime of runtimeMap.values()) runtime.dispose();
      runtimeMap.clear();
      unionBoundsRef.current = new THREE.Box3();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [annotations, focusedRecordAnnotation, lodDepth, pointBudget, representationMap, representations]);

  function setCameraPreset(preset: CameraPreset) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const bounds = unionBoundsRef.current;
    if (!camera || !controls || bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    if (preset === "overview") {
      camera.up.set(0, 1, 0);
      camera.position.copy(center.clone().add(new THREE.Vector3(radius * 0.9, radius * 0.55, radius * 0.95)));
      controls.target.copy(center);
    } else if (preset === "top") {
      camera.up.set(0, 0, -1);
      camera.position.copy(center.clone().add(new THREE.Vector3(0, radius * 1.8, 0)));
      controls.target.copy(center);
    } else {
      const target = preset === "apse" ? new THREE.Vector3(-8.3, -0.6, 0) : preset === "floor" ? new THREE.Vector3(-0.5, -2.1, 0) : new THREE.Vector3(5.8, 0.1, 4.1);
      const position = preset === "apse" ? new THREE.Vector3(-17, 5, 11) : preset === "floor" ? new THREE.Vector3(7, 7.5, 12) : new THREE.Vector3(15, 6, 13);
      camera.up.set(0, 1, 0);
      camera.position.copy(position);
      controls.target.copy(target);
    }
    camera.lookAt(controls.target);
    controls.update();
  }

  function chooseRepresentation(representation: WorkspaceRepresentation) {
    setActiveRepresentationId(representation.id);
    activeRepresentationRef.current = representation.id;
    pendingPointRef.current = null;
    setPendingPoint(null);
    setSelectedId(null);
    setSaveError("");
  }

  function focusAnnotation(annotation: SpatialAnnotation) {
    setSelectedId(annotation.id);
    pendingPointRef.current = null;
    setPendingPoint(null);
    const representation = representationMap.get(annotation.representationId);
    if (representation) {
      setActiveRepresentationId(representation.id);
      activeRepresentationRef.current = representation.id;
    }
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const point = transformedAnnotationPoint(annotation, representationMap);
    controls.target.copy(point);
    const radius = Math.max(1.5, unionBoundsRef.current.isEmpty() ? 3 : unionBoundsRef.current.getSize(new THREE.Vector3()).length() * 0.06);
    camera.position.copy(point.clone().add(new THREE.Vector3(radius, radius * 0.75, radius)));
    camera.lookAt(point);
    controls.update();
  }

  async function saveAnnotation() {
    if (!pendingPoint) return;
    const representation = representationMap.get(pendingPoint.representationId);
    if (!representation) return;
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
          visibility: recordVisibility,
          point: pendingPoint.point
        })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save the spatial observation.");
      setTitle("");
      setDescription("");
      pendingPointRef.current = null;
      setPendingPoint(null);
      setAnnotate(false);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the spatial observation.");
    } finally {
      setSaving(false);
    }
  }

  const activeStats = activeRepresentation ? layerStats[activeRepresentation.id] : null;
  const activeError = activeRepresentation ? layerErrors[activeRepresentation.id] : null;
  const canManage = ["owner", "admin"].includes(project.role);

  return <div className={styles.workspace}>
    <section className={styles.viewerShell}>
      <div ref={mountRef} className={styles.canvas} />
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}><button className={mode === "photo" ? styles.active : ""} onClick={() => setMode("photo")}><Camera size={14} /> Photo</button><button className={mode === "points" ? styles.active : ""} onClick={() => setMode("points")}><ScanLine size={14} /> Points</button><button className={mode === "hybrid" ? styles.active : ""} onClick={() => setMode("hybrid")}><Layers3 size={14} /> Hybrid</button></div>
        <div className={styles.toolbarGroup}><button onClick={() => setCameraPreset("overview")}><Eye size={14} /> Overview</button><button onClick={() => setCameraPreset("top")}>Top</button>{project.slug === "casignana" ? <><button onClick={() => setCameraPreset("apse")}>Apse</button><button onClick={() => setCameraPreset("floor")}>Floor</button><button onClick={() => setCameraPreset("wall")}>Wall</button></> : null}</div>
        <div className={styles.toolbarGroup}><button className={annotate ? styles.annotate : ""} disabled={!activeRepresentation?.webAssetId} onClick={() => { setAnnotate((value) => !value); pendingPointRef.current = null; setPendingPoint(null); }}><Crosshair size={14} /> {annotate ? "Cancel annotation" : "Annotate active layer"}</button></div>
      </div>

      <div className={styles.lodControls}><SlidersHorizontal size={14} /><label>Point budget<select value={pointBudget} onChange={(event) => setPointBudget(Number(event.target.value))}><option value={100000}>100k</option><option value={250000}>250k</option><option value={500000}>500k</option><option value={1000000}>1M</option></select></label><label>Octree depth<select value={lodDepth} onChange={(event) => setLodDepth(Number(event.target.value))}><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option><option value={6}>6</option><option value={7}>7</option></select></label></div>

      {!representations.length ? <div className={styles.loading}><div><Box size={32} /><strong>No survey representation yet</strong><span>Create the first photogrammetry, point-cloud or detail-scan layer in the management panel.</span></div></div> : loadingLayers ? <div className={styles.loadingCompact}>{loadingLayers} survey layer{loadingLayers === 1 ? "" : "s"} loading...</div> : null}
      {activeError ? <div className={styles.layerError}><AlertTriangle size={15} /> {activeError}</div> : null}
      {annotations.map((annotation) => <button key={annotation.id} ref={(element) => { pinsRef.current[annotation.id] = element; }} className={`${styles.pin} ${selectedId === annotation.id ? styles.selected : ""}`} onClick={() => focusAnnotation(annotation)} aria-label={annotation.title || "Spatial annotation"}><span>{annotation.title}</span></button>)}
      {pendingPoint ? <button ref={pendingPinRef} className={`${styles.pin} ${styles.pendingPin}`} aria-label="Pending spatial annotation" /> : null}
      <div className={styles.viewerStatus}>{annotate ? `Annotation mode · ${activeRepresentation?.name || "select a layer"}` : activeRepresentation ? `${activeRepresentation.name}${activeStats?.kind === "copc" ? ` · ${(activeStats.loadedPoints || 0).toLocaleString()} streamed points` : activeStats?.vertices ? ` · ${activeStats.vertices.toLocaleString()} mesh vertices` : ""}` : `${project.name} · no active layer`}</div>
    </section>

    <aside className={styles.sidebar}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Survey layers</p><h2>{representations.length} representation{representations.length === 1 ? "" : "s"}</h2></div><Layers3 size={22} /></div>
        <div className={styles.layerList}>{representations.map((representation) => {
          const stats = layerStats[representation.id];
          const error = layerErrors[representation.id];
          const visible = visibility[representation.id] !== false;
          return <div key={representation.id} className={`${styles.layerCard} ${activeRepresentationId === representation.id ? styles.layerActive : ""}`}>
            <button className={styles.layerSelect} onClick={() => chooseRepresentation(representation)}><strong>{representation.name}</strong><span>{representation.representationType.replace("_", " ")} · {representation.webFormat || "no web derivative"}</span></button>
            <div className={styles.layerControls}><label title="Show or hide layer"><input type="checkbox" checked={visible} onChange={(event) => setVisibility((current) => ({ ...current, [representation.id]: event.target.checked }))} /> visible</label><label>opacity <input type="range" min="0.05" max="1" step="0.05" value={opacity[representation.id] ?? 1} onChange={(event) => setOpacity((current) => ({ ...current, [representation.id]: Number(event.target.value) }))} /></label></div>
            <div className={styles.layerBadges}><span className={styles[`registration_${representation.registrationStatus}`]}>{representation.registrationStatus}</span>{representation.nominalResolutionMm !== null ? <span>{representation.nominalResolutionMm} mm</span> : null}{representation.registrationUncertaintyMm !== null ? <span>±{representation.registrationUncertaintyMm} mm</span> : null}{stats?.kind === "copc" ? <span>{(stats.loadedPoints || 0).toLocaleString()} / {(stats.sourcePoints || representation.pointCount || 0).toLocaleString()} pts</span> : null}{error ? <span className={styles.errorBadge}>load error</span> : representation.webAssetId ? <span className={styles.readyBadge}><CheckCircle2 size={10} /> ready</span> : null}</div>
          </div>;
        })}</div>
      </section>

      {activeRepresentation ? <section className={styles.panel}><p className={styles.eyebrow}>Active representation</p><h3>{activeRepresentation.name}</h3><p className={styles.detailText}>{activeRepresentation.coordinateSystem || "Coordinate frame not documented"}</p><div className={styles.meta}><div><span>Context</span><strong>{activeRepresentation.objectName || activeRepresentation.siteName || project.name}</strong></div><div><span>Source</span><strong>{activeRepresentation.sourceFormat || "Unknown"} · {bytesLabel(activeRepresentation.sourceAssetSize)}</strong></div><div><span>Web</span><strong>{activeRepresentation.webFormat || "None"} · {bytesLabel(activeRepresentation.webAssetSize)}</strong></div><div><span>Registration</span><strong>{activeRepresentation.registrationStatus}{activeRepresentation.registrationRmseMm !== null ? ` · RMSE ${activeRepresentation.registrationRmseMm} mm` : ""}</strong></div><div><span>Resolution</span><strong>{activeRepresentation.nominalResolutionMm !== null ? `${activeRepresentation.nominalResolutionMm} mm` : "Unknown"}</strong></div>{activeStats?.kind === "copc" ? <><div><span>Streamed</span><strong>{(activeStats.loadedPoints || 0).toLocaleString()} points · {activeStats.nodes || 0} nodes</strong></div><div><span>LOD</span><strong>depth {activeStats.depth || 0} · budget {pointBudget.toLocaleString()}</strong></div></> : null}</div>{activeRepresentation.registrationStatus === "unregistered" || activeRepresentation.registrationUncertaintyMm === null ? <div className={styles.uncertaintyWarning}><AlertTriangle size={14} /><span>{activeRepresentation.registrationStatus === "unregistered" ? "This layer is not registered to the common project frame." : "Registration uncertainty is not documented. Do not interpret sub-resolution differences as conservation change."}</span></div> : null}</section> : null}

      {pendingPoint ? <section className={styles.panel}><p className={styles.eyebrow}>New spatial observation</p><h3>Anchor evidence on {representationMap.get(pendingPoint.representationId)?.name}</h3><form className={styles.annotationForm} onSubmit={(event) => { event.preventDefault(); void saveAnnotation(); }}><span className={styles.pointReadout}>XYZ {pendingPoint.point.map((value) => value.toFixed(4)).join(", ")}</span><label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. mortar loss at wall edge" /></label><label><span>Observation</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Record what is visible. Interpretation can follow later." /></label><label><span>Visibility</span><select value={recordVisibility} onChange={(event) => setRecordVisibility(event.target.value)}><option value="private">Private</option><option value="project">Project</option><option value="public">Public</option></select></label>{saveError ? <div className={styles.notice}>{saveError}</div> : null}<button disabled={saving}>{saving ? "Saving..." : "Create linked record"}</button></form></section> : selected ? <section className={styles.panel}><p className={styles.eyebrow}>Selected evidence</p><h3>{selected.title || "Spatial observation"}</h3><p className={styles.detailText}>{selected.description || "No description yet."}</p><div className={styles.meta}><div><span>Layer</span><strong>{representationMap.get(selected.representationId)?.name || "Unknown"}</strong></div><div><span>Author</span><strong>{selected.authorName || selected.authorEmail}</strong></div><div><span>Visibility</span><strong>{selected.visibility}</strong></div><div><span>Status</span><strong>{selected.status}</strong></div><div><span>XYZ</span><strong>{[selected.x, selected.y, selected.z].map((value) => value.toFixed(3)).join(", ")}</strong></div></div><Link className={styles.recordLink} href={`/records/${selected.recordId}`}>Open full record →</Link></section> : <section className={styles.panel}><MapPin size={22} /><h3>Spatial evidence</h3><p className={styles.detailText}>Select a layer, activate annotation mode, then click its visible mesh or point cloud. The resulting observation remains a normal Catalog record.</p></section>}

      <section className={styles.panel}><p className={styles.eyebrow}>Linked observations</p><div className={styles.annotationList}>{annotations.length ? annotations.map((annotation) => <button key={annotation.id} className={`${styles.annotationButton} ${selectedId === annotation.id ? styles.active : ""}`} onClick={() => focusAnnotation(annotation)}><strong>{annotation.title || "Spatial observation"}</strong><span>{representationMap.get(annotation.representationId)?.name || "Layer"} · {annotation.visibility}</span></button>) : <p className={styles.detailText}>No spatial observations yet.</p>}</div></section>

      {canManage ? <RepresentationManager key={activeRepresentation?.id || "none"} project={project} representations={representations} activeRepresentation={activeRepresentation} sites={sites} objects={objects} /> : null}
    </aside>
  </div>;
}
