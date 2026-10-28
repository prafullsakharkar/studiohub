# StudioHub Identity — Domain & Security Contracts (Phase 2)

**Date:** 2026-10-22
**Status:** Approved 2026-10-22. Recommendations A1–A15 were adopted in writing; implementation proceeds by work package.
**Authority:** Supersedes ad-hoc behaviour for the Identity module once each section is implemented. Until a section is implemented, the **Current** column describes production behaviour and the **Target** column is a specification, not a claim.
**Companions:** `docs/identity/AUDIT.md` (evidence), `docs/identity/PLAN.md` (work packages). Work-package IDs (`WP 3.1`, `5.2`, …) refer to `PLAN.md`.
**Change control:** any change to an `API-*` contract requires a contract review and an update to this document; any change to a `SEC-*` or `DOM-*` invariant requires an ADR if it alters the trust model.

---

## 0. Reading conventions

| Label | Meaning |
|---|---|
| **CURRENT** | Verified in source at the cited `path:line`. |
| **TARGET** | Required behaviour; not yet implemented unless the row says otherwise. |
| **DECIDED** | Recommended decision recorded in §10; requires written sign-off before the dependent WP starts. |
| **UNVERIFIED** | Not confirmable statically. |

Every contract has a stable ID so tests, PRs, and review comments can reference it (`SEC-AUTH-03`, `API-AUTH-01`, …).

---

## 1. Scope and trust model

### 1.1 What Identity owns

Identity owns: `User`, `Profile`, `UserPreference`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Group`, `GroupMember`, `GroupRole`, `UserSession`, `LoginAttempt`, `Identity.LoginHistory` (orphan — to be resolved), `SecurityEvent`, `IPBlacklist`, `KnownDevice` (dead — to be removed), `TrustedDevice`, `UserMFA`, `BackupCode`, `ApiKey`, `PersonalAccessToken`, `OAuthProvider`, `OAuthAccount`.

### 1.2 What Identity does not own

- Project/show membership and production authorization — owned by `apps.production` (`ProjectMembership`), consumed by the frontend user payload (`api/serializers/frontend_user.py:150-190`).
- The audit ledger — `apps.audit` owns `LoginHistory`, `AuditLog`, `ErrorLog` (`selectors/authentication.py:5,22-27`).
- Organization/tenant data — **there is no organization domain in the runtime**: `apps/organization` is not in `INSTALLED_APPS` and has no tracked source; Identity has **no organization FK or import** (verified: `grep -rn "organizations" apps/identity/models` returns nothing).

### 1.3 Trust boundary

```
Untrusted client
   │  HTTPS (Bearer JWT / PAT / Api-Key)
   ▼
Django + DRF  ──► authentication chain (§4.1)
   │
   ▼
Identity API (permission classes + declarative permission_map)
   │
   ▼
Identity service ──► selector ──► ORM
   │
   ▼
PostgreSQL / SQLite(test)
```

- No client-supplied identity, role, scope, or tenant identifier is ever trusted.
- `request.user` is the only authorization principal.
- The frontend never receives a secret it does not need (§4.5).

### 1.4 Organization-boundary note (ADR required)

`AGENTS.md` describes organization as the fundamental security boundary. The implemented system is **platform-global**: RBAC resolves globally (`resolvers/permission.py:20-24`), and project scope is enforced separately by `apps.production` membership selectors. This is an existing architectural decision, not a new one. **Contract DEP-04** records it. A short ADR is required to reconcile `AGENTS.md` with runtime (proposed: "Identity and RBAC are platform-global; production access is project-scoped"). This ADR is not created in Phase 2 and is listed as an open item.

---

## 2. Domain contracts

### 2.1 Aggregate map

```
User 1──1 Profile            (Profile owns must_change_password + preferences JSON)
User 1──1 UserPreference*    (*dead — decision A2)
User 1──1 UserMFA 1──* BackupCode
User 1──* UserRole *──1 Role *──* Permission (through RolePermission)
User 1──* GroupMember *──1 Group *──* Role       (through GroupRole)
User 1──* UserSession
User 1──* LoginAttempt
User 1──* SecurityEvent
User 1──* TrustedDevice
User 1──* ApiKey | PersonalAccessToken
User 1──* OAuthAccount *──1 OAuthProvider
```

All models derive from `apps.core.models.EntityModel` → UUID PK + `created_at`/`updated_at` + `created_by`/`updated_by`/`deleted_by` + `is_deleted`/`deleted_at` (see `apps/core/models/bases/`). Soft deletion is the default lifecycle.

### 2.2 Account state machine — `User`

**CURRENT.** `User.is_active`, `is_staff`, `is_email_verified`, and `is_deleted` are independent booleans (`models/user.py:22-34`, `core/models/bases/soft_delete.py`).

**TARGET — DOM-USER-01.** An account is *usable* iff `is_active == True and is_deleted == False`. Every authenticator and every default queryset must enforce usability.

```
created ──activate──► active ──deactivate──► inactive
   │                    │                     │
   │                    └──soft-delete──► deleted
   └──invite/verify──► active (is_email_verified=True)
