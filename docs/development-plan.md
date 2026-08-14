# Development plan

Updated: 2026-08-14

## Phase 0: standalone foundation

Status: **in implementation**

Build:

- Next.js + TypeScript application
- Docker/Coolify deployment
- `/api/health`
- PostgreSQL + PostGIS and migrations
- central Hupla access
- central Hupla usage/session tracking
- private Cloudflare R2 connectivity
- application shell and canonical documentation

Gate 0 passes when a Hupla-authorised user can open the deployed application and deep health diagnostics confirm database and R2 connectivity.

## Phase 1: real project, records and catalog

Implement:

- Project
- Site
- Physical Object
- project membership
- records
- text notes
- photographs
- documents
- authorship
- Private / Project / Public visibility
- catalog desktop table and mobile cards
- filtering
- record detail
- audit history
- source/derivative relationships

Use Casignana as the first project dataset.

Gate 1: two authorised users can collaborate in one project without cross-user exposure of private records.

## Phase 2: field prototype

Implement mobile-first:

- camera capture
- photo library
- rapid text note
- microphone recording
- original audio retention
- transcription
- GPS
- current site/object context
- acquisition time and author automatically
- field inbox for later classification

Gate 2: a user can capture at least ten useful onsite observations on a phone without needing the desktop workflow.

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
