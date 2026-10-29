# StudioHub Identity Module — Audit (Phase 1)

**Date:** 2026-10-22
**Scope:** `backend/apps/identity` (23 feature areas), identity-adjacent `apps/core`, `apps/audit`, identity URL mounts and settings.
**Status:** Analysis only. **No code, migration, or settings were changed.** The only writes are `docs/identity/AUDIT.md` and `docs/identity/PLAN.md`.

**Method.** Every load-bearing claim is backed by a `path:line` reference relative to the repository root, verified in source by parallel independent audits and spot-checked by the coordinating agent. Claims that could not be confirmed from source are labelled **UNVERIFIED** or **LATENT** (reasoned from static structure, not executed). No tests were run in Phase 1; all test counts are file/test-name counts, not executed results. The Phase 0 baseline is: `1667 passed, 1 skipped`, coverage 78.22%.

**Prior art reconciled.** `docs/10-security/IDENTITY_AUDIT_2026-10-20.md` (651 lines) covers adjacent ground. This audit independently re-verified it. Net changes since that report:

- **Fixed since 2026-10-20:** PAT/ApiKey now check `is_active` (`tests/api/test_credential_auth_account_state.py:59-104`); `/mfa/config` no longer echoes the TOTP secret (`api/views/mfa_compat.py:45-50`); `PATCH /auth/me/` is implemented (`api/views/auth_compat.py:163-178`); password change revokes tokens and emits events (`services/password.py:39-58`); RBAC cache invalidation signals are now wired (`signals/rbac.py:17-63`); deactivation suspends credentials (`services/user.py:201-209`); trusted-device revoke is owner-scoped (`api/views/authentication/trusted_device.py:37-49`); client-IP extraction for login/lockout uses `REMOTE_ADDR` only (`authentication/utils.py:16-24`).
- **Still present / newly surfaced in this audit:** soft-deleted users/profiles remain reachable and a soft-deleted active user can authenticate; `SecurityEvent` and `LoginAttempt` are mutable+deletable ledgers; MFA enablement is unreachable and unenforced; TOTP secret plaintext at rest; identity `LoginHistory` is an orphan duplicate recreated after removal; `GroupMember.left_at` is ignored by the resolver; cross-user Profile creation; case-insensitive email uniqueness not enforced.

---

## 1. Audit Table (one row per feature)

