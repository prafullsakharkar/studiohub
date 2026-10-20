# Identity Phase 1 — Revocation & Lifecycle Hardening (design)

**Date:** 2026-10-20 · **Status:** Approved design (bounded-to-architectural scope, written spec)
**Source:** findings C1/F4/F8/C3/M3/M4/M5/M7 + §12 Phase 1 of `docs/10-security/IDENTITY_AUDIT_2026-10-20.md` (backend repo).
**Companion decisions (user-approved):**
1. Scope = full Phase 1 (six workstreams below).
2. `must_change_password` model = **token claim + forced screen** (login succeeds; claim on access+refresh; `/auth/me` exposes flag; SPA forces a change-password screen).
3. Client IP = **REMOTE_ADDR only, always** (XFF ignored everywhere).
4. Lockout keying = **username only** (across all IPs, window-based; no persistent lock, no IP dimension).

Phase 0 (already shipped, `develop` @ `6385a61`) fixed C1 auth-time gating, H4 `/auth/me` PATCH, C2 secret echo, H5 device revoke, H3 unmounts, guarded blacklist. **This spec is the revocation/lifecycle hardening layer that sits on top of that.**

---

## 0. Principles

- **Sessions are the source of truth** for refresh validity (existing design, verified). Access tokens are revocable only via session status (≤30 min today) or via the new cache-backed access-jti check (≤60 s, workstream 5).
- **Credentials are suspended, never silently destroyed.** Deactivation suspends PATs/ApiKeys (`is_active=False`) and revokes sessions; reactivation restores the account and its suspended credentials symmetrically.
- **Every destructive/lifecycle action writes a SecurityEvent** — the current `SecurityEvent` model has zero producers (audit finding F11); Phase 1 wires the first real producers.
- **Fail closed where it matters, fail open elsewhere.** Login/refresh throttles fail closed on cache outage; other scopes keep the resilient fail-open behavior.
- **No new User model, no organization reintroduction, no RunPython data migrations.** Two tiny schema changes max (documented below), both fresh-DB-safe.

---

## 1. Workstream 1 — Password change & admin reset: full revocation + SecurityEvent + `must_change_password`

### 1.1 Behavior (today → target)

| Action | Today (verified) | Target |
|---|---|---|
| Self password change (`/identity/password/change/`) | verifies old, sets password, **nothing revoked, no event** | + revoke all other sessions + blacklist sweep + SecurityEvent(PASSWORD_CHANGED) |
| Admin-target change (`/users/change_password/`) | no validators, `old_password` never checked, no revocation | route through the same service: run validators, clear `must_change_password`, revoke all sessions + sweep + event |
| Admin reset (`/users/{id}/reset-password/`) | email stub, no-op | set `must_change_password=True` + revoke all sessions + sweep + event; **email delivery stays out of scope** (no notification subsystem — Phase 3) |
| `must_change_password` | stored, never enforced | enforced via token claim + forced screen (see §1.3) |

### 1.2 New/changed backend pieces

- **`TokenService.revoke_all_for_user(*, user, reason)`** (new, in `apps/identity/authentication/token.py`):
  1. `UserSessionService.logout_all(user, reason=reason)` — marks every ACTIVE session LOGGED_OUT (existing method).
  2. **Blacklist sweep** `JWTService.blacklist_sweep_for_user(user)` — for each session `refresh_token_jti`, `OutstandingToken.objects.get_or_create(jti=…)` + `BlacklistedToken.objects.create(token=…)` (idempotent), so the presented refresh dies even if a client holds a copy whose session row is stale. Also blacklist the *current* access? Access jti cannot be blacklisted by simplejwt — session-status + access-jti middleware (WS5) covers it.
  3. Dispatch `UserSessionsRevoked`-style event (reuse existing `SessionLoggedOut`/`SessionRevoked` per-session events; no new event type needed).
