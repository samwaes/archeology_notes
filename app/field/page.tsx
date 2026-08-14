import Link from "next/link";
import { Camera, MapPin, Mic, NotebookPen, Ruler } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  const user = await requireCurrentUser();
  return (
    <AppShell user={user} active="Field">
      <header className="workspace-header"><div><p className="eyebrow">Phase 2 preview</p><h1>Field capture</h1><p>The mobile workflow will keep Casignana and the current physical context selected while observations are captured in seconds.</p></div></header>
      <section className="field-context"><MapPin size={18} /><div><span>Current project</span><strong>Casignana · Casignana room</strong></div></section>
      <section className="field-actions">
        <Link href="/catalog"><Camera size={25} /><strong>Photo</strong><span>Capture or upload a photograph</span></Link>
        <Link href="/catalog"><Mic size={25} /><strong>Voice</strong><span>Original audio plus transcription in Phase 2</span></Link>
        <Link href="/catalog"><NotebookPen size={25} /><strong>Note</strong><span>Quick observation with author and time</span></Link>
        <Link href="/catalog"><Ruler size={25} /><strong>Measure</strong><span>Record a measurement and context</span></Link>
      </section>
      <p className="small-note">Phase 1 uses the same persistent record model through Catalog. Camera, microphone, GPS and offline capture are the next implementation slice.</p>
    </AppShell>
  );
}