| # | Area | Status | Severity | Evidence (`path:line`) | Problem | Recommended action |
|---|------|--------|----------|------------------------|---------|--------------------|
| 1 | users | PARTIAL | High | `models/user.py:14-20,42-63`; `managers/user.py:12-18`; `querysets/user.py:6-10`; `selectors/authentication.py:41`; `validators/user.py:18-36`; `api/viewsets/user.py:196-223`; `services/password.py:20-58` | Soft-deleted users not filtered by `objects` (soft-delete base shadowed) and a soft-deleted, still-active user can authenticate; case-insensitive email uniqueness not enforced; `/identity/users/change_password/` collects but never verifies `old_password`; `must_change_password` advisory only | Add `is_deleted=False` scoping to manager/queryset/selector + auth rejection; `UniqueConstraint(Lower("email"))` + normalization; route viewset change-password through a single service that verifies the old password; enforce `must_change_password` |
| 2 | profiles | PARTIAL | High | `models/profile.py:18-22`; `api/serializers/user_preference/create.py:20-23`; `api/viewsets/profile.py:47-74`; `selectors/profile.py:18-39`; `managers/profile.py:8-12` | Client can create a Profile for **another** user (writable `user` FK + `setdefault`); soft-deleted profiles still listable; serializers misplaced under `user_preference/` | Make `user` read-only/self-bound (or gate behind `identity.profile.create`); apply `is_deleted=False` scoping; move serializers to a `profile/` package |
| 3 | user preferences | MISSING | High (gap) | `models/user_preference.py:10-87`; `admin/user_preference.py:7-22`; `api/routers.py:13-56`; `migrations/0011_…:948-1038` | Model + migration + admin exist, but **no** selector/service/serializer/viewset/route/test; cannot be read or written via the API; no row auto-created | Decide wire vs delete (approval A2); if wire, full vertical + auto-create on user creation |
| 4 | roles | PARTIAL | High | `models/role.py:17-26,65-101`; `api/serializers/rbac.py:14-43`; `api/viewsets/rbac.py:49-74`; `admin/role.py:24` | `name` not unique at DB; `code`/`is_system` client-writable; system roles deletable/renameable; no DB constraint on name; redundant `code` index | Unique constraint on `name`; make `code`/`is_system` read-only; service guard protecting `is_system`; drop duplicate index |
| 5 | permissions | PARTIAL | High | `models/permission.py:29-33,104-112`; `api/serializers/rbac.py:70-95`; `api/viewsets/rbac.py:105-130`; `admin/permission.py:7-24` | System permissions deletable/editable; `is_system`/`code` client-writable; `code` vs `(module,action)` uniqueness intent ambiguous | Protect `is_system` catalog rows; make `code`/`is_system` read-only; reconcile uniqueness intent |
| 6 | role permissions | MISSING (mgmt) / PARTIAL (model) | High | `models/role_permission.py:8-59`; `admin/role_permission.py:7-23`; absent from `api/serializers/rbac.py` / `api/viewsets/rbac.py` | No API/service to grant/revoke permissions on a role; `granted_by` never populated; `expires_at` unindexed | Add grant/revoke service + endpoint; set `granted_by` from request; index `expires_at`; audit changes |
| 7 | user roles | MISSING (mgmt) / PARTIAL (model) | High | `models/user_role.py:10-45`; `admin/user_role.py:7-19`; no serializer/viewset/route | No API to assign/revoke roles; no privilege-escalation controls; soft-deleted assignment blocks re-assign (no restore) | Add assignment service + endpoint; enforce escalation rules; restore path |
| 8 | groups | PARTIAL | High | `models/group.py:17-49`; `api/serializers/rbac.py:46-67`; `api/viewsets/rbac.py:77-102`; `admin/group.py:7-22` | `is_system` client-writable and groups deletable; `name` not unique; `is_system` unindexed | Protect system groups; decide name uniqueness; add index |
| 9 | group members | DEFECTIVE (resolver) / MISSING (mgmt) | High | `models/group_member.py:10-62`; `resolvers/permission.py:80-94`; `signals/rbac.py:36-41`; `admin/group_member.py:7-29` | Resolver filters only `is_deleted`/`group__is_deleted` and **ignores `left_at`**, so a departed member keeps group-role permissions; no membership API; bulk delete skips cache invalidation | Filter `left_at__isnull=True` (or delete on departure); add membership endpoint; fix bulk-delete invalidation |
| 10 | group roles | PARTIAL (model) / MISSING (mgmt, audit) | High | `models/group_role.py:9-44`; `resolvers/permission.py:85-94`; `audit/signals/change_tracking.py:183-204`; `admin/group_role.py:7-19` | No attach/detach API; `GroupRole` not in change tracking; no escalation guard | Add group-role management service/endpoint; add to change tracking; validate escalation |
| 11 | API keys | PARTIAL | Medium | `models/api_key.py:10-82`; `api_keys/hashing.py:14-26`; `authentication/api_key.py:41-103`; `admin/api_key.py:20`; no viewset/route | No lifecycle API (create/rotate/revoke/list) — admin only, and admin add cannot populate required readonly digest; `scopes` never evaluated; `sha256(SECRET_KEY:secret)` unsalted; `last_used` sync write | Add credential lifecycle API; enforce scopes; harden hashing (dedicated pepper); batch last-used |
| 12 | personal access tokens | PARTIAL | Medium | `models/personal_access_token.py:10-70`; `authentication/personal_access_token.py:27-58`; `middleware/personal_access_token.py:4` | Near-duplicate of API keys (same hashing/scopes/lifecycle gaps); dead middleware; no lifecycle API | Consolidate with API keys (approval A5); remove dead middleware |
| 13 | backup codes | PARTIAL | Medium | `models/backup_code.py:8-63`; `services/mfa/recovery.py:44-51,104-122`; `querysets/backup_code.py:8-13`; `api/views/authentication/recovery_codes.py:14-23` | `expires_at` never set (dead); concurrent consumption non-atomic (no `select_for_update`); GET re-displays/rotates codes; duplicated consume paths | Set real expiry; atomic `filter(used=False).update(...)`; POST-only issuance; unify consume |
| 14 | user MFAs | DEFECTIVE | Critical | `models/user_mfa.py:26-29`; `services/mfa/enrollment.py:57-88`; `services/mfa/facade.py:32`; `validators/user_mfa.py:31-32`; `services/authentication.py:60-142`; `authentication/totp.py:56-80` | Enablement unreachable over HTTP (`activate` has zero production callers; verify requires ENABLED); never enforced at login; TOTP secret plaintext at rest; no replay prevention; SMS/email are stubs | Rebuild single lifecycle (enroll→pending→verify→enable); enforce policy at login; encrypt secret at rest; add time-step replay tracking |
| 15 | OAuth accounts | PARTIAL (schema) / MISSING (runtime) | Critical (no flow) | `models/oauth_account.py:10-80`; `migrations/0003_…:413-519`; `admin/oauth.py:25-52`; no `api/`/`services/` refs | No serializers/views/routes/services/selectors/auth-backend — OAuth cannot authenticate anyone; tokens plaintext; no linking rules | Build full flow or deprecate/remove (approval A7) |
| 16 | OAuth providers | PARTIAL (schema) / MISSING (runtime) | High | `models/oauth_provider.py:14-50`; `admin/oauth.py:7-22`; no consumers | No runtime consumer; `is_active`/disable unenforced; `client_secret` plaintext; no `redirect_uri`/PKCE/model | Encrypt secret, add redirect allow-list + flow, or deprecate (A7) |
| 17 | user sessions | PARTIAL | High | `models/user_session.py:43-59`; `validators/authentication.py:124-138`; `services/user_session.py:224-242`; `authentication/token.py:168-188`; `admin/user_session.py:28` | `validate_session` ignores `LOGGED_OUT`; `logout_all` does not blacklist outstanding refresh JTIs (asymmetric vs `revoke_all_for_user`); no rotation on privilege change; `cleanup` unscheduled; admin docstring/permission mismatch | Reject `LOGGED_OUT`; unify bulk revocation with blacklist sweep; schedule cleanup; reconcile admin gate |
| 18 | login attempts | PARTIAL | High | `models/login_attempt.py:37-48`; `api/viewsets/login_attempt.py:50-57`; `selectors/login_attempt.py:16-25`; `querysets/login_attempt.py:70-75`; `tasks/login_attempt.py:6-17` | Ledger fully mutable/deletable via API+admin; unscoped read of all users' telemetry; `locked_until` never written so `cleanup` is a no-op; `reason` has no choices | Make append-only; scope reads; fix retention key; add choices |
| 19 | login history | DEFECTIVE | High | `models/login_history.py:19`; `migrations/0006_…:40-42` (delete) vs `migrations/0011_…:205-379` (recreate); `services/login_history.py:15,35`; `admin/login_history.py:7` | Orphan duplicate: removed then recreated; only `apps.audit.LoginHistory` is written; identity model has admin+table but no writer; failures not recorded | Delete identity model/orphan admin (or make canonical and delegate); record failures |
| 20 | security events | DEFECTIVE | Critical/High | `models/security_event.py:60-69`; `api/viewsets/security_event.py:42-57`; `services/security_event.py:23-46`; `admin/security_event.py:7-37`; producers `services/authentication.py:169`, `services/user.py:108,156,211,270` | **Not append-only** — update/delete exposed via API + admin (tests assert mutability); no DB protection; missing core auth event producers (LOGIN_SUCCESS/FAILED/LOCKED) | Make write-once (remove update/destroy, admin read-only, service=create only) + DB guard; add login/lockout producers |
| 21 | IP blacklists | PARTIAL | High | `models/ip_blacklist.py:18-80`; `querysets/ip_blacklist.py:37-42`; `services/ip_blacklist.py:135-137`; `services/authentication.py:75-82`; `api/filtersets/ip_blacklist.py:1,77-86` | `network`/CIDR inert (exact-match only) — CIDR entries never block; enforced only at login (no request middleware); hit tracking never updated; tz-import bug in filterset | Implement CIDR containment or drop the column; add hits; consider middleware; fix tz import |
| 22 | known devices | MISSING (dead) | Medium | `models/known_device.py:9-78`; `admin/known_device.py:7-36`; no service/selector/serializer/route | Dead model (no non-admin consumer); near-duplicate of `TrustedDevice`; carried `is_trusted` alongside a dedicated trust model | Remove (approval A3), or merge into `TrustedDevice` |
| 23 | trusted devices | DEFECTIVE | High (latent) | `models/trusted_device.py:16-55`; `services/mfa/trusted_device.py:54-61,117-120,177-183`; `authentication/device.py:21,98-101`; `selectors/trusted_device.py:11-29` | `MFATrustedDeviceService` writes non-existent columns (`device_name`/`operating_system`/`trusted`/`revoked`/`last_used_at`) → guaranteed error if ever reached; two classes named `TrustedDeviceService`; device validation not wired into login; fingerprint helper trusts raw `X-Forwarded-For` | Align service to real columns (or extend model); rename duplicate class; wire/retire dead MFA paths; use `REMOTE_ADDR` helper |

