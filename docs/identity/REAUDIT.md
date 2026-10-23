# Identity Module: Re-audit (Phase 8)

**Date:** 2026-10-22 · **Branch:** `feature/identity-hardening` · **Nothing is pushed.**
Re-audit of every row of `AUDIT.md` §1 against the code and tests after Phases 3–8. "Then" is the original status and severity; "Now" is the status after hardening. Evidence cites tests that fail when the fix is removed (each was mutation-checked at the time it was written) and the code that enforces it.

Status legend: **FIXED** closed and regression-locked · **REMOVED** the feature is gone by decision · **ACCEPTED** open by an explicit operator decision (recorded here) · **PARTIAL** improved, residual risk listed.

## 0. Verification

Fresh schema built from migrations (all applied), full suite, 2026-10-22:

| Check | Result |
|---|---|
| Full test suite | **2130 passed, 1 skipped** (Phase 0 baseline 1732 / 1) |
| Total coverage | 80.21% (gate 72%) |
| `apps/identity` coverage (non-test, non-migration) | **89.8%** (A13 target 85%) |
| `ruff check`, `makemigrations --check`, `manage.py check` | clean (`check` warns `identity.W003`, see §3) |
| Type check | no new errors in changed files |
| Migrations | forward on an empty schema; whole identity chain reversed to `0013` and forward on a populated schema; `studiohub` migrated to head with no errors |
| Not run | `pip-audit`, `bandit` (A12: needs approval to add) |

## 1. Row-by-row

| # | Area | Then | Now | Evidence |
|---|------|------|-----|----------|
| 1 | users | PARTIAL · High | **FIXED** | Soft-deleted users are out of every default query and cannot log in (`tests/models/test_soft_delete_scoping_models.py`). Case-insensitive unique email, data-normalising migration `0014` (`tests/managers/test_email_uniqueness_managers.py`). One password service and, since Phase 8, one password policy (`tests/security/test_settings_hardening.py::TestOnePasswordPolicy`). |
| 2 | profiles | PARTIAL · High | **FIXED** | `user` is read-only and bound to the caller; cross-user create refused (Phase 3, WP 3.4). |
| 3 | user preferences | MISSING · High | **REMOVED** | A2: model, admin and manager deleted (`0014`); `Profile.preferences` is canonical. |
| 4 | roles | PARTIAL · High | **FIXED** | Service-backed writes, `is_system`/`code` not client-writable, system roles protected, name uniqueness at the DB (`0015`) and in the service (`tests/services/test_rbac_services.py`, `tests/api/viewsets/test_rbac_viewsets.py`). |
| 5 | permissions | PARTIAL · High | **FIXED** | `PermissionService`; system permissions immutable; API-created permissions are never system (Phase 4). |
| 6 | role permissions | MISSING (mgmt) · High | **FIXED** | `grant_permission`/`revoke_permission` with escalation guard and audit event (`TestEveryMutationIsAudited`). |
| 7 | user roles | MISSING (mgmt) · High | **FIXED** | `assign_user`/`unassign_user`; revive-or-create is race-safe (`tests/services/test_rbac_concurrency.py`). |
| 8 | groups | PARTIAL · High | **FIXED** | System groups protected, live-name uniqueness (`0015`). |
| 9 | group members | DEFECTIVE · High | **FIXED** | The resolver honours `left_at` (WP 4.4); membership changes are audited. |
| 10 | group roles | PARTIAL · High | **FIXED** | `attach_group`/`detach_group`/`grant_role`/`revoke_role`; `GroupRole` is in change tracking. |
| 11 | API keys | PARTIAL · Medium | **FIXED** | Lifecycle API, peppered digests, scope enforcement, revocation semantics (Phase 7; `tests/security/test_credential_lifecycle.py`, `test_credential_auth.py`, `test_credential_races.py`). |
| 12 | personal access tokens | PARTIAL · Medium | **FIXED** | Same service and API as API keys (A5); dead middleware removed. |
| 13 | backup codes | PARTIAL · Medium | **FIXED** | Expire, hashed, spent by an atomic conditional update (`tests/security/test_mfa.py::TestRecoveryCodeRace`), counts-only GET, re-authenticated regeneration. |
| 14 | user MFAs | DEFECTIVE · **Critical** | **FIXED, one ACCEPTED risk** | Real lifecycle, login enforcement with a single-use challenge, replay prevention, one lockout (`tests/security/test_mfa.py`, `test_e2e_real_auth.py`). **ACCEPTED:** `MFA_ENCRYPTION_ENABLED=false` in the operator's `.env.local` (see §3). The code default is encrypted (`tests/security/test_mfa_encryption.py`). |
| 15 | OAuth accounts | PARTIAL/MISSING · **Critical** (no flow) | **REMOVED** | A7: models dropped by `0021` (refuses to run on a non-empty table); nothing referenced them (`tests/models/test_oauth_removed.py`). |
| 16 | OAuth providers | PARTIAL/MISSING · High | **REMOVED** | As above; the plaintext `client_secret` column no longer exists. |
| 17 | user sessions | PARTIAL · High | **FIXED** | Every close releases tokens and evicts the status cache; `LOGGED_OUT` rejected; rotation evicts the replaced access token (Phase 8 fix); refresh-token reuse revokes the session (`tests/security/test_session_revocation.py`, `test_refresh_reuse.py`, `test_e2e_real_auth.py::TestRotatedAccessTokens`). |
| 18 | login attempts | PARTIAL · High | **FIXED** | Append-only (row, queryset, service, API, admin), retention job, reason choices (`tests/security/test_audit_ledgers.py`). |
| 19 | login history | DEFECTIVE · High | **FIXED** | Identity owns the only history (ADR-0035); append-only; read endpoint `/identity/login-history/` (`tests/security/test_login_history.py`, `test_login_history_api.py`). |
| 20 | security events | DEFECTIVE · Critical/High | **FIXED** | Append-only everywhere including admin; best-effort emission that cannot fail a login; MFA, credential and RBAC events added. |
| 21 | IP blacklists | PARTIAL · High | **FIXED** | CIDR/IPv6/mapped matching, hit tracking, trusted-proxy client IP (`tests/security/test_ip_controls.py`). |
| 22 | known devices | MISSING (dead) · Medium | **REMOVED** | A3: dropped by `0017`. |
| 23 | trusted devices | DEFECTIVE · High | **FIXED** | Owner-scoped, minted server-side only, fails closed, and now wired into login (skips the MFA challenge for the same user) (`tests/security/test_trusted_devices.py`, `test_mfa.py::TestLoginEnforcement`). |

