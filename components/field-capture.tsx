"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileImage, LocateFixed, Mic, NotebookPen, Ruler, Save, Square, TriangleAlert } from "lucide-react";
import styles from "./field-capture.module.css";

type FieldObject = { id: string; siteId: string; name: string; code?: string | null };
type FieldSite = { id: string; name: string; code?: string | null };
type FieldProject = { slug: string; name: string; sites: FieldSite[]; objects: FieldObject[] };
type CaptureMode = "photo" | "voice" | "note" | "measurement" | "observation";
type LocationFix = { latitude: number; longitude: number; accuracyMeters: number | null };

type CaptureResult = {
  recordId: string;
  recordUrl: string;
  transcriptionStatus: string;
  transcript?: string | null;
  locationCaptured: boolean;
};

const CONTEXT_KEY = "archeology-notes-field-context-v1";

export default function FieldCapture({ projects, transcriptionConfigured }: { projects: FieldProject[]; transcriptionConfigured: boolean }) {
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
  const [audioUrl, setAudioUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [locationMessage, setLocationMessage] = useState("Location will be requested when you save.");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CaptureResult | null>(null);

  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const project = useMemo(() => projects.find((item) => item.slug === projectSlug) || projects[0], [projectSlug, projects]);
  const sites = project?.sites || [];
  const objects = useMemo(() => (project?.objects || []).filter((item) => !siteId || item.siteId === siteId), [project, siteId]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONTEXT_KEY);
      if (!stored) return;
      const context = JSON.parse(stored) as { projectSlug?: string; siteId?: string; objectId?: string; visibility?: string };
      if (context.projectSlug && projects.some((item) => item.slug === context.projectSlug)) setProjectSlug(context.projectSlug);
      if (context.siteId) setSiteId(context.siteId);
      if (context.objectId) setObjectId(context.objectId);
      if (context.visibility && ["private", "project", "public"].includes(context.visibility)) setVisibility(context.visibility);
    } catch {
      // Invalid local field context is ignored.
    }
  }, [projects]);

  useEffect(() => {
    window.localStorage.setItem(CONTEXT_KEY, JSON.stringify({ projectSlug, siteId, objectId, visibility }));
  }, [projectSlug, siteId, objectId, visibility]);

  useEffect(() => {
    if (!project) return;
    if (siteId && !project.sites.some((item) => item.id === siteId)) {
      setSiteId(project.sites[0]?.id || "");
      setObjectId("");
    }
  }, [project, siteId]);

  useEffect(() => {
    if (objectId && !objects.some((item) => item.id === objectId)) setObjectId("");
  }, [objectId, objects]);

  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl("");
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
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
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
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

  async function saveCapture() {
    setError("");
    setResult(null);
    if (!project) {
      setError("Select a project first.");
      return;
    }
    if (mode === "photo" && !photoFile) {
      setError("Take or choose a photograph first.");
      return;
    }
    if (mode === "voice" && !audioBlob) {
      setError("Record a voice note first.");
      return;
    }
    if ((mode === "note" || mode === "observation") && !description.trim()) {
      setError("Add a short note or observation first.");
      return;
    }
    if (mode === "measurement" && !measurementValue.trim()) {
      setError("Enter the measurement value first.");
      return;
    }

    setSaving(true);
    try {
      const fix = location || await readLocation();
      const data = new FormData();
      data.append("projectSlug", project.slug);
      data.append("siteId", siteId);
      data.append("physicalObjectId", objectId);
      data.append("recordType", mode);
      data.append("visibility", visibility);
      data.append("title", title);
      data.append("description", description);
      data.append("measurementValue", measurementValue);
      data.append("measurementUnit", measurementUnit);
      data.append("capturedAt", new Date().toISOString());
      if (fix) {
        data.append("latitude", String(fix.latitude));
        data.append("longitude", String(fix.longitude));
        if (fix.accuracyMeters !== null) data.append("accuracyMeters", String(fix.accuracyMeters));
      }
      if (mode === "photo" && photoFile) data.append("file", photoFile);
      if (mode === "voice" && audioBlob) {
        const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
        data.append("file", new File([audioBlob], `voice-note-${Date.now()}.${extension}`, { type: audioBlob.type || "audio/webm" }));
      }

      const response = await fetch("/api/field/capture", { method: "POST", body: data });
      const payload = await response.json() as CaptureResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Field capture failed.");

      setResult(payload);
      setTitle("");
      setDescription("");
      setMeasurementValue("");
      setMeasurementUnit("");
      setPhotoFile(null);
      setAudioBlob(null);
      router.refresh();
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Field capture failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!projects.length) {
    return <div className={styles.empty}>Create or join a project before using Field capture.</div>;
  }

  return (
    <div className={styles.fieldWorkspace}>
      <section className={styles.contextPanel}>
        <div className={styles.contextHeading}>
          <div><span>Current context</span><strong>{project?.name || "Project"}</strong></div>
          <button type="button" className={styles.locationButton} onClick={() => void readLocation()} disabled={!locationEnabled}><LocateFixed size={16} /> {location ? "Refresh GPS" : "Get GPS"}</button>
        </div>
        <div className={styles.contextGrid}>
          <label><span>Project</span><select value={projectSlug} onChange={(event) => { setProjectSlug(event.target.value); setSiteId(""); setObjectId(""); }}>{projects.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
          <label><span>Site</span><select value={siteId} onChange={(event) => { setSiteId(event.target.value); setObjectId(""); }}><option value="">Link later</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
          <label><span>Object / area</span><select value={objectId} onChange={(event) => setObjectId(event.target.value)}><option value="">Link later</option>{objects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
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

          {mode === "photo" ? <div className={styles.fileState}><FileImage size={22} /><div><strong>{photoFile?.name || "No photograph selected"}</strong><span>{photoFile ? `${Math.round(photoFile.size / 1024)} KB` : "Take a photo or choose one from the device."}</span></div><button type="button" onClick={() => libraryInput.current?.click()}>Choose existing</button></div> : null}

          {mode === "voice" ? <div className={styles.voiceState}>{recording ? <><span className={styles.recordingDot} /><strong>Recording...</strong><button type="button" onClick={stopRecording}>Stop recording</button></> : audioUrl ? <><audio controls src={audioUrl} /><button type="button" onClick={() => void startRecording()}>Record again</button></> : <><Mic size={22} /><span>Tap Voice above to start recording.</span></>}</div> : null}

          {mode === "measurement" ? <div className={styles.measurementRow}><label><span>Value</span><input inputMode="decimal" value={measurementValue} onChange={(event) => setMeasurementValue(event.target.value)} placeholder="12.4" /></label><label><span>Unit</span><input value={measurementUnit} onChange={(event) => setMeasurementUnit(event.target.value)} placeholder="mm, cm, °C..." /></label></div> : null}

          <label><span>{mode === "measurement" ? "Measurement note" : mode === "photo" ? "Photo note" : mode === "voice" ? "Optional note before transcription" : "Observation"}</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={mode === "photo" ? "What is visible or important?" : mode === "voice" ? "Optional context for this voice note" : "Capture the observation now; refine it later."} /></label>

          <div className={styles.captureMeta}>
            <span>Author and acquisition time are automatic.</span>
            {mode === "voice" ? <span>Transcription: {transcriptionConfigured ? "enabled" : "not configured yet"}</span> : null}
          </div>

          {error ? <div className={styles.error}><TriangleAlert size={16} /> {error}</div> : null}
          {result ? <div className={styles.success}><CheckCircle2 size={17} /><div><strong>Saved to the field inbox.</strong><span>{result.locationCaptured ? "GPS attached." : "Saved without GPS."}{mode === "voice" ? ` Transcription: ${result.transcriptionStatus}.` : ""}</span></div><a href={result.recordUrl}>Open record</a></div> : null}

          <button className={styles.saveButton} type="button" onClick={() => void saveCapture()} disabled={saving || recording}><Save size={17} /> {saving ? "Saving..." : "Save field record"}</button>
        </div>
      </section>
    </div>
  );
}