**Status legend:** COMPLETE = implemented, wired, and tested; PARTIAL = exists but incomplete/unwired; MISSING = absent; DEFECTIVE = present but broken/unsafe.

---

## 2. Duplicated responsibilities (keep-separate vs merge)

| Pair | Verdict | Evidence |
|------|---------|----------|
| `KnownDevice` vs `TrustedDevice` | **Merge / remove `KnownDevice`** | Near-identical fields (`models/known_device.py:14-59` vs `models/trusted_device.py:10-55`); only `TrustedDevice` is wired. Independently flagged dead in the prior audit (`docs/10-security/IDENTITY_AUDIT_2026-10-20.md:69,563`) |
| `ApiKey` vs `PersonalAccessToken` | **Consolidate** (big refactor → approval A5) | Structurally identical models/authenticators/admin differing only in keyword (`Api-Key` vs `Token`) and principal FK; shared `APIKeyHasher` (`api_keys/hashing.py`) |
| `LoginAttempt` vs `LoginHistory` | **Keep, clarify** — attempts = all outcomes for lockout/telemetry; history = audit narrative. Fix: identity `LoginHistory` is a dead duplicate of `audit.LoginHistory` | `models/login_history.py:19` vs `apps/audit/models/login_history.py:29`; only audit model is written (`services/login_history.py:35`) |
| `UserSession` vs Django sessions (`django_session`) | **Keep, but document** — `UserSession.session_key` = refresh JTI, not Django's key; Django cookie session is created (`services/authentication.py:114`) but the DRF chain has no `SessionAuthentication` (`config/settings/components/drf.py:17-24`) | `authentication/token.py:61` |
| Custom RBAC (`identity.Group`/`identity.Permission`) vs Django auth `Group`/`Permission` | **Reconcile / remove latent Django tables** (approval A9) | `User` mixes in `PermissionsMixin` (`models/user.py:12`); migration `0001_initial.py:118-141` creates `groups`/`user_permissions`; nothing in the resolver/API reads them |
| Password change stacks: `PasswordService.change_password` vs `UserPasswordService.change_password` | **Unify** | `services/password.py:10-58` (verifies old password, no validators) vs `services/user_password.py:20-70` (validators, no old-password check) |
| MFA trees: `/identity/auth/mfa/*` vs `/identity/mfa/*` | **Collapse to one** | `api/urls.py:72-125`; legacy tree is session-cookie-only (`api/views/authentication/enroll_mfa.py:2,10`) |
| Lockout math: `services/mfa/lockout.py` vs inline in `services/mfa/verification.py` | **Unify** | `lockout.py:29-108`; `verification.py:121-195` |
| "Trusted device" third notion: `AuthenticationSelector.get_trusted_devices` returns `UserSession` rows | **Reconcile** | `selectors/authentication.py:124-133` |
| Bearer auth trees: `/auth/*` compat vs `/identity/*` legacy | **Keep `/auth/*`, demote legacy** | `config/v1_urls.py:22,29` |

