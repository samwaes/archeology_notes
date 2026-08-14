# Architecture

## Phase 0 architecture

```text
Cloudflare Access
      ↓ identity headers
Archeology Notes · Next.js / TypeScript
      │
      ├── Hupla central access + usage API
      ├── PostgreSQL + PostGIS
      └── private Cloudflare R2
```

Hosting: Coolify.

Production hostname: `archeology-notes.hupla.eu`.

## Why this is deliberately small

The first external prototype does not need microservices, Redis, Elasticsearch, a graph database or a separate native mobile application. One web application, one relational/spatial database and one object store are enough to validate the workflow.

## Identity boundary

Cloudflare Access authenticates the person at the edge. The application reads the authenticated email header and asks the central Hupla access service whether that user may access application slug `archeology-notes`.

The Hupla service returns a stable `userId` and access level. Archeology Notes stores the Hupla user identifier as the external identity reference instead of creating passwords or a parallel user directory.

Project membership is application data, not a second identity system.

## Database boundary

PostgreSQL stores structured knowledge, permissions, provenance and relationships. PostGIS stores spatial anchors and spatial geometries.

Object bytes do not belong in PostgreSQL.

## Object-storage boundary

Cloudflare R2 stores original and derived binary assets, including:

- photographs
- audio
- PDFs and documents
- original 3D/point-cloud files
- browser derivatives
- generated thumbnails
- derived analysis outputs

The bucket remains private. Browser access uses short-lived signed URLs.

## 3D architecture direction

Three.js remains suitable for the shared scene, textured models, annotations and general interaction.

Large point clouds should later use a tiled/streaming representation such as COPC/LAZ and a specialised point-cloud rendering path such as Potree or compatible tooling.

The viewer should compose independent representations in a registered scene rather than merge source datasets destructively.
