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

Status: **implementation available, field validation pending**

Implemented in the first Phase 2 slice:

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
- direct 3D spatial anchoring

These remain later slices because the first goal is to validate whether the fast online field workflow is useful before adding offline complexity.

Gate 2: a user can capture at least ten useful onsite observations on a phone without needing the desktop workflow. The test should include photos, a voice note, a text note, a measurement, GPS and later Catalog refinement.

## Phase 3: real photographic 3D workspace

Implement:

- browser-optimised textured Casignana model
- orbit/pan/zoom
- predefined views
- 3D point annotation
- persisted spatial records
- catalog → Show in 3D
- annotation → related records
- object/area selection

Gate 3: a record can be attached to an actual Casignana location and later reopened at the same spatial context.

This is the target for the first serious external user test.

## Phase 4: dense point clouds and multiple representations

Implement:

- E57/LAS/LAZ source ingestion strategy
- preservation originals
- COPC/LAZ or compatible web derivatives
- streaming point-cloud viewer
- Photo / Point / Hybrid modes
- level of detail
- multiple overlapping scans
- independent layer control
- registration transforms
- resolution and registration uncertainty
- object-specific detail scans

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