---

## 3. Missing constraints, insecure behaviour, architecture violations

**Missing / weak constraints**
- No case-insensitive unique email; email not normalized on the API create path (`models/user.py:14-20`; `validators/user.py:24-26`; `core/services/crud.py:24-28` bypasses `full_clean`).
- RBAC `name`/`Group.name` not unique; `Role.code` also `db_index` + explicit index (redundant) (`models/role.py:17-24,95-101`).
- No index on `RolePermission.expires_at` (`resolvers/permission.py:104` filters on it).
- `SecurityEvent` / `LoginAttempt` have no DB-level append-only protection (`models/security_event.py:60-69`).

**Insecure behaviour**
- Soft-deleted User/Profile/UserPreference remain reachable; soft-deleted active user authenticates (`managers/user.py:12-18`, `managers/profile.py:8-12`, `managers/rbac.py:40-41`, `selectors/authentication.py:41`).
- Cross-user Profile creation via client-supplied `user` (`api/serializers/user_preference/create.py:20-23`, `api/viewsets/profile.py:68-71`).
- `old_password` accepted-but-unverified on `/identity/users/change_password/` (`api/viewsets/user.py:206-217`).
- TOTP secret plaintext at rest (`models/user_mfa.py:26-29`); OAuth provider `client_secret` and account tokens plaintext (`models/oauth_provider.py:25-27`, `models/oauth_account.py:32-40`).
- MFA never enforced at login; enablement unreachable (`services/authentication.py:60-142`; `services/mfa/facade.py:32`).
- Non-append-only security/audit ledgers (`api/viewsets/security_event.py:42-57`, `api/viewsets/login_attempt.py:50-57`).
- Credential hashing = unsalted `sha256(SECRET_KEY:secret)`, no pepper/KDF (`api_keys/hashing.py:14-26`); scopes decorative.
- User enumeration on login: distinct "inactive" vs "invalid" messages and inactive checked before password (no dummy hash) (`validators/authentication.py:167-186`; `authentication/exceptions.py:9-14`).
- Spoofable `X-Forwarded-For` in trusted-device fingerprinting (`authentication/device.py:98-101`).
- CIDR blacklist entries never block (`querysets/ip_blacklist.py:37-42`).
- Object-level permission is inert (`permissions/permission.py:63-75` always True); isolation relies solely on selector scoping.