- **`PasswordService.change_password`** → after `set_password`+save: call `revoke_all_for_user(user, reason=PASSWORD_CHANGED)` and `SecurityEventService.create(user=user, event_type=SecurityEventType.PASSWORD_CHANGED, ip, user_agent, metadata={"origin": "self"})`. Taxonomy verified: `PASSWORD_CHANGED`, `PASSWORD_RESET`, `SESSION_TERMINATED`, `LOGIN_LOCKED` already exist in `apps/identity/choices/security.py`; add enum members `ACCOUNT_DEACTIVATED`/`ACCOUNT_ACTIVATED` (enum-only, no migration) for workstream 3.
- **`UserPasswordService.change_password`** (the viewset path) → stop using raw `make_password`; delegate to `PasswordService.change_password` semantics but with **no old-password requirement** (it is the admin-targeted path): set password, run `django.contrib.auth.password_validation.validate_password`, clear `Profile.must_change_password`, revoke all sessions + sweep, `SecurityEvent(PASSWORD_CHANGED, origin=admin)`.
- **`UserService` admin reset action** (`/users/{id}/reset-password/`) → set `Profile.must_change_password=True`, revoke all sessions + sweep, `SecurityEvent(PASSWORD_RESET_ADMIN)`. Serializer gains no new fields (existing request shape).
- **`AuthenticationValidator.validate_refresh_token`** → additionally `token.check_blacklist()` so swept refresh tokens are rejected at decode/validate time (simplejwt `CHECK_REVOKE_TOKEN` stays off; we enforce in our own validator, keeping behavior explicit and testable).

### 1.3 `must_change_password` enforcement (token claim + forced screen)

- **Claim injection** (`apps/identity/authentication/jwt.py`): `create_refresh_token` / `create_access_token` read `user.profile.must_change_password` (fallback False) and set claim `must_change_password` on both tokens. `for_user()` returns a token; set `token["must_change_password"] = bool(...)` before returning. Rotation inherits the claim automatically (new pair generated from user state).
- **`serialize_frontend_user`**: expose `must_change_password` from the profile (default False).
- **FE sub-stream** (studiohub-react, small):
  - `AuthProvider`: on login/refresh/me, if `user.must_change_password === true`, force route to a new `/auth/change-password` screen; all guarded routes redirect there while the flag is set.
  - New `ChangePasswordPage` calling the existing self change-password endpoint (verify backend path first — the SPA currently has no wired change-password call; add `AuthService.changePassword` → `POST /api/v1/auth/change-password/` **new compat route** wrapping `PasswordService.change_password`, returning 200 + detail, or 401 on old-password mismatch). **Consistency note:** the backend revokes *all* sessions (including the current one) on password change, so the endpoint deliberately returns no replacement tokens — the SPA clears tokens and redirects to login after a successful change.
  - Remove nothing else; no org remnants touched.

---

## 2. Workstream 2 — Logout terminates the session; rolling `expires_at`

### 2.1 Logout (F8)
- **Root cause (verified):** `LogoutSerializer.save()` calls `AuthenticationService.logout(session=None, …)`; the `session=None` branch skips `TokenService.logout` entirely (only `django_logout` + refresh blacklist run).
- **Fix:** resolve the session before logout:
  - If `refresh` provided → `AuthenticationSelector.get_session_by_refresh_jti(jti)`.
  - Else → derive jti from the request's access token (`request.auth.jti`) → `get_session_by_access_jti` (method already exists).
  - Pass the resolved session into `AuthenticationService.logout(session=…)` so `TokenService.logout` runs (blacklist presented refresh + `UserSessionService.logout` → status LOGGED_OUT, `logged_out_at`, `is_current=False`).
  - No session found → still `django_logout` + 200 (idempotent logout); add `SecurityEvent(SESSION_TERMINATED)` when a session was actually terminated.

