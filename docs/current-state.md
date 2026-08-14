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

Phase 3 connects the persistent record layer to a real photographic 3D representation:

- Representation is a first-class database entity and remains separate from the Physical Object
- Casignana is seeded as the first photogrammetry representation
- a web GLB derivative is stored in private R2, not committed as the preservation source
- the 3D viewer defaults to the photographic textured mesh
- orbit, pan, zoom and Casignana-specific camera viewpoints are supported
- users can click a photographic surface and create a persistent XYZ observation
- XYZ anchors are stored as PostGIS `PointZ`
- a spatial observation creates a normal Catalog record with the same author and visibility controls
- a Catalog record with a spatial anchor exposes `Show in 3D`

Gate 3 still requires production round-trip validation with the generated Casignana GLB derivative.

Phase 4 generalises the 3D workspace from one photographic model into a multi-representation survey environment:

- one project, site or physical object can have multiple independent representations
- a detail scan can reference a parent representation without being merged into it
- photogrammetry, mesh and point-cloud layers can overlap in the same project workspace
- each layer has its own source format, acquisition date, coordinate frame and source-to-project transform
- source E57/LAS/LAZ/COPC can be preserved unchanged in private R2
- COPC is the first browser point-cloud representation
- private R2 point clouds are exposed only through an authenticated range-capable application endpoint
- COPC metadata and octree hierarchy are read by range request
- selected LAZ nodes are decompressed client-side and rendered with Three.js
- the viewer exposes point-budget and octree-depth controls
- layers have independent visibility and opacity
- Photo / Points / Hybrid modes can combine photographic and point-cloud evidence
- registration status, nominal resolution, RMSE and wider registration uncertainty are separate fields
- missing registration evidence is visible rather than silently treated as accurate
- spatial records remain attached to the representation on which they were observed, while their display can use the stored source-to-project transform
- project owners/admins can create layers, preserve source files, upload COPC/GLB web representations and edit registration metadata

Gate 4 is not passed yet. The implementation now needs a genuine dense E57/LAS/LAZ/COPC test dataset to validate responsiveness, layer overlap, coordinate handling and annotation behaviour at professional survey scale.

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

The product therefore supports a direction where:

- one physical object has many representations
- one survey can cover many physical objects
- multiple overlapping surveys coexist in one registered project frame
- annotations stay linked to the representation and evidence from which they were made

### Original evidence and derivatives must remain distinguishable

A source OBJ, E57, LAS/LAZ, image, audio file or document is preservation evidence. Browser-optimised GLB, COPC, contrast-enhanced image, transcription or AI analysis is a derivative unless the delivered source was already in that format.

The system must never silently replace the original with the derivative.

### Registration accuracy is not scan density

Dense points do not automatically mean accurate change detection. Nominal point resolution, registration RMSE and broader registration uncertainty are separate concepts and are stored separately.

This becomes a hard requirement for Phase 5 change/comparison tools.

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

For Phase 3, a full textured GLB derivative has been generated from the supplied OBJ and texture. It keeps the full prototype mesh geometry and packages the photographic texture into a browser-loadable file of about 13 MB.

Casignana remains useful for photogrammetry and spatial-annotation validation, but it is not a native dense LiDAR/TLS dataset. Phase 4 therefore requires an additional real point-cloud dataset before its performance and professional usability gate can be considered validated.

## Point-cloud preservation route

The canonical workflow is documented in `docs/point-cloud-ingestion.md`:

- preserve the acquired E57/LAS/LAZ/COPC source in R2 with checksum
- retain known coordinate, acquisition, resolution and registration metadata
- derive COPC where necessary for interactive access
- never invent missing CRS or uncertainty data
- use the same source file as the web stream when the delivered source is already COPC and there is no preservation reason to duplicate it
- move multi-gigabyte upload/conversion to a dedicated ingestion worker only after Gate 4 demonstrates the need
