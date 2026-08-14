# Point-cloud ingestion and preservation

Updated: 2026-08-15

## Purpose

Archeology Notes must keep the acquired survey evidence distinct from the representation optimised for interactive web inspection.

The default point-cloud workflow is therefore:

```text
acquisition/source file
E57 / LAS / LAZ / COPC
        ↓ preserve unchanged
private R2 source asset + SHA-256
        ↓ derive when required
COPC (.copc.laz)
        ↓ range-stream
3D Workspace
        ↓
spatial annotations + catalog evidence
```

A COPC file can be both the preserved source and the browser stream when it is already the delivered acquisition/archive format. The application records that explicitly rather than duplicating the bytes without reason.

## Supported prototype formats

### Preservation/source

- E57
- LAS
- LAZ
- COPC (`.copc.laz`)
- PLY
- OBJ / GLB for mesh-based representations

### Browser working representation

- COPC for point clouds
- GLB for photographic/mesh representations

E57 is not loaded directly in the browser in Phase 4. It remains preserved, while a COPC derivative is created for range-based web access.

## Why COPC

COPC keeps LAZ-compressed points in a clustered octree hierarchy in one file. The viewer can request byte ranges instead of downloading the complete survey. This fits private R2 storage because Archeology Notes can proxy authenticated HTTP Range requests to the underlying object.

The initial browser implementation uses the open-source `copc` TypeScript library for COPC metadata, hierarchy traversal and LAZ node decompression, then renders selected nodes with Three.js.

## Conversion with PDAL

Conversion should happen outside the production web container. A workstation, processing VM or later ingestion worker should have PDAL with the required format plugins.

Typical E57 to COPC conversion:

```bash
pdal translate survey.e57 survey.copc.laz writers.copc
```

Typical LAS/LAZ to COPC conversion:

```bash
pdal translate survey.las survey.copc.laz writers.copc
```

or:

```bash
pdal translate survey.laz survey.copc.laz writers.copc
```

For complex E57 files, first inspect the file and confirm which Cartesian point clouds, coordinate system and dimensions should be retained. Do not merge scans merely because they share one E57 container.

## Before conversion

Record or verify where available:

- source filename and checksum
- acquisition date/time
- instrument / acquisition method
- coordinate reference system or explicit local coordinate frame
- units
- point count
- available RGB / intensity / classification dimensions
- nominal sampling resolution
- registration method
- registration reference layer
- registration RMSE
- broader registration uncertainty
- whether the file contains multiple internal scans

Missing information stays missing. Archeology Notes must not invent a CRS, resolution or registration accuracy.

## Registration model

Each Representation has its own local coordinates and a 4×4 `source-to-project` transform.

This means two scans can overlap the same wall while remaining independent records of acquisition. A detail scan can also identify a parent representation without being merged into it.

Registration status is explicit:

- `unregistered`: no common spatial relationship is claimed
- `approximate`: manually or coarsely aligned; not suitable for fine change claims
- `registered`: transformed into the common project frame using a documented method
- `verified`: registration has been reviewed and accepted for the stated use

RMSE and registration uncertainty are stored separately from nominal point resolution. High scan density does not imply high registration accuracy.

## Viewer level of detail

The Phase 4 viewer does not fetch the full COPC file. It:

1. reads COPC metadata using byte ranges;
2. traverses hierarchy pages up to a selected octree depth;
3. selects nodes under a configurable point budget;
4. requests only those compressed node ranges;
5. decompresses selected LAZ nodes in the browser;
6. renders them as independent Three.js point layers.

The first implementation exposes explicit point-budget and octree-depth controls. Screen-space adaptive refinement can replace this coarse control later without changing the preservation/data model.

## R2 and access

Source and web assets stay in the private `archeology-notes` R2 bucket.

The browser does not need an R2 credential. It requests the authenticated Archeology Notes asset endpoint, which verifies project membership and proxies full or ranged reads from R2.

## Prototype upload boundary

The current browser upload route deliberately has conservative limits:

- source asset: 220 MB
- web derivative: 140 MB

This is enough to validate the product workflow, but not an institutional ingestion architecture. Real archaeological and conservation surveys can be multiple gigabytes.

The future ingestion service should use:

- direct/multipart upload to R2
- resumable processing jobs
- checksum verification
- PDAL conversion workers
- metadata extraction
- COPC validation
- status/progress reporting
- no need to route multi-gigabyte bodies through the Next.js application container

That worker is deferred until Gate 4 proves that the viewing and annotation workflow itself is useful.

## Scientific guardrail

Survey comparison must never imply meaningful change below the evidence quality of the two surveys and their registration. Phase 5 comparison tools therefore need to consume both nominal resolution and registration uncertainty before displaying or interpreting distance/change results.
