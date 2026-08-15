# User documentation

Updated: 2026-08-15

## Purpose

Archeology Notes provides two user-facing PDF documents for pilot users:

- Quick Start Guide
- Full User Manual

They are linked from the authenticated Home page and describe only functions that are implemented in the current testing release.

Testing contact: `samwaes@gmail.com`.

## Source and generation

The canonical PDF-generation source is:

- `scripts/generate-manuals.mjs`

`npm run build` executes the `prebuild` hook and generates:

- `manuals/Archeology-Notes-Quick-Start.pdf`
- `manuals/Archeology-Notes-User-Manual.pdf`

The PDFs are generated artifacts and should not become a separate source of truth from the application and project documentation.

When a user-facing function changes materially, update the generator content in the same development change.

## R2 publication

The Docker runtime includes the generated `manuals/` directory.

At container startup:

1. database migrations run
2. `scripts/sync-manuals.mjs` uploads the generated PDFs to the private R2 bucket
3. the application server starts

R2 keys:

- `manuals/Archeology-Notes-Quick-Start.pdf`
- `manuals/Archeology-Notes-User-Manual.pdf`

The synchronization uses the existing Archeology Notes R2 credentials and bucket. No additional storage service or public bucket is introduced.

## Downloads

Authenticated user-facing routes:

- `/manuals/quick-start.pdf`
- `/manuals/user-manual.pdf`

The routes read the current PDF from private R2 and return it as a PDF attachment. This keeps the bucket private and applies the same application access boundary as the rest of Archeology Notes.

## Updating manuals

For any significant pilot release:

1. update the relevant application function
2. update the Quick Start only if the first-use workflow changed
3. update the full User Manual for any changed user-facing function
4. run `npm run build`
5. render/inspect the generated PDFs before release where layout changed materially
6. deploy normally; startup synchronizes the PDFs to R2
7. verify both Home-page download links

The manuals should continue to state testing boundaries explicitly rather than documenting planned capability as available.
