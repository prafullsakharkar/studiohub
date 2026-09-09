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

Backend status: **MATCHED via compat layer** (`apps/identity/api/views/auth_compat.py` mounted at
`/api/v1/auth/` in `config/v1_urls.py`). The identity canonical endpoints remain at
`/api/v1/identity/login/` etc. returning `{access, refresh, session}`; the compat layer
wraps them to frontend shapes and serializes the user via
`apps/identity/api/serializers/frontend_user.py::serialize_frontend_user`.

### POST /api/v1/auth/refresh/

Request `{ "refresh": "<token>" }` → Response `200 { "access": "<token>" }`.

The frontend calls this automatically on any `401` (single-flight queue, one retry of the
original request; logout on refresh failure). Refresh requests set `retry: 0`.

Backend status: **MATCHED** — compat layer calls `AuthenticationService.refresh` then
projects to `{access}` only. Fixed `JWTService.rotate_refresh_token` to resolve user via
`api_settings.USER_ID_CLAIM` (was `refresh.user` AttributeError) and added missing
`UserSessionValidator.validate_refresh/validate_logout` stubs; `SIMPLE_JWT` now imported
in `config/settings/base.py`.

### POST /api/v1/auth/logout/

Authenticated. Expected `200 { "detail": "…" }`. Frontend clears local tokens regardless
of server outcome. Backend should blacklist/rotate-revoke the refresh token
(`TokenService` already supports this).

Backend status: **MATCHED** — `AuthLogoutView` at `/api/v1/auth/logout/` with
`JWTAuthentication` + `IsAuthenticated` calls `LogoutSerializer` → `AuthenticationService.logout`.

### GET /api/v1/auth/me/

Returns the current serialized `User` (same shape as login's `user`). Used by
`AuthProvider.initAuth()` at bootstrap when a stored access token exists; any failure
clears tokens.

Backend status: **MATCHED** — `AuthMeView` at `/api/v1/auth/me/` returns
`serialize_frontend_user(request.user, request)`. Fixed `BaseAPIView` auth (was
`authentication_classes=()` blocking JWT); now uses `JWTAuthentication` for `me`/`logout`.

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
