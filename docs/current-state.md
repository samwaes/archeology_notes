# Current state

Updated: 2026-08-15

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

## Current working product

Phase 1 provides the persistent project and catalog loop:

- create and manage Projects
- Sites and Physical Objects
- Hupla-authenticated project membership
- Private / Project / Public visibility
- notes, photos, documents, observations, measurements and voice record types
- authorship and acquisition provenance
- original files in private R2 with SHA-256 checksums
- project-aware Catalog desktop table and mobile cards
- record detail and editing
- permission checks for record editing
- basic search
- audit events

Gate 1 still needs an explicit two-user validation, especially around private-record isolation and owner/admin editing.

Phase 2 adds the first real onsite capture workflow:

- mobile-first field workspace
- persistent project/site/object context on the device
- camera and photo-library capture
- quick note and observation capture
- measurement value and unit
- browser microphone recording
- original audio retained in R2
- optional server-side transcription
- GPS position and browser-reported accuracy
- automatic author and acquisition time
- field inbox for later Catalog refinement

The original audio remains evidence. A transcription is derived text and can fail or be disabled without losing the voice note. Gate 2 field validation has been deliberately deferred until an onsite-style phone test is convenient.

Phase 3 now connects the persistent record layer to a real photographic 3D representation:

- Representation is a first-class database entity and remains separate from the Physical Object
- Casignana is seeded as the first photogrammetry representation
- a web GLB derivative is stored in private R2, not committed as the preservation source
- the 3D viewer defaults to the photographic textured mesh
- Photo, Points and Hybrid modes are available from the same loaded derivative
- the Points mode uses the mesh vertices and is explicitly a derived vertex view, not a native TLS/LiDAR source
- orbit, pan, zoom and Casignana-specific camera viewpoints are supported
- users can click a photographic surface and create a persistent XYZ observation
- XYZ anchors are stored as PostGIS `PointZ`
- a spatial observation creates a normal Catalog record with the same author and visibility controls
- a Catalog record with a spatial anchor exposes `Show in 3D`
- the 3D workspace can reopen around the selected record's spatial context

Gate 3 still requires production deployment, one-time upload of the generated Casignana GLB derivative into the project's R2 representation, and a round-trip annotation test.

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

The Hupla discussion prototype intentionally used only a sparse sampled representation for browser performance. That was useful for interaction testing but not dense enough for professional inspection.

For Phase 3, a full textured GLB derivative has been generated from the supplied OBJ and texture. It keeps the full prototype mesh geometry and packages the photographic texture into a browser-loadable file of about 13 MB. The standalone viewer uses this derivative as the photographic working representation and can derive a much denser vertex display from it.

The GLB remains a derivative. The original OBJ and texture remain the preservation/source evidence. Native dense point-cloud ingestion, COPC/LAZ streaming, multiple overlapping surveys and registration uncertainty remain Phase 4.