**Architecture / structure violations**
- Profile/SecurityEvent/TrustedDevice serializers and filtersets live under `api/serializers/user_preference/` and `api/filtersets/user_preference.py` — misleading; real `UserPreference` has none (`api/serializers/user_preference/__init__.py`).
- No service layer for RBAC writes (ADR-0032 D4 references a `RoleService` that does not exist; `docs/adr/ADR-0032-backend-authorization-hardening.md:59-62`).
- No domain events/validators for RBAC; `SecurityEventType.ROLE_CHANGED`/`PERMISSION_CHANGED` defined but never emitted (`choices/security.py:29-30`).
- Stale org-scoped docstring in `UserViewSet` (`api/viewsets/user.py:61-66`); dead `MeAPIView`/`LogoutAllAPIView`/`LogoutOtherDevicesAPIView` implemented but unmounted.
- Soft-delete base managers shadowed by domain managers (`core/models/bases/soft_delete.py:40` vs `managers/user.py:12-18`).
- Tasks (`cleanup_login_attempts`, `cleanup_expired_trusted_devices`, `UserSessionService.cleanup`) exist but have no caller and no Celery beat schedule.

**Identity↔Organization:** no organization FK or import anywhere in `apps/identity/models` (verified); the hypothesized stale `User.organizations` property **does not exist** (`models/user.py` has no `organizations` member). Identity independence is preserved. `apps/organization` is not in `INSTALLED_APPS` and has no tracked source (removed in "B7").

---

## 4. Missing identity features (normally expected here)