```

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-USER-01 | Usable ⇔ `is_active ∧ ¬is_deleted` | Manager/queryset default filter + all authenticators (WP 3.1) |
| DOM-USER-02 | `email` is case-insensitively unique | DB `UniqueConstraint(Lower("email"))` + service normalization (WP 3.2) |
| DOM-USER-03 | Deactivation immediately revokes sessions, refresh tokens, PAT/ApiKey, OAuth sessions | `deactivate` service + cascade (WP 5.3) |
| DOM-USER-04 | Soft delete is reversible; a soft-deleted unique identifier can be restored, not duplicated | `restore` service (existing pattern) |
| DOM-USER-05 | `is_superuser`/`is_staff` are never client-writable on self-service endpoints | serializers (CURRENT partly: `MePatchSerializer` excludes them) |

### 2.3 Profile & preferences

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-PRO-01 | Exactly one `Profile` per `User` (OneToOne, `models/profile.py:18-22`) | DB |
| DOM-PRO-02 | A user may create/update only their own profile through self-service; creating for another user requires `identity.profile.create` | Serializer + permission (WP 3.4) |
| DOM-PRO-03 | `must_change_password` lives on `Profile` (`models/profile.py:82-85`) and is cleared only by a successful password change; until then the session is restricted (SEC-AUTH-06) | `PasswordService` (WP 3.3), `authentication/restrictions.py` |
| DOM-PWD-01 | One password policy (`validators/password.py`): 12 to 128 characters (`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`), upper, lower and digit, Django's similarity/common/numeric validators; no password equal to the current one or any of the last `PASSWORD_HISTORY_COUNT` (5), kept as hashes in `PasswordHistory` | `PasswordService` (TM-007) |
| DOM-PRF-01 | **DECIDED A2:** `UserPreference` is removed; `Profile.preferences` is the single preference store | Migration + API (WP 3.6) |
| DOM-PRF-02 | Preferences are self-scoped and never expose another user's settings | selector scoping |

> Note: `UserPreference` currently has fields that overlap `Profile` (`language`, `timezone`) and no consumer (`AUDIT.md` area 3). `Profile.preferences` is already a JSONField (`models/profile.py:77-80`) and is accepted by `PATCH /auth/me/` (`api/serializers/frontend_user.py:38-52`). Keeping both is the duplication; deleting `UserPreference` is the smaller, safer consolidation.

### 2.4 RBAC

```
User ──UserRole──► Role ──RolePermission──► Permission
User ──GroupMember──► Group ──GroupRole──► Role
```

**TARGET — DOM-RBAC-01.** Effective permission set = union over direct roles and live group roles, restricted to:

1. usable user (`is_active ∧ ¬is_deleted`),
2. `UserRole.is_deleted = False`,
3. `GroupMember.is_deleted = False` **and `left_at IS NULL`**,
4. `GroupRole.is_deleted = False`,
5. role `is_deleted = False ∧ is_active = True`,
6. `RolePermission.granted = True ∧ is_deleted = False`,
7. `expires_at IS NULL OR expires_at > now()`,
8. permission `is_deleted = False ∧ is_active = True`.

The contract is **fail-closed**: any uncertainty yields the empty set. The current resolver satisfies all but (3) — `left_at` is ignored (`resolvers/permission.py:80-84`; confirmed).

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-RBAC-01 | Resolver rules 1–8 above | `PermissionResolver` (WP 4.4) |
| DOM-RBAC-02 | `Role.name` and `Group.name` are unique | DB constraint (WP 4.5) |
| DOM-RBAC-03 | `code` and `is_system` are immutable after creation; system rows cannot be deleted | Serializer read-only + service guard (WP 4.3) |
| DOM-RBAC-04 | A grant cannot exceed the grantor's effective permissions | Assignment service (WP 4.2) |
| DOM-RBAC-05 | The last user holding an administrative permission cannot be demoted/deleted | Service guard (WP 4.2) |
| DOM-RBAC-06 | Every grant/revoke/assign/membership change emits a `SecurityEvent` and invalidates the permission cache synchronously | Signals + service (WPs 4.1, 4.4, 4.6) |
| DOM-RBAC-07 | `RolePermission.granted_by` is populated from the authenticated actor | Service (WP 4.5) |
| DOM-RBAC-08 | Deleting assignments invalidates cache even for bulk `QuerySet.delete()` | Signal/override (WP 4.4) |

### 2.5 Credentials (API keys, PATs)

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-CRED-01 | The plaintext secret exists only in the create/rotate response and is never retrievable again | Serializer (WP 7.2) |
| DOM-CRED-02 | Only a one-way digest (`v2$` HMAC-SHA256 with `API_KEY_PEPPER`) is stored; lookup uses a non-secret prefix; constant-time compare; legacy digests upgraded on use | Model + hasher (`api_keys/hashing.py`, `api_keys/resolver.py`) |
| DOM-CRED-03 | A credential is usable iff `is_active ∧ (expires_at IS NULL ∨ expires_at > now()) ∧ owner usable` | Authenticator (CURRENT owner-active check added; WP 7.5) |
| DOM-CRED-04 | Effective scopes = `owner_permissions ∩ credential.scopes`. **Documented exception:** a *legacy* credential with no scopes keeps its owner's full access; new credentials must have ≥1 scope. Non-permission labels grant nothing. A scoped credential never receives the superuser bypass beyond its scopes (ADR-0036) | `HasPermission` (WP 7.3) |
| DOM-CRED-05 | A scoped credential reaches only endpoints that apply scopes. (1) An action open to every signed-in user (empty `permission_map` tuple) is refused unless the view lists it in `credential_open_actions` (`users/me`, the master-data catalogs, feature flags). (2) A view whose permission classes do not enforce scopes (attachments, tags, analytics, …) is refused with `403 {"code": "credential_scope_not_applicable"}` unless it sets `credential_open`. Legacy unscoped credentials are unchanged (TM-013) | `HasPermission._open_action_allowed`, `permissions/scopes.gate_scoped_credential` (both authenticators) |
| DOM-CRED-05 | Revocation is immediate and idempotent | Service (WP 7.2) |
| DOM-CRED-06 | **DECIDED A5:** one service/serializer/API over both tables; no physical merge in MVP | WP 7.1 |

### 2.6 Sessions and tokens

```
login ──► UserSession(ACTIVE) ──► JWT(access 30m, refresh 30d)
             │                        │
             ├─ refresh rotate ───────┤ (old refresh blacklisted)
             ├─ logout ──► LOGGED_OUT │ (refresh blacklisted)
             └─ revoke ──► REVOKED    │ (all refresh JTIs blacklisted)
