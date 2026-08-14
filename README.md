# Archeology Notes

Standalone Hupla Labs working prototype for archaeologists and conservation professionals.

Production target: `https://archeology-notes.hupla.eu`

## Product question

Can archaeologists and conservation professionals keep spatial models, field observations, photographs, documents and interpretation together without creating more administrative work?

## Current phase

**Phase 0: standalone foundation.**

This repository now owns the product implementation. The earlier `/archeology-notes` route in `samwaes/hupla.eu` remains interaction/design history only.

Phase 0 establishes:

- Next.js + TypeScript
- Docker/Coolify deployment
- PostgreSQL + PostGIS migrations
- existing Hupla identity/access reuse
- existing Hupla usage/session tracking
- private Cloudflare R2 connectivity
- health/dependency diagnostics
- canonical product documentation

The next product phase is the persistent Project/Site/Object + Record/Catalog model.

## Core design decisions

- physical object is not the same thing as a scan/model
- original source assets remain immutable
- derivatives retain provenance to their source
- field capture should be fast and classification can happen later
- annotations target physical/spatial context, not screen coordinates
- Hupla owns identity; Archeology Notes owns project membership
- R2 stores object bytes; PostgreSQL/PostGIS stores metadata, relationships and spatial knowledge
- photographic 3D is the preferred default representation for the first user-testable 3D workspace
- dense point-cloud and hybrid modes follow after the record and field workflow is persistent

## Documentation

- `docs/current-state.md`
- `docs/product-objectives.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/development-plan.md`
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
