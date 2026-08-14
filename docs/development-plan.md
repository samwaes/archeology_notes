# Development plan

Updated: 2026-08-15

## Phase 0: standalone foundation

Status: **complete and validated**

Implemented:

- Next.js + TypeScript application
- Docker/Coolify deployment at `https://archeology-notes.hupla.eu`
- `/api/health` and deep dependency diagnostics
- PostgreSQL + PostGIS 3.5 and migrations
- central Hupla access behind Cloudflare Access
- central Hupla usage/session tracking
- private Cloudflare R2 connectivity
- application shell and canonical documentation

Gate 0 passed on 2026-08-14. A Hupla-authorised user can open the deployed application and `/api/health?deep=1` reports database, PostGIS, R2 and Hupla access as ready.

## Phase 1: real project, records and catalog

Status: **implemented, Gate 1 multi-user validation still pending**

Implemented:

- create and manage Projects
- Site and Physical Object hierarchy
- project membership and project roles
- notes, photographs, documents, observations, measurements and voice record types
- authorship and acquisition provenance
- Private / Project / Public visibility
- original uploads in private R2 with SHA-256 checksum
- project-aware Catalog desktop table and mobile cards
- record detail
- record editing with permission checks
- original author and original asset preserved through edits
- audit history
- basic structured search

Casignana remains the first real project dataset. Additional projects can now be created through the application.

The pilot simplification remains: Hupla-authorised Archeology Notes users are automatically enrolled in Casignana. Explicit project invitations and role administration will replace this bootstrap after the first multi-user test.

Gate 1: two authorised users can collaborate in one project without cross-user exposure of private records. Original photo/document uploads must persist in private R2 and retain author, acquisition date and source provenance.

## Phase 2: field prototype

Status: **implemented, Gate 2 field validation deferred until user test**

Implemented:

- mobile-first field capture workspace
- project, site and physical-object context retained on the device between captures
- camera capture and photo-library selection
- rapid text note and observation capture
- measurement value + unit capture
- browser microphone recording
- original audio retained in private R2
- optional server-side voice transcription
- transcription stored as derived text, never as replacement for original audio
- GPS capture with browser-reported accuracy
- acquisition time and author captured automatically
- Private / Project / Public visibility at capture time
- field inbox for later catalog refinement
- field GPS and transcription shown in record detail

Transcription is provider-isolated behind `lib/transcription.ts`. The initial provider is OpenAI audio transcription when explicitly configured. Without a transcription key, voice capture still works and the original audio is retained.

Not yet in Phase 2:

- offline queue
- background sync
- conflict handling

These remain later slices because the first goal is to validate whether the fast online field workflow is useful before adding offline complexity.

Gate 2: a user can capture at least ten useful onsite observations on a phone without needing the desktop workflow. The test should include photos, a voice note, a text note, a measurement, GPS and later Catalog refinement.

## Phase 3: real photographic 3D workspace

Status: **implemented in code, deployment and spatial validation pending**

Implemented:

- first-class Representation registry separate from Physical Objects and source evidence
- seeded Casignana photogrammetry representation with known source properties and explicit missing-CRS metadata
- browser-ready GLB assets stored as private R2 derivatives rather than repository binaries
- protected same-origin model streaming from R2
- full textured photographic model as the default working view
- orbit, pan and zoom navigation
- Overview, Top, Apse, Floor and Wall viewpoints for the Casignana pilot
- Photo, Points and Hybrid views
- Points mode derives a dense vertex representation from the loaded web mesh and is not presented as an original LiDAR/TLS point cloud
- direct surface raycasting for XYZ annotation
- spatial anchors persisted as PostGIS `PointZ`
- every spatial observation creates a normal Catalog record with author and visibility
- spatial annotations respect Private / Project visibility rules
- record detail exposes its XYZ anchor and `Show in 3D`
- selecting a record through `Show in 3D` returns the viewer to that spatial context
- owner/admin GLB replacement workflow without replacing the preservation source

### Casignana browser derivative

A full textured GLB derivative has been generated from the supplied Casignana OBJ and 8000 × 8000 texture for Phase 3 validation. It retains the full source mesh geometry used for the prototype, approximately 244,639 vertices and 486,261 triangles, while packaging the photographic texture into a browser-loadable asset of about 13 MB.

The GLB is a web derivative. The supplied OBJ and texture remain the preservation/source evidence. The derivative must be uploaded once through the 3D Workspace after deployment so it is stored in the project's private R2 bucket and registered against the Casignana representation.

Gate 3: deploy migration `0004_phase3_spatial_workspace.sql`, upload the Casignana GLB derivative, navigate the photographic model, create a spatial observation on the real surface, open it from Catalog, use `Show in 3D`, and verify that it returns to the same XYZ context.

This remains the target for the first serious external user test after Gate 2 and Gate 3 behaviour have been checked internally.

## Phase 4: dense point clouds and multiple representations

Implement:

- E57/LAS/LAZ source ingestion strategy
- preservation originals
- COPC/LAZ or compatible web derivatives
- streaming point-cloud viewer
- level of detail
- multiple overlapping scans
- independent layer control
- registration transforms
- resolution and registration uncertainty
- object-specific detail scans
- scientifically distinct photogrammetry, TLS/LiDAR and derived vertex layers

Gate 4: a realistically large survey remains fluid enough for professional inspection and annotation.

## Phase 5: comparison and conservation workflow

Implement:

- survey A/B overlay
- fade and split comparison
- distance/change visualisation
- registration uncertainty warnings
- conservation interventions
- condition classifications
- object timeline

Gate 5: users can review change without the interface implying significance below survey/registration uncertainty.

## Phase 6: pilot hardening and offline robustness

Driven by real user evidence:

- offline field queue
- IndexedDB
- conflict handling
- bulk upload
- metadata templates
- spreadsheet import/export
- richer project roles
- batch actions
- tablet optimisation
- improved search

## Phase 7: heritage intelligence

Possible later layer:

- cross-source retrieval
- evidence-linked AI summaries
- entity/relationship suggestions
- conflicting interpretation detection
- human confirmation workflow
- knowledge-graph projections

AI output must remain traceable to evidence and visibly separate from source observations.

## Phase 8: interoperability and institutional future

Keep compatibility routes open toward:

- CIDOC CRM
- CRMarchaeo
- CRMsci
- Arches / Arches for Science
- W3C Web Annotation
- IIIF
- RO-Crate
- GeoJSON
- E57
- COPC
- glTF
- 3D Tiles
