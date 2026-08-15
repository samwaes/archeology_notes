"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  CloudOff,
  FileImage,
  LocateFixed,
  Mic,
  NotebookPen,
  RefreshCw,
  Ruler,
  Save,
  Square,
  Trash2,
  TriangleAlert,
  Wifi
} from "lucide-react";
import {
  captureToFormData,
  deleteOfflineCapture,
  listOfflineCaptures,
  putOfflineCapture,
  syncOfflineCaptures,
  updateOfflineCapture,
  type OfflineCapture
} from "@/lib/offline-field";
import styles from "./field-capture.module.css";

type FieldObject = { id: string; siteId: string; name: string; code?: string | null };
type FieldSite = { id: string; name: string; code?: string | null };
type FieldTemplate = {
  id: string;
  name: string;
  recordType: string;
  defaultVisibility: string;
  template: Record<string, unknown>;
};
type FieldProject = {
  slug: string;
  name: string;
  sites: FieldSite[];
  objects: FieldObject[];
  templates?: FieldTemplate[];
};
type CaptureMode = "photo" | "voice" | "note" | "measurement" | "observation";
type LocationFix = { latitude: number; longitude: number; accuracyMeters: number | null };
type CaptureResult = {
  recordId: string;
  recordUrl: string;
  transcriptionStatus: string;
  transcript?: string | null;
  locationCaptured: boolean;
};

const CONTEXT_KEY = "archeology-notes-field-context-v2";

