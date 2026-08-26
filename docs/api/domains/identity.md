# Identity Domain API

Backend app reference: `backend/apps/identity/` (User, Profile, MFA suite, sessions,
security records). Contract sources: `modules/auth/*` (live) and
`modules/identity/api/*Service.ts`.

## 1. Authentication (live frontend contract)

See [authentication.md](../authentication.md) for full shapes. Summary:

| Endpoint | Status |
|---|---|
| `POST /api/v1/auth/login/` | MISMATCH — backend has `/api/v1/identity/login/`; response must become `{tokens:{access,refresh}, user}` |
| `POST /api/v1/auth/refresh/` | MISMATCH — response must be exactly `{access}` |
| `POST /api/v1/auth/logout/` | MISMATCH — path |
| `GET /api/v1/auth/me/` | MISMATCH — `MeAPIView` exists but unrouted |

Implementation notes: add `JWTAuthentication` to default auth (currently Basic+Session
only); enable `rest_framework_simplejwt.token_blacklist` app so rotation blacklisting
actually works.

## 2. Users

Contract (UserService): prefix `/api/v1/identity/`

| Method | Path | Backend |
|---|---|---|
| GET | `users/` | MATCHED (routed, paginated) |
| POST | `users/` | MATCHED |
| GET/PUT/PATCH/DELETE | `users/{id}/` | MATCHED |
| GET | `users/me/` | MATCHED |
| POST | `users/{id}/activate/` `deactivate/` | MATCHED |
| POST | `users/{id}/suspend/` `unsuspend/` | MISSING BACKEND (add status transitions via UserService) |
| POST | `users/{id}/reset-password/` | MISSING BACKEND (forgot/reset views exist under different paths) |
| POST | `users/{id}/force-password-change/` | MISSING BACKEND |
| POST | `users/{id}/revoke-sessions/` | MISSING BACKEND (`TokenService.revoke` primitives exist) |
| GET/POST | `users/{id}/roles/` | MISSING BACKEND (RBAC models live in organization app — decide owner before implementing) |

Existing extras not consumed by frontend (MISSING FRONTEND): `archive/ restore/
change_password/`, `profiles/`, `ip-blacklist/`, `login-attempts/`, `security-events/`,
`trusted-devices/`.

Mock user shape (`types/auth.ts`) that serializers must produce: `id, email, first_name,
last_name, full_name, avatar_url, role (display string), permissions[] ("module:action"),
organization_id, organization_name, department, is_active, is_staff, is_superuser,
created_at, updated_at`.

## 3. Roles & Permissions

Contract (RoleService/PermissionService):

| Method | Path | Backend |
|---|---|---|
| GET/POST | `roles/` | MISSING BACKEND as identity route (models exist in organization app) |
| CRUD | `roles/{id}/` | same |
| POST | `roles/{id}/clone/` | MISSING BACKEND |
| GET/POST | `roles/{id}/permissions/` | MISSING BACKEND |
| POST | `roles/{id}/permissions/{add,remove}/` | MISSING BACKEND |
| GET | `permissions/` (+`/module/{m}/`, `/category/{c}/`, `/codes/`) | Partial — organization app routes `permissions/` list; module/category/code filtering needed |

Note: the MSW identity handler file defining these is **dead code** today; the live
frontend services call them, so they are real required contracts.

## 4. Sessions

Contract (SessionService): `GET sessions/`, CRUD `sessions/{id}/`,
`POST sessions/revoke-all/`, `POST sessions/revoke-other/`.
Backend: `UserSession` model + `TokenService` exist; unrouted `LogoutAllAPIView` /
`LogoutOtherDevicesAPIView` exist. Status: **MISSING BACKEND (wiring)**.

## 5. MFA

Contract (MFAService): `mfa/config/`, `mfa/totp/*`, `mfa/sms/*`, `mfa/email/*`,
`mfa/recovery-codes*`, `mfa/admin/reset/{user_id}/`.
Backend implements TOTP enroll/verify/disable/recovery/devices under
`identity/auth/mfa/…`. Status: **MISMATCH (paths)**; low priority — the registered mock
handlers never expose MFA, and no live UI calls it yet. Reconcile paths when MFA UI ships.

## Missing Models (documented, not invented)

None — all identity contracts map onto existing models. Gaps are routing/serializer work,
plus the roles-owner decision (identity vs organization app).

## Tests

Extend existing pytest viewset tests (`apps/identity/tests/api/…`) with auth-flow
contract tests (login/refresh/401-retry) shared with the frontend contract suite
(see [backend-implementation-plan.md](../backend-implementation-plan.md)).
