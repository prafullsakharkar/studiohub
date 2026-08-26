# Versioning & URL Conventions

## Base Path

```
api/            → config.api_urls (namespace "api")
 └ v1/          → config.v1_urls (namespace "v1")
    ├ core/
    ├ identity/
    ├ organization/
    ├ settings/
    └ audit/
```

Final namespace pattern: `api:v1:<app>:<basename>`. The frontend hardcodes `/api/v1/…`
relative paths; there is no env-based base URL. **Deployment must serve Django and the
SPA same-origin**, or a reverse proxy must map `/api/` (and `/media/`, `/admin/`) to the
backend. Adding `VITE_API_URL` support later is a frontend change requiring explicit
agreement.

## Trailing Slash Policy

- Canonical DRF style: trailing slash on collection and detail routes
  (`/api/v1/projects/`, `/api/v1/projects/{id}/`).
- The frontend is inconsistent (some repositories send `/api/v1/projects` bare); the mock
  router normalizes both. Django's default `APPEND_SLASH=True` covers GET redirects but
  not all methods cleanly — prefer explicit tolerance (middleware or router patterns)
  so both forms work without 301 hops on writes.

## Resource Naming

- Plural kebab-case resources: `work-calendars/`, `feature-flags/`, `audit-logs/`.
- Detail lookup by string id (UUID in the real backend; mocks use `usr-001`-style slugs —
  serializers expose `id` as string; no code-based lookups except documented cases:
  organization detail accepts id-or-uppercase-code, feature-flag actions accept `{key}`).
- Actions are verb sub-resources: `POST …/{id}/approve/`, `bulk-assign/`,
  `add-to-playlist/`.

## API Versioning Strategy

- Single active version `v1`. No header/content negotiation versioning today.
- Additive changes stay in v1. Breaking changes require `v2/` alongside `v1/` plus a
  documented migration window — never silent shape changes.
- OpenAPI: `drf-spectacular` is installed and configured as the schema class
  (`SPECTACULAR_SETTINGS` present) **but no schema/UI URLs are wired**. Implementation
  step: add `SpectacularAPIView`, `SpectacularSwaggerView` under e.g.
  `/api/schema/` and generate the machine-readable contract in CI
  (see `docs/05-api/openapi.md` for existing standards notes).