export default function FieldCapture({
  projects,
  transcriptionConfigured
}: {
  projects: FieldProject[];
  transcriptionConfigured: boolean;
}) {
  const router = useRouter();
  const [projectSlug, setProjectSlug] = useState(projects[0]?.slug || "");
  const [siteId, setSiteId] = useState(projects[0]?.sites[0]?.id || "");
  const [objectId, setObjectId] = useState("");
  const [visibility, setVisibility] = useState("project");
  const [mode, setMode] = useState<CaptureMode>("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [measurementValue, setMeasurementValue] = useState("");
  const [measurementUnit, setMeasurementUnit] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locationMessage, setLocationMessage] = useState("Location will be requested when you save.");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [queue, setQueue] = useState<OfflineCapture[]>([]);
  const [syncing, setSyncing] = useState(false);

  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const project = useMemo(
    () => projects.find((item) => item.slug === projectSlug) || projects[0],
    [projectSlug, projects]
  );
  const sites = project?.sites || [];
  const validSiteId = siteId && sites.some((item) => item.id === siteId) ? siteId : "";
  const objects = useMemo(
    () => (project?.objects || []).filter((item) => !validSiteId || item.siteId === validSiteId),
    [project, validSiteId]
  );
  const validObjectId = objectId && objects.some((item) => item.id === objectId) ? objectId : "";

  useEffect(() => {
    let active = true;
    void listOfflineCaptures().then((items) => {
      if (active) setQueue(items);
    });

    const goOnline = () => {
      setOnline(true);
      void syncOfflineCaptures((items) => {
        if (active) setQueue(items);
      }).then(() => {
        if (active) router.refresh();
      });
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      active = false;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(CONTEXT_KEY);
        if (!stored) return;
        const context = JSON.parse(stored) as {
          projectSlug?: string;
          siteId?: string;
          objectId?: string;
          visibility?: string;
        };
        const storedProject = context.projectSlug
          ? projects.find((item) => item.slug === context.projectSlug)
          : null;
        if (!storedProject) return;

        setProjectSlug(storedProject.slug);
        if (context.siteId && storedProject.sites.some((item) => item.id === context.siteId)) {
          setSiteId(context.siteId);
        }
        if (context.objectId && storedProject.objects.some((item) => item.id === context.objectId)) {
          setObjectId(context.objectId);
        }
        if (context.visibility && ["private", "project", "public"].includes(context.visibility)) {
          setVisibility(context.visibility);
        }
      } catch {
        // Invalid local context is ignored.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [projects]);

  useEffect(() => {
    window.localStorage.setItem(
      CONTEXT_KEY,
      JSON.stringify({ projectSlug, siteId: validSiteId, objectId: validObjectId, visibility })
    );
  }, [projectSlug, validSiteId, validObjectId, visibility]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function doSync() {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      await syncOfflineCaptures(setQueue);
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function readLocation() {
    if (!locationEnabled || !("geolocation" in navigator)) return null;
    setLocationMessage("Getting current location...");
    return new Promise<LocationFix | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const fix = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null
          };
          setLocation(fix);
          setLocationMessage(`Location ready${fix.accuracyMeters ? ` · ±${Math.round(fix.accuracyMeters)} m` : ""}`);
          resolve(fix);
        },
        () => {
          setLocationMessage("Location unavailable. Capture can continue without GPS.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  function selectPhoto(file: File | null) {
    if (!file) return;
    setMode("photo");
    setPhotoFile(file);
    setResult(null);
    setError("");
  }

  async function startRecording() {
    setError("");
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      setMode("voice");
      setAudioBlob(null);
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone permission was not granted or the microphone is unavailable.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function applyTemplate(template: FieldTemplate) {
    if (template.recordType === "condition" || template.recordType === "intervention") return;
    const nextMode: CaptureMode = template.recordType === "measurement"
      ? "measurement"
      : template.recordType === "observation"
        ? "observation"
        : "note";
    setMode(nextMode);
    setVisibility(template.defaultVisibility || "project");
    if (typeof template.template.category === "string") {
      setDescription((value) => value || `[${template.template.category}] `);
    }
  }

  function resetCapture() {
    setTitle("");
    setDescription("");
    setMeasurementValue("");
    setMeasurementUnit("");
    setPhotoFile(null);
    setAudioBlob(null);
    setLocation(null);
  }

  function validateCapture() {
    if (!project) return "Select a project first.";
    if (mode === "photo" && !photoFile) return "Take or choose a photograph first.";
    if (mode === "voice" && !audioBlob) return "Record a voice note first.";
    if ((mode === "note" || mode === "observation") && !description.trim()) return "Add a short note or observation first.";
    if (mode === "measurement" && !measurementValue.trim()) return "Enter the measurement value first.";
    return "";
  }

  async function buildCapture(): Promise<OfflineCapture> {
    const fix = location || await readLocation();
    let file: Blob | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;

    if (mode === "photo" && photoFile) {
      file = photoFile;
      fileName = photoFile.name;
      fileType = photoFile.type;
    }
    if (mode === "voice" && audioBlob) {
      file = audioBlob;
      fileName = `voice-note-${Date.now()}.${audioBlob.type.includes("mp4") ? "mp4" : "webm"}`;
      fileType = audioBlob.type || "audio/webm";
    }

    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      projectSlug: project!.slug,
      siteId: validSiteId,
      physicalObjectId: validObjectId,
      recordType: mode,
      visibility,
      title,
      description,
      measurementValue,
      measurementUnit,
      capturedAt: new Date().toISOString(),
      latitude: fix?.latitude ?? null,
      longitude: fix?.longitude ?? null,
      accuracyMeters: fix?.accuracyMeters ?? null,
      file,
      fileName,
      fileType,
      state: "queued",
      error: null
    };
  }

  async function saveCapture() {
    setError("");
    setResult(null);
    const validationError = validateCapture();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const capture = await buildCapture();
      if (!navigator.onLine) {
        await putOfflineCapture(capture);
        setQueue(await listOfflineCaptures());
        resetCapture();
        setResult({
          recordId: capture.id,
          recordUrl: "#offline-queue",
          transcriptionStatus: "queued",
          locationCaptured: Boolean(capture.latitude)
        });
        return;
      }

      try {
        const response = await fetch("/api/field/capture", { method: "POST", body: captureToFormData(capture) });
        const payload = await response.json() as CaptureResult & { error?: string };
        if (!response.ok) {
          throw Object.assign(new Error(payload.error || "Field capture failed."), { httpStatus: response.status });
        }
        setResult(payload);
        resetCapture();
        router.refresh();
      } catch (captureError) {
        const status = (captureError as { httpStatus?: number }).httpStatus;
        if (status && status < 500) throw captureError;
        await putOfflineCapture({
          ...capture,
          error: captureError instanceof Error ? captureError.message : "Network interrupted"
        });
        setQueue(await listOfflineCaptures());
        resetCapture();
        setResult({
          recordId: capture.id,
          recordUrl: "#offline-queue",
          transcriptionStatus: "queued",
          locationCaptured: Boolean(capture.latitude)
        });
      }
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Field capture failed.");
    } finally {
      setSaving(false);
    }
  }

  async function retryWithCurrentContext(item: OfflineCapture) {
    await updateOfflineCapture(item.id, {
      projectSlug: project?.slug || item.projectSlug,
      siteId: validSiteId,
      physicalObjectId: validObjectId,
      state: "queued",
      error: null
    });
    setQueue(await listOfflineCaptures());
    await doSync();
  }

  async function discard(id: string) {
    await deleteOfflineCapture(id);
    setQueue(await listOfflineCaptures());
  }

  if (!projects.length) {
    return <div className={styles.empty}>Create or join a project before using Field capture.</div>;
  }

  return (
    <div className={styles.fieldWorkspace}>
      <section className={styles.offlineBar} data-online={online}>
        <div>
          {online ? <Wifi size={16} /> : <CloudOff size={16} />}
          <strong>{online ? "Online" : "Offline capture active"}</strong>
          <span>{queue.length
            ? `${queue.length} capture${queue.length === 1 ? "" : "s"} waiting on this device`
            : online ? "Nothing waiting to sync" : "New captures will stay safely on this device"}</span>
        </div>
        <button type="button" disabled={!online || !queue.length || syncing} onClick={() => void doSync()}>
          <RefreshCw size={14} /> {syncing ? "Syncing..." : "Sync now"}
        </button>
      </section>

      {project?.templates?.length ? (
        <section className={styles.templateRow}>
          <strong>Templates</strong>
          {project.templates.map((template) => template.recordType === "condition" || template.recordType === "intervention"
            ? <Link key={template.id} href={`/conservation?project=${encodeURIComponent(project.slug)}`}>{template.name}</Link>
            : <button type="button" key={template.id} onClick={() => applyTemplate(template)}>{template.name}</button>)}
        </section>
      ) : null}

      <section className={styles.contextPanel}>
        <div className={styles.contextHeading}>
          <div><span>Current context</span><strong>{project?.name || "Project"}</strong></div>
          <button type="button" className={styles.locationButton} onClick={() => void readLocation()} disabled={!locationEnabled}>
            <LocateFixed size={16} /> {location ? "Refresh GPS" : "Get GPS"}
          </button>
        </div>
        <div className={styles.contextGrid}>
          <label><span>Project</span><select value={projectSlug} onChange={(event) => { setProjectSlug(event.target.value); setSiteId(""); setObjectId(""); }}>{projects.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
          <label><span>Site</span><select value={validSiteId} onChange={(event) => { setSiteId(event.target.value); setObjectId(""); }}><option value="">Link later</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
          <label><span>Object / area</span><select value={validObjectId} onChange={(event) => setObjectId(event.target.value)}><option value="">Link later</option>{objects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Private</option><option value="project">Project</option><option value="public">Public</option></select></label>
        </div>
        <div className={styles.locationRow}>
          <label><input type="checkbox" checked={locationEnabled} onChange={(event) => { setLocationEnabled(event.target.checked); if (!event.target.checked) { setLocation(null); setLocationMessage("GPS disabled for this capture."); } }} /> Attach current GPS when available</label>
          <span>{locationMessage}</span>
        </div>
      </section>

      <section className={styles.capturePanel}>
        <div className={styles.modeGrid}>
          <button type="button" className={mode === "photo" ? styles.activeMode : ""} onClick={() => cameraInput.current?.click()}><Camera size={24} /><strong>Photo</strong><span>Use camera</span></button>
          <button type="button" className={mode === "voice" ? styles.activeMode : ""} onClick={() => recording ? stopRecording() : void startRecording()}>{recording ? <Square size={24} /> : <Mic size={24} />}<strong>{recording ? "Stop" : "Voice"}</strong><span>{recording ? "Recording now" : "Record note"}</span></button>
          <button type="button" className={mode === "note" ? styles.activeMode : ""} onClick={() => setMode("note")}><NotebookPen size={24} /><strong>Note</strong><span>Fast text</span></button>
          <button type="button" className={mode === "measurement" ? styles.activeMode : ""} onClick={() => setMode("measurement")}><Ruler size={24} /><strong>Measure</strong><span>Value + unit</span></button>
          <button type="button" className={mode === "observation" ? styles.activeMode : ""} onClick={() => setMode("observation")}><TriangleAlert size={24} /><strong>Observe</strong><span>Condition or finding</span></button>
        </div>
        <input ref={cameraInput} className={styles.hiddenInput} type="file" accept="image/*" capture="environment" onChange={(event) => selectPhoto(event.target.files?.[0] || null)} />
        <input ref={libraryInput} className={styles.hiddenInput} type="file" accept="image/*" onChange={(event) => selectPhoto(event.target.files?.[0] || null)} />

        <div className={styles.editor}>
          <label><span>Optional title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short identifier" /></label>

          {mode === "photo" ? (
            <div className={styles.fileState}>
              <FileImage size={22} />
              <div><strong>{photoFile?.name || "No photograph selected"}</strong><span>{photoFile ? `${Math.round(photoFile.size / 1024)} KB` : "Take a photo or choose one from the device."}</span></div>
              <button type="button" onClick={() => libraryInput.current?.click()}>Choose existing</button>
            </div>
          ) : null}

          {mode === "voice" ? (
            <div className={styles.voiceState}>
              {recording ? <><span className={styles.recordingDot} /><strong>Recording...</strong><button type="button" onClick={stopRecording}>Stop recording</button></>
                : audioBlob ? <><Mic size={22} /><div><strong>Voice note ready</strong><span>{Math.max(1, Math.round(audioBlob.size / 1024))} KB · {audioBlob.type || "audio"}</span></div><button type="button" onClick={() => void startRecording()}>Record again</button></>
                  : <><Mic size={22} /><span>Tap Voice above to start recording.</span></>}
            </div>
          ) : null}

          {mode === "measurement" ? (
            <div className={styles.measurementRow}>
              <label><span>Value</span><input inputMode="decimal" value={measurementValue} onChange={(event) => setMeasurementValue(event.target.value)} placeholder="12.4" /></label>
              <label><span>Unit</span><input value={measurementUnit} onChange={(event) => setMeasurementUnit(event.target.value)} placeholder="mm, cm, °C..." /></label>
            </div>
          ) : null}

          <label>
            <span>{mode === "measurement" ? "Measurement note" : mode === "photo" ? "Photo note" : mode === "voice" ? "Optional note before transcription" : "Observation"}</span>
            <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={mode === "photo" ? "What is visible or important?" : mode === "voice" ? "Optional context for this voice note" : "Capture the observation now; refine it later."} />
          </label>

          <div className={styles.captureMeta}>
            <span>Author and acquisition time are automatic.</span>
            {mode === "voice" ? <span>Transcription: {transcriptionConfigured ? "enabled when synced" : "not configured yet"}</span> : null}
          </div>

          {error ? <div className={styles.error}><TriangleAlert size={16} /> {error}</div> : null}
          {result ? (
            <div className={styles.success}>
              <CheckCircle2 size={17} />
              <div>
                <strong>{result.transcriptionStatus === "queued" ? "Saved offline on this device." : "Saved to the field inbox."}</strong>
                <span>{result.transcriptionStatus === "queued" ? "It will sync when connectivity returns." : result.locationCaptured ? "GPS attached." : "Saved without GPS."}</span>
              </div>
              {result.recordUrl.startsWith("/") ? <a href={result.recordUrl}>Open record</a> : null}
            </div>
          ) : null}

          <button className={styles.saveButton} type="button" onClick={() => void saveCapture()} disabled={saving || recording}>
            <Save size={17} /> {saving ? "Saving..." : online ? "Save field record" : "Save offline"}
          </button>
        </div>
      </section>

      {queue.length ? (
        <section id="offline-queue" className={styles.queuePanel}>
          <div className={styles.contextHeading}>
            <div><span>Device queue</span><strong>{queue.length} waiting / needs attention</strong></div>
            {online ? <button type="button" className={styles.locationButton} onClick={() => void doSync()}><RefreshCw size={14} /> Retry all</button> : null}
          </div>
          {queue.map((item) => (
            <article key={item.id} className={styles.queueItem}>
              <div>
                <strong>{item.title || item.recordType}</strong>
                <span>{new Date(item.capturedAt).toLocaleString()} · {item.projectSlug} · {item.state}</span>
                {item.error ? <small>{item.error}</small> : null}
              </div>
              <div>
                {item.state === "conflict" ? <button type="button" onClick={() => void retryWithCurrentContext(item)}>Use current context & retry</button> : null}
                <button type="button" onClick={() => void discard(item.id)}><Trash2 size={13} /> Discard</button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
