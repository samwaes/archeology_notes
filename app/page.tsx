import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Box, Camera, Database, FolderKanban, MapPinned, Search, ShieldCheck } from "lucide-react";
import AccessUsageTracker from "@/components/access-usage-tracker";
import { upsertApplicationUser } from "@/lib/db";
import { authenticatedAccessEmail, getHuplaAccessDecision, huplaAccessConfiguration } from "@/lib/hupla-access";

export const dynamic = "force-dynamic";

const workspaces = [
  { icon: Box, title: "3D Workspace", text: "Photographic models, point clouds, spatial annotations and linked evidence.", phase: "Phase 3" },
  { icon: Database, title: "Catalog", text: "Photos, notes, voice, documents and observations with provenance and filters.", phase: "Phase 1" },
  { icon: Camera, title: "Field", text: "Fast mobile capture with site context, author, time, location and later classification.", phase: "Phase 2" },
  { icon: FolderKanban, title: "Projects", text: "Projects, sites, physical objects, representations and team membership.", phase: "Phase 1" },
  { icon: Search, title: "Search", text: "Find records across spatial context, metadata, people and evidence.", phase: "Phase 1+" }
];

export default async function HomePage() {
  const requestHeaders = await headers();
  const email = authenticatedAccessEmail(requestHeaders);
  if (!email) redirect("/access?reason=identity");

  const decision = await getHuplaAccessDecision(email);
  if (!decision.allowed) redirect("/access?reason=denied");

  try {
    await upsertApplicationUser({ huplaUserId: decision.userId, email });
  } catch (error) {
    console.error("Archeology Notes user persistence failed", error);
  }

  const access = huplaAccessConfiguration();

  return (
    <>
      <main className="page-shell">
        <header className="topbar">
          <Link className="brand" href="/">hupla_<span>archeology notes</span></Link>
          <div className="user-chip"><ShieldCheck size={14} /> {email} · {decision.accessLevel}</div>
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow">Working prototype · Phase 0 foundation</p>
            <h1>Keep the evidence connected to the place.</h1>
            <p className="lead">A visual field and knowledge workspace for archaeologists and conservation professionals. Sites, physical objects, 3D surveys, photographs, notes and conservation history stay connected without turning fieldwork into database administration.</p>
          </div>
          <div className="foundation-card">
            <MapPinned size={28} />
            <strong>Casignana will be the first real project dataset.</strong>
            <p>The earlier Hupla discussion mockup remains the design reference. This standalone application is now the canonical product implementation.</p>
          </div>
        </section>

        <section className="principles" aria-label="Product principles">
          <div><strong>Object ≠ scan</strong><span>Physical context remains stable while representations change over time.</span></div>
          <div><strong>Originals stay original</strong><span>Source files remain immutable; web and analysis assets are explicit derivatives.</span></div>
          <div><strong>Capture first</strong><span>Field observations should take seconds. Classification and review can happen later.</span></div>
        </section>

        <section className="workspace-section">
          <div className="section-heading">
            <div><p className="eyebrow">Product structure</p><h2>Five connected working views</h2></div>
            <p>Phase 0 deliberately exposes the planned navigation before the records are implemented so the product structure can remain stable while functionality arrives in vertical slices.</p>
          </div>
          <div className="workspace-grid">
            {workspaces.map(({ icon: Icon, title, text, phase }) => (
              <article key={title} className="workspace-card">
                <div className="workspace-icon"><Icon size={22} /></div>
                <span className="phase-label">{phase}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="status-panel">
          <div><p className="eyebrow">Phase 0 gate</p><h2>Infrastructure before features</h2></div>
          <div className="status-list">
            <span>Hupla central identity/access</span>
            <span>Hupla usage/session tracking</span>
            <span>PostgreSQL + PostGIS migrations</span>
            <span>Private Cloudflare R2 foundation</span>
            <span>Docker/Coolify deployment</span>
            <span>/api/health + deep dependency diagnostics</span>
          </div>
        </section>

        <footer>
          <span>Archeology Notes · Hupla Labs</span>
          <a href={access.accountUrl}>Hupla account</a>
        </footer>
      </main>
      <AccessUsageTracker />
    </>
  );
}