| Feature | Present? | Evidence |
|---------|----------|----------|
| Email verification | No real flow (endpoint unmounted/stub) | prior audit F5; `api/urls_auth_compat.py` has only `/email/resend/` |
| Password reset (token system) | Absent | prior audit §4.6; no `PasswordResetToken` model |
| Password change + policy | Partial; policy divergent; old-password gap | `services/password.py`, `services/user_password.py`, `api/viewsets/user.py:206-217` |
| Lockout / unlock | Partial (username-only, non-persistent) | `validators/authentication.py:100-118`; `locked_until` never written |
| Email change | Absent | no endpoint/model |
| Invitations / activation | Absent | prior audit §4.2 |
| Deactivation / deletion | Partial; cascade now suspends credentials but soft-delete semantics broken | `services/user.py:172-225`; soft-delete gaps above |
| Refresh-token rotation + reuse detection | Present | `authentication/token.py:86-115` |
| Cleanup jobs (sessions/tokens/attempts) | Absent (tasks unscheduled/no-op) | `tasks/login_attempt.py:6-17`; `services/user_session.py:365-378` |
| MFA enrollment/verification/recovery | Present but broken/unenforced | area 14 |
| API keys/PAT lifecycle API | Absent | areas 11–12 |
| OAuth / SSO / LDAP | Absent runtime | areas 15–16 |
| Trusted-proxy client-IP config | Absent | only `SECURE_PROXY_SSL_HEADER` (`components/security.py:17-20`) |
| Trusted-device management wired to login | Partial/unwired | area 23 |
| Security-event producers for auth events | Partial | area 20 |

---

## 5. Test coverage & quality (per area)

**Identity total:** 97 test files, 720 passing tests (Phase 0 baseline). Global coverage 78.22% (threshold 72%).

| Area | Test files | Quality notes / gaps |
|------|-----------|----------------------|
| users | `models/test_user_models.py`, `managers`, `querysets`, `selectors`, `permissions`, `viewsets` (27+13+6), `serializers`, `admin`, `api/test_auth_security.py`, `services/test_admin_password_reset.py` | No soft-delete visibility test; no case-insensitive duplicate test; no `old_password` enforcement test on the viewset; most viewset tests use `force_authenticate` (`tests/fixtures.py:132-161`) |
| profiles | `models`, `managers`, `querysets`, `selectors`, `permissions` (14), `viewsets` (14), `serializers` (6) | A serializer test **asserts** cross-user create success (`test_profile_serializer_serializers.py:42-56`); no soft-delete visibility test |
| user preferences | None | No tests at all |
| roles/permissions/groups | `permissions/test_has_permission_gate.py` (18), `resolvers/test_grant_expiry.py` (2), `services/test_rbac_cache_invalidation.py` (2), `test_no_org_rbac.py` (1) | No `Role/Group/Permission` viewset CRUD/auth tests; no assignment tests (none exist); no escalation/last-admin tests; `GroupRole` audit untested; `left_at` untested |
| API keys / PATs | `api/test_credential_auth_account_state.py` (5), `services/test_deactivation_suspends_credentials.py` (2) | No create/rotate/revoke, expiry, scope, prefix-collision tests |
| backup codes | `models/test_backup_code_models.py` (9), `services/test_mfa_service_services.py` | No expiry, concurrency, regeneration-invalidation, or hashed-at-rest tests |
| user MFAs | `models/test_user_mfa_models.py` (10), `services/test_mfa_service_services.py` (8), `api/test_mfa_compat_smoke.py` (6), `api/test_mfa_config_secret_exposure.py` (1) | No HTTP activation test; no replay test; no login-with-MFA test; no encryption-at-rest test; `test_mfa_service` reaches ENABLED by calling `activate` directly |
| OAuth | `models/test_oauth_account_models.py` (11), `test_oauth_provider_models.py` (10) | Model-schema only; no flow/linking/secret-secrecy tests |
| sessions | `viewsets/test_user_session_viewset_viewsets.py` (13), `api/test_session_bound_jwt.py` (4), `test_logout_terminates_session.py` (2), `services/test_session_rolling_expiry.py` (2), `test_transactional_rotation.py` (1), `test_revoke_all_services.py` (3) | No dedicated model test; no refresh-after-logout-all rejection test; no bulk-blacklist test |
| login attempts / history / security events | `models`, `querysets`, `managers`, `selectors`, `permissions`, `viewsets` (14 each), `filtersets`, `serializers` | Tests **assert** update/delete succeed (locking in mutability); tautological model assertions (`test_login_attempt_models.py:59-66`); no identity `LoginHistory` tests |
| IP blacklists | `models` (8), `services` (5, mock-only), `selectors` (6), `viewsets` (14), `permissions` (16), `filtersets`, `validators/test_ip_address_validator_validators.py` (4) | No CIDR enforcement test; no login-time expiry test; no hit-tracking test |
| known/trusted devices | `models` (10, 12), `selectors` (7), `viewsets` (16), `permissions` (16), `api/test_trusted_device_revoke.py` (5), `security/test_client_ip_extraction.py` (3) | No register/validate/touch/cookie tests (the field-mismatch defect is uncovered); viewset tests POST ignored `device_name` |

