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

**Phase 4 execution status (2026-10-22):**

| WP | Status | Evidence |
|----|--------|----------|
| 4.1 | **DONE** | `services/rbac.py` (`RoleService`, `GroupService`, `PermissionService`); `api/viewsets/rbac.py` serves API-RBAC-02/03/05/06. Tests: `tests/services/test_rbac_services.py`, `tests/api/viewsets/test_rbac_viewsets.py`. |
| 4.2 | **DONE** | Escalation guards (`_require_holds*`), self-modification block, set-based last-administrator guard (`_admin_holder_ids`). Tests: `TestLastAdministratorGuardIsolated` (superuser actor, so the guard — not the self-modification rule — is what blocks). |
| 4.3 | **DONE** | `is_system` read-only in serializers; system Role/Group/Permission never deletable, superuser-only edit; `code` immutable; API-created permissions are forced non-system. `PermissionViewSet` now routes through `PermissionService` (it previously wrote via the serializer directly). |
| 4.4 | **DONE** | Resolver filters `left_at IS NULL`; `Role` signal invalidates on any save. Bulk `QuerySet.delete()` is covered by Django's per-row `post_delete` (comment in `signals/rbac.py`); there is no dedicated bulk-delete test yet. |
| 4.5 | **DONE, migration unverified on populated data** | Migration `0015`: case-insensitive live-name uniqueness for Role/Group (partial, `is_deleted=False`), `RolePermission.expires_at` index, redundant `Role.code` index dropped; read-only duplicate pre-scan fails fast. `granted_by` populated by the service; `GroupRole` added to change tracking. Service-level name guard returns a client error instead of an `IntegrityError`. |
| 4.6 | **DONE** | Every grant/revoke/assign/membership/permission-catalog mutation emits one `SecurityEvent` (`TestEveryMutationIsAudited`). No-op revokes emit nothing. |
| 4.7 | **NOT STARTED** | Later. A9 is DECIDED (keep Django-auth tables, document as unused, do not expose); no code change in this phase. |

**Open item blocking the concurrency test.** Concurrent same-role/same-member assignment is handled by `_activate_link` (row lock + retry on the unique constraint), but its real-thread test (`tests/services/test_rbac_concurrency.py`, `transaction=True`) needs a database that may be flushed: Django empties every table after a `transaction=True` test. The database configured in the env file holds live data (users, projects, tokens, audit rows), so the test is not run against it until a disposable database is provided or the owner explicitly accepts the flush.

**Environment facts found in Phase 4.** The configured DB role has no `CREATEDB` (`pytest --create-db` fails). `UserFactory` uses `django_get_or_create=("email",)`, so committed leftover users silently change test inputs.

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

**Phase 5 execution status (2026-10-22):**

| WP | Status | Evidence |
|----|--------|----------|
| 5.1 | **DONE** | One generic 401 for unknown / wrong password / inactive / deleted / locked; exactly one password hash per attempt (dummy hash of the configured hasher); precise cause only in the attempt ledger. `tests/security/test_login_hardening.py`. |
| 5.2 | **DONE** | Every session close goes through `UserSessionService._release_tokens` (blacklist refresh jti + evict the 60 s status cache); `validate_session` rejects `LOGGED_OUT`. `tests/security/test_session_revocation.py`. |
| 5.3 | **DONE** | `UserService._close_account`: one transaction for flag, sessions, refresh tokens, PAT, API keys, audit event; rolls back as a unit. |
| 5.4 | **DONE** | `SecurityEvent` is append-only (row, queryset, service, API, admin); `LoginAttempt` read + create only. A11 stays application-level; no DB trigger. |
| 5.5 | **DONE** | Retention keyed on `attempted_at`; `LoginAttemptReason` choices (migration 0016). Reads remain permission-gated (`identity.login_attempt.view`), as SEC-AUD-01 specifies; no additional row scoping was added. |
| 5.6 | **DONE** | `LOGIN_SUCCESS`, `SESSION_CREATED`, `LOGIN_FAILED` (rate-limited), `LOGIN_LOCKED`, `TOKEN_REFRESHED`, `IP_BLOCKED`, `TRUSTED_DEVICE_*`, `SUSPICIOUS_ACTIVITY` (refresh reuse). Best effort via `SecurityEventService.emit`. |
| 5.7 | **DONE, decision reversed** | Identity `LoginHistory` is canonical and the audit copy, URL and rows are removed (ADR-0035). Migration `audit.0006` drops the table; rows are not copied. |
| 5.8 | **DONE** | CIDR/IPv6/mapped matching, hit tracking, rate-limited `IP_BLOCKED`, CIDR validation; `__str__` and expired-filter defects fixed. |
| 5.9 | **DONE** (MFA wiring deferred to Phase 6) | Service aligned to real columns, owner-scoped fail-closed `validate`, duplicate class renamed (`DeviceTokenService`), API is list/revoke only. Device validation is **not** yet wired into login: that is the MFA enforcement of Phase 6. |
| 5.10 | **DONE** | `identity.cleanup` task, `identity_cleanup` command, daily beat entry; also purges login history. |
| 5.11 | **DONE** | `apps.core.utils.client_ip` + `TRUSTED_PROXY_IPS`; all call sites delegate. |
| 5.12 | **DONE by design** | Permissions are resolved per request from a cache that RBAC writes invalidate synchronously, so a role change reaches live sessions on the next request without terminating them (`TestPrivilegeChangesReachLiveSessions`). Sessions are not rotated on privilege change. |
| 5.13 | **DONE** | `KnownDevice` removed (migration 0017 refuses to drop a non-empty table). |
| 5.14 | **NOT STARTED** | A15: legacy `/identity/*` tree is kept during the transition; canonical is `/auth/*`. No change. |

