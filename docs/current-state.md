# Current state

Updated: 2026-08-15

## Position

Archeology Notes is now **in user testing** with archaeologists, conservators and heritage documentation teams as the intended pilot audience.

The product tests whether spatial surveys, field observations, photographs, documents, condition assessments and conservation history can stay connected without forcing practitioners into a heavy database workflow.

Canonical repository: `samwaes/archeology_notes`.

Production: `https://archeology-notes.hupla.eu`.

Testing contact: `samwaes@gmail.com`.

The earlier `/archeology-notes` route in `samwaes/hupla.eu` remains interaction/design history only.

## Testing readiness

The application now has enough end-to-end product breadth to stop treating the next step as another development phase. The active priority is to observe real users performing real documentation tasks.

New tester onboarding is part of the product:

- Home is the authenticated starting page
- Home explains purpose and target users
- Home presents a five-step Quick Start
- Home links directly to Projects and Field capture
- Home provides downloadable Quick Start and full User Manual PDFs
- both PDFs are synchronized into the private R2 bucket during production startup
- the Access and Home pages show `samwaes@gmail.com` for questions and test-user requests

R2 documentation objects:

- `manuals/Archeology-Notes-Quick-Start.pdf`
- `manuals/Archeology-Notes-User-Manual.pdf`

## Validated foundation

Phase 0 passed on 2026-08-14:

- standalone Next.js/TypeScript app in Coolify
- Cloudflare Access + central Hupla identity/access
- PostgreSQL with PostGIS 3.5
- migration runner
- private Cloudflare R2 bucket `archeology-notes`
- health diagnostics reporting ready

## Working product today

### Projects, records and Catalog

The app supports Projects, Sites, Physical Objects, project membership, authorship, Private/Project/Public visibility and normal evidence records: notes, photos, documents, observations, measurements and voice.

Original uploaded files are retained in private R2 with SHA-256 provenance. Catalog records can be edited without changing original authorship or original assets.

Pilot functionality includes:

- bulk photo/document intake, up to 12 files per batch
- project/type/context Catalog filtering
- cross-project evidence search
- search over conservation categories, intervention methods, authors and physical context
- Catalog CSV export

Gate 1 is now an active user-test item: validate collaboration and private-record isolation with two real users.

### Field capture, including offline operation

The Field workflow supports camera/photo library, original voice recording, optional transcription, notes, observations, measurements, GPS, automatic author/time, persistent project/site/object context and reusable capture templates.

Offline operation includes:

- IndexedDB device queue with metadata plus photo/audio Blob data
- capture without connectivity
- automatic sync when connectivity returns
- manual Sync now
- client capture IDs and server sync receipts
- project/site/object and permission revalidation at sync
- visible conflicts rather than silent loss
- retry against current context or explicit discard
- installable PWA manifest
- cached Field shell/static assets without caching API or evidence responses

Security boundary: unsynced evidence remains on the current device until successful server sync.

Gate 2 and Gate 6B are active field tests.

### Conservation workflow

Implemented:

- condition assessment category, severity, confidence, extent and treatment priority
- interventions with status, method, materials and outcome/follow-up
- intervention → condition relationship
- before/after links to ordinary Catalog evidence
- conservation timeline
- reusable capture templates
- conservation CSV export
- conservation details on normal record pages

Condition and intervention records remain normal Catalog records, so author, visibility, project context and audit history stay consistent.

Gate 5A is now an active conservation-professional test.

### Photographic 3D workspace

Implemented:

- Representation separated from Physical Object
- private R2 GLB derivatives
- photographic default view
- Photo / Points / Hybrid modes
- orbit / pan / zoom
- surface click → persistent PostGIS PointZ observation
- spatial observation as normal Catalog record
- Show in 3D spatial round trip

Casignana remains the first real photogrammetry test dataset. Gate 3 is now an active production user-test item.

### Dense point-cloud / multi-representation prototype

Phase 4 remains implemented but its professional-scale validation is parked until suitable data exists.

Implemented:

- E57/LAS/LAZ/COPC preservation strategy
- COPC browser representation
- authenticated R2 byte-range access
- browser COPC hierarchy and LAZ node decoding
- point-budget/depth controls
- overlapping independent representations
- layer visibility and opacity
- registration transforms and state
- nominal resolution, RMSE and registration uncertainty kept separate

Gate 4 is parked, not failed.

## Roadmap position

- Phase 5A conservation/evidence workflow: implemented, **in user testing**
- Phase 5B repeated-survey comparison: parked until repeated survey data exists
- Phase 6A pilot usability/intake: implemented, **in user testing**
- Phase 6B offline field operation: implemented, **in field testing**
- Phase 7 heritage intelligence: future, only after genuine evidence and user needs exist
- Phase 8 institutional interoperability: future compatibility route

The next development priorities should come from repeated user evidence, not from continuing the roadmap mechanically.

## Core findings retained

### Physical object is not the scan

A wall, capital, trench, room or artefact is persistent. A LiDAR survey, photogrammetry model, macro scan or historical survey is a Representation of it at a point in time.

### Original evidence and derivatives must remain distinguishable

Source OBJ/E57/LAS/LAZ/images/audio/documents are evidence. GLB/COPC conversions, transcriptions, image enhancements and future AI analysis are explicit derivatives unless supplied as original source.

### Dense points do not equal accurate change detection

Nominal point spacing, registration RMSE and broader registration uncertainty are different concepts. Phase 5B must respect them before displaying change as meaningful.

### Field capture must be faster than cataloguing

Capture should take seconds. Detailed classification can happen later, which is why Field capture and Catalog/Conservation refinement remain separate.

### Catalog, 3D and Conservation are views of the same evidence

A spatial annotation, field photo, condition assessment and intervention history should resolve back to the same project/site/object evidence graph.

### Authorship and visibility are first-class

Every contribution retains its author and Private/Project/Public visibility. Changing visibility or classification never rewrites provenance.

## Casignana sample dataset

The supplied archive remains the main photographic test dataset:

- `casignana2.obj`
- `casignana.jpg`
- approximately 244,639 vertices
- approximately 486,261 triangles
- 8000 × 8000 RGB texture
- no explicit CRS/acquisition metadata supplied

A browser GLB derivative of roughly 13 MB was generated for the photographic workspace. Casignana remains useful for spatial and conservation interaction testing even though it is not a native TLS/LiDAR point cloud.
