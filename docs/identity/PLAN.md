# StudioHub Identity Module — Plan (Phase 1)

**Date:** 2026-10-22
**Companion:** `docs/identity/AUDIT.md` (findings + evidence).
**Status:** Phase 1 plan. Phase 2 decisions A1–A15 were approved on 2026-10-22; Phase 3 execution status is recorded directly below its table.

**Conventions.** Sizes: S = hours, M = 1–2 days, L = 3–5 days, XL = 1–2 weeks. Risk: Low/Medium/High (blast radius on production data, API contract, or security guarantees). Classification: **MVP** = required to close a Critical/High finding or unblock a later phase; **Later** = hardening/hygiene that can follow. Every WP lists its dependencies; WPs that require a decision from `AUDIT.md` §6 are flagged **[approval A#]** and **must not start** until answered. Migration risk is called out per WP.

**Ordering.** Phases 3–8 mirror Parts A/Phase list of the master prompt. Within a phase, WPs are dependency-ordered. Cross-phase dependencies are explicit; notably, Phase 5 session-revocation guarantees are prerequisites for Phase 6 (MFA enforcement at login) and Phase 7 (credential lifecycle), and RBAC management correctness (Phase 4) precedes Phase 8 integration proof.

---

## Phase 3 — Users, profiles, preferences

| WP | Title | Size | Risk | Class | Depends on | Migration risk |
|----|-------|------|------|-------|-----------|----------------|
| 3.1 | Soft-delete correctness: add `is_deleted=False` scoping to `UserManager`/`UserQuerySet`, `ProfileManager`/`ProfileQuerySet`, `UserPreferenceManager`, and the auth login selector; add an `all_objects` escape hatch for recovery; make soft-delete set `is_active=False` or make auth reject `is_deleted`. Tests: soft-deleted user cannot log in or appear. | M | Medium | MVP | — | None (queryset/manager only). Behaviour change: hides existing soft-deleted rows from default queries — confirm no admin/report relies on seeing them. |
| 3.2 | Case-insensitive unique email + normalization: normalize `email` to lowercase on the create/update service path (no `full_clean` bypass), add DB `UniqueConstraint(Lower("email"))`, make `UserValidator.validate_email_unique` use `iexact`. | M | High | MVP | 3.1 | **Medium–High:** additive migration will fail if duplicate case-variant emails exist — needs a data-normalization migration (with reverse) first, gated on a duplicate pre-scan. |
| 3.3 | Unify password change: single service that verifies `old_password`, runs Django validators, revokes sessions/tokens, emits `SecurityEvent(PASSWORD_CHANGED)`, and clears `must_change_password`; route both `/identity/password/change/` and `/identity/users/change_password/` through it. | M | Low | MVP | 5.2 (session revocation) | None |
| 3.4 | Profile cross-user create fix: make `user` read-only / self-bound in `ProfileCreateSerializer`; keep admin create gated behind `identity.profile.create`. Update the serializer test that currently asserts cross-user success. | S | Low | MVP | — | None |
| 3.5 | Serializer/filterset package reorg: move Profile/SecurityEvent/TrustedDevice serializers and filtersets out of `api/serializers/user_preference/` and `api/filtersets/user_preference.py` into correctly named packages. Pure refactor, no contract change. | M | Low | Later | — | None |
| 3.6 | `UserPreference` resolution: wire a full self-scoped vertical (selector/service/serializer/viewset/route + auto-create on user creation) **or** delete model/migration/admin. **[approval A2]** | M | Medium | MVP (decision) | A2 | If delete: destructive `DeleteModel` migration (schema-only; confirm no data). If wire: additive. |
| 3.7 | `must_change_password` enforcement (design): decide enforcement point (login response flag / JWT claim gate / permission class). Implementation lands in Phase 5 login. **[approval]** | S (design) | Medium | MVP (design) | — | None |
| 3.8 | Password reset / email verification: either implement a hashed single-use `PasswordResetToken` (+1 h expiry, version invalidation, email delivery) and an email-verification token, **or** unmount the stub endpoints. **[approval A10]** | L | Medium | MVP (decision) | A10 | Additive (new model) or none (unmount). |

**Phase 3 execution status (2026-10-22):**

| WP | Status | Evidence |
|----|--------|----------|
| 3.1 | **DONE** | `UserManager`/`ProfileManager` default to `alive()`; `IdentityQuerySet` exposes `alive/deleted/with_deleted`; auth selector cannot resolve soft-deleted users; login validator rejects `is_deleted`. Tests: `tests/models/test_soft_delete_scoping_models.py`. |
| 3.2 | **DONE** | Emails normalized on manager/service paths; `UniqueConstraint(Lower("email"))`; validator uses `iexact`; data-normalizing migration with duplicate pre-scan (`0014`). Tests: `tests/managers/test_email_uniqueness_managers.py`. |
| 3.3 | **DONE** | `PasswordService` is the single mutation path (old-password check, Django validators, session revocation, `PASSWORD_CHANGED`, clears `must_change_password`); both change-password endpoints delegate. Tests: `tests/api/viewsets/test_user_change_password.py`, `tests/services/test_password_revocation.py`. |
| 3.4 | **DONE** | `ProfileCreateSerializer.user` is read-only; viewset forces `request.user`; serializer test and new cross-user API test updated. |
| 3.5 | **DEFERRED (Later)** | Package reorg is a pure rename with no contract impact; deferred to keep the Phase 3 diff reviewable. |
| 3.6 | **DONE (A2)** | `UserPreference` model/admin/manager removed; destructive `DeleteModel` in `0014`. `Profile.preferences` is canonical. |
| 3.7 | **DONE (design + claim)** | `must_change_password` already appears in the refresh JWT claim and `FrontendUser` payload; the unified password service clears it only after a successful change. Login-time enforcement remains WP 6.2. |
| 3.8 | **DONE (A10)** | `PasswordResetToken` (SHA-256 digest, 1 h expiry, single active token per user, row lock on consume), `PasswordResetService`, `POST /identity/password/reset/` + `/auth/reset-password/`, forgot-password throttled (`5/min`) and generic. Tests: `tests/services/test_password_reset_services.py`, `tests/api/test_password_reset_api.py`. Email verification stays unmounted. |

## Phase 4 — Roles, permissions, assignments, groups

| WP | Title | Size | Risk | Class | Depends on | Migration risk |
|----|-------|------|------|-------|-----------|----------------|
| 4.1 | RBAC management services + APIs: create `RoleService`/`GroupService` covering grant/revoke permission, assign/unassign user role, add/remove group member, attach/detach group role, with serializers/viewsets/routes. | L | Medium | MVP | — | None (uses existing tables) |
| 4.2 | Privilege-escalation guards: cannot grant a permission/role the actor does not hold; cannot modify own assignments; cannot remove/demote the last administrator. | M | High | MVP | 4.1 | None |
| 4.3 | System-record protection: make `code`/`is_system` read-only in serializers; guard rename/delete of `is_system` Role/Group/Permission in services; make system permission catalog non-deletable. | M | Medium | MVP | 4.1 | None |
| 4.4 | Resolver + cache defects: filter `GroupMember.left_at__isnull=True` in `PermissionResolver` and cache invalidators; fix bulk `QuerySet.delete()` invalidation; fix `Role` signal to invalidate on any `update_fields` (not only `is_deleted`). | M | Medium | MVP | — | None |
| 4.5 | Constraints & attribution: DB `UniqueConstraint` on `Role.name`/`Group.name` (per decision), index `RolePermission.expires_at`, populate `RolePermission.granted_by` from the request, add `GroupRole` to change tracking, drop the redundant `Role.code` index. | M | Medium | MVP | 4.1 | **Medium:** unique-on-name may fail on existing duplicates — pre-scan + normalization. |
| 4.6 | RBAC audit events: emit `SecurityEventType.ROLE_CHANGED`/`PERMISSION_CHANGED` on every grant/revoke/assign/membership mutation. | S | Low | MVP | 4.1, 5.6 | None |
| 4.7 | Reconcile latent Django-auth RBAC: remove `PermissionsMixin` M2M shadow tables or document them as unused and drop from admin. **[approval A9]** | M | High | Later | A9 | **High:** dropping `auth.Group` M2M from `User` touches the user model — requires a reviewed migration and a statement that nothing reads those tables. |

## Phase 5 — Authentication, sessions, history, devices, IP controls

| WP | Title | Size | Risk | Class | Depends on | Migration risk |
|----|-------|------|------|-------|-----------|----------------|
| 5.1 | Login anti-enumeration: single generic failure message for unknown/inactive/wrong-password; run a dummy hash so timing is comparable; keep username-only lockout. Update `authentication/exceptions.py` + validators + response handler. | M | Medium | MVP | — | None |
| 5.2 | Session revocation completeness: reject `LOGGED_OUT` (and `LOCKED`) in `AuthenticationValidator.validate_session`; make `logout_all`/`revoke` perform the same refresh-JTI blacklist sweep as `revoke_all_for_user`; make logout mark the `UserSession` row (verify serializer path). | M | High | MVP | — | None |
| 5.3 | Immediate deactivation cascade (auth side): confirm/complete deactivation closes sessions, blacklists refresh tokens, suspends PAT/ApiKey (already partly done), and rejects API keys for disabled owners. Prerequisite for Phase 7. | M | High | MVP | 5.2 | None |
| 5.4 | Append-only audit ledgers: remove `update`/`partial_update`/`destroy` from `SecurityEventViewSet` and `LoginAttemptViewSet`; set admin `has_change/delete_permission=False`; restrict services to create. **[approval A11 for DB-level guard]** | M | Medium | MVP | A11 | None if API/admin-only; **Medium** if a DB trigger/constraint is chosen (portability). |
| 5.5 | Fix `LoginAttempt` retention + read scoping: key cleanup on `attempted_at`; add `choices` to `reason`; scope the viewset/server-side read. | S | Low | MVP | — | None |
| 5.6 | Security-event producers: emit `LOGIN_SUCCESS`/`LOGIN_FAILED`(rate-limited)/`LOGIN_LOCKED`/`SESSION_CREATED`/`TOKEN_REFRESHED` from the auth services. | M | Low | MVP | 5.4 | None |
| 5.7 | Identity `LoginHistory` orphan resolution: delete the model + `admin/login_history.py` + recreate-migration, **or** make it canonical and delegate the audit app. **[approval A4]** | M | Medium | MVP | A4 | If delete: destructive `DeleteModel` migration (confirm no data). |
| 5.8 | IP blacklist CIDR + observability: implement CIDR containment (`ipaddress.ip_network`) in `is_blacklisted`/`by_network` or drop `network`; add CIDR validation; increment `hit_count`/`last_hit_at` on block; fix the `datetime.timezone` import bug in the filterset. | M | Medium | MVP | — | None |
| 5.9 | Trusted-device correctness: align `services/mfa/trusted_device.py` with real model columns (`platform`, `is_trusted`, `revoked_at`, `last_login_at`) or extend the model; rename the duplicate `TrustedDeviceService`; wire device validation into login or retire the dead MFA path; use `REMOTE_ADDR`-only client IP for the fingerprint. | M | Medium | MVP | 6.1 | **Medium** if the model is extended (additive). |
| 5.10 | Cleanup jobs: schedule `UserSessionService.cleanup`, `cleanup_login_attempts` (fixed key), `cleanup_expired_trusted_devices` via Celery beat, or a management command if beat is out of scope. | S | Low | MVP | 5.5 | None |
| 5.11 | Trusted-proxy client-IP configuration: introduce a vetted proxy-allowlist setting used by all `get_client_ip` call sites; stop trusting raw `X-Forwarded-For`. **[approval A14]** | M | Medium | MVP | A14 | None |
| 5.12 | Session rotation on privilege change: invalidate/rotate sessions when roles/permissions change (coordinate with 4.4). | S | Medium | Later | 4.4, 5.2 | None |
| 5.13 | `KnownDevice` removal (or merge into `TrustedDevice`). **[approval A3]** | S | Low | Later | A3 | Destructive `DeleteModel` migration. |
| 5.14 | Legacy `/identity/*` tree demotion. **[approval A15]** | S | Low | Later | A15 | None |

## Phase 6 — MFA and recovery

| WP | Title | Size | Risk | Class | Depends on | Migration risk |
|----|-------|------|------|-------|-----------|----------------|
| 6.1 | MFA lifecycle rebuild: single tree; `enroll` → `pending` → `verify(code)` → `ENABLED` (call `activate` only after a verified code); fix `validators/user_mfa.py` so verify works pre-activation; stop trusting client-supplied secrets in `mfa/totp/enable`. | L | Medium | MVP | — | None |
| 6.2 | MFA enforcement at login: issue only a limited pre-auth `mfa_required` state on password alone; enforce `MFAPolicyService` (staff/superuser) with real settings; wire `MFARequired`. Prerequisite: 5.2/5.3 give a reliable session model. | L | High | MVP | 5.2, 5.3, 6.1 | None |
| 6.3 | TOTP secret encryption at rest: encrypt `UserMFA.totp_secret` with a dedicated key; fail closed when the key is missing/invalid; data migration to encrypt existing plaintext secrets (with reverse). **[approval A1]** | M | High | MVP | A1 | **Medium–High:** encrypting existing values; reverse migration must decrypt. |
| 6.4 | TOTP replay prevention + attempt limiting: record the last consumed time step; reject reuse within the window; unify the duplicated lockout math. | M | Medium | MVP | 6.1 | Additive column. |
| 6.5 | Backup codes hardening: set real `expires_at`; atomic consumption via `filter(used=False).update(...)`/`select_for_update`; POST-only issuance (no GET rotation); unify the two consume paths; one-time display. | M | Medium | MVP | — | Additive (expiry backfill). |
| 6.6 | SMS/email MFA: implement real channels (provider + dependency approval) or remove the stub endpoints. **[approval A8]** | L | Medium | Later | A8 | None (or new model). |
| 6.7 | MFA test expansion: HTTP activation, login-with-MFA, replay, encryption-at-rest, lockout e2e, IDOR; real-auth (not forced) for the core flow. | M | Low | MVP | 6.1–6.5 | None |

## Phase 7 — API keys, personal access tokens, OAuth

| WP | Title | Size | Risk | Class | Depends on | Migration risk |
|----|-------|------|------|-------|-----------|----------------|
| 7.1 | Credential model decision + consolidation: merge `ApiKey`+`PersonalAccessToken` into one model (+ optional `ServiceAccount`), or share one service/serializer set over both. **[approval A5]** | XL | High | MVP (decision) | A5 | **High** if merged: data migration moving rows; dual-read window; staging verification. |
| 7.2 | Credential lifecycle API: create/list/revoke/rotate with one-time secret display; digest-only storage; ownership scoping; tests including IDOR and rotation-invalidates-old. | L | Medium | MVP | 7.1 | None |
| 7.3 | Scope enforcement: `request.effective_permissions = intersect(owner_permissions, token_scopes)` consumed by `HasPermission`; a scoped key can never exceed its owner. Prerequisite: RBAC resolver correctness (4.4). | M | High | MVP | 4.4, 7.1 | None |
| 7.4 | Credential hashing hardening: `HMAC-SHA256(dedicated pepper)` + lazy rehash-on-use + constant-time verify on both paths. **[approval A6]** | M | High | MVP | A6 | **Medium:** lazy rehash migration; ops coordination for pepper. |
| 7.5 | Disabled-owner / revocation enforcement tests: expired, revoked, wrong-scope, wrong-owner, disabled-owner all rejected; concurrent revoke+use consistent. (Base behaviour partly present.) | M | Low | MVP | 7.1, 7.2 | None |
| 7.6 | Last-used batching: move synchronous `last_used_at`/`last_used_ip` writes to a task/event. | S | Low | Later | 5.10 | None |
| 7.7 | OAuth: build a full server-side flow (single-use session-bound `state`, `nonce`, redirect-URI allow-list, verified-email gate, authenticated link/unlink with last-credential guard) **or** deprecate/remove `OAuthAccount`+`OAuthProvider`. **[approval A7]** | XL | High | Later (decision) | A7 | If remove: destructive migrations. If build: additive + `redirect_uri` model. |
| 7.8 | OAuth provider secret encryption (if OAuth is retained): encrypt `client_secret`; support PKCE/public clients. **[approval A7/A1]** | M | High | Later | 7.7 | Additive/data migration. |

## Phase 8 — Integration, hardening, final verification

| WP | Title | Size | Risk | Class | Depends on | Migration risk |
|----|-------|------|------|-------|-----------|----------------|
| 8.1 | End-to-end real-auth tests: register → login → MFA → credential create → use → revoke → rejected, driving the real API (no `force_authenticate`). | L | Medium | MVP | all MVP WPs | None |
| 8.2 | Deactivation cascade proof: sessions, JWTs, PAT/ApiKey, OAuth sessions all stop immediately; regression-locked. | M | Medium | MVP | 5.3, 7.1 | None |
| 8.3 | Settings review: password validators consolidation, secure cookie flags, CSRF/CORS for identity endpoints, security headers, throttle fail-closed policy for all relevant scopes. | M | Medium | MVP | — | None |
| 8.4 | Admin hardening: read-only security/credential models; no secret fields displayed; correct read-only semantics. | S | Low | MVP | 5.4 | None |
| 8.5 | Migration verification: forward on an empty DB; forward+backward on a populated DB where data migrations are used (3.2, 6.3, 7.1, 7.4). | M | High | MVP | all migration WPs | Verification only. |
| 8.6 | PostgreSQL integration + concurrency tests: backup-code concurrent consumption, concurrent role assignment (one wins), credential revoke races. | M | Medium | MVP | 6.5, 4.1 | None |
| 8.7 | OpenAPI + module documentation update; re-audit every AUDIT.md row with new evidence. | M | Low | MVP | — | None |
| 8.8 | Tooling gates decision + run: type checker, formatter scope, `pip-audit`/`bandit`, time-freeze utility, identity coverage threshold. **[approval A12, A13]** | S–M | Low | MVP (decision) | A12, A13 | None |

---

## Dependency graph (critical path)

```
3.1 → 3.2
5.2 → 3.3
5.2,5.3 → 6.2
4.4 → 7.3
5.10 → 7.6
4.1 → 4.2/4.3/4.5/4.6
5.4 → 5.6 → 4.6
6.1 → 6.2/6.4/6.7
7.1 → 7.2/7.3/7.5
all MVP → 8.1/8.2/8.5
```

Highest-blast-radius migrations (do last within their phase, with reversal verified on PostgreSQL): **3.2** (unique lower(email)), **6.3** (encrypt TOTP secrets), **7.1** (credential merge), **7.4** (pepper rehash), **5.7/5.13** (destructive model deletions).

## Approvals required before execution

A1 (MFA key), A2 (UserPreference), A3 (KnownDevice), A4 (identity LoginHistory), A5 (credential consolidation), A6 (hashing pepper), A7 (OAuth), A8 (SMS/email MFA), A9 (Django-auth RBAC tables), A10 (password reset/email verification), A11 (audit immutability level), A12 (tooling gates), A13 (coverage threshold), A14 (trusted proxy), A15 (legacy tree contract). See `AUDIT.md` §6.

## MVP vs Later summary

- **MVP (must close a Critical/High or unblock a later phase):** 3.1–3.4, 3.6 (decision), 3.7 (design), 3.8 (decision), 4.1–4.6, 5.1–5.11, 6.1–6.5, 6.7, 7.1–7.5, 8.1–8.8.
- **Later (hardening/hygiene):** 3.5, 4.7, 5.12, 5.13, 5.14, 6.6, 7.6, 7.7–7.8.

## Definition of Done (per Phase 8)

All MVP WPs complete and re-audited with evidence; standard verification commands pass or failures documented as pre-existing in the Phase 0 baseline; no skipped/weakened tests; no open Critical/High without written acceptance; identity coverage threshold met (A13); one commit per phase on `feature/identity-hardening`; nothing pushed.