### 2.2 Rolling session expiry (M4)
- **Today (verified):** `UserSessionService.refresh` re-stamps only the two jti columns; `expires_at` stays frozen at creation (+30 d) → every healthy rolling session hard-dies 30 days in.
- **Target:** on `refresh`, set `expires_at = now + settings.REFRESH_TOKEN_LIFETIME` (30 d), **capped** at `settings.SESSION_MAX_ABSOLUTE_LIFETIME_DAYS = 90` (new setting; sliding window bounded so sessions cannot roll forever). Add both settings to `config/settings/components/jwt.py`; no schema change (column exists).
- **Cleanup**: `UserSessionService.cleanup` already exists (stub/unscheduled); wire a Celery beat schedule entry to expire stale sessions daily — *deferred to Phase 5 hygiene* unless the plan finds it trivial; do not add beat infrastructure in Phase 1.

---

## 3. Workstream 3 — Deactivation suspends credentials & sessions

- **`UserService.deactivate` / `archive` / `suspend`** → additionally: `TokenService.revoke_all_for_user(user, reason=…)` + `PersonalAccessToken.objects.filter(user=user, is_active=True).update(is_active=False)` + `ApiKey.objects.filter(created_by=user, is_active=True).update(is_active=False)` + `SecurityEvent(ACCOUNT_DEACTIVATED)`.
- **`UserService.activate` / `restore` / `unsuspend`** → restore `is_active=True` **and** re-enable the suspended credentials (`update(is_active=True)`), symmetric and documented. (Audit §4.2 already records this expectation.)
- JWT self-heal already covered (simplejwt `CHECK_USER_IS_ACTIVE`) + Phase 0 PAT/ApiKey owner gate — this workstream makes the *account action* itself revoke, instead of relying on the next-request gate.
- Tests: deactivate → sessions LOGGED_OUT, PAT/ApiKey inactive, refresh 401, access 401 (via WS5 middleware), SecurityEvent row; activate → everything restores; archive/suspend/unsuspend analogs.

---

## 4. Workstream 4 — Signal-driven RBAC cache invalidation + grant expiry (C3)

