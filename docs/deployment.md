# Deployment

## Target

- GitHub: `samwaes/archeology_notes`
- branch: `main`
- hosting: Coolify
- hostname: `https://archeology-notes.hupla.eu`
- application port: `3000`
- health endpoint: `/api/health`

## Coolify application

Recommended settings:

```text
Source: samwaes/archeology_notes
Branch: main
Build pack: Dockerfile
Port: 3000
Auto deploy: on
Domain: https://archeology-notes.hupla.eu
Health path: /api/health
```

## Database

Use PostgreSQL with PostGIS support. The container startup runs `scripts/migrate.mjs` before starting Next.js.

`DATABASE_URL` must be available at runtime or the container intentionally refuses to start.

## Required production variables

```text
DATABASE_URL=
ARCHEOLOGY_DATABASE_SSL=false

HUPLA_ACCESS_API_URL=https://www.hupla.eu/api/access/v1
HUPLA_ACCESS_SERVICE_TOKEN=
HUPLA_ACCOUNT_URL=https://labs.hupla.eu/account
HUPLA_ACCESS_FAIL_CLOSED=true

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=archeology-notes
R2_ENDPOINT=

NEXT_PUBLIC_APP_URL=https://archeology-notes.hupla.eu
```

## Health

`GET /api/health` is a shallow liveness endpoint suitable for Docker/Coolify.

`GET /api/health?deep=1` validates configured PostgreSQL/PostGIS and R2 dependencies and reports central Hupla configuration.
