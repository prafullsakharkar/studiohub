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
| POST | `users/{id}/activate/` `deactivate/` | MATCHED (via `is_active`; `User` has no lifecycle `status` column) |
| POST | `users/{id}/suspend/` `unsuspend/` | MATCHED — mapped to `deactivate`/`activate` (`is_active`); documented decision, no `suspended` field exists |
| POST | `users/{id}/reset-password/` | MATCHED — delegates to `PasswordService.request_password_reset` → auth reset flow |
| POST | `users/{id}/force-password-change/` | MATCHED — sets `Profile.must_change_password` (cleared on password change) |
| POST | `users/{id}/revoke-sessions/` | MATCHED — `UserSessionService.logout_all`; responds `{sessions: <count>}` |
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

Contract (SessionService): `GET sessions/` (own, paginated), `GET sessions/current/`,
`POST sessions/{id}/revoke/`, `POST sessions/revoke-all-other/`,
`GET sessions/{id}/activity/`, `GET sessions/admin/{userId}/` (staff),
`POST sessions/admin/{userId}/revoke-all/` (staff).
Backend: `UserSessionViewSet` routed at `sessions/` (UserSessionSerializer matches the
frontend `Session` shape; `location` derived from city/region/country).
Status: **MATCHED**. Standard actions are scoped to `request.user`; `admin/*` routes
require staff. Per-session `activity` is derived from session timestamps
(login/activity/logout), not a separate log model.

## 5. Permission Wiring (P1.2)

`permission_map` completed where the pattern was already established:
- `UserViewSet`: `activate/deactivate/archive/restore` → matching
  `UserPermissions` (reads `list/retrieve/me` deliberately stay open to any
  authenticated user — member-directory/self-service contract, asserted
  by tests).
- `IPBlacklistViewSet`: `activate/deactivate/expire` → `UPDATE`.
- RBAC joins (`UserRole`/`GroupMember`/`GroupRole`/`RolePermission`):
  `update/partial_update/destroy` → matching domain constants
  (ASSIGN/REVOKE, ADD/REMOVE, GRANT/REVOKE).

Fixed along the way (same `status`-column bug family as P0.5):
- `UserService.archive` → maps onto `is_active=False` with distinct ARCHIVE
  event (was 500); `IPBlacklistService.activate/deactivate` → `is_active`
  flag (were 500).
- `ip-blacklist/{id}/expire/` now parses ISO-8601 `expires_at` (400 on
  invalid) — raw strings used to poison the column and crash serialization.

Deliberately out of scope: settings/audit permission models (IsStaff by design).

P2.4 update: `Profile`/`TrustedDevice` querysets are now scoped to the
request user's own records (staff see all; anonymous fails closed) via
`ProfileSelector`/`TrustedDeviceSelector`. Reads/writes stay code-open so
self-service keeps working; existing viewset + permission-matrix tests updated
to the scoped contract (own → 200, others' → 404).

## 6. Login Security

- **Throttling**: `ScopedRateThrottle` with `login` (30/min) and `refresh`
  (60/min) scopes on the identity + compat login/refresh views. Views without
  a scope are unaffected.
- **IP blacklist**: `AuthenticationService.login` rejects blacklisted IPs with
  `403 ip_blocked` (a plain `APIException`, deliberately not `PermissionDenied`,
  so the shared handler does not coerce it to 401).
- **Failure recording + lockout**: every failed `validate_login` is recorded
  via `LoginAttemptService.record_failure` (previously never called, so the
  `MAX_LOGIN_ATTEMPTS = 5` lockout in `AuthenticationValidator` was dead code);
  the 6th attempt gets `401 Too many login attempts`, and successes are
  recorded via `record_success`. Covered by
  `apps/identity/tests/api/test_auth_security.py` (7 tests).

## 7. MFA

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
