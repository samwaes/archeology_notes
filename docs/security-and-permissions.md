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

## R2

The R2 bucket remains private.

Credentials remain server-side. The browser receives only short-lived signed upload or read URLs for authorised objects.

Object keys must be derived server-side from project/user/asset identifiers rather than trusted from arbitrary client paths.

## Auditability

Meaningful permission, visibility and record-history changes should produce audit events. Deleting or replacing preservation originals should require stronger controls than ordinary note editing.
