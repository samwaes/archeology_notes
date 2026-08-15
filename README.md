# Archeology Notes

Standalone Hupla Labs product in **user testing** for archaeologists, conservators and heritage documentation teams.

Production: `https://archeology-notes.hupla.eu`

Testing contact: `samwaes@gmail.com`

## Product question

Can archaeologists and conservation professionals keep spatial surveys, field observations, photographs, documents, condition assessments and conservation history connected without creating more administrative work?

## Current stage

**User testing: field, conservation, evidence and spatial workflow pilot.**

The implementation is now broad enough for real workflow testing. Development should be driven by observed user friction rather than by adding another major phase before the current product is used.

The active validation focus is:

- first-session onboarding and terminology
- Project / Site / Physical Object structure
- Catalog evidence intake, filtering, editing and search
- mobile Field capture with online and offline operation
- condition → intervention → before/after evidence workflow
- Private / Project visibility with multiple users
- photographic 3D spatial round trips
- practical value of connecting these workflows in one product

Dense point-cloud Phase 4 remains implemented but professional-scale validation is parked until suitable data is available. Repeated-survey geometric comparison is Phase 5B and remains parked until appropriate repeated survey datasets exist.

## User onboarding

The application Home page is now the starting point for pilot users. It explains the purpose, intended users and five-step quick start, and links to two downloadable PDF guides.

The PDFs are generated from maintained source during the production build, copied into the application image and synchronized to the private Cloudflare R2 bucket at startup:

- `manuals/Archeology-Notes-Quick-Start.pdf`
- `manuals/Archeology-Notes-User-Manual.pdf`

Authenticated download routes:

- `/manuals/quick-start.pdf`
- `/manuals/user-manual.pdf`

The Home and Access pages both show `samwaes@gmail.com` for questions and test-user requests.

## Current implementation

- Projects, Sites and Physical Objects
- Hupla identity plus project membership and roles
- notes, photos, documents, observations, measurements and voice records
- condition assessments and conservation interventions
- intervention → condition and before/after evidence relationships
- Private / Project / Public visibility
- original assets in private Cloudflare R2 with provenance/checksums
- editable Catalog with bulk photo/document intake and CSV export
- project/type/context Catalog filtering
- cross-project server-side evidence search
- reusable capture templates
- mobile field capture with camera, voice, GPS and optional transcription
- IndexedDB offline field queue including photo/audio Blob data
- automatic/manual sync, de-duplication receipts and visible conflict recovery
- installable PWA field shell
- conservation timeline and CSV export
- first-class 3D Representations separate from Physical Objects
- photographic GLB workspace with persistent PostGIS XYZ annotations
- Catalog → `Show in 3D` spatial round trip
- multiple independent/overlapping mesh and point-cloud layers
- COPC streaming through authenticated HTTP Range requests
- source-to-project registration transforms
- separate nominal resolution, registration RMSE and registration uncertainty

The earlier `/archeology-notes` route in `samwaes/hupla.eu` remains interaction/design history only. This repository is the canonical implementation.

## Core design decisions

- physical object is not the same thing as a scan/model representation
- one physical object may have many independent representations over time
- original source assets remain immutable evidence
- web-optimised assets remain explicit derivatives unless the delivered source is already suitable for that role
- field capture should be fast and classification can happen later
- offline captures remain local evidence until server-confirmed sync
- annotations target physical/spatial context, not screen coordinates
- condition/intervention records remain normal Catalog records with author and visibility
- Catalog, Conservation and 3D are different views of connected evidence
- Hupla owns identity; Archeology Notes owns project membership
- R2 stores object bytes; PostgreSQL/PostGIS stores metadata, relationships and spatial knowledge
- photographic 3D and dense point clouds are complementary representations, not interchangeable evidence
- scan density does not equal registration accuracy
- missing CRS, resolution or uncertainty remains unknown rather than being invented
- geometric change analysis must respect registration uncertainty and is parked until suitable data exists

## Validation status

- Gate 0 foundation: passed
- Gate 1 two-user privacy/collaboration: active user test
- Gate 2 practical mobile field session: active user test
- Gate 3 Casignana photographic spatial round trip: active user test
- Gate 4 professional-size dense point-cloud test: parked until data is available
- Gate 5A conservation workflow: active user test
- Gate 5B repeated-survey change analysis: parked until data is available
- Gate 6A pilot usability/intake: active user test
- Gate 6B offline field sync/conflict workflow: active field test

See `docs/user-testing-plan.md` for the current pilot scenarios and `docs/development-plan.md` for the detailed roadmap.

## Documentation

- `docs/current-state.md`
- `docs/product-objectives.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/development-plan.md`
- `docs/point-cloud-ingestion.md`
- `docs/security-and-permissions.md`
- `docs/asset-and-preservation-strategy.md`
- `docs/deployment.md`
- `docs/user-testing-plan.md`
- `docs/user-documentation.md`
- `docs/decisions.md`
- `docs/sample-data/casignana.md`

## Local development

Copy `.env.example` to `.env.local`, configure a PostGIS-enabled PostgreSQL database, then run:

```bash
npm install
npm run migrate
npm run dev
```

`npm run build` generates the current Quick Start and User Manual PDFs. Production startup runs migrations, synchronizes those PDFs to private R2 and then starts the standalone Next.js server.
