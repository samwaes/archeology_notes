# Development plan

Updated: 2026-08-15

## Roadmap principle

Development now follows what can be tested with available archaeological material. Dense point-cloud and repeated-survey capabilities remain implemented research paths, but they must not block user testing of the evidence, field and conservation workflows.

## Phase 0: standalone foundation

Status: **complete and validated**.

Implemented: standalone Next.js/TypeScript application, Docker/Coolify deployment, PostgreSQL + PostGIS, Hupla identity/access and usage tracking, private Cloudflare R2, migrations and health diagnostics.

Gate 0 passed on 2026-08-14.

## Phase 1: projects, records and Catalog

Status: **implemented; explicit two-user privacy validation remains open**.

Implemented: Projects, Sites, Physical Objects, project membership, notes/photos/documents/observations/measurements/voice, authorship, Private/Project/Public visibility, original R2 assets with SHA-256, project-aware Catalog, editing, audit history and structured context.

Gate 1 remains: validate collaboration and private-record isolation with two real users.

## Phase 2: field capture

Status: **implemented; practical field test remains open**.

Implemented: mobile capture for camera/photo library, text notes, observations, measurements, browser voice recording, original audio retention, optional transcription, GPS, automatic author/time, persistent project/site/object context and field inbox.

The original audio is evidence. Transcription remains derived information.

Gate 2 remains: complete a representative mobile session with at least ten mixed field records.

## Phase 3: photographic 3D workspace

Status: **implemented; production round-trip validation remains open**.

Implemented: Representation registry, private R2 GLB derivatives, photographic default view, orbit/pan/zoom, Photo/Points/Hybrid modes, direct surface XYZ annotation, PostGIS PointZ anchors, Catalog records linked to 3D context and Show in 3D round trips.

Casignana is the first real photogrammetry dataset. Its GLB remains a working derivative, not the preservation source.

Gate 3 remains: complete the photographic model upload and Catalog ↔ 3D annotation round trip in production.

## Phase 4: dense point clouds and multiple representations

Status: **implemented as a functional prototype; Gate 4 parked until suitable data is available**.

Implemented: E57/LAS/LAZ/COPC preservation strategy, COPC browser representation, authenticated R2 byte-range proxy, COPC hierarchy/LAZ decoding, point-budget/depth controls, overlapping representation layers, independent opacity/visibility, registration transforms, registration status, nominal resolution, RMSE and uncertainty.

The current LOD approach is intentionally a prototype rather than a mature camera-driven streaming engine.

Gate 4 requires a genuine professional-size point-cloud dataset and is therefore parked, not failed.

## Phase 5A: conservation and evidence workflow

Status: **implemented in the combined pilot-hardening release; validation pending**.

Implemented:

- condition-assessment records
- condition category, severity, confidence, extent and treatment priority
- conservation interventions with planned/in-progress/completed/monitoring status
- method, materials and outcome
- intervention → condition relationship
- explicit before/after evidence links to ordinary Catalog records
- conservation metadata on normal record-detail pages
- conservation timeline
- conservation CSV export
- reusable project capture templates

Gate 5A: a conservation user can document an observed condition, link it to a physical context, create an intervention, attach before/after evidence and understand the history without using the underlying database directly.

## Phase 5B: repeated-survey comparison

Status: **parked until appropriate repeated survey datasets are available**.

Future scope:

- survey A/B overlay
- fade and split comparison
- distance/change visualisation
- uncertainty-aware interpretation
- change thresholds that never imply significance below registration/survey uncertainty

Do not build further geometric comparison logic without data that can validate it.

## Phase 6A: pilot usability and intake

Status: **implemented in the combined pilot-hardening release; user validation pending**.

Implemented:

- bulk photo/document upload to Catalog
- project/type/context Catalog filtering
- cross-project server-side evidence search
- search includes conservation categories/intervention methods plus author and physical context
- reusable metadata/capture templates
- Catalog CSV export
- conservation CSV export
- responsive conservation, Catalog and field workflows for phone/tablet use
- condition/intervention records remain normal Catalog records with generic metadata editing

Still evidence-driven rather than automatically expanded:

- richer role administration
- spreadsheet import
- large batch actions
- institutional report templates

## Phase 6B: offline field operation

Status: **implemented in the combined pilot-hardening release; field reliability validation pending**.

Implemented:

- IndexedDB device queue for field captures
- queued Blob/File evidence, not only text metadata
- online/offline state indicator
- explicit Save offline behaviour
- automatic sync when connectivity returns
- manual Sync now
- client capture IDs and server sync receipts for ordinary retry de-duplication
- project/site/object and permission validation repeated at sync time
- failed validation remains visible as a conflict instead of being silently discarded
- retry a conflict using the current field context
- explicit discard action
- installable PWA manifest
- service worker caches the Field shell and static application assets, but does not cache API responses or evidence-object responses

Security boundary: offline field data is stored locally on the user's device until successful sync. Pilot users should therefore use trusted devices and remove local application data when a device is reassigned.

Gate 6B: capture mixed photos/voice/notes offline, close/reopen the Field workspace where supported, reconnect, sync without duplicates, and deliberately create one stale-context conflict to verify recovery.

## Phase 7: heritage intelligence

Possible later layer after real user records exist:

- cross-source retrieval
- evidence-linked AI summaries
- related-evidence suggestions
- entity/relationship suggestions
- conflicting interpretation detection
- human confirmation workflow
- knowledge-graph projections

AI output must remain visibly separate from source observations and traceable to evidence.

## Phase 8: interoperability and institutional future

Keep compatibility routes open toward CIDOC CRM, CRMarchaeo, CRMsci, Arches/Arches for Science, W3C Web Annotation, IIIF, RO-Crate, GeoJSON, E57, COPC, glTF and 3D Tiles.

These standards should support institutional adoption later without making the user-test prototype unnecessarily heavy today.
