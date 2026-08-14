# Archeology Notes

Standalone Hupla Labs working prototype for archaeologists and conservation professionals.

Production: `https://archeology-notes.hupla.eu`

## Product question

Can archaeologists and conservation professionals keep spatial surveys, field observations, photographs, documents and interpretation together without creating more administrative work?

## Current phase

**Phase 4: dense point-cloud and multi-representation validation.**

The product now has a persistent project/catalog layer, mobile field capture, photographic 3D annotation and the first real dense point-cloud architecture. The implementation is merged; Gate 4 is deliberately still open until a genuine professional-size E57/LAS/LAZ/COPC dataset has been tested.

Current implementation includes:

- Projects, Sites and Physical Objects
- Hupla identity plus project membership and roles
- notes, photos, documents, observations, measurements and voice records
- Private / Project / Public visibility
- original assets in private Cloudflare R2 with provenance/checksums
- editable Catalog and record detail
- mobile field capture with camera, voice, GPS and optional transcription
- first-class 3D Representations separate from Physical Objects
- photographic GLB workspace with persistent PostGIS XYZ annotations
- Catalog → `Show in 3D` spatial round trip
- multiple independent/overlapping mesh and point-cloud layers
- preservation sources including E57, LAS, LAZ and COPC
- COPC browser streaming through authenticated HTTP Range requests
- point budget and octree-depth controls
- independent layer visibility and opacity
- source-to-project registration transforms
- separate nominal resolution, registration RMSE and registration uncertainty

The earlier `/archeology-notes` route in `samwaes/hupla.eu` remains interaction/design history only. This repository is the canonical product implementation.

## Core design decisions

- physical object is not the same thing as a scan/model representation
- one physical object may have many independent representations over time
- original source assets remain immutable evidence
- web-optimised assets remain explicit derivatives unless the delivered source is already suitable for that role
- derivatives retain provenance to their source
- field capture should be fast and classification can happen later
- annotations target physical/spatial context, not screen coordinates
- spatial observations remain normal Catalog records with author and visibility
- Hupla owns identity; Archeology Notes owns project membership
- R2 stores object bytes; PostgreSQL/PostGIS stores metadata, relationships and spatial knowledge
- photographic 3D and dense point clouds are complementary representations, not interchangeable evidence
- scan density does not equal registration accuracy
- missing CRS, resolution or uncertainty remains unknown rather than being invented
- comparison/change analysis must later respect registration uncertainty

## Validation status

- Gate 0 foundation: passed
- Gate 1 two-user privacy/collaboration: still open
- Gate 2 practical mobile field session: still open
- Gate 3 Casignana photographic spatial round trip: still open in production
- Gate 4 professional-size dense point-cloud test: active next validation

See `docs/development-plan.md` for the detailed gates and roadmap.

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
