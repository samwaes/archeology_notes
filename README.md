# Archeology Notes

Standalone Hupla Labs working prototype for archaeologists and conservation professionals.

Production: `https://archeology-notes.hupla.eu`

## Product question

Can archaeologists and conservation professionals keep spatial surveys, field observations, photographs, documents, condition assessments and conservation history together without creating more administrative work?

## Current phase

**Combined Phase 5A + 6A + 6B: conservation workflow and real-user pilot hardening.**

Dense point-cloud Phase 4 remains implemented but its professional-scale validation is parked until suitable data is available. Repeated-survey geometric comparison is now Phase 5B and is also parked until appropriate repeated survey datasets exist.

The active product direction is intentionally testable with ordinary archaeological photos, notes, documents and the existing Casignana photogrammetry model.

Current implementation includes:

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

The earlier `/archeology-notes` route in `samwaes/hupla.eu` remains interaction/design history only. This repository is the canonical product implementation.

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
- Gate 1 two-user privacy/collaboration: open
- Gate 2 practical mobile field session: open
- Gate 3 Casignana photographic spatial round trip: open
- Gate 4 professional-size dense point-cloud test: parked until data is available
- Gate 5A conservation workflow: ready for user validation
- Gate 5B repeated-survey change analysis: parked until data is available
- Gate 6A pilot usability/intake: ready for user validation
- Gate 6B offline field sync/conflict workflow: ready for field validation

See `docs/development-plan.md` for the detailed roadmap.

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
- `docs/decisions.md`
- `docs/sample-data/casignana.md`

## Local development

Copy `.env.example` to `.env.local`, configure a PostGIS-enabled PostgreSQL database, then run:

```bash
npm install
npm run migrate
npm run dev
```

Production runs migrations automatically before starting the standalone Next.js server.
