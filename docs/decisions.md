# Decisions

## 2026-08-14 · standalone product repository

Decision: new product development moves to `samwaes/archeology_notes` and `archeology-notes.hupla.eu`.

The earlier Hupla route remains design history, not the canonical product implementation.

## 2026-08-14 · reuse Hupla identity

Decision: use the existing Hupla access/user service, following the Ensemble pattern. Do not build passwords, invitations or a second account directory inside Archeology Notes.

## 2026-08-14 · private Cloudflare R2

Decision: use a dedicated private R2 bucket `archeology-notes`, following the Ensemble storage pattern. Binary assets live in R2; metadata and relationships live in PostgreSQL/PostGIS.

## 2026-08-14 · physical object is not a scan

Decision: physical hierarchy and digital representation hierarchy are separate concepts.

## 2026-08-14 · originals are immutable evidence

Decision: source files are preservation assets. Optimised, processed, transcribed or AI-generated outputs are explicit derivatives.

## 2026-08-14 · photographic 3D first

Decision: the real standalone 3D workspace should default to a textured photographic representation because it is more intuitive for archaeological/conservation review. Dense point-cloud and Hybrid modes follow after the record/field workflow is persistent.

## 2026-08-14 · PostGIS for spatial anchors

Decision: use standard spatial geometry in PostgreSQL/PostGIS rather than an application-specific XYZ-only annotation store.

## 2026-08-14 · no Arches backend for the MVP

Decision: keep interoperability with Arches/CIDOC CRM possible, but do not introduce Arches as the first prototype backend. Validate the smaller workflow first.
