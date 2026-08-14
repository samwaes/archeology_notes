import Link from "next/link";
import { ArrowLeft, FileText, Image as ImageIcon, LockKeyhole, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import { getRecordForUser } from "@/lib/records";
import { signedAssetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const record = await getRecordForUser(id, user.localUserId);
  if (!record) notFound();

  const assetUrl = record.asset_r2_key ? await signedAssetUrl(String(record.asset_r2_key), 900) : null;
  const isImage = String(record.asset_mime_type || "").startsWith("image/");

  return (
    <AppShell user={user} active="Catalog">
      <div className="record-detail-header">
        <Link href="/catalog" className="back-link"><ArrowLeft size={15} /> Catalog</Link>
        <div className="record-detail-title"><p className="eyebrow">{String(record.record_type)} · {String(record.status)}</p><h1>{record.title ? String(record.title) : record.description ? String(record.description).slice(0, 80) : "Untitled record"}</h1></div>
        <span className={`visibility-badge ${String(record.visibility)}`}><LockKeyhole size={12} /> {String(record.visibility)}</span>
      </div>

      <div className="record-detail-grid">
        <section className="record-evidence">
          {assetUrl && isImage ? <img className="record-hero-image" src={assetUrl} alt={record.title ? String(record.title) : "Record image"} /> : assetUrl ? <div className="document-preview"><FileText size={42} /><strong>{String(record.asset_filename)}</strong><a className="primary-button" href={assetUrl} target="_blank" rel="noreferrer">Open original</a></div> : <div className="document-preview"><ImageIcon size={42} /><strong>No file attached</strong><p>This record currently contains structured notes only.</p></div>}
        </section>

        <aside className="record-inspector">
          <section><p className="eyebrow">Observation</p><h2>{record.description ? String(record.description) : "No description yet"}</h2>{record.additional_information ? <p>{String(record.additional_information)}</p> : null}</section>
          <dl className="metadata-list">
            <div><dt><UserRound size={14} /> Author</dt><dd>{String(record.author_name || record.author_email)}</dd></div>
            <div><dt>Acquisition</dt><dd>{new Date(record.acquisition_at).toLocaleString("en-GB")}</dd></div>
            <div><dt>Uploaded / created</dt><dd>{new Date(record.created_at).toLocaleString("en-GB")}</dd></div>
            <div><dt><MapPin size={14} /> Context</dt><dd>{String(record.object_name || record.site_name || "Not linked yet")}</dd></div>
            <div><dt>Filter</dt><dd>{String(record.filter_name || "None recorded")}</dd></div>
            <div><dt>Enhancement</dt><dd>{String(record.enhancement || "None")}</dd></div>
            <div><dt><ShieldCheck size={14} /> Review status</dt><dd>{String(record.status)}</dd></div>
            <div><dt>Record ID</dt><dd className="mono">{String(record.id)}</dd></div>
          </dl>
          {record.asset_id ? <section className="asset-provenance"><p className="eyebrow">Original asset</p><dl className="metadata-list compact"><div><dt>Filename</dt><dd>{String(record.asset_filename)}</dd></div><div><dt>Type</dt><dd>{String(record.asset_mime_type || "Unknown")}</dd></div><div><dt>Size</dt><dd>{record.asset_file_size ? `${Math.round(Number(record.asset_file_size) / 1024)} KB` : "Unknown"}</dd></div><div><dt>SHA-256</dt><dd className="mono break">{String(record.asset_checksum || "Pending")}</dd></div></dl><p className="small-note">The original R2 object is retained. Future crops, inversions or AI processing will be stored as explicit derivatives linked back to this source asset.</p></section> : null}
        </aside>
      </div>
    </AppShell>
  );
}