**Also in Phase 5 (not a numbered WP):** refresh-token reuse detection. Refresh tokens carry a stable `sid`; presenting an already-rotated token (signature and expiry still valid) revokes that session and records `SUSPICIOUS_ACTIVITY`. A token issued before the claim existed cannot name a session, so its replay is only rejected until the session's first rotation adds the claim.

**Defects found and fixed in Phase 5:** closing an old session raised `IntegrityError` (outstanding-token row recreated without `expires_at`); `CELERY_BEAT_SCHEDULE` never reached the running app; trusted-device create/update let any user plant or un-revoke trust; five call sites trusted a spoofable `X-Forwarded-For`.

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

**Phase 6 execution status (2026-10-22):**

| WP | Status | Evidence |
|----|--------|----------|
| 6.1 | **DONE** | Lifecycle is `enroll` (PENDING, server-generated secret) → `activate(code)` (ENABLED + one-time recovery codes). `enroll` refuses while MFA is live, so a stolen session cannot swap the factor. The compat `totp/enable` ignores any client-supplied secret. Disable and recovery regeneration need the password and a valid second factor; policy-required accounts cannot disable. `tests/security/test_mfa.py`. |
| 6.2 | **DONE** (see risk) | A correct password for an enabled account returns `{mfa_required, challenge}` with no tokens, session or login-history row. `POST /auth/mfa/challenge/` exchanges challenge + TOTP/recovery code for tokens (session method `MFA`). The challenge is signed, 5 min, single use, bound to one user. A valid trusted-device cookie skips the challenge. Unenrolled staff/superusers are flagged `mfa_enrollment_required` but not blocked (no self-service enrollment path exists for a blocked user). The `MFA_*` settings were never exported by `settings/base.py`, so every `MFA_*` value silently fell back to its code default; they are exported now. |
| 6.3 | **DONE** | `UserMFA.totp_secret` is an `EncryptedSecretField` (Fernet via `apps/identity/crypto.py`, key(s) from `MFA_ENCRYPTION_KEY`, comma-separated for rotation: first encrypts, all decrypt). Fails closed: no/invalid key, plaintext at rest, tampered or foreign-key ciphertext all raise `SecretUnavailable` (503), including at login, so an unreadable secret never means "no MFA". Migration `0019` encrypts existing secrets (raw SQL, idempotent, reverse decrypts; refuses rather than leave plaintext when the key is missing and rows exist). `manage.py check` reports `identity.E001` (W001 in DEBUG) when the key is absent. `cryptography` 50.0.2 added with approval. `tests/security/test_mfa_encryption.py`. **Switch:** `MFA_ENCRYPTION_ENABLED=false` (operator request, 2026-10-22) stores new secrets in plaintext and needs no key; already-encrypted values still need it; `mfa_encrypt_secrets` converts plaintext when re-enabled. |
| 6.4 | **DONE** | `UserMFA.last_used_step` (migration `0018`); a step is consumable once per user, checked under a row lock. One lockout implementation (`MFALockoutService`): TOTP and recovery failures share the counter, a lockout no longer rewrites `status` (so it can never read as "MFA off"). |
| 6.5 | **DONE** | Recovery codes get `expires_at` (`MFA_RECOVERY_CODE_DAYS`, default 365; existing rows back-filled in `0018`, reverse is a no-op). Consumption is a conditional `UPDATE ... WHERE used = false` (concurrency test). GET returns counts only; POST regenerates after re-authentication. |
| 6.6 | **DONE (removal)** | A8: SMS/e-mail stub endpoints and routes removed; TOTP + recovery only. The unused `email_enabled`/`sms_enabled` columns remain (dropping them is a separate migration). |
| 6.7 | **DONE** | 60 tests in `tests/security/test_mfa.py` plus 23 in `test_mfa_encryption.py`: HTTP activation, login with MFA, replay, lockout, recovery race, IDOR/admin reset, audit trail free of secrets, legacy tree. |