```

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-SES-01 | Every issued JWT is bound to a `UserSession`; requests are rejected when the session is not `ACTIVE` | `SessionBoundJWTAuthentication` (CURRENT; missing `LOGGED_OUT` rejection → WP 5.2) |
| DOM-SES-02 | Refresh rotation blacklists the presented token and detects reuse | `authentication/token.py:86-115` (CURRENT) |
| DOM-SES-03 | Logout and `logout_all` are symmetric: they mark sessions and blacklist every outstanding refresh JTI | WP 5.2 |
| DOM-SES-04 | Privilege change reaches live sessions on the next request (permissions are resolved server-side, never baked into tokens); sessions are not terminated | WP 5.12 (done by design) |
| DOM-SES-06 | A rotated refresh token presented again revokes its session and records `SUSPICIOUS_ACTIVITY` (refresh tokens carry a stable `sid`) | Phase 5 |
| DOM-SES-05 | Absolute session lifetime is bounded (`SESSION_MAX_ABSOLUTE_LIFETIME_DAYS = 90`, `config/settings/components/jwt.py:3`) | Service (CURRENT) |
| DOM-SES-06 | Expired sessions/attempts are cleaned by a scheduled job | WP 5.10 |

### 2.7 MFA

```
DISABLED ──enroll──► PENDING (secret generated, not confirmed)
PENDING  ──verify valid code──► ENABLED (confirmed_at set, recovery codes issued)
ENABLED  ──disable (auth + code)──► DISABLED
ENABLED  ──locked (N failures)──► LOCKED (until locked_until)
```

**TARGET — DOM-MFA-01.** A user is authenticated only after the full chain: password → second factor (when enabled or required by policy) → session/tokens. Password alone must never yield a usable session for an MFA-enabled user.

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-MFA-01 | `PENDING` is fully unauthenticated; `ENABLED` (and a legacy `LOCKED`) require the factor; a lockout never relaxes it | `AuthenticationService._mfa_state` (WP 6.2) |
| DOM-MFA-02 | A TOTP secret is never returned after enrollment | API (WP 6.1) |
| DOM-MFA-03 | A TOTP secret is encrypted at rest and decryption fails closed (`EncryptedSecretField`, `apps/identity/crypto.py`; implemented Phase 6) | Model field (WP 6.3) |
| DOM-MFA-04 | A time step can be consumed once per user (replay prevention) | Service (WP 6.4) |
| DOM-MFA-05 | `MFA_MAX_FAILED_ATTEMPTS=5`, `MFA_LOCKOUT_MINUTES=15` are enforced with a single lockout implementation | `services/mfa/lockout.py` (WP 6.4) |
| DOM-MFA-06 | Backup codes are single-use, hashed, expiring, and atomically consumed | Service/queryset (WP 6.5) |
| DOM-MFA-07 | Enrollment is reachable over HTTP and activation requires a valid code | API (WP 6.1) |
| DOM-MFA-08 | MFA is required of superusers, staff, external (vendor/client) project members (`MFA_REQUIRE_EXTERNAL`, default on) and, when `MFA_REQUIRE_ALL` is set, everyone. A required user without a factor holds a restricted session (SEC-AUTH-06), not a full one | `MFAPolicyService.is_required`, `authentication/restrictions.py` (TM-007) |

### 2.8 Devices

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-DEV-01 | A trusted device is owned by exactly one user and is scoped to that user's MFA challenges | Service (WP 5.9) |
| DOM-DEV-02 | Revocation is owner-scoped and immediate | CURRENT `api/views/authentication/trusted_device.py:37-49` |
| DOM-DEV-03 | Device fingerprinting uses a server-trusted client IP, never raw `X-Forwarded-For` | WP 5.9/5.11 |
| DOM-DEV-04 | **DECIDED A3:** `KnownDevice` is removed; `TrustedDevice` is canonical | WP 5.13 |

### 2.9 Audit, attempts, IP controls

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-AUD-01 | `SecurityEvent` is append-only: no update/delete via API, admin, or service | WPs 5.4, 8.4 |
| DOM-AUD-02 | `LoginAttempt` is append-only; failures and successes are recorded | WP 5.4 |
| DOM-AUD-03 | `SecurityEvent` is written for every authentication-state transition (§6) | WP 5.6 |
| DOM-AUD-04 | **DECIDED A4:** the canonical login-history ledger is `apps.audit.LoginHistory`; the identity duplicate is removed | WP 5.7 |
| DOM-AUD-05 | An `IPBlacklist` entry blocks by CIDR containment when `network` is set, and by exact address otherwise | WP 5.8 |
| DOM-AUD-06 | Block hits update `hit_count`/`last_hit_at`; expiry is honoured (`expires_at > now()`) | WP 5.8 |

### 2.10 OAuth

| ID | Invariant | Enforcement |
|---|---|---|
| DOM-OAUTH-01 | **DECIDED A7, implemented:** OAuth is out of MVP and its models/admin are removed (migration `0021`, refuses to drop non-empty tables). Re-introducing OAuth needs a complete, tested flow (single-use `state`, `nonce`, redirect allow-list, verified-email gate, encrypted secrets) and a new ADR. | WP 7.7 |
| DOM-OAUTH-02 | Provider `client_secret` and account tokens are never stored in plaintext | WP 7.8 |

---

## 3. Security contracts

### 3.1 Authentication chain

**SEC-AUTH-01 (CURRENT, frozen).** DRF tries authenticators in this order (`config/settings/components/drf.py:17-24`):

1. `SessionBoundJWTAuthentication` (Bearer JWT)
2. `PersonalAccessTokenAuthentication` (Bearer PAT)
3. `APIKeyAuthentication` (`Api-Key` header)

**SEC-AUTH-02.** An authenticator returns a principal **only if the owner is usable** (§2.2). It must not return a user whose `is_active` is false or `is_deleted` is true.

**SEC-AUTH-03.** Authentication failures are `401` with a generic message; authorization failures are `403`. The exception handler normalises DRF's 403-to-401 coercion (`apps/core/api/exceptions/handlers.py:328-345`).

**SEC-AUTH-06 (TM-007, ADR-0038).** A session that still owes something is *restricted*. `SessionBoundJWTAuthentication` raises `403 {"detail", "code"}` for every endpoint except the ones that settle the debt, plus `auth/me` and `logout`:

| Code | Owed when | Reachable meanwhile |
|---|---|---|
| `password_change_required` | the token carries `must_change_password` (admin reset, bootstrapped account) | `auth/change-password`, `password/change` |
| `mfa_enrollment_required` | policy requires MFA of the user and no factor is enabled | `mfa/config`, `mfa/totp/{setup,enable,verify}`, `mfa/recovery-codes*`, `auth/mfa/{enroll,verify,recovery*}` |

The password is settled first when both are owed. PATs and API keys are not sessions and are not restricted.

**SEC-AUTH-04.** Public auth endpoints (`login`, `refresh`, `forgot-password`, `resend-verification`) disable authentication and use scoped throttling (`api/views/auth_compat.py:48-52`).

### 3.2 Login

| ID | Contract |
|---|---|
| SEC-LOGIN-01 | The response for unknown email, inactive user, and wrong password is identical (status and body), and the work factor is comparable (dummy hash) — WP 5.1 |
| SEC-LOGIN-02 | Repeated failures lock the account for a bounded window; `locked_until` is persisted — WP 5.5 |
| SEC-LOGIN-03 | A successful login creates a `UserSession`, records a `SecurityEvent(LOGIN_SUCCESS)` and a `LoginAttempt(success=True)` — WP 5.6 |
| SEC-LOGIN-04 | An MFA-enabled user's password-only login yields **no** tokens and **no** active session; it yields a short-lived pre-auth challenge — WP 6.2 |
| SEC-LOGIN-05 | Login honours IP blacklists (exact + CIDR) before password verification — WP 5.8 |
| SEC-LOGIN-06 | Throttle: `login` 30/min per client; `refresh` 60/min (`drf.py:38-41`). Throttle failure is fail-closed when the cache is unavailable (`ResilientScopedRateThrottle`). Authenticated endpoints that verify a password or second factor (change password, MFA enroll/verify/disable/recovery, credential issuing) use scope `sensitive`, 20/min per user, fail-closed (Phase 8). |

### 3.3 Authorization

**SEC-AUTHZ-01.** Every Identity viewset uses `IsAuthenticatedPermission` + `HasPermission` (`api/viewsets/base.py:21-24`); `permission_map` is mandatory per action. A missing map entry denies.

**SEC-AUTHZ-02.** Permission codes follow `identity.<resource>.<action>` (`constants/permissions.py:6-76`).

**SEC-AUTHZ-03.** Object access is limited by the selector's queryset, not by trust in URL IDs. `HasObjectPermission` currently returns `True` unconditionally (`permissions/permission.py:63-75`); therefore every selector must be self-scoped or explicitly filter by owner. This is a **current weakness**; target: object checks implemented per resource (WP 3.4/7.2).

**SEC-AUTHZ-04.** Superusers do not bypass the resolver inside services; the break-glass path is confined to `serialize_frontend_user` (`api/serializers/frontend_user.py:118-133`) and is documented as a presentation fallback, not an authorization decision. **TARGET:** remove the fabricated permission list; superusers receive permissions through an explicit system role.

**SEC-AUTHZ-05.** Denials are logged with `event=permission_denied` and never leak the permission inventory.

**SEC-AUTHZ-06 (TM-022).** A user-administration permission says what an actor may do, not to whom. Acting on another user (update, delete, activate, deactivate, archive, restore, suspend, change or reset password, force password change, revoke sessions) needs the target not to outrank the actor: only a superuser may act on a superuser, and nobody may act on a user who holds permissions they lack (the same principle as the RBAC grant guard). Enforced in `UserViewSet.get_object` via `UserAdministrationGuard`.

**SEC-AUTHZ-07 (TM-022).** `is_staff` widens what a user sees (the whole directory) and who can reach the admin site, so only a superuser grants or removes it, on create or update. Setting `is_active` through a plain update needs the activate or deactivate permission, as the dedicated actions do.

**SEC-AUTHZ-08 (TM-018).** Who holds a role or belongs to a group is user data: `GET roles/<id>/users/` needs `identity.role.view` and `GET groups/<id>/members/` needs `identity.group.view`. The role, group and permission lists and their other sub-lists are shared reference data and stay open.

### 3.4 Multi-tenancy / isolation

**SEC-ISO-01.** Identity data is platform-global; no request field may select another tenant (there is no tenant). Project-scoped data remains guarded by `apps.production` selectors — Identity must not weaken them.

**SEC-ISO-02.** A user may read/revoke only their own sessions, trusted devices, backup codes, MFA, and credentials; administrative access requires the corresponding `identity.*` permission and is still selector-scoped.

### 3.5 Secrets at rest and in transit

| ID | Secret | Contract |
|---|---|---|
| SEC-SEC-01 | Password | Django hasher (Argon2 first if configured by `PASSWORD_HASHERS`); never logged or serialized |
| SEC-SEC-02 | TOTP secret | Encrypted at rest; decrypted only in memory during verification; never returned after enrollment (WP 6.3). **Operator exception:** `MFA_ENCRYPTION_ENABLED=false` stores new secrets in plaintext (default on; `identity.W003` warns). Re-enable with `manage.py mfa_encrypt_secrets` |
| SEC-SEC-03 | TOTP provisioning URI / QR | Returned only at enrollment; not logged |
| SEC-SEC-04 | API key / PAT secret | Digest only; plaintext shown once; prefix is non-secret |
| SEC-SEC-05 | Backup codes | Hashed; shown once; never retrievable |
| SEC-SEC-06 | OAuth provider/account tokens | Encrypted at rest if OAuth is retained (WP 7.8) |
| SEC-SEC-07 | JWT signing key | From settings/env; never logged; rotation invalidates outstanding tokens by design |
| SEC-SEC-08 | Logs | Passwords, tokens, secrets, full authorization headers are redacted; `SecurityEvent.metadata` must not carry secrets |
| SEC-SEC-09 | Error responses | Never echo a secret or a stack trace (`handlers.py:322-326`) |

**SEC-SEC-10 (dependency gate).** Encryption requires an approved crypto dependency. **DECIDED A1:** use `cryptography` (Fernet/AES-GCM) with a dedicated key supplied via env; **adding this dependency required written approval, given 2026-10-22; `cryptography` 50.0.2 is installed.** Implemented in WP 6.3. Operational: set `MFA_ENCRYPTION_KEY` (Fernet key) before deploying migration `0019`; losing the key makes existing MFA secrets unrecoverable, so back it up with the other secrets. Rotate by prepending a new key to the comma-separated list; drop the old key only after no row needs it.

### 3.6 Token and session lifecycle

**SEC-TOK-01.** Access lifetime 30 min; refresh 30 days; rotation on refresh; blacklist after rotation (`jwt.py:5-11`).

**SEC-TOK-02.** A refresh token presented after rotation is rejected and revokes the session family (reuse detection).

**SEC-TOK-03.** Logout is idempotent; a second logout returns success without revealing session existence.

**SEC-TOK-04.** Password change/reset revokes every session and refresh token (CURRENT `services/password.py:39-58`; viewset path WP 3.3).

### 3.7 Anti-enumeration, throttling, lockout

| ID | Contract |
|---|---|
| SEC-ENUM-01 | Login, forgot-password, and resend-verification return the same response for known and unknown emails |
| SEC-ENUM-02 | Registration (if added) does not disclose whether an email exists |
| SEC-ENUM-03 | User-list filters/search never reveal existence outside the caller's permitted scope |
| SEC-THROTTLE-01 | `login`/`refresh` throttles are scoped and fail closed on cache outage |
| SEC-THROTTLE-02 | Authenticated endpoints may add scopes; absence of a scope means no rate limit (documented, not accidental) |
| SEC-LOCK-01 | Account lockout is per account, not per IP, and is recorded (`LOGIN_LOCKED`/`ACCOUNT_LOCKED`) |

### 3.8 Audit immutability

**SEC-AUD-01.** Security-relevant ledgers (`SecurityEvent`, `LoginAttempt`) accept create only. Read is permitted to holders of `identity.security_event.view` / `identity.login_attempt.view`; update/delete is forbidden at the API, admin, and service layers (WP 5.4). **DECIDED A11:** application-level enforcement is the MVP; a database trigger is optional and must remain PostgreSQL-portable (documented, not required).

**SEC-AUD-02.** Audit writes are best-effort and must never fail the primary operation (except when the operation itself is the audit record).

**SEC-AUD-03.** Audit records contain actor, action, target, result, client IP, user agent, and a non-secret metadata map.

### 3.9 Client IP and proxy trust

**SEC-IP-01.** The canonical client IP is `REMOTE_ADDR` unless a trusted-proxy allowlist/count is configured (WP 5.11).

**SEC-IP-02.** `X-Forwarded-For` is parsed only from trusted proxies and only the entry added by the outermost trusted proxy is used.

**SEC-IP-04 (implemented Phase 5).** `TRUSTED_PROXY_IPS` (comma-separated IPs/CIDRs, default empty) is the only way `X-Forwarded-For` is honoured; every call site uses `apps.core.utils.client_ip`.

**SEC-IP-03.** The current login/lockout path already uses `REMOTE_ADDR` (`authentication/utils.py:16-24`); trusted-device fingerprinting still reads raw `X-Forwarded-For` (`authentication/device.py:98-101`) and must be fixed (WP 5.9).

### 3.10 Deactivation cascade

**SEC-DEACT-01.** Deactivating a user, in one transaction, must: set `is_active=False`, terminate active sessions, blacklist outstanding refresh tokens, deactivate PAT/ApiKey, and emit `ACCOUNT_DEACTIVATED`. A partially completed cascade must roll back.

---

## 4. API contracts

### 4.1 Global conventions

| ID | Convention |
|---|---|
| API-GEN-01 | Base path `/api/v1/`; Identity at `/api/v1/identity/`; RBAC at `/api/v1/{roles,groups,permissions}/`; SPA auth at `/api/v1/auth/`. |
| API-GEN-02 | JSON only (`application/json`); UTF-8; ISO-8601 UTC timestamps; UUID strings for IDs. |
| API-GEN-03 | Authentication: `Authorization: Bearer <jwt|pat>` or `Api-Key: <key>`. |
| API-GEN-04 | Pagination: `?page=&page_size=` (aliases `limit`); response envelope `{count,next,previous,results}` (`apps/core/api/pagination/base.py:10-40`). Default page size 20 (`drf.py:13`), max 500. |
| API-GEN-05 | Filtering/search/ordering via query params (`django-filter`, `SearchFilter`, `OrderingFilter`, `drf.py:7-11`). |
| API-GEN-06 | Errors are **flat DRF bodies** (`{"detail": ...}` or field maps) plus an additive `{"error":{"code","request_id"}}` and `X-Request-ID` header (`handlers.py:4-15,349-376`). |
| API-GEN-07 | Status codes: 200/201/204 success; 400 validation; 401 unauthenticated; 403 forbidden; 404 not found; 405 method; 409 conflict; 429 throttled; 500 internal. |
| API-GEN-08 | Destructive operations are explicit actions (`POST .../deactivate/`), never inferred from `PATCH`. |
| API-GEN-09 | Bulk endpoints return per-record results and never partially apply a transaction unless documented. |
| API-GEN-10 | No endpoint returns a secret after its one-time display. |

### 4.2 Frozen SPA contract — `/api/v1/auth/*`

These shapes are consumed by the frontend and **must not change** without a contract review (`api/views/auth_compat.py:1-16`).

| ID | Method & path | Request | Response |
|---|---|---|---|
| API-AUTH-01 | `POST /auth/login/` | `{email, password}` (accepts `username` alias) | `200 {"tokens":{"access","refresh"},"user":FrontendUser}` |
| API-AUTH-02 | `POST /auth/refresh/` | `{refresh}` | `200 {"access","refresh"}` (rotated) |
| API-AUTH-03 | `POST /auth/logout/` | `{refresh?}` | `200 {"detail"}` |
| API-AUTH-04 | `GET /auth/me/` | — | `200 FrontendUser` |
| API-AUTH-05 | `PATCH /auth/me/` | writable Profile fields | `200 FrontendUser` |
| API-AUTH-06 | `POST /auth/change-password/` | `{old_password,new_password,...}` | `200 {"detail"}`; all sessions revoked |

`FrontendUser` fields (`api/serializers/frontend_user.py:186-200`): `id,email,first_name,last_name,full_name,avatar_url,role,permissions[],project_memberships[],is_active,is_staff,is_superuser,created_at,updated_at`.

### 4.3 Identity admin tree — `/api/v1/identity/*`

**CURRENT** (mounted via `api/urls.py` + `api/routers.py`): users, profiles, sessions, trusted devices, security events, login attempts, IP blacklist, plus the two MFA trees and the legacy auth aliases.

| ID | Resource | Contract |
|---|---|---|
| API-ID-01 | `/identity/users/` | CRUD + `activate/deactivate/archive/restore`; writes require `identity.user.*`; self-service fields restricted |
| API-ID-02 | `/identity/profiles/` | CRUD; create for another user requires `identity.profile.create` (WP 3.4) |
| API-ID-03 | `/identity/sessions/` | list/retrieve/revoke; self-scoped; admin requires permission |
| API-ID-04 | `/identity/trusted-devices/` | list, retrieve, revoke (DELETE = soft revoke); owner-scoped. **No create or update** (implemented Phase 5): trust is minted only by the MFA flow |
| API-ID-05 | `/identity/security-events/` | **read + create only**; no update/delete (WP 5.4) |
| API-ID-06 | `/identity/login-attempts/` | **read + create only**; scoped (WP 5.4/5.5) |
| API-ID-07 | `/identity/ip-blacklist/` | CRUD + `activate/deactivate`; CIDR semantics (WP 5.8) |

### 4.4 RBAC tree — `/api/v1/{roles,groups,permissions}/`

| ID | Endpoint | Contract |
|---|---|---|
| API-RBAC-01 | `roles/` | CRUD; `code`/`is_system` read-only; system rows protected |
| API-RBAC-02 | `roles/{id}/permissions/` **(new)** | `GET` list, `POST {permission_id, expires_at?}` grant, `DELETE {permission_id}` revoke (WP 4.1) |
| API-RBAC-03 | `roles/{id}/users/` **(new)** | `GET` list, `POST {user_id}` assign, `DELETE {user_id}` unassign (WP 4.1) |
| API-RBAC-04 | `groups/` | CRUD; `is_system` read-only |
| API-RBAC-05 | `groups/{id}/members/` **(new)** | add/remove; removal sets `left_at` (WP 4.1) |
| API-RBAC-06 | `groups/{id}/roles/` **(new)** | attach/detach (WP 4.1) |
| API-RBAC-07 | `permissions/` | CRUD; system catalog protected |
| API-RBAC-08 | All RBAC writes | escalation guards + `SecurityEvent` (WPs 4.2, 4.6) |

### 4.5 MFA contract

Two trees currently exist (`api/urls.py:72-125`). **TARGET — API-MFA-00:** one canonical tree; the legacy tree is deprecated after migration.

| ID | Method & path | Contract |
|---|---|---|
| API-MFA-01 | `POST /auth/mfa/enroll/` | returns `{secret, provisioning_uri, qr?}` once; state `PENDING`; `400` if MFA is already enabled. Compat: `GET|POST /identity/mfa/totp/setup/` |
| API-MFA-02 | `POST /auth/mfa/verify/` | `{code}`; while `PENDING` a valid code sets `ENABLED` and returns recovery codes once; once enabled it is a step-up check. Compat: `POST /identity/mfa/totp/enable/` ignores any client `secret` |
| API-MFA-03 | `POST /auth/mfa/disable/` | `{password, code \| recovery_code}`; revokes devices/codes, clears the secret; `403` for accounts the policy requires; `400` wrong password/code, `429` locked |
| API-MFA-04 | `GET /auth/mfa/recovery/` | **must not** rotate or display codes; returns counts only |
| API-MFA-05 | `POST /auth/mfa/recovery/` | regenerate, requires re-auth, returns codes once |
| API-MFA-06 | `POST /auth/mfa/recovery/verify/` | consumes one code atomically |
| API-MFA-07 | `GET /auth/mfa/devices/` | list own devices |
| API-MFA-08 | `POST /auth/mfa/devices/revoke/` | revoke own device |
| API-MFA-09 | login with MFA | `200 {"mfa_required":true,"challenge":"<signed>","expires_in":300}`; **no tokens/session/history row**. Complete with `POST /auth/mfa/challenge/` `{challenge, code \| recovery_code, remember_device?}` → `{tokens, user}`. Challenge: single use, 5 min (`MFA_CHALLENGE_TTL_SECONDS`), one user. Wrong code `401`, lockout `429` |
| API-MFA-10 | `/identity/mfa/*` | deprecated alias; same semantics during transition. SMS/e-mail routes removed (A8) |
| API-MFA-11 | `POST /identity/mfa/admin/reset/{user}/` | superuser only; clears secret, codes, devices |

### 4.6 Credential contract (new)

| ID | Method & path | Contract |
|---|---|---|
| API-CRED-01 | `GET /identity/api-keys/` | list own (`?all=true` with `identity.credential.manage` lists everyone's); revoked hidden unless `?include_revoked=true`; secret and digest never included |
| API-CRED-02 | `POST /identity/api-keys/` | `{name, scopes (required, permission codes the caller holds), description?, expires_at?}` → `201 {..., "secret": "<prefix.secret>"}` once; minted for the caller only; `400` on invalid input or the per-user cap; `503` without `API_KEY_PEPPER`. Session JWT only |
| API-CRED-03 | `POST /identity/api-keys/{id}/rotate/` | revoke old, return new secret once (same name/scopes/expiry); owner only (`403`/`404` otherwise) |
| API-CRED-04 | `DELETE /identity/api-keys/{id}/` | revoke immediately, idempotent, `204`; owner or `identity.credential.manage` |
| API-CRED-05 | `/identity/personal-access-tokens/` | identical semantics (WP 7.1/7.2) |

### 4.7 Removals and deprecations

| ID | Item | Contract |
|---|---|---|
| API-DEP-01 | `/identity/mfa/*` | deprecated; removal after frontend migration |
| API-DEP-02 | Legacy `/identity/{login,refresh,logout,password/change,...}` | kept for compatibility; canonical is `/auth/*` |
| API-DEP-03 | `SecurityEvent` update/delete | removed (breaking, intentional, documented) |
| API-DEP-04 | `LoginAttempt` update/delete | removed (implemented Phase 5) |
| API-DEP-06 | `/api/v1/audit/login-history/` | removed with `apps.audit.LoginHistory` (ADR-0035) |
| API-ID-LH | `GET /api/v1/identity/login-history/` and `/{id}/` | read-only; requires `identity.login_history.view`; filters `user`, `login_type`, `status`, `ip_address`, `start_date`, `end_date`; no write route (append-only ledger, ADR-0035) |
| API-DEP-07 | Trusted-device create/update | removed (implemented Phase 5) |
| API-DEP-05 | `OAuth*` endpoints | none exist; none are added unless A7 changes |

---

## 5. Service contracts

Layer rules (see `backend/.ai/ARCHITECTURE.md`): **View → Service → Selector → ORM**. Views never write models directly; selectors are read-only; services own transactions and side effects; serializers validate shape only.

| ID | Service | Contract |
|---|---|---|
| SVC-USER-01 | `UserService` | create/update/activate/deactivate/archive/restore; transactional; emits events; cascade per SEC-DEACT-01 |
| SVC-USER-02 | `PasswordService` | single entry point for change/reset; verifies old password where required; runs Django validators; revokes sessions; clears `must_change_password` |
| SVC-PRO-01 | `ProfileService` | self/authorized updates only; one profile per user |
| SVC-RBAC-01 | `RoleService` / `GroupService` | all writes; escalation + system guards; cache invalidation; events (ADR-0032 D4 requires `RoleService`, currently absent) |
| SVC-AUTH-01 | `AuthenticationService` | login orchestration: blacklist → credentials → lockout → MFA challenge → session/tokens → events |
| SVC-SES-01 | `UserSessionService` | create/rotate/revoke/logout/cleanup; one source of truth for session state |
| SVC-MFA-01 | `MFAService` | enroll/activate/verify/disable/recovery; one lockout implementation |
| SVC-CRED-01 | `CredentialService` | create/list/rotate/revoke over both credential tables (DECIDED A5) |
| SVC-AUD-01 | `SecurityEventService` | **create-only**; sanitises metadata |
| SVC-IP-01 | `IPBlacklistService` | CRUD + `is_blocked(ip)` with CIDR/expiry; updates hit counters |

**SVC-TX-01.** Multi-row security transitions (password change, deactivation, RBAC grant, credential rotation) run in `transaction.atomic()`.

**SVC-TX-02.** A failure in an audit/event side effect must not roll back the primary operation unless the event is the operation.

---

## 6. Event contracts

**EVT-01.** `SecurityEvent` is the canonical security ledger. Required fields: `user` (nullable for unknown principals), `event_type`, `created_at`, `ip_address`, `user_agent`, `metadata` (no secrets), `success` (if present in model).

**EVT-02.** Emission points:

| Event type | Emitted when |
|---|---|
| `LOGIN_SUCCESS` | credentials + MFA complete |
| `LOGIN_FAILED` | invalid credentials (rate-limited/throttled to avoid flooding) |
| `LOGIN_LOCKED` / `ACCOUNT_LOCKED` | lockout threshold reached |
| `PASSWORD_CHANGED` / `PASSWORD_RESET` | successful change/reset |
| `MFA_ENABLED` / `MFA_DISABLED` / `MFA_VERIFIED` | state transitions |
| `SESSION_CREATED` / `SESSION_TERMINATED` | session lifecycle |
| `TOKEN_REFRESHED` | rotation |
| `ROLE_CHANGED` / `PERMISSION_CHANGED` | RBAC mutation |
| `API_KEY_CREATED` / `API_KEY_REVOKED` | credential lifecycle |
| `TRUSTED_DEVICE_ADDED` / `_REMOVED` | device lifecycle |
| `ACCOUNT_DEACTIVATED` / `ACCOUNT_ACTIVATED` | account lifecycle |
| `IP_BLOCKED` / `IP_UNBLOCKED` | blacklist lifecycle |
| `PROFILE_UPDATED` / `SETTINGS_UPDATED` | self-service changes |
| `SUSPICIOUS_ACTIVITY` | reuse detection, impossible travel (future) |

**EVT-03.** Events are immutable (`SEC-AUD-01`), idempotent per operation where a retry is possible, and never contain passwords, tokens, TOTP secrets, or backup codes.

**EVT-04.** Cache invalidation is synchronous and precedes the event emission for RBAC changes (so a read after the response cannot see stale permissions).

---

## 7. Dependency and layering contracts

| ID | Contract |
|---|---|
| DEP-01 | Identity may import `apps.core` and `apps.audit` (audit login history) only. It must not import `apps.production` except in the presentation helper that already does (`api/serializers/frontend_user.py:150`), which is a documented exception; **target:** move membership serialization to the production app or a shared serializer. |
| DEP-02 | No Identity model may add a foreign key to another domain (Organization, Project, Shot). |
| DEP-03 | `apps.production` may read identity identity/principals; it must not write identity tables directly. |
| DEP-04 | Identity is platform-global; organization is not a runtime boundary. |
| DEP-05 | Migrations are additive-first; destructive migrations require a documented reversal and a data-retention check. |
| DEP-06 | Neither tests nor runtime may depend on a system Python; all commands use `uv run`. |

---

## 8. Test contracts

A contract is satisfied only when a test asserts it. Minimum required coverage:

| ID | Test obligation | WP |
|---|---|---|
| TEST-AUTH-01 | Real login (not `force_authenticate`) → token → authenticated request → logout → rejected | 8.1 |
| TEST-AUTH-02 | Unknown/inactive/wrong-password produce identical responses | 5.1 |
| TEST-AUTH-03 | MFA-enabled login without second factor yields no token/session | 6.2 |
| TEST-AUTH-04 | Replayed TOTP code rejected | 6.4 |
| TEST-AUTH-05 | Concurrent backup-code consumption: exactly one succeeds | 6.5/8.6 |
| TEST-AUTHZ-01 | A user cannot read/revoke another user's sessions/devices/credentials | 5.2/7.2 |
| TEST-AUTHZ-02 | A grant cannot exceed the grantor's permissions | 4.2 |
| TEST-AUTHZ-03 | A departed group member (`left_at`) loses group-role permissions | 4.4 |
| TEST-AUD-01 | SecurityEvent/LoginAttempt update/delete returns 405/403 | 5.4 |
| TEST-DEACT-01 | Deactivation immediately invalidates sessions, JWTs, PAT/ApiKey | 5.3/8.2 |
| TEST-SEC-01 | No response or log contains a secret/hash | 6.1/7.2/8.4 |
| TEST-USER-01 | Soft-deleted user cannot authenticate or appear in lists | 3.1 |
| TEST-USER-02 | Case-variant duplicate email rejected | 3.2 |

**TEST-DATA-01.** Tests use a pre-created preserved test database (`backend/config/test_runner.py`); parallel agents must not run the suite concurrently. No test may hit a non-test database.

---

## 9. Decision register

Status values: **DECIDED** = approved for implementation; **PROPOSED** = recommended but not yet approved. On 2026-10-22 the user approved all recommendations A1–A15 ("Approved and do recommendation and continue").

| ID | Decision | Recommendation | Status | Blocks |
|---|---|---|---|---|
| A1 | MFA secret encryption | Add `cryptography` (Fernet/AES-GCM) with a dedicated env key; fail closed if absent | DECIDED (approved and implemented in WP 6.3) | WP 6.3 |
| A2 | `UserPreference` | Delete the model; `Profile.preferences` is the single store | DECIDED | WP 3.6 |
| A3 | `KnownDevice` | Delete; `TrustedDevice` is canonical | DECIDED | WP 5.13 |
| A4 | Identity `LoginHistory` | **Reversed 2026-10-22 (ADR-0035):** identity `LoginHistory` is canonical; `apps.audit.LoginHistory`, its URL and its rows are removed | DECIDED (superseded) | WP 5.7 |
| A5 | Credential consolidation | One service/API over both tables in MVP; no physical merge | DECIDED | WP 7.1 |
| A6 | Credential hashing | HMAC-SHA256 with a dedicated pepper; lazy rehash | DECIDED (implemented WP 7.4) | WP 7.4 |
| A7 | OAuth | Out of MVP; remove models/admin in a later cleanup | DECIDED (removed in Phase 7) | WP 7.7/7.8 |
| A8 | SMS/email MFA | Remove stub endpoints; TOTP + recovery only | DECIDED | WP 6.6 |
| A9 | Django-auth `Group`/`Permission` | Keep tables for now; document unused; do not expose | DECIDED | WP 4.7 |
| A10 | Password reset / email verification | Implement password reset; unmount email verification until email delivery exists | DECIDED | WP 3.8 |
| A11 | Audit immutability | Application-level (API + admin + service) for MVP; DB trigger optional | DECIDED | WP 5.4 |
| A12 | Tooling gates | Keep current CI gates; add type-checker and dependency audit only with approval; use manual backdating instead of a time library | DECIDED | WP 8.8 |
| A13 | Identity coverage | ≥ 85% for `apps/identity` | DECIDED | WP 8.8 |
| A14 | Trusted proxy | `REMOTE_ADDR` by default; configurable trusted-proxy allowlist | DECIDED | WPs 5.9, 5.11 |
| A15 | Legacy `/identity/*` contract | Keep during transition; canonical is `/auth/*` | DECIDED | WP 5.14 |

---

## 10. Explicit non-goals (MVP)

- Organization/tenant isolation (does not exist at runtime).
- LDAP/SSO/OAuth runtime.
- SMS/email MFA delivery.
- A physical merge of `ApiKey` and `PersonalAccessToken`.
- Frontend redesign; the SPA contract (`/auth/*`) is frozen.
- A database trigger for audit immutability.
- Rewriting applied migrations.

---

## 11. Contract verification checklist (used at each phase gate)

- [ ] Every changed endpoint still satisfies its `API-*` row.
- [ ] Every `DOM-*`/`SEC-*` invariant has a test (`TEST-*`).
- [ ] No secret is serialized, logged, or returned after one-time display.
- [ ] `uv run python manage.py check` and `makemigrations --check --dry-run` are clean.
- [ ] `uv run pytest apps/identity --no-cov` passes; no skipped/weakened tests.
- [ ] Migration forward and reverse verified where data migrations exist.
- [ ] `AUDIT.md` rows for the changed areas are re-verified with new evidence.
- [ ] `PLAN.md` work-package status updated; one commit per phase (`identity(phase-N): …`).

---

## 12. Contract → audit → plan traceability

| Audit area (AUDIT.md §1) | Contracts | Work packages |
|---|---|---|
| 1 users | DOM-USER-01…05, SEC-AUTH-02, API-ID-01 | 3.1, 3.2, 3.3, 5.3, 8.2 |
| 2 profiles | DOM-PRO-01…03, API-ID-02 | 3.4, 3.5 |
| 3 user preferences | DOM-PRF-01…02 | 3.6 |
| 4–10 RBAC | DOM-RBAC-01…08, API-RBAC-01…08 | 4.1–4.7 |
| 11–12 credentials | DOM-CRED-01…06, API-CRED-01…05 | 7.1–7.6 |
| 13 backup codes | DOM-MFA-06, API-MFA-04…06 | 6.5 |
| 14 MFA | DOM-MFA-01…07, API-MFA-01…10 | 6.1–6.7 |
| 15–16 OAuth | DOM-OAUTH-01…02 | 7.7, 7.8 |
| 17 sessions | DOM-SES-01…06, API-ID-03 | 5.2, 5.10, 5.12 |
| 18 login attempts | DOM-AUD-02, API-ID-06 | 5.4, 5.5 |
| 19 login history | DOM-AUD-04 | 5.7 |
| 20 security events | DOM-AUD-01/03, EVT-01…04, API-ID-05 | 5.4, 5.6 |
| 21 IP blacklists | DOM-AUD-05/06, SEC-IP-01…03 | 5.8, 5.11 |
| 22 known devices | DOM-DEV-04 | 5.13 |
| 23 trusted devices | DOM-DEV-01…03, API-MFA-07/08 | 5.9 |
