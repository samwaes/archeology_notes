import Link from "next/link";
import { ArrowRight, BookOpen, Box, Camera, Database, Download, FlaskConical, Mail, MapPinned, ScanLine, Stethoscope, UsersRound } from "lucide-react";
import AppShell from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/current-user";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

const quickSteps = [
  ["Choose a project", "Open an existing project or create a working context for an excavation, monument or conservation campaign."],
  ["Set the context", "Organise the project into Sites and Physical Objects so evidence remains connected to the real place or object."],
  ["Capture evidence", "Use Field for photos, voice, notes, observations and measurements. Work offline when connectivity disappears."],
  ["Review and connect", "Use Catalog and Conservation to refine metadata, assess condition and link before/after treatment evidence."],
  ["Add spatial context", "Use the 3D Workspace for photogrammetry, point clouds and persistent XYZ observations when survey data is available."]
] as const;

export default async function HomePage() {
  const user = await requireCurrentUser();
  return (
    <AppShell user={user} active="Home">
      <div className={styles.home}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.badge}><FlaskConical size={14} /> User testing release</span>
            <h1>Field evidence, conservation history and 3D context in one place.</h1>
            <p className={styles.heroLead}>Archeology Notes is a working pilot for archaeologists, conservators and heritage documentation teams. Capture evidence quickly onsite, keep authorship and source provenance clear, and connect records to the physical context that gives them meaning.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primary} href="/projects">Open projects <ArrowRight size={15} /></Link>
              <Link className={styles.secondary} href="/field">Start field capture <Camera size={15} /></Link>
            </div>
          </div>
          <aside className={styles.heroPanel}>
            <p>Designed for</p><h2>Real heritage workflows</h2>
            <div className={styles.audienceList}>
              <div><span><MapPinned size={18} /></span><div><strong>Archaeologists</strong><small>Sites, contexts, features, finds and field evidence</small></div></div>
              <div><span><Stethoscope size={18} /></span><div><strong>Conservators</strong><small>Condition, intervention, evidence and follow-up</small></div></div>
              <div><span><ScanLine size={18} /></span><div><strong>Survey & documentation teams</strong><small>Photogrammetry, meshes, point clouds and spatial observations</small></div></div>
              <div><span><UsersRound size={18} /></span><div><strong>Collaborative project teams</strong><small>Shared records with clear authorship and visibility</small></div></div>
            </div>
          </aside>
        </section>

        <section>
          <div className={styles.sectionHeader}><div><p>Purpose</p><h2>Capture quickly. Keep the evidence connected.</h2></div><span>The application separates the physical object from its digital representations, preserves original evidence, and lets field, catalog, conservation and 3D work remain different views of the same project knowledge.</span></div>
          <div className={styles.purposeGrid}>
            <article className={styles.purposeCard}><div className={styles.icon}><Camera size={20} /></div><h3>Capture in the field</h3><p>Photos, voice, text, observations, measurements and GPS. Offline captures remain safely queued on the current device until server-confirmed sync.</p></article>
            <article className={styles.purposeCard}><div className={styles.icon}><Database size={20} /></div><h3>Build a traceable record</h3><p>Catalog evidence keeps author, acquisition time, visibility, physical context and original source assets together. Search and bulk intake support practical project work.</p></article>
            <article className={styles.purposeCard}><div className={styles.icon}><Box size={20} /></div><h3>Connect spatial evidence</h3><p>Photogrammetry and point-cloud representations remain independent layers. Spatial annotations become normal Catalog records linked to their Representation and XYZ location.</p></article>
          </div>
        </section>

        <section className={styles.quickStart}>
          <div className={styles.sectionHeader}><div><p>Quick start</p><h2>Your first useful session</h2></div><span>You do not need a point cloud to start. Ordinary photos, notes and a clear project context are enough to test the core workflow.</span></div>
          <div className={styles.steps}>{quickSteps.map(([title, text], index) => <article className={styles.step} key={title}><span className={styles.stepNumber}>{index + 1}</span><strong>{title}</strong><p>{text}</p></article>)}</div>
        </section>

        <section>
          <div className={styles.sectionHeader}><div><p>Guides</p><h2>Download the manuals</h2></div><span>Use the short guide for a first session. The full manual covers every function currently available in this testing release.</span></div>
          <div className={styles.manualGrid}>
            <a className={styles.manualCard} href="/manuals/quick-start.pdf"><span className={styles.manualIcon}><BookOpen size={23} /></span><div><h3>Quick Start Guide</h3><p>4 pages. The five-step workflow, field/offline capture, conservation, 3D basics, visibility and support.</p></div><span className={styles.download}><Download size={15} /> PDF</span></a>
            <a className={styles.manualCard} href="/manuals/user-manual.pdf"><span className={styles.manualIcon}><BookOpen size={23} /></span><div><h3>Full User Manual</h3><p>10 pages. Projects, Catalog, Field, offline sync, Conservation, records, 3D Workspace, Search, roles, exports and troubleshooting.</p></div><span className={styles.download}><Download size={15} /> PDF</span></a>
          </div>
        </section>

        <p className={styles.testingNote}>This is a testing product, not a finished institutional archive. Dense point-cloud performance and repeated-survey comparison remain explicit validation areas. Please report confusing terminology, missing steps and tasks you still need to complete outside the application.</p>

        <section className={styles.contact}>
          <div><span className={styles.eyebrow}>Questions, feedback or access</span><h2>Want to test Archeology Notes?</h2><p>Contact Sam Waes for questions or to be added as a test user. Include your name, organisation or project context, and the archaeological, conservation or survey workflow you want to test.</p></div>
          <div className={styles.contactActions}>
            <a className={styles.mailButton} href="mailto:samwaes@gmail.com?subject=Archeology%20Notes%20question"><Mail size={16} /> samwaes@gmail.com</a>
            <a className={styles.testButton} href="mailto:samwaes@gmail.com?subject=Archeology%20Notes%20test%20user%20request"><UsersRound size={16} /> Request test access</a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
