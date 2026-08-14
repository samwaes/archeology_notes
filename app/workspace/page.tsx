import { Box, Layers3, MapPinned } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const user = await requireCurrentUser();
  return (
    <AppShell user={user} active="3D Workspace">
      <header className="workspace-header"><div><p className="eyebrow">Phase 3</p><h1>3D Workspace</h1><p>The real Casignana photographic model will return here after the persistent object, record and authorship layer is stable.</p></div></header>
      <section className="future-workspace">
        <div className="future-scene"><Box size={72} /><span>Casignana photographic model</span><small>Photo · Point · Hybrid</small></div>
        <div className="future-notes"><div><MapPinned size={19} /><span><strong>Spatial annotations</strong><small>Records attach to physical context and actual XYZ locations.</small></span></div><div><Layers3 size={19} /><span><strong>Multiple representations</strong><small>Photogrammetry, point clouds and later surveys remain independent layers.</small></span></div></div>
      </section>
    </AppShell>
  );
}
