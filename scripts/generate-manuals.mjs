import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";

const OUT = join(process.cwd(), "manuals");
await mkdir(OUT, { recursive: true });

const C = {
  ink: "#18352d",
  green: "#49695d",
  sage: "#8d9d8a",
  sand: "#c5b9a1",
  paper: "#f7f3eb",
  pale: "#eef2ee",
  dark: "#17221e",
  muted: "#64716c",
  accent: "#b75e3d",
  line: "#d7ddd9",
  white: "#ffffff"
};

function createDocument(title, subtitle) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: title, Author: "Sam Waes / Hupla Labs" } });
  doc.on("pageAdded", () => {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.paper);
  });
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.paper);
  doc.fillColor(C.accent).font("Helvetica-Bold").fontSize(8).text("HUPLA LABS / USER TESTING", { characterSpacing: 1.1 });
  doc.moveDown(1.2).fillColor(C.ink).font("Helvetica-Bold").fontSize(30).text(title);
  doc.moveDown(0.2).fillColor(C.green).font("Helvetica").fontSize(13).text(subtitle);
  doc.moveDown(1.4);
  return doc;
}

function ensure(doc, needed = 70) {
  const limit = doc.page.height - 62;
  if (doc.y + needed > limit) doc.addPage();
}

function h1(doc, text) {
  ensure(doc, 55);
  doc.moveDown(0.8).fillColor(C.ink).font("Helvetica-Bold").fontSize(19).text(text);
  doc.moveDown(0.35);
}

function h2(doc, text) {
  ensure(doc, 42);
  doc.moveDown(0.45).fillColor(C.green).font("Helvetica-Bold").fontSize(12.5).text(text);
  doc.moveDown(0.2);
}

function body(doc, text) {
  ensure(doc, 45);
  doc.fillColor(C.dark).font("Helvetica").fontSize(9.2).text(text, { lineGap: 2.8 });
  doc.moveDown(0.45);
}

function bullet(doc, text) {
  ensure(doc, 30);
  const y = doc.y + 4;
  doc.circle(55, y, 1.7).fill(C.green);
  doc.fillColor(C.dark).font("Helvetica").fontSize(9).text(text, 64, doc.y, { width: doc.page.width - 112, lineGap: 2.2 });
  doc.moveDown(0.3);
}

function callout(doc, title, text, warning = false) {
  ensure(doc, 86);
  const x = 48, w = doc.page.width - 96;
  const start = doc.y;
  doc.fillColor(warning ? "#fff3ed" : C.pale).rect(x, start, w, 72).fill();
  doc.strokeColor(warning ? C.accent : C.green).lineWidth(0.9).rect(x, start, w, 72).stroke();
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9.5).text(title, x + 10, start + 10, { width: w - 20 });
  doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(text, x + 10, start + 27, { width: w - 20, lineGap: 2 });
  doc.y = start + 81;
}

function keyValue(doc, title, text) {
  ensure(doc, 54);
  const x = 48, w = doc.page.width - 96, left = 125;
  const y = doc.y;
  doc.fillColor(C.pale).rect(x, y, left, 46).fill();
  doc.fillColor(C.white).rect(x + left, y, w - left, 46).fill();
  doc.strokeColor(C.line).lineWidth(0.6).rect(x, y, w, 46).stroke();
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9).text(title, x + 8, y + 9, { width: left - 16 });
  doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(text, x + left + 8, y + 8, { width: w - left - 16, lineGap: 1.8 });
  doc.y = y + 52;
}

function footer(doc) {
  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(index);
    const y = doc.page.height - 34;
    doc.strokeColor(C.line).lineWidth(0.6).moveTo(48, y - 7).lineTo(doc.page.width - 48, y - 7).stroke();
    doc.fillColor(C.muted).font("Helvetica").fontSize(7).text("hupla_ archeology notes", 48, y, { lineBreak: false });
    doc.text(`Page ${index + 1}`, doc.page.width - 90, y, { width: 42, align: "right", lineBreak: false });
  }
}

async function finish(doc, filename) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(join(OUT, filename));
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);
    footer(doc);
    doc.end();
  });
}

