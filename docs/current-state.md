# Current state

Updated: 2026-08-15

## Position

Archeology Notes is a standalone working prototype for archaeologists and conservation professionals. The product tests whether spatial surveys, field observations, photographs, documents, condition assessments and conservation history can stay connected without forcing practitioners into a heavy database workflow.

Canonical implementation repository: `samwaes/archeology_notes`.

Production: `https://archeology-notes.hupla.eu`.

The earlier `/archeology-notes` route in `samwaes/hupla.eu` is retained as interaction/design history only.

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

The current pilot-hardening release adds:

- bulk photo/document intake, up to 12 files per batch
- project/type/context Catalog filtering
- cross-project evidence search
- search over conservation categories, intervention methods, authors and physical context
- Catalog CSV export

Gate 1 still needs explicit two-user privacy and collaboration validation.

### Field capture, including offline operation

The field workflow supports:

- camera/photo library
- voice recording with original audio retained
- optional transcription as derived text
- rapid note and observation capture
- measurements
- GPS and browser-reported accuracy
- automatic author and acquisition time
- persistent project/site/object context
- reusable project capture templates

The current pilot-hardening release adds real offline behaviour:

- IndexedDB device queue stores structured metadata plus photo/audio Blob data
- captures can be saved with no connectivity
- automatic sync when connectivity returns
- manual Sync now control
- client capture IDs and server sync receipts reduce retry duplicates
- permissions and project/site/object context are validated again when syncing
- rejected sync items remain visible as conflicts
- a conflict can be retried against the current context or explicitly discarded
- installable PWA manifest
- Field shell and static assets can be cached by the service worker
- API responses and evidence-object responses are not service-worker cached

Security implication: unsynced field evidence is temporarily present on the user's local device. Pilot users should use trusted devices and clear local application data when a device is reassigned.

Gate 2 and Gate 6B still require practical field validation.

### Conservation workflow

A dedicated Conservation workspace now treats conservation history as first-class project evidence.

Implemented:

- condition-assessment records
- category
- severity: low / moderate / high / critical
- confidence: low / medium / high
- extent
- treatment priority: monitor / routine / urgent / emergency
- intervention records
- intervention status: planned / in progress / completed / monitoring
- method
- materials
- outcome / follow-up
- intervention → condition relationship
- before/after links to ordinary Catalog records
- conservation timeline
- reusable capture templates
- conservation CSV export
- condition/intervention details visible on normal record-detail pages

Condition and intervention records remain normal Catalog records, so authorship, visibility, project context and audit history stay consistent with the rest of the product.

Gate 5A now needs a conservation professional to document one real condition and intervention chain and judge whether the workflow is useful and appropriately lightweight.

### Photographic 3D workspace

Phase 3 connects normal Catalog records to a real photographic representation:

- Representation is separate from the Physical Object
- Casignana is the first photogrammetry representation
- web GLB is a private R2 derivative, not the preservation source
- photographic default view
- Photo / Points / Hybrid modes
- orbit / pan / zoom
- surface click creates persistent PostGIS PointZ observation
- spatial observation is also a normal Catalog record
- Show in 3D returns a record to its stored spatial context

Gate 3 still needs the final production round-trip validation with the generated Casignana GLB.

### Dense point-cloud / multi-representation prototype

Phase 4 is implemented but deliberately not validated because the project currently lacks the right professional datasets.

Implemented:

- E57/LAS/LAZ/COPC preservation strategy
- COPC browser representation
- authenticated R2 byte-range access
- browser COPC hierarchy and LAZ node decoding
- point-budget/depth controls
- overlapping representations
- independent visibility and opacity
- registration transforms
- registration state
- nominal resolution, RMSE and registration uncertainty kept separate

Gate 4 is parked until a genuine professional-size point-cloud dataset is available.

## Roadmap adjustment

The original Phase 5 mixed conservation workflow with repeated-survey geometric change analysis. These have now been split.

### Phase 5A

Conservation and evidence workflow. Implemented and awaiting user validation.

### Phase 5B

Repeated-survey comparison, fade/split views, distance/change maps and uncertainty-aware change interpretation. Parked until appropriate repeated survey datasets exist.

### Phase 6A

Pilot usability: bulk intake, templates, improved search, responsive workflows and exports. Implemented and awaiting user validation.

### Phase 6B

Offline field operation: IndexedDB queue, sync, conflicts and installable field shell. Implemented and awaiting field validation.

### Phase 7

Potential heritage intelligence after enough genuine evidence exists: cross-source retrieval, evidence-linked summaries, related-evidence suggestions, conflicting interpretations and human-confirmed relationship proposals.

### Phase 8

Institutional interoperability route: CIDOC CRM, CRMarchaeo, CRMsci, Arches/Arches for Science, W3C Web Annotation, IIIF, RO-Crate, GeoJSON, E57, COPC, glTF and 3D Tiles.

## Core findings retained

### Physical object is not the scan

A wall, capital, trench, room or artefact is persistent. A LiDAR survey, photogrammetry model, macro scan or historical survey is a representation of it at a point in time.

### Original evidence and derivatives must remain distinguishable

Source OBJ/E57/LAS/LAZ/images/audio/documents are evidence. GLB/COPC conversions, transcriptions, image enhancements and future AI analysis are explicit derivatives unless they were supplied as the original source.

### Dense points do not equal accurate change detection

Nominal point spacing, registration RMSE and broader registration uncertainty are different concepts. Phase 5B must respect them before displaying change as meaningful.

### Field capture must be faster than cataloguing

Capture should take seconds. Detailed classification can happen later, which is why the Field queue and Catalog/Conservation refinement flows remain separate.

### Catalog, 3D and Conservation are views of the same evidence

The product should not create isolated subsystems. A spatial annotation, field photo, condition assessment and intervention history should all resolve back to the same project/site/object evidence graph.

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
