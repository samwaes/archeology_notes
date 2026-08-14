# Current state

Updated: 2026-08-14

## Position

Archeology Notes has moved from a Hupla discussion mockup into a standalone working prototype intended for testing with archaeologists and conservation professionals.

Canonical implementation repository: `samwaes/archeology_notes`.

Production: `https://archeology-notes.hupla.eu`.

The earlier prototype remains in `samwaes/hupla.eu` under `/archeology-notes` as design and interaction history only. New product development belongs in this repository.

## Infrastructure status

Phase 0 passed on 2026-08-14.

Validated production foundation:

- standalone Next.js/TypeScript application in Coolify
- Cloudflare Access protecting `archeology-notes.hupla.eu`
- central Hupla identity, application grant and usage/session model
- PostgreSQL with PostGIS 3.5
- migration runner executed on container startup
- private Cloudflare R2 bucket `archeology-notes`
- `/api/health?deep=1` returning `ready`

## What the discussion prototype established

The mockup evolved through several stages:

1. object-centric evidence and field-note concept
2. visual-first point-cloud annotations
3. real Three.js navigation
4. site → scene → physical object → representation hierarchy
5. overlapping scans and registration uncertainty
6. multi-user catalog and field-capture concept
7. integration of the supplied Roman Villa of Casignana photogrammetry model

The strongest design conclusions are retained in the standalone product.

## Core findings

### Physical object is not the scan

A wall, capital, trench, room or artefact is a persistent physical entity. A LiDAR scan, photogrammetry mesh, macro scan or historical survey is a representation of that entity at a point in time.

The product must therefore support:

- one physical object with many representations
- one survey containing many physical objects
- multiple overlapping surveys in one registered spatial scene
- annotations that persist even when the active representation changes

### Original evidence and derivatives must remain distinguishable

A source OBJ, E57, LAZ, image, audio file or document is preservation evidence. Browser-optimised GLB, COPC, contrast-enhanced image, transcription or AI analysis is a derivative.

The system must never silently replace the original with the derivative.

### Field capture must be faster than cataloguing

Onsite users should be able to record a photo, voice note, text note or measurement in seconds. Author, time, current project/site/object context and location should be captured automatically where possible. Detailed classification can happen later.

### Catalog and 3D are two views of the same evidence

A catalog record should be able to open its spatial context in the 3D workspace. A spatial annotation should reveal the related records, images, documents and observations.

### Authorship and visibility are first-class data

Every contribution retains its author. Records can be Private, Project or Public. Changing visibility does not duplicate the record and does not change its provenance.

## Casignana sample dataset

The supplied archive contains a textured photogrammetry model:

- `casignana2.obj`
- `casignana.jpg`
- approximately 244,639 vertices
- approximately 486,261 triangular faces
- 8000 × 8000 RGB texture
- approximate extent 21.21 × 14.95 × 6.40 source units

No explicit coordinate reference or acquisition metadata was supplied with the archive.

The Hupla discussion prototype intentionally used only a sparse sampled representation for browser performance. That is useful for interaction testing but not dense enough for real professional inspection.

For the standalone product, Casignana is the first real project dataset. The preferred future browser representation is a textured photographic mesh, with dense point-cloud and hybrid modes added later.

## Phase 1 implementation

Phase 1 is now building the first persistent working loop:

- Casignana Project, Site and Physical Object records
- Hupla-authenticated pilot membership
- Private / Project / Public record visibility
- note, photo, document, observation, measurement and voice record types
- author and acquisition provenance
- original asset storage in private R2 with SHA-256 checksum
- Catalog desktop table and mobile cards
- record detail and original asset access through short-lived signed URLs
- basic structured search
- audit events

The first pilot automatically enrols Hupla-authorised Archeology Notes users into Casignana. Explicit invitation and project role administration will follow the first multi-user validation.
