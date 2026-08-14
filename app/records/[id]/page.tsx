import Link from "next/link";
import { ArrowLeft, FileText, Image as ImageIcon, LockKeyhole, MapPin, Mic, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { getFieldMetadataForRecord } from "@/lib/field-records";
import { getRecordForUser } from "@/lib/records";
import { signedAssetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [record, field] = await Promise.all([
    getRecordForUser(id, user.localUserId),
    getFieldMetadataForRecord(id, user.localUserId)
  ]);
  if (!record) notFound();

  const assetUrl = record.asset_r2_key ? await signedAssetUrl(String(record.asset_r2_key), 900) : null;
  const mimeType = String(record.asset_mime_type || "");
  const isImage = mimeType.startsWith("image/");
  const isAudio = mimeType.startsWith("audio/");
  const latitude = field?.latitude !== null && field?.latitude !== undefined ? Number(field.latitude) : null;
  const longitude = field?.longitude !== null && field?.longitude !== undefined ? Number(field.longitude) : null;
  const accuracy = field?.capture_accuracy_m !== null && field?.capture_accuracy_m !== undefined ? Number(field.capture_accuracy_m) : null;

  return (
    <AppShell user={user} active="Catalog">
      <div className="record-detail-header">
        <Link href="/catalog" className="back-link"><ArrowLeft size={15} /> Catalog</Link>
        <div className="record-detail-title"><p className="eyebrow">{String(record.record_type)} · {String(record.status)}</p><h1>{record.title ? String(record.title) : record.description ? String(record.description).slice(0, 80) : "Untitled record"}</h1></div>
        <div className="record-header-actions">
          <span className={`visibility-badge ${String(record.visibility)}`}><LockKeyhole size={12} /> {String(record.visibility)}</span>
          {record.can_edit ? <Link className="secondary-button" href={`/records/${id}/edit`}><Pencil size={14} /> Edit</Link> : null}
        </div>
      </div>

      <div className="record-detail-grid">
        <section className="record-evidence">
          {assetUrl && isImage ? <img className="record-hero-image" src={assetUrl} alt={record.title ? String(record.title) : "Record image"} /> : assetUrl && isAudio ? <div className="document-preview"><Mic size={42} /><strong>{String(record.asset_filename)}</strong><audio controls src={assetUrl} style={{ width: "min(560px, 100%)" }} /><a className="secondary-button" href={assetUrl} target="_blank" rel="noreferrer">Open original audio</a></div> : assetUrl ? <div className="document-preview"><FileText size={42} /><strong>{String(record.asset_filename)}</strong><a className="primary-button" href={assetUrl} target="_blank" rel="noreferrer">Open original</a></div> : <div className="document-preview"><ImageIcon size={42} /><strong>No file attached</strong><p>This record currently contains structured notes only.</p></div>}
        </section>

        <aside className="record-inspector">
          <section><p className="eyebrow">Observation</p><h2>{record.description ? String(record.description) : "No description yet"}</h2>{record.additional_information ? <p>{String(record.additional_information)}</p> : null}</section>

          {field?.captured_in_field ? <section>
            <p className="eyebrow">Field capture</p>
            {field.transcription ? <><h3>Voice transcription</h3><p>{String(field.transcription)}</p></> : String(record.record_type) === "voice" ? <p>Transcription status: <strong>{String(field.transcription_status || "not requested")}</strong></p> : <p>This record was captured through the mobile field workflow.</p>}
          </section> : null}

          <dl className="metadata-list">
            <div><dt><UserRound size={14} /> Author</dt><dd>{String(record.author_name || record.author_email)}</dd></div>
            <div><dt>Acquisition</dt><dd>{new Date(record.acquisition_at).toLocaleString("en-GB")}</dd></div>
            <div><dt>Uploaded / created</dt><dd>{new Date(record.created_at).toLocaleString("en-GB")}</dd></div>
            <div><dt><MapPin size={14} /> Context</dt><dd>{String(record.object_name || record.site_name || "Not linked yet")}</dd></div>
            {latitude !== null && longitude !== null ? <div><dt><MapPin size={14} /> Field GPS</dt><dd>{latitude.toFixed(6)}, {longitude.toFixed(6)}{accuracy !== null ? ` · ±${Math.round(accuracy)} m` : ""}</dd></div> : null}
            <div><dt>Filter</dt><dd>{String(record.filter_name || "None recorded")}</dd></div>
            <div><dt>Enhancement</dt><dd>{String(record.enhancement || "None")}</dd></div>
            <div><dt><ShieldCheck size={14} /> Review status</dt><dd>{String(record.status)}</dd></div>
            <div><dt>Record ID</dt><dd className="mono">{String(record.id)}</dd></div>
          </dl>
          {record.asset_id ? <section className="asset-provenance"><p className="eyebrow">Original asset</p><dl className="metadata-list compact"><div><dt>Filename</dt><dd>{String(record.asset_filename)}</dd></div><div><dt>Type</dt><dd>{String(record.asset_mime_type || "Unknown")}</dd></div><div><dt>Size</dt><dd>{record.asset_file_size ? `${Math.round(Number(record.asset_file_size) / 1024)} KB` : "Unknown"}</dd></div><div><dt>SHA-256</dt><dd className="mono break">{String(record.asset_checksum || "Pending")}</dd></div></dl><p className="small-note">The original R2 object is retained. Transcription and future crops, inversions or AI processing are derived information linked back to this source asset.</p></section> : null}
        </aside>
      </div>
    </AppShell>
  );
}
