# Authentication Contract

## Overview

- Scheme: JWT Bearer tokens (djangorestframework-simplejwt on the backend).
- Transport: `Authorization: Bearer <access_token>` on every authenticated request
  (`ApiClient.ts` beforeRequest hook, `skipAuth` opt-out).
- Storage: `localStorage` keys `studiohub_access_token`, `studiohub_refresh_token`
  (`frontend/src/core/auth/tokenStorage.ts`). Not cookies.
- Multi-tenancy: every request also carries `X-Organization-Id: <uuid>` from
  `localStorage['studiohub_active_org_id']`. The backend organization context middleware
  **must** read this header.

## Endpoints

### POST /api/v1/auth/login/

Request:

```json
{ "email": "artist@studio.example", "password": "…" }
```

Response `200` (**nested tokens wrapper is mandatory**):

```json
{
  "tokens": { "access": "…", "refresh": "…" },
  "user": {
    "id": "…", "email": "…", "first_name": "…", "last_name": "…", "full_name": "…",
    "avatar_url": null, "role": "VFX Supervisor", "permissions": ["shots:approve"],
    "organization_id": "…", "organization_name": "…", "department": "…",
    "is_active": true, "is_staff": false, "is_superuser": false,
    "created_at": "…", "updated_at": "…"
  }
}
```

Errors:
- `401 { "detail": "No active account found with the given email" }`
- `400 { "detail": "…" }`

Backend status: **MISMATCH**. Current implementation is `POST /api/v1/identity/login/`
returning `{access, refresh, session:{id, session_key}}` and no nested `user`.
Required adaptation: route `/auth/*` paths and wrap the token pair in `tokens`, embed the
serialized user.

### POST /api/v1/auth/refresh/

Request `{ "refresh": "<token>" }` → Response `200 { "access": "<token>" }`.

The frontend calls this automatically on any `401` (single-flight queue, one retry of the
original request; logout on refresh failure). Refresh requests set `retry: 0`.

Backend status: **MISMATCH** (path + response must be exactly `{access}`).

### POST /api/v1/auth/logout/

Authenticated. Expected `200 { "detail": "…" }`. Frontend clears local tokens regardless
of server outcome. Backend should blacklist/rotate-revoke the refresh token
(`TokenService` already supports this).

### GET /api/v1/auth/me/

Returns the current serialized `User` (same shape as login's `user`). Used by
`AuthProvider.initAuth()` at bootstrap when a stored access token exists; any failure
clears tokens.

Backend status: **MISMATCH** — a `MeAPIView` exists in
`apps/identity/api/views/authentication/` but is not wired into
`apps/identity/api/urls.py`; `users/me/` exists as a UserViewSet action.

## Token Lifecycle

| Property | Value |
|---|---|
| Access TTL | 30 minutes (`SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']`) |
| Refresh TTL | 30 days |
| Rotation | enabled (`ROTATE_REFRESH_TOKENS=True`) |
| Blacklist after rotation | enabled — **but** `rest_framework_simplejwt.token_blacklist` is missing from `INSTALLED_APPS`; add it or rotation revocation silently no-ops |
| Clock skew | frontend tolerates none; keep access TTL comfortably above request duration |

## Error Semantics

- Missing/expired access token → `401` with DRF body (`{"detail": "…"}`) → triggers the
  refresh flow.
- Invalid refresh token → `401` from `/auth/refresh/` → frontend logs out.
- Permission failure with valid auth → `403` (does **not** trigger refresh).

## Backend Implementation Notes

- Reuse `apps.identity.authentication` (`JWTService`, `TokenService`,
  `IdentityAuthentication`). Add `JWTAuthentication` to
  `DEFAULT_AUTHENTICATION_CLASSES` or apply it via the identity middleware path — today
  only Basic+Session are defaults, which cannot satisfy this contract.
- Keep MFA endpoints under the identity namespace but document that the live frontend
  does not yet consume them (the MSW `identityHandlers.ts` MFA suite is unregistered dead
  code). When MFA UI ships, reconcile paths before implementing.

## Tests

Contract tests must cover: login success/failure shapes, refresh rotation, 401→refresh→
retry sequence, logout blacklisting, `/me/` bootstrap, and `X-Organization-Id` presence.