**Cross-cutting test-quality issues:** heavy `force_authenticate` usage on viewsets (real JWT flow only in the auth-focused suites); no time-freezing library installed (`freezegun`/`time-machine` absent — window/expiry tested by manual backdating); assertions that pin insecure behaviour (mutable ledgers, cross-user profile create).

**UNVERIFIED items requiring later confirmation:** runtime behaviour of the `MFATrustedDeviceService` field mismatch (reasoned statically — the code path is currently unreachable); whether any external/non-repo consumer calls the legacy `/identity/*` tree or `/api/organizations/projects/...` prefix.

---

## 6. Open Questions

1. **A1 — MFA/TOTP secret encryption mechanism:** no standalone `cryptography` package is installed; options are (a) Django `signing`/`SECRET_KEY`-derived key, (b) add `cryptography` (Fernet) with a dedicated env key. Which? Key-rotation plan?
2. **A2 — `UserPreference`:** wire a full vertical, or delete the model and use `Profile.preferences`?
3. **A3 — `KnownDevice`:** delete, or merge into `TrustedDevice`?
4. **A4 — identity `LoginHistory`:** delete the orphan (canonical = `apps.audit.LoginHistory`), or make it canonical and have the audit app delegate?
5. **A5 — Credential consolidation:** merge `ApiKey`+`PersonalAccessToken` into one model (large refactor, API-contract impact), or keep both tables and share one service/serializer set?
6. **A6 — Credential hashing:** adopt `HMAC-SHA256(dedicated pepper)` with lazy rehash-on-use? This requires ops coordination for the pepper env var and a `SECRET_KEY`-rotation policy.
7. **A7 — OAuth:** build the full flow, or deprecate/remove `OAuthAccount`+`OAuthProvider`?
8. **A8 — SMS/email MFA:** implement real channels (needs a provider + dependency approval) or remove the stub endpoints?
9. **A9 — Django auth `Group`/`Permission`:** remove the `PermissionsMixin` M2M shadow RBAC, or keep and document as unused?
10. **A10 — Password reset / email verification:** implement the token system (new model + email delivery) in this effort, or unmount the endpoints until a later phase?
11. **A11 — Security/audit immutability:** is API+admin read-only sufficient, or is a DB-level guard (trigger / constraints) required? (Portability vs. guarantee.)
12. **A12 — Tooling gates (carried from Phase 0):** type checker (basedpyright vs none), formatter (`ruff format` has 510 pre-existing failures), `pip-audit`/`bandit` adoption, and a time-freezing test utility.
13. **A13 — Identity coverage threshold** to meet at Phase 8 (Definition of Done requires an agreed value).
14. **A14 — Trusted proxy configuration** for client IP (needed for IP controls and trusted devices).
15. **A15 — Scope of the frontend contract:** the SPA only calls `/api/v1/auth/*`; do the legacy `/identity/*` and RBAC assignment endpoints need to preserve any existing external contract?

---

## 7. Untouched / verified-clean

- `apply_migrations`/settings were not modified; `uv run python manage.py check` and `makemigrations --check --dry-run` passed in Phase 0 (`0 issues`, `No changes detected`).
- No secret values were read or printed. `.env*` files were not read.
- No tests were executed in Phase 1 (documentation-only phase).
