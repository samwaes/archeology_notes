"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Link2, Mic, Square, Trash2, Upload } from "lucide-react";

type Asset = {
  id: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  role: string;
};

type LinkRow = {
  related_record_id: string;
  related_record_type: string;
  related_title: string | null;
  related_description: string | null;
  related_acquisition_at: string;
  related_author_name: string | null;
  related_author_email: string;
  relationship_type: string;
  direction: string;
};

type Candidate = {
  id: string;
  record_type: string;
  title: string | null;
  description: string | null;
  acquisition_at: string;
  site_name: string | null;
  object_name: string | null;
};

function label(value: { title?: string | null; description?: string | null }) {
  return value.title || value.description?.slice(0, 90) || "Untitled record";
}

function sizeLabel(value: number | null) {
  if (!value) return "";
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

export default function RecordEvidenceEditor({
  record,
  assets,
  links,
  candidates
}: {
  record: {
    id: string;
    projectSlug: string;
    siteId: string | null;
    physicalObjectId: string | null;
    visibility: string;
  };
  assets: Asset[];
  links: LinkRow[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [targetRecordId, setTargetRecordId] = useState(candidates[0]?.id || "");
  const [relationshipType, setRelationshipType] = useState("related");
  const [linking, setLinking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  async function uploadAttachments() {
    if (!files.length) return;
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch(`/api/records/${record.id}/attachments`, { method: "POST", body: formData });
      const payload = await response.json() as { error?: string; attachments?: unknown[] };
      if (!response.ok) throw new Error(payload.error || "Could not add supporting files.");
      setFiles([]);
      setMessage(`${payload.attachments?.length || 0} supporting file(s) added.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add supporting files.");
    } finally {
      setUploading(false);
    }
  }

  async function addLink() {
    if (!targetRecordId) return;
    setLinking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/records/${record.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRecordId, relationshipType })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not link the record.");
      setMessage("Existing evidence linked.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not link the record.");
    } finally {
      setLinking(false);
    }
  }

  async function removeLink(link: LinkRow) {
    setMessage("");
    const response = await fetch(`/api/records/${record.id}/links`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetRecordId: link.related_record_id, relationshipType: link.relationship_type })
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "Could not remove the link.");
      return;
    }
    setMessage("Evidence link removed.");
    router.refresh();
  }

  async function startRecording() {
    setMessage("");
    setVoiceBlob(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Audio recording is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        setVoiceBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecording(true);
    } catch {
      setMessage("Microphone permission was not granted or the microphone is unavailable.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function saveVoiceNote() {
    if (!voiceBlob) return;
    setVoiceBusy(true);
    setMessage("");
    try {
      const extension = voiceBlob.type.includes("mp4") ? "m4a" : "webm";
      const voice = new File([voiceBlob], `voice-note-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`, { type: voiceBlob.type || "audio/webm" });
      const formData = new FormData();
      formData.set("projectSlug", record.projectSlug);
      formData.set("recordType", "voice");
      formData.set("visibility", record.visibility);
      formData.set("siteId", record.siteId || "");
      formData.set("physicalObjectId", record.physicalObjectId || "");
      formData.set("title", "Linked voice note");
      formData.set("description", "Voice note added while reviewing an existing record.");
      formData.set("capturedAt", new Date().toISOString());
      formData.set("file", voice);
      const voiceResponse = await fetch("/api/field/capture", { method: "POST", body: formData });
      const voicePayload = await voiceResponse.json() as { error?: string; recordId?: string; transcriptionStatus?: string };
      if (!voiceResponse.ok || !voicePayload.recordId) throw new Error(voicePayload.error || "Could not save the voice note.");

      const linkResponse = await fetch(`/api/records/${record.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRecordId: voicePayload.recordId, relationshipType: "related" })
      });
      const linkPayload = await linkResponse.json() as { error?: string };
      if (!linkResponse.ok) throw new Error(`Voice note was saved, but linking failed: ${linkPayload.error || "unknown error"}`);

      setVoiceBlob(null);
      setMessage(voicePayload.transcriptionStatus === "completed" ? "Voice note saved, transcribed and linked." : "Voice note saved and linked.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the voice note.");
    } finally {
      setVoiceBusy(false);
    }
  }

  return <section className="quick-add-panel record-evidence-editor">
    <div className="panel-heading"><div><p className="eyebrow">Evidence & links</p><h2>Add evidence after creation</h2></div><p>Attach supporting files, record a new linked voice note, or connect an earlier project record without duplicating it.</p></div>

    <div className="evidence-editor-grid">
      <section className="evidence-editor-card">
        <div className="evidence-card-title"><FilePlus2 size={18} /><div><strong>Supporting files</strong><span>Documents, images and audio attached directly to this record.</span></div></div>
        <input type="file" multiple accept="image/*,audio/*,.pdf,.txt,.csv,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
        {files.length ? <p className="small-note">{files.map((file) => file.name).join(" · ")}</p> : null}
        <button type="button" className="secondary-button" disabled={!files.length || uploading} onClick={() => void uploadAttachments()}><Upload size={14} /> {uploading ? "Uploading..." : "Add files"}</button>
        {assets.length ? <div className="evidence-mini-list">{assets.map((asset) => <div key={asset.id}><strong>{asset.original_filename}</strong><span>{asset.role} · {asset.mime_type || "file"}{asset.file_size ? ` · ${sizeLabel(asset.file_size)}` : ""}</span></div>)}</div> : <p className="small-note">No files attached yet.</p>}
      </section>

      <section className="evidence-editor-card">
        <div className="evidence-card-title"><Mic size={18} /><div><strong>Voice note</strong><span>Creates a separate Voice record and links it back here.</span></div></div>
        <div className="voice-edit-actions">{recording ? <button type="button" className="danger-outline-button" onClick={stopRecording}><Square size={14} /> Stop recording</button> : <button type="button" className="secondary-button" onClick={() => void startRecording()}><Mic size={14} /> Record voice note</button>}{voiceBlob ? <button type="button" className="primary-button" disabled={voiceBusy} onClick={() => void saveVoiceNote()}>{voiceBusy ? "Saving..." : "Save & link voice note"}</button> : null}</div>
        {recording ? <p className="form-note">Recording... speak naturally, then stop and save.</p> : voiceBlob ? <p className="form-note">Voice note ready. Saving creates its own evidence record and preserves the original audio.</p> : <p className="small-note">If transcription is configured, the linked Voice record will also use the normal transcription workflow.</p>}
      </section>

      <section className="evidence-editor-card evidence-link-card">
        <div className="evidence-card-title"><Link2 size={18} /><div><strong>Link existing record</strong><span>Connect earlier notes, photos, documents, voice notes or observations.</span></div></div>
        {candidates.length ? <><label><span>Existing record</span><select value={targetRecordId} onChange={(event) => setTargetRecordId(event.target.value)}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.record_type} · {new Date(candidate.acquisition_at).toLocaleDateString()} · {label({ title: candidate.title, description: candidate.description }).slice(0, 85)}</option>)}</select></label><label><span>Relationship</span><select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}><option value="related">Related</option><option value="supports">Supports / evidence for</option><option value="follows">Follows / later observation</option></select></label><button type="button" className="secondary-button" disabled={!targetRecordId || linking} onClick={() => void addLink()}><Link2 size={14} /> {linking ? "Linking..." : "Link existing record"}</button></> : <p className="small-note">No other visible project records are available to link yet.</p>}
        {links.length ? <div className="linked-record-list">{links.map((link) => <div key={`${link.related_record_id}-${link.relationship_type}-${link.direction}`}><a href={`/records/${link.related_record_id}`}><strong>{link.related_record_type} · {label({ title: link.related_title, description: link.related_description })}</strong><span>{link.relationship_type} · {new Date(link.related_acquisition_at).toLocaleDateString()} · {link.related_author_name || link.related_author_email}</span></a><button type="button" aria-label="Remove relationship" onClick={() => void removeLink(link)}><Trash2 size={13} /></button></div>)}</div> : <p className="small-note">No linked evidence yet.</p>}
      </section>
    </div>
    {message ? <p className="form-note evidence-editor-message">{message}</p> : null}
  </section>;
}
