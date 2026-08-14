# Data model direction

This is the target domain model for the working prototype. It will be implemented incrementally through migrations rather than created as one large schema in Phase 0.

## Identity and projects

```text
users
projects
project_memberships
```

Hupla owns identity. Archeology Notes owns project membership and roles.

Initial project roles:

- project admin
- contributor
- viewer

## Physical hierarchy

```text
projects
  ↓
sites
  ↓
physical_objects
  ↓
physical_objects (parent/child)
```

A physical object may be a room, wall, trench, architectural element, artefact, surface, decorative feature or another project-defined entity.

## Surveys and digital representations

```text
surveys
  ↓
digital_assets
  ↓
representations
  ↓
registrations
```

A survey describes acquisition context. A digital asset describes a file. A representation links that digital asset to the physical context it depicts. A registration describes how a representation is positioned in a shared scene, including transform and uncertainty.

## Records

A `record` is the general unit for captured or collected evidence.

Initial record types:

- photo
- text note
- voice note
- document
- measurement
- observation

Every record keeps:

- author
- acquisition date/time
- upload/creation date/time
- visibility
- project/site/object context
- optional spatial geometry
- review status
- description
- tags
- provenance

## Visibility

Initial states:

```text
private
project
public
```

Public is represented in the data model from the beginning, but external anonymous publication can remain disabled during the first pilot.

## Spatial annotations

Use PostGIS geometry for spatial anchors.

Target annotation types:

- point
- line
- polygon/surface region
- volume

A spatial annotation may refer to a specific representation as evidence, but its primary target is the physical context.

## Derivations

Derived assets should explicitly record:

- source asset
- processing method
- software/version
- parameters where useful
- creator/system
- processing time
- checksum

This applies equally to image enhancement, mesh conversion, point-cloud conversion, OCR, transcription and AI processing.