## 2. Defects found while hardening (not in the original audit)

Found by writing the tests, not by reading the code.

- **Phase 5:** closing an old session crashed on a missing `expires_at` (the cleanup job would have hit it); the Celery beat schedule never reached the running app; trusted-device create/update let any user plant or un-revoke trust; five call sites trusted a spoofable `X-Forwarded-For`.
- **Phase 6:** the legacy `/auth/mfa/*` views returned bare dicts and called a method that does not exist, so that tree could not answer over HTTP; the compat `totp/disable` needed no proof of identity; `enroll` on an enabled account silently disabled it; recovery-code guesses never counted toward lockout; **no `MFA_*` setting ever reached Django** (`base.py` imports names one by one), so every value silently used its code default.
- **Phase 7:** scopes were stored and never evaluated, and a superuser's key had the full bypass; re-activating an account switched on every inactive credential, including revoked ones.
- **Phase 8:**
  - **Rotated access tokens (found by the end-to-end cascade test):** a rotated-out access token kept a cached "active" snapshot, so it outlived a logout or deactivation by up to 60 s and came back when the account was re-activated.
  - **Credential cap race:** the per-user credential cap was check-then-insert; four concurrent requests passed a cap of two.
  - **Last-administrator race:** two concurrent removals of two different administrators could both pass and leave none (write skew). Now serialized by a PostgreSQL advisory lock.
  - **Admin password field:** the User admin let a typed value overwrite the password hash.
  - **Admin write access:** the admin could create or alter MFA rows, backup codes, trusted devices, sessions, API keys and PATs, bypassing every service guard; all are now view-only.
  - **Production CORS:** `CORS_ALLOW_ALL_ORIGINS` followed the env DEBUG flag while credentials were allowed, and `production.py` did not reset it.
  - **Throttling and password policy:** endpoints that verify a password or second factor were unthrottled for authenticated callers (a stolen session could guess); password reset enforced a different policy from create and change.
  - **Test isolation:** test settings inherited `MFA_ENCRYPTION_ENABLED` from the operator's env file.

## 3. Open items and residual risk

No Critical or High finding is open without an explicit decision, except as listed.

| Item | Severity | Status |
|------|----------|--------|
| TOTP secrets stored in plaintext (`MFA_ENCRYPTION_ENABLED=false`) | High | **ACCEPTED** by the operator's instruction on 2026-10-22; `identity.W003` warns on every `manage.py check`. Anyone who can read `identity_user_mfa` can generate valid codes. Re-enable with `manage.py mfa_encrypt_secrets`. |
| Staff/superusers with no MFA can still log in (the response carries `mfa_enrollment_required`) | Medium | Open. Blocking them needs an enrollment-only token, otherwise they cannot enroll. |
| Scopes narrow only where `HasPermission` is used; endpoints needing no permission, or using other permission classes, are not narrowed | Medium | Open. Not audited per app. |
| Legacy credentials with no scopes keep their owner's full access; legacy unkeyed digests still verify (`API_KEY_ACCEPT_LEGACY_HASH`) | Medium | Open by design; retire after every credential is used or reissued. |
| RBAC rows (Role, Permission, RolePermission, UserRole, Group*) are still editable in Django admin, which bypasses the service guards and audit events | Medium | Open. Left editable as the operational escape hatch; consider view-only like the other security state. |
| `SECURE_PROXY_SSL_HEADER` trusts `X-Forwarded-Proto` unconditionally | Medium | Open. Safe only if the proxy overwrites the header. |
| Password policy minimum is 8 characters (identity rules plus Django validators) | Low | Open; raising it is a product decision. |
| Reuse detection: two tabs refreshing the same token at once revoke the session; a pre-`sid` token's replay is rejected but cannot name a session | Low | Open, documented. |
| A user's MFA can be locked for 15 minutes by anyone who knows the password | Low | Open, inherent to the lockout design. |
| `pip-audit`/`bandit` not run | Low | A12 forbids adding them without approval. |
| Legacy `/identity/*` tree kept (A15); Django-auth `Group`/`Permission` tables kept (A9) | Low | Open by decision. |
