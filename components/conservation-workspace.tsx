"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ClipboardCheck, Download, Hammer, History, Plus, ShieldAlert } from "lucide-react";
import type { CaptureTemplate, ConservationItem } from "@/lib/conservation";
import styles from "./conservation-workspace.module.css";

type Site={id:string;name:string};
type ObjectItem={id:string;siteId:string;name:string};

export default function ConservationWorkspace({projectSlug,projectName,sites,objects,items,templates}:{projectSlug:string;projectName:string;sites:Site[];objects:ObjectItem[];items:ConservationItem[];templates:CaptureTemplate[]}) {
  const router=useRouter();
  const [tab,setTab]=useState<"condition"|"intervention"|"timeline"|"templates">("condition");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [siteId,setSiteId]=useState(sites[0]?.id||"");
  const objectChoices=useMemo(()=>objects.filter((item)=>!siteId||item.siteId===siteId),[objects,siteId]);
  const [physicalObjectId,setPhysicalObjectId]=useState("");
  const conditions=items.filter((item)=>item.recordType==="condition");
  const interventions=items.filter((item)=>item.recordType==="intervention");
  const activeHigh=conditions.filter((item)=>item.active && ["high","critical"].includes(item.severity||"")).length;

  async function submit(kind:"condition"|"intervention",form:HTMLFormElement) {
    setBusy(true); setMessage("");
    try {
      const fd=new FormData(form); const body:ObjectRecord={kind,projectSlug};
      fd.forEach((value,key)=>{ if(typeof value==="string") body[key]=value; });
      const response=await fetch("/api/conservation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const payload=await response.json() as {error?:string;recordId?:string};
      if(!response.ok) throw new Error(payload.error||"Could not save conservation record.");
      form.reset(); setPhysicalObjectId(""); setMessage("Saved. The item is now part of the Catalog and conservation history."); router.refresh();
    } catch(error) { setMessage(error instanceof Error?error.message:"Save failed."); } finally { setBusy(false); }
  }

  async function saveTemplate(form:HTMLFormElement) {
    setBusy(true);setMessage("");
    try {
      const fd=new FormData(form); const recordType=String(fd.get("recordType")||"condition");
      const template:Record<string,unknown>={};
      for(const key of ["category","severity","confidence","treatmentPriority","interventionType","interventionStatus"]) { const value=String(fd.get(key)||"").trim(); if(value) template[key]=value; }
      const response=await fetch("/api/conservation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"template",projectSlug,name:String(fd.get("name")||""),recordType,visibility:String(fd.get("visibility")||"project"),template})});
      const payload=await response.json() as {error?:string}; if(!response.ok) throw new Error(payload.error||"Could not save template.");
      setMessage("Template saved for reuse in the project."); form.reset(); router.refresh();
    } catch(error){setMessage(error instanceof Error?error.message:"Template save failed.");} finally{setBusy(false);}
  }

  return <div className={styles.workspace}>
    <section className={styles.stats}>
      <div><Activity size={19}/><strong>{conditions.length}</strong><span>condition assessments</span></div>
      <div><ShieldAlert size={19}/><strong>{activeHigh}</strong><span>high/critical active</span></div>
      <div><Hammer size={19}/><strong>{interventions.length}</strong><span>interventions</span></div>
      <div><ClipboardCheck size={19}/><strong>{templates.length}</strong><span>capture templates</span></div>
    </section>

    <nav className={styles.tabs}>
      <button className={tab==="condition"?styles.active:""} onClick={()=>setTab("condition")}>Condition</button>
      <button className={tab==="intervention"?styles.active:""} onClick={()=>setTab("intervention")}>Intervention</button>
      <button className={tab==="timeline"?styles.active:""} onClick={()=>setTab("timeline")}>Timeline</button>
      <button className={tab==="templates"?styles.active:""} onClick={()=>setTab("templates")}>Templates</button>
      <a className={styles.export} href={`/api/conservation/export?project=${encodeURIComponent(projectSlug)}`}><Download size={14}/> Export CSV</a>
    </nav>

    {message?<div className={styles.notice}>{message}</div>:null}

    {tab==="condition"?<section className={styles.twoCol}>
      <form className={styles.form} onSubmit={(event)=>{event.preventDefault();void submit("condition",event.currentTarget);}}>
        <p className={styles.eyebrow}>New assessment</p><h2>Record condition</h2>
        <div className={styles.grid}>
          <label><span>Site</span><select name="siteId" value={siteId} onChange={(e)=>{setSiteId(e.target.value);setPhysicalObjectId("");}}><option value="">No site</option>{sites.map((site)=><option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label><span>Object / area</span><select name="physicalObjectId" value={physicalObjectId} onChange={(e)=>setPhysicalObjectId(e.target.value)}><option value="">Link later</option>{objectChoices.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Category</span><input name="category" required placeholder="cracking, loss, staining..." /></label>
          <label><span>Severity</span><select name="severity" defaultValue="moderate"><option>low</option><option>moderate</option><option>high</option><option>critical</option></select></label>
          <label><span>Confidence</span><select name="confidence" defaultValue="medium"><option>low</option><option>medium</option><option>high</option></select></label>
          <label><span>Priority</span><select name="treatmentPriority" defaultValue="monitor"><option>monitor</option><option>routine</option><option>urgent</option><option>emergency</option></select></label>
          <label><span>Visibility</span><select name="visibility" defaultValue="project"><option>private</option><option>project</option><option>public</option></select></label>
          <label><span>Assessment date</span><input name="acquisitionAt" type="datetime-local" /></label>
          <label className={styles.wide}><span>Title</span><input name="title" placeholder="Optional short title" /></label>
          <label className={styles.wide}><span>Observation</span><textarea name="description" rows={4} placeholder="What is visible? Keep observation separate from interpretation." /></label>
          <label className={styles.wide}><span>Extent</span><input name="extent" placeholder="e.g. 0.4 m², north edge, localised" /></label>
        </div><button disabled={busy}><Plus size={15}/> Save condition assessment</button>
      </form>
      <div className={styles.list}><p className={styles.eyebrow}>Current conditions</p><h2>{projectName}</h2>{conditions.length?conditions.map((item)=><Link href={`/records/${item.recordId}`} key={item.recordId} className={styles.item}><div><strong>{item.title||item.category||"Condition"}</strong><span>{item.objectName||item.siteName||"Unlinked"} · {new Date(item.acquisitionAt).toLocaleDateString("en-GB")}</span></div><div className={styles.badges}><span data-severity={item.severity}>{item.severity}</span><span>{item.treatmentPriority}</span></div></Link>):<p className={styles.empty}>No condition assessments yet.</p>}</div>
    </section>:null}

    {tab==="intervention"?<section className={styles.twoCol}>
      <form className={styles.form} onSubmit={(event)=>{event.preventDefault();void submit("intervention",event.currentTarget);}}>
        <p className={styles.eyebrow}>Conservation action</p><h2>Record intervention</h2>
        <div className={styles.grid}>
          <label><span>Site</span><select name="siteId"><option value="">No site</option>{sites.map((site)=><option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label><span>Object / area</span><select name="physicalObjectId"><option value="">Link later</option>{objects.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Type</span><input name="interventionType" required placeholder="cleaning, consolidation, repair..." /></label>
          <label><span>Status</span><select name="interventionStatus" defaultValue="planned"><option value="planned">planned</option><option value="in_progress">in progress</option><option value="completed">completed</option><option value="monitoring">monitoring</option></select></label>
          <label><span>Date</span><input name="interventionDate" type="date" /></label>
          <label><span>Visibility</span><select name="visibility" defaultValue="project"><option>private</option><option>project</option><option>public</option></select></label>
          <label className={styles.wide}><span>Addresses condition</span><select name="conditionRecordId"><option value="">No direct link</option>{conditions.map((item)=><option key={item.recordId} value={item.recordId}>{item.title||item.category||item.recordId.slice(0,8)}</option>)}</select></label>
          <label className={styles.wide}><span>Title</span><input name="title" /></label>
          <label className={styles.wide}><span>Description</span><textarea name="description" rows={3}/></label>
          <label className={styles.wide}><span>Method</span><textarea name="method" rows={2}/></label>
          <label className={styles.wide}><span>Materials</span><input name="materials" /></label>
          <label className={styles.wide}><span>Outcome / follow-up</span><textarea name="outcome" rows={3}/></label>
        </div><button disabled={busy}><Plus size={15}/> Save intervention</button>
      </form>
      <div className={styles.list}><p className={styles.eyebrow}>Intervention history</p><h2>{projectName}</h2>{interventions.length?interventions.map((item)=><Link href={`/records/${item.recordId}`} key={item.recordId} className={styles.item}><div><strong>{item.title||item.interventionType||"Intervention"}</strong><span>{item.objectName||item.siteName||"Unlinked"} · {new Date(item.acquisitionAt).toLocaleDateString("en-GB")}</span></div><div className={styles.badges}><span>{item.interventionStatus}</span></div></Link>):<p className={styles.empty}>No interventions yet.</p>}</div>
    </section>:null}

    {tab==="timeline"?<section className={styles.timeline}><div className={styles.timelineHeading}><History size={20}/><div><p className={styles.eyebrow}>Object and site history</p><h2>Conservation timeline</h2></div></div>{items.length?items.map((item)=><article key={item.recordId}><time>{new Date(item.acquisitionAt).toLocaleDateString("en-GB")}</time><div><span>{item.recordType}</span><Link href={`/records/${item.recordId}`}>{item.title||item.category||item.interventionType||"Untitled record"}</Link><p>{item.description||item.method||"No description"}</p><small>{item.objectName||item.siteName||"Unlinked"} · {item.authorName||item.authorEmail}</small></div></article>):<p className={styles.empty}>The timeline will fill as conditions and interventions are recorded.</p>}</section>:null}

    {tab==="templates"?<section className={styles.twoCol}><form className={styles.form} onSubmit={(e)=>{e.preventDefault();void saveTemplate(e.currentTarget);}}><p className={styles.eyebrow}>Reusable capture</p><h2>Create template</h2><div className={styles.grid}><label className={styles.wide}><span>Name</span><input name="name" required placeholder="Wall moisture check" /></label><label><span>Type</span><select name="recordType"><option value="condition">condition</option><option value="observation">observation</option><option value="measurement">measurement</option><option value="intervention">intervention</option><option value="note">note</option></select></label><label><span>Visibility</span><select name="visibility"><option>project</option><option>private</option><option>public</option></select></label><label><span>Category</span><input name="category" /></label><label><span>Severity</span><select name="severity"><option value="">Not set</option><option>low</option><option>moderate</option><option>high</option><option>critical</option></select></label><label><span>Confidence</span><select name="confidence"><option value="">Not set</option><option>low</option><option>medium</option><option>high</option></select></label><label><span>Priority</span><select name="treatmentPriority"><option value="">Not set</option><option>monitor</option><option>routine</option><option>urgent</option><option>emergency</option></select></label><label><span>Intervention type</span><input name="interventionType" /></label><label><span>Intervention status</span><select name="interventionStatus"><option value="">Not set</option><option>planned</option><option value="in_progress">in progress</option><option>completed</option><option>monitoring</option></select></label></div><button disabled={busy}><Plus size={15}/> Save template</button></form><div className={styles.list}><p className={styles.eyebrow}>Project templates</p><h2>Fast capture presets</h2>{templates.map((template)=><div className={styles.template} key={template.id}><strong>{template.name}</strong><span>{template.recordType} · {template.defaultVisibility}</span><code>{JSON.stringify(template.template)}</code></div>)}</div></section>:null}
  </div>;
}

type ObjectRecord=Record<string,string>;