**Defects found and fixed in Phase 6:** the legacy `/auth/mfa/*` views returned bare dicts (DRF refuses them) and called a non-existent `ResponseBuilder.bad_request`, so that tree could not have answered over HTTP; the compat `totp/disable` needed no proof of identity; `enroll` on an enabled account silently disabled it; `Verification.reset_failed_attempts` overwrote `totp_confirmed_at` on every login; recovery-code guesses were never counted toward lockout; the legacy trusted-device list returned an unserialisable queryset.

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

**Phase 7 execution status (2026-10-22):**

| WP | Status | Evidence |
|----|--------|----------|
| 7.1 | **DONE** (A5) | One `CredentialService` and one viewset/serializer set over both tables; no physical merge. An `ApiKey` acts as its owner, else its creator (`principal`). ADR-0036. |
| 7.2 | **DONE** | `/identity/api-keys/` and `/identity/personal-access-tokens/`: create (secret once), list, retrieve, rotate, revoke; owner-scoped; manager (`identity.credential.manage`) may list/revoke, never rotate; session JWT only; per-user cap. `tests/security/test_credential_lifecycle.py`. |
| 7.3 | **DONE** | `HasPermission` intersects a credential's scopes with its owner's permissions; scoped superuser credentials do not get the bypass; legacy no-scope credentials unchanged (documented). `tests/security/test_credential_auth.py`. |
| 7.4 | **DONE** (A6) | `v2$` HMAC-SHA256 with `API_KEY_PEPPER`; legacy digests verified and upgraded on first use; fails closed without a pepper; `identity.E002` check. |
| 7.5 | **DONE** | Expired, revoked, inactive, wrong-secret, malformed, disabled/deleted owner, prefix-sharing rows all rejected; reactivation no longer revives revoked credentials (migration `0020` adds `revoked_at` + backfill). |
| 7.6 | **DONE (throttled, not queued)** | `last_used_at`/`last_used_ip` are a conditional UPDATE at most once per `IDENTITY_CREDENTIAL_TOUCH_SECONDS` (60), not a task. |
| 7.7 / 7.8 | **DONE (removal, A7)** | `OAuthAccount` and `OAuthProvider` models, admin, factories/fixtures and `OAuthProviderName` are removed; nothing in the application read or wrote them. Migration `0021` refuses to run if either table has rows (client secrets and tokens would be lost) and recreates empty tables on reverse. `tests/models/test_oauth_removed.py`. 7.8 (secret encryption) is moot. |

**Defects found and fixed in Phase 7:** scopes were never enforced and a scoped superuser key would have had full bypass; `UserService.activate` re-enabled every inactive credential including revoked ones; an API key acted as its creator even when it had a different owner and was suspended by the wrong account; the admin could "create" credentials with no usable digest; a dead PAT middleware was removed.

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

**Phase 8 execution status (2026-10-22):**

| WP | Status | Evidence |
|----|--------|----------|
| 8.1 | **DONE** | `tests/security/test_e2e_real_auth.py`: operator creates a user over the API; the user signs in, enrols MFA, logs out, completes an MFA login, a credential is minted, used and revoked. No `force_authenticate`. |
| 8.2 | **DONE, one defect fixed** | Same file, `TestDeactivationCascade`: JWT, refresh token, PAT and API key all stop at once on deactivation; after re-activation sessions stay dead, suspended credentials return, a revoked one does not. It found that a rotated-out access token kept a cached "active" snapshot (up to 60 s, and back after re-activation); `UserSessionService.refresh` now evicts it. |
| 8.3 | **DONE** | Review in `REAUDIT.md` §2. Fixed: production CORS, `sensitive` throttle scope on password/MFA/credential endpoints, one password policy, test settings pinned. Not changed: `SECURE_PROXY_SSL_HEADER`, 8-character minimum (decisions). `tests/security/test_settings_hardening.py`. |
| 8.4 | **DONE** | Admin: MFA rows, backup codes, trusted devices, sessions, API keys and PATs are view-only; the User admin can no longer overwrite the password hash. RBAC rows stay editable (residual risk). `tests/admin/test_security_admin.py`. |
| 8.5 | **DONE** | Whole identity chain reversed to `0013` and forward to head on a populated schema: counts equal, MFA secret intact and re-encrypted, credential digests intact. Individual data migrations (`0018`–`0021`) also verified with seeded rows and guards. |
| 8.6 | **DONE, two defects fixed** | `tests/security/test_credential_races.py` (revoke, rotate, use-while-revoking, cap) and `test_rbac_concurrency.py::TestLastAdministratorRace`. Fixed: credential cap overshoot (owner row lock) and last-administrator write skew (advisory lock). Backup-code race: `test_mfa.py::TestRecoveryCodeRace`. |
| 8.7 | **DONE** | `REAUDIT.md` re-audits all 23 rows; OpenAPI generates, includes the new endpoints, and now documents the three authentication schemes (`authentication/schema.py`). |
| 8.8 | **DONE except audit tools** | Ruff, type check (no new errors in changed files) and the full suite run; coverage in `REAUDIT.md`. `pip-audit` and `bandit` not run: A12 requires approval to add them. |

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