### 4.1 Wiring (the invalidators already exist — they are simply never called)
- New receivers in `apps/identity/signals/` (module-level, imported via existing `apps.identity.apps.ready()` → `import apps.identity.signals`):
  - `RolePermission.post_save` / `post_delete` → `PermissionCacheService.invalidate_role_holders(role)` (query RolePermission → role_id).
  - `UserRole.post_save` / `post_delete` → `PermissionCacheService.invalidate_role_holders_by_id(role_id)`.
  - `GroupMember.post_save` / `post_delete` → `invalidate_group_members(group_id)`.
  - `GroupRole.post_save` / `post_delete` → `invalidate_role_holders_by_id(role_id)`.
  - `Role.post_save` (name/code changes don't affect grants — skip; but `is_deleted` flip does) → `invalidate_role_holders(instance)` when `is_deleted` toggles.
  - `Permission.post_save` (is_active flip) / `post_delete` → `invalidate_permission_holders(permission)`.
- Guard against cascading double-invalidation: `GroupMember` deletion via `GroupRole` cascade doesn't fire per-row `post_delete` in bulk — acceptable (window ≤1 request anyway; document in code comment). Use `m2m_changed`/`post_delete` receivers only where Django reliably fires them; bulk deletes (`queryset.delete()`) don't emit signals — note as known limitation (RBAC writes go through serializers/viewsets in practice, which use single-row ops).

### 4.2 Grant expiry + denial enforcement (resolver)
- `apps/identity/resolvers/permission.py` currently filters `granted=True, is_deleted=False`. Add `(expires_at IS NULL OR expires_at > now())` to the RolePermission query so timed grants lapse.
- `RolePermission.granted=False` already excludes the row (only `granted=True` counted) — no change; add a regression test documenting it (denial rows must never grant).
- `Role.parent` hierarchy: **not walked** (verified) — keep as-is; deprecation note moved to Phase 5.

---

## 5. Workstream 5 — Transactional rotation + cache-backed access-jti session check

### 5.1 Transactional rotation (M3)
- Wrap `TokenService.refresh` body (`JWTService.rotate_refresh_token` + `UserSessionService.refresh`) in `transaction.atomic()` so the session jti re-stamp and token rotation commit together (or not at all). Blacklist failure inside rotation already logs (Phase 0) — no transaction abort on blacklist error.

### 5.2 Access-jti → session-status enforcement (≤60 s revocation of access tokens)
- **New middleware** `SessionStatusMiddleware` (in `apps/identity/middleware/`, added to `MIDDLEWARE` after authentication; runs only for `request.user.is_authenticated` and JWT-auth requests where `request.auth` is a simplejwt token):
  - Extract `jti` from the access token payload.
  - Cache-backed validity: key `identity.session.<jti>` → snapshot `{status, expires_at}` TTL 60 s. Miss → load `UserSession` by `access_token_jti=jti` via `get_session_by_access_jti`; store snapshot; **fail closed** (401 `SessionExpired`) if row missing (covers revoked-while-in-flight) or status not ACTIVE or expired.
  - Skip non-JWT principals (PAT/ApiKey) — those are covered by the owner gate + credential suspension (WS1/WS3).
  - 401 response shape mirrors existing auth errors (`{"detail": ..., "code": "session_expired"}` via the API error handler).
- **Performance**: one cache get per authenticated request; DB hit only on miss (TTL 60 s). Same philosophy as `PermissionCacheService` (versioned, tolerant).
- **Alternative considered (rejected):** per-request DB lookup (no cache) — simple but doubles DB load on the hottest path; simplejwt `CHECK_REVOKE_TOKEN=True` — only checks blacklisted tokens, not session status, and adds a DB hit per request anyway.

---

## 6. Workstream 6 — Lockout redesign: username-only + REMOTE_ADDR-only IP + login fail-closed

### 6.1 Username-only lockout (user-approved)
- `AuthenticationValidator.validate_login_attempts`: count failed attempts **per username across all IPs** in the 15-min window (`LoginAttempt.objects.failed().for_username(username).recent(15).count()`); `>= 5` → `TooManyLoginAttempts`. The IP dimension is removed from the counter entirely.
- `LoginAttempt` rows keep recording `ip_address` (forensics) — only the counting key changes.
- No persistent `locked_until` (window-based only, per decision). `User.locked_until`/`is_locked` fields remain untouched (validate_user_locked stays, but nothing writes them — leave for future).

### 6.2 REMOTE_ADDR-only client IP (M2)
- Replace all IP-extraction sites to ignore `X-Forwarded-For`:
  1. `apps/identity/authentication/base.py:get_client_ip` → `REMOTE_ADDR`.
  2. `apps/identity/authentication/api_key.py:_get_ip` → `REMOTE_ADDR`.
  3. `apps/identity/authentication/utils.py` (the login-flow IP helper) → `REMOTE_ADDR`.
  4. `apps/core/api/throttling.py` — DRF `SimpleRateThrottle.get_ident()` trusts XFF; add a `get_ident` override on the resilient throttle using `REMOTE_ADDR`.
  - Centralize: introduce `apps/identity/authentication/utils.py:get_client_ip(request)` (single helper) and make all call sites use it (dedupe the 4th copy).
- **Documented tradeoff:** behind a load balancer, all users share the LB IP (REMOTE_ADDR-only means per-IP throttle/forensics see one IP). User decision recorded in the spec; infra note added to `docs/10-security/authentication.md`.

### 6.3 Login fail-closed throttle (M7)
- New `FailClosedScopedRateThrottle(ResilientScopedRateThrottle)` overriding the cache-exception fallback to return `False` (deny) instead of `True`.
- Apply to `login` and `refresh` throttle scopes only (`AuthLoginView`, `AuthRefreshView`, legacy `LoginAPIView`/`RefreshAPIView`). Other throttled endpoints keep fail-open.
- **Existing test change:** `test_auth_security.py::test_login_survives_cache_outage` currently asserts login succeeds during a cache outage (the Phase-0-era fail-open contract). With fail-closed, that test flips to assert a 429/401 deny on login during cache outage; add a parallel test asserting *other* scoped endpoints still fail open.
- Rationale (documented in code): a cache outage must not turn login into an unthrottled brute-force target; the login path itself stays up (Django session + DB), only rate limiting degrades to deny.

---

## 7. Data & schema impact

| Change | Type | Migration needed? |
|---|---|---|
| `SecurityEvent` enum members (PASSWORD_CHANGED, PASSWORD_RESET_ADMIN, ACCOUNT_DEACTIVATED, LOGOUT if absent) | code (choices) | no |
| `SESSION_MAX_ABSOLUTE_LIFETIME_DAYS` (new, default 90) + REFRESH lifetime reuse | settings | no |
| `PersonalAccessToken`/`ApiKey` suspension via existing `is_active` | data ops | no |
| `UserSession.expires_at` rolling (column exists) | data ops | no |
| `RolePermission.expires_at` enforcement | read path | no |
| **None required.** No RunPython, no data backfills. Fresh-DB compatible. | — | — |

## 8. Frontend impact (minimal, forced-change screen only)

- `types`: `User.must_change_password?: boolean`.
- `AuthProvider`: flag-driven route forcing to `/auth/change-password`.
- New `ChangePasswordPage` + `AuthService.changePassword` → `POST /api/v1/auth/change-password/` (new compat endpoint; see §1.3).
- Guarded-route behavior: while flag set, all protected routes redirect to the change screen; after success the SPA logs out (tokens revoked server-side) and redirects to login.
- No other FE changes. FE verification: tsc, vitest, e2e smoke.

## 9. Testing strategy (TDD per workstream)

- **Unit (services):** revocation matrix — password change (self/admin/reset) revokes sessions + blacklists sweep + events; deactivate suspends creds/sessions; activate restores; rolling expires_at cap; username-only lockout counts across IPs; resolver excludes expired grants and never grants on `granted=False`; `check_blacklist` enforcement on refresh.
- **Integration (DRF API):** each changed endpoint (change-password, reset-password, logout with/without refresh, auth/change-password compat, me.must_change_password flag, sessions list after logout shows LOGGED_OUT).
- **Middleware:** access-jti check — fresh token OK; revoked session → 401 ≤60 s (cache-busted test); PAT/ApiKey principals unaffected; cache-miss path hits DB.
- **Security:** deactivated user: JWT 401, PAT 401 (Phase 0 gate), refresh 401; reactivated user: creds restored; swept refresh rejected even with a valid-shaped token.
- **Signals:** RBAC write (UserRole/RolePermission/GroupMember/GroupRole/Permission/Role) bumps cache version for affected users (assert via `PermissionCacheService.get_permissions` before/after).
- **Regression:** full backend pytest (currently 1631) stays green; ruff clean; FE tsc/vitest green; e2e smoke (`route-authorization`, `platform-workflow`, `real-api-validation`, `flat-entity-views`) on warm vite + new backend.

## 10. Rollout & verification gates (team convention)

1. Implement per workstream with TDD (RED→GREEN), committing per workstream on `develop`.
2. Gate 1 (each commit): targeted pytest + ruff.
3. Gate 2 (before push): full backend pytest green + `makemigrations --check` clean.
4. Gate 3 (FE): tsc, vitest, e2e smoke for the forced-change screen + identity specs.
5. Update the SDD ledger (local-only) per wave.

## 11. Out of scope (deferred, per audit §12)

- Real password-reset token system + email delivery (Phase 3).
- Credential lifecycle API + scope enforcement (Phase 2).
- MFA rebuild/enforcement (Phase 3).
- LDAP/SSO (Phase 4).
- Dead-model/tree cleanup, `Role.parent` deprecation, celery beat hygiene (Phase 5).
- `logout_all` blacklist sweep for *access* tokens (impossible with simplejwt — session-status middleware covers it, WS5).
