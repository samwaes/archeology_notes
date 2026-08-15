# Security and permissions

## Identity

Do not build a second account/password system.

Production identity comes from Cloudflare Access. Archeology Notes asks the existing Hupla central access service whether the authenticated identity is allowed to use application slug `archeology-notes`.

The local database stores the Hupla user ID and email only as the application identity reference.

## Application access versus project access

These are separate concerns:

- Hupla access decides whether someone may enter Archeology Notes.
- Archeology Notes project membership decides which project data they may use.

## Record visibility

Initial visibility states:

- `private`: author only
- `project`: authorised members of the project
- `public`: explicitly publishable

The first external pilot may keep anonymous public delivery disabled even while records can be marked for future publication.

## Server-side enforcement

Visibility and ownership checks must be performed on the server for every record read/write and signed-object URL. Client-side hiding is never sufficient access control.

Offline capture does not bypass server enforcement. Project access, site/object context and record rules are revalidated when a queued capture synchronises.

## Offline device queue

Phase 6B stores unsynchronised field records in browser IndexedDB on the capture device. This may include photographs and audio Blobs.

Security implications:

- use trusted or managed field devices
- device/browser profile access becomes part of the temporary security boundary
- do not treat an offline queue as server-backed preservation until sync is confirmed
- clear site data when a device is transferred to another user
- rejected sync items remain local until explicitly retried or discarded
- service-worker caching is restricted to the Field shell/static assets; API responses and evidence-object responses are not deliberately cached

A future institutional deployment may add managed-device controls, encrypted offline packages or explicit offline-project provisioning if pilots demonstrate the need.

## Sync integrity

Offline captures receive a client capture ID. The server stores a sync receipt after successful ingestion so normal retries do not create duplicate records.

This is pragmatic pilot idempotency, not a distributed transaction across PostgreSQL and R2. Production hardening should add stronger ingestion transactions/reconciliation if large-scale offline use proves necessary.

## R2

The R2 bucket remains private.

Credentials remain server-side. The browser receives only authorised application responses or short-lived signed read URLs.

Object keys are derived server-side from project/user/asset identifiers rather than trusted from arbitrary client paths.

## Auditability

Meaningful permission, visibility, condition, intervention, relationship and record-history changes should produce audit events. Deleting or replacing preservation originals requires stronger controls than ordinary note editing.