async function quickStart() {
  const doc = createDocument("Archeology Notes", "Quick Start Guide for archaeologists, conservators and heritage documentation teams");
  callout(doc, "Purpose", "Keep field evidence, conservation history and 3D survey context connected without turning fieldwork into database administration.");
  h2(doc, "Who is this for?");
  bullet(doc, "Archaeologists documenting sites, contexts, features and finds.");
  bullet(doc, "Conservators recording condition, treatment and follow-up evidence.");
  bullet(doc, "Survey and documentation teams working with photogrammetry, meshes or point clouds.");
  bullet(doc, "Project teams that need shared evidence while keeping authorship and privacy clear.");
  callout(doc, "Pilot status", "Archeology Notes is in active user testing. Your workflow observations, terminology corrections and missing steps are useful feedback.");
  body(doc, "Production: https://archeology-notes.hupla.eu");
  body(doc, "Questions or test access: samwaes@gmail.com");

  doc.addPage();
  h1(doc, "Start in five steps");
  body(doc, "You can begin with ordinary photographs and notes. A 3D survey is useful, but it is not required for the basic workflow.");
  const steps = [
    ["1. Choose a Project", "Open an existing project or create one for an excavation, monument, conservation campaign or research collection."],
    ["2. Set the physical context", "Organise the project into Sites and Physical Objects such as rooms, trenches, walls, mosaics, features or artefacts."],
    ["3. Capture evidence", "Use Field for photos, voice, notes, observations and measurements. GPS can be attached automatically. Offline captures stay on the device until sync."],
    ["4. Review and refine", "Use Catalog to search, filter, bulk upload and edit metadata. Records retain author, acquisition time, visibility and source provenance."],
    ["5. Connect conservation or 3D", "Use Conservation for condition and treatment history. Use 3D Workspace to annotate photogrammetry or point-cloud representations when survey data is available."]
  ];
  for (const [title, text] of steps) keyValue(doc, title, text);
  callout(doc, "Field principle", "Capture first. Catalogue later. Record the evidence quickly onsite, then refine classification and relationships later in Catalog or Conservation.");

  doc.addPage();
  h1(doc, "Field capture and offline use");
  keyValue(doc, "Photo", "Use the device camera or choose an existing image. Add an optional title and field note.");
  keyValue(doc, "Voice", "Record a voice note. Original audio is preserved. Optional transcription remains derived text.");
  keyValue(doc, "Note / Observation", "Capture short text without opening the full Catalog form.");
  keyValue(doc, "Measurement", "Store a value, unit and optional note.");
  keyValue(doc, "GPS", "Attach browser-provided latitude, longitude and accuracy when available.");
  keyValue(doc, "Offline", "Photos, audio and metadata are held in IndexedDB on the current device until server-confirmed sync.");
  h2(doc, "When connectivity returns");
  bullet(doc, "Automatic sync starts when the browser comes back online.");
  bullet(doc, "Use Sync now to trigger a manual sync.");
  bullet(doc, "If project/site/object context changed, the item remains visible as a conflict. Retry with current context or discard explicitly.");
  callout(doc, "Trusted-device note", "Offline evidence stays locally on the device until sync succeeds. Use a trusted phone or tablet during the pilot and clear local application data before reassigning a device.", true);

  doc.addPage();
  h1(doc, "Conservation, 3D and collaboration");
  h2(doc, "Conservation");
  bullet(doc, "Condition: category, severity, confidence, extent and treatment priority.");
  bullet(doc, "Intervention: treatment type, status, method, materials, outcome and the condition addressed.");
  bullet(doc, "Link before and after photos, observations or documents to an intervention.");
  bullet(doc, "Review the conservation timeline and export project data as CSV.");
  h2(doc, "3D Workspace");
  bullet(doc, "Photo, Points and Hybrid viewing modes.");
  bullet(doc, "Independent survey layers with visibility and opacity controls.");
  bullet(doc, "COPC point budget and octree-depth controls for dense point clouds.");
  bullet(doc, "Annotate the active Representation and save a Catalog record with an XYZ spatial anchor.");
  h2(doc, "Visibility");
  keyValue(doc, "Private", "Only the record author can see it.");
  keyValue(doc, "Project", "Visible to authorised project members.");
  keyValue(doc, "Public", "Marked as publishable, but anonymous public delivery remains disabled during the pilot.");
  callout(doc, "Need help or want to join the test?", "Email samwaes@gmail.com with your name, organisation or project context, and the archaeological or conservation workflow you want to test.");
  await finish(doc, "Archeology-Notes-Quick-Start.pdf");
}

async function userManual() {
  const doc = createDocument("Archeology Notes", "User Manual - testing release");
  callout(doc, "Purpose", "A spatial field and conservation workspace for archaeologists and heritage professionals. It connects physical context, evidence records, conservation history and 3D survey representations while preserving authorship and source provenance.");
  body(doc, "This manual documents functions implemented in the current application. Repeated-survey change analysis and other future functions are not presented as available.");
  body(doc, "Application: https://archeology-notes.hupla.eu");
  body(doc, "Support and test-user requests: samwaes@gmail.com");

  doc.addPage();
  h1(doc, "1. What Archeology Notes is");
  body(doc, "Archeology Notes is designed for work where evidence exists in several forms at once: field notes, photographs, documents, voice, measurements, condition assessments, treatment history, photogrammetry and point-cloud surveys.");
  body(doc, "Different evidence types keep their provenance while remaining linked to the same Project, Site, Physical Object or spatial location.");
  h2(doc, "Target users");
  for (const item of ["Field archaeologists and excavation teams.", "Built-heritage and architectural archaeology teams.", "Conservators and conservation scientists.", "Photogrammetry, laser-scanning and survey specialists.", "Researchers and project teams needing shared evidence with clear authorship."]) bullet(doc, item);
  callout(doc, "Testing phase", "The current priority is to validate real workflows with real users before adding more product scope.");

  h1(doc, "2. Core concepts");
  for (const row of [
    ["Project", "The collaboration boundary for an excavation, monument, conservation campaign or research collection."],
    ["Site", "A physical or working subdivision such as a wing, room, trench or area."],
    ["Physical Object", "A persistent real-world entity such as a wall, mosaic, room, feature or artefact."],
    ["Record", "A note, photo, document, observation, measurement, voice note, condition or intervention."],
    ["Representation", "A digital survey/model such as photogrammetry, mesh or point cloud. It is not the Physical Object."],
    ["Source Asset", "Original evidence retained for preservation, for example E57, LAS/LAZ, OBJ, image, audio or PDF."],
    ["Web Derivative", "A browser-optimised working copy such as GLB or COPC linked back to its source."],
    ["Spatial Annotation", "A normal Catalog record with an XYZ anchor on a specific Representation."]
  ]) keyValue(doc, row[0], row[1]);

  doc.addPage();
  h1(doc, "3. Access and navigation");
  body(doc, "Production access uses Hupla identity behind Cloudflare Access. Application access and Project membership are separate: entering the application does not automatically grant access to every Project.");
  for (const row of [
    ["Home", "Purpose, quick start, manuals and support/test-user information."],
    ["Projects", "Create projects and manage physical structure."],
    ["Catalog", "Create, upload, filter, review and edit evidence records."],
    ["Field", "Fast mobile capture including offline queue and sync."],
    ["Conservation", "Condition, intervention, evidence relationships and timeline."],
    ["3D Workspace", "Survey layers and spatial annotation."],
    ["Search", "Cross-project evidence search with permissions preserved."]
  ]) keyValue(doc, row[0], row[1]);

  h1(doc, "4. Projects, Sites and Physical Objects");
  h2(doc, "Create a Project");
  bullet(doc, "Open Projects and enter a name. A short URL name is optional.");
  bullet(doc, "Add a description explaining purpose, scope or location.");
  bullet(doc, "Owners/admins can later edit Project details.");
  h2(doc, "Build the physical structure");
  bullet(doc, "Add Sites with name, optional code and description.");
  bullet(doc, "Add Physical Objects with Site, name, type, optional code, parent and description.");
  bullet(doc, "Use parent objects for contained or subordinate physical entities when useful.");

  doc.addPage();
  h1(doc, "5. Catalog and evidence records");
  body(doc, "Catalog is the evidence overview. It includes ordinary records plus Condition, Intervention and spatial records created elsewhere in the application.");
  for (const row of [
    ["Note", "General text note."], ["Photo", "Photograph plus optional metadata."], ["Document", "PDF, Office/text or other supported document."],
    ["Observation", "Structured observation."], ["Measurement", "Value/unit plus note."], ["Voice", "Original audio plus optional transcription."],
    ["Condition", "Created in Conservation."], ["Intervention", "Created in Conservation."]
  ]) keyValue(doc, row[0], row[1]);
  h2(doc, "Create or import");
  bullet(doc, "Choose Project, type, visibility and acquisition date.");
  bullet(doc, "Link Site and Physical Object when known, or link later.");
  bullet(doc, "Add title, description, filter, enhancement and additional information as relevant.");
  bullet(doc, "Attach a photo or document. Bulk Upload can intake multiple files for later refinement.");
  h2(doc, "Find records");
  bullet(doc, "Free-text search across title, description, author and context.");
  bullet(doc, "Filter by type, Site or Physical Object.");
  bullet(doc, "Desktop uses a table; narrow screens use cards. Both lead to the same record detail.");

  doc.addPage();
  h1(doc, "6. Field capture and offline operation");
  body(doc, "Field follows the rule: Capture first. Catalogue later. Choose Project, Site, Object/area and Visibility, then capture with minimal administration.");
  for (const row of [
    ["Photo", "Use the camera or choose an existing image."], ["Voice", "Record microphone audio. Original audio remains evidence; transcription is optional derived text."],
    ["Note", "Fast free-text note."], ["Measure", "Measurement value, unit and optional note."], ["Observe", "Fast field observation."],
    ["GPS", "Latitude, longitude and browser-reported accuracy when available."]
  ]) keyValue(doc, row[0], row[1]);
  h2(doc, "Offline queue and sync");
  bullet(doc, "Metadata and photo/audio Blob data are stored in IndexedDB on the current device.");
  bullet(doc, "Automatic sync runs when connectivity returns; Sync now triggers it manually.");
  bullet(doc, "Client capture IDs and server receipts avoid ordinary retry duplicates.");
  bullet(doc, "Permissions and Project/Site/Object context are revalidated when syncing.");
  bullet(doc, "Rejected items remain visible as conflicts. Retry with current context or discard explicitly.");
  callout(doc, "Offline security", "Use trusted devices. Offline evidence remains on the current device until server-confirmed sync.", true);

  doc.addPage();
  h1(doc, "7. Conservation workflow");
  h2(doc, "Condition");
  bullet(doc, "Choose Site and Object/area.");
  bullet(doc, "Record category, severity (low/moderate/high/critical), confidence and treatment priority.");
  bullet(doc, "Add assessment date, visibility, observation and extent.");
  h2(doc, "Intervention");
  bullet(doc, "Record intervention type and status: planned, in progress, completed or monitoring.");
  bullet(doc, "Optionally link the Condition being addressed.");
  bullet(doc, "Record description, method, materials, outcome and follow-up.");
  h2(doc, "Evidence and history");
  bullet(doc, "Link before and after photographs, observations or documents to an Intervention.");
  bullet(doc, "Use Timeline for condition/intervention history in acquisition-date order.");
  bullet(doc, "Create reusable capture templates with selected defaults.");
  bullet(doc, "Export conservation data as CSV.");

  h1(doc, "8. Record detail and provenance");
  bullet(doc, "Open original photo, document or audio when attached.");
  bullet(doc, "Review author, acquisition date, creation date, context, GPS and review status.");
  bullet(doc, "Review filter, enhancement, additional information and transcription where available.");
  bullet(doc, "Original assets expose filename, MIME type, size and SHA-256 checksum.");
  bullet(doc, "Spatial records expose XYZ and Show in 3D.");
  callout(doc, "Preservation principle", "Metadata editing does not replace the original source file or original author. Transcriptions and browser-optimised 3D files remain explicit derivatives.");

  doc.addPage();
  h1(doc, "9. 3D Workspace and Representations");
  h2(doc, "Viewing");
  bullet(doc, "Photo, Points and Hybrid modes.");
  bullet(doc, "Orbit, pan and zoom. Overview and Top presets are available; Casignana also has Apse, Floor and Wall presets.");
  bullet(doc, "Independent layers can be shown/hidden and assigned opacity.");
  h2(doc, "Dense point clouds");
  bullet(doc, "COPC is streamed through authenticated HTTP Range requests from private R2.");
  bullet(doc, "Point budget choices: 100k, 250k, 500k and 1M.");
  bullet(doc, "Octree depth choices: 3 through 7. Reduce these settings if a dataset is slow.");
  h2(doc, "Spatial observation");
  bullet(doc, "Select a Representation, choose Annotate active layer, then click a surface/point location.");
  bullet(doc, "Add title/description and visibility, then save.");
  bullet(doc, "The observation becomes a Catalog record linked to the Representation and XYZ location.");
  h2(doc, "Representation management - owners/admins");
  bullet(doc, "Create point-cloud, photogrammetry, mesh or other Representations and link them to Project/Site/Object context.");
  bullet(doc, "Preserve source formats such as E57, LAS, LAZ, COPC, OBJ, PLY or GLB in private R2.");
  bullet(doc, "Upload browser GLB or COPC derivatives. A delivered COPC may be used directly as the web stream.");
  bullet(doc, "Store registration state, 4 x 4 transform, nominal resolution, RMSE, wider uncertainty and notes.");
  callout(doc, "Current upload limits", "Browser uploads are limited to 220 MB for source files and 140 MB for web derivatives. Multi-gigabyte institutional ingestion is not yet a pilot function.", true);

  doc.addPage();
  h1(doc, "10. Search, collaboration and exports");
  h2(doc, "Search");
  bullet(doc, "Search record text, conservation categories, intervention methods, authors and physical context.");
  bullet(doc, "Restrict by Project and/or record type when useful.");
  bullet(doc, "Permissions and Private visibility remain enforced across search results.");
  h2(doc, "Visibility");
  keyValue(doc, "Private", "Visible only to the record author.");
  keyValue(doc, "Project", "Visible to authorised Project members.");
  keyValue(doc, "Public", "Marked for future/publication use; anonymous public delivery is disabled during the pilot.");
  h2(doc, "Roles");
  body(doc, "Project roles are owner, admin, contributor and viewer. Owners/admins have additional Project and Representation management functions. Authorship is retained on every contribution.");
  h2(doc, "Exports and storage");
  bullet(doc, "Catalog and Conservation can export CSV metadata.");
  bullet(doc, "Original binary evidence is stored in private Cloudflare R2.");
  bullet(doc, "Structured metadata, relationships and spatial coordinates are stored in PostgreSQL/PostGIS.");

  doc.addPage();
  h1(doc, "11. Recommended working patterns");
  h2(doc, "Onsite documentation");
  bullet(doc, "Set current Project/Site/Object in Field, capture quickly, work offline if needed, sync, then refine in Catalog.");
  h2(doc, "Conservation campaign");
  bullet(doc, "Capture baseline evidence, create Condition, record Intervention, capture after evidence, link before/after, review Timeline.");
  h2(doc, "Spatial documentation");
  bullet(doc, "Create/select Representation, load GLB or COPC derivative, verify registration metadata, annotate, then use Catalog-to-3D round trips.");

  h1(doc, "12. Current pilot boundaries");
  bullet(doc, "Two-user privacy/collaboration validation remains open.");
  bullet(doc, "Practical mobile field validation remains open.");
  bullet(doc, "Casignana photographic spatial round-trip validation remains open.");
  bullet(doc, "Professional-scale dense point-cloud validation is parked until suitable data is available.");
  bullet(doc, "Repeated-survey geometric comparison/change analysis is parked until repeated survey data exists.");
  bullet(doc, "Anonymous public publishing is disabled during the pilot.");

  h1(doc, "13. Troubleshooting");
  for (const row of [
    ["Cannot enter", "Contact the test owner to confirm Hupla application access."],
    ["Project missing", "Application access and Project membership are separate. Confirm membership."],
    ["Capture waiting", "Open Field, reconnect and choose Sync now."],
    ["Sync conflict", "Select current Project/Site/Object context and retry, or discard explicitly."],
    ["GPS unavailable", "Capture can continue without GPS. Check device/browser location permission if needed."],
    ["3D slow", "Reduce point budget and/or octree depth."],
    ["3D layer missing", "Owners/admins should verify a web derivative is uploaded to the Representation."],
    ["Colleague cannot see Private record", "This is expected. Private records are author-only."]
  ]) keyValue(doc, row[0], row[1]);

  h1(doc, "14. Support and test access");
  callout(doc, "Questions, feedback or test-user requests", "Email samwaes@gmail.com. Include your name, organisation/project context, main discipline and the workflow/evidence types you want to test.");
  body(doc, "Useful feedback is concrete: the task you were trying to complete, where the interface slowed you down, which terminology felt wrong, and what you still needed to do outside the application.");
  await finish(doc, "Archeology-Notes-User-Manual.pdf");
}

await quickStart();
await userManual();
console.log(`[manuals] generated user documentation in ${OUT}`);
