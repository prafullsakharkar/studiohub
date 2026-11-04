# CR-40: directory (OpenLDAP) sign-in beside local accounts: verification

Branch `sync/backend-cr-40-ldap` (from local `develop` at `a095254e`, which holds the ADR-0039 and
CR-40 documents and is itself not pushed), **not pushed, not merged**. This branch **changes the
backend** (CR-40, approved by the owner: "approved CR-40"). The design is
`docs/adr/ADR-0039-ldap-authentication.md` (now accepted); the change request and its work packages
are in `backend-change-requests.md`.

## 1. What changed

| Commit | What |
|---|---|
| `a4983c98` | Backend, WP L.1 to L.6 (47 files, +2,821 / -7; one additive migration, `identity/0003_directory_sign_in`) |
| `c3a74f43` | The OpenAPI snapshot and `openapi.ts`, regenerated from the backend. The previous snapshot predated CR-37; the regenerated types are what the new frontend code is typed from |
| (this commit set) | Frontend WP L.7, the captured samples and their capture tool, contracts and deployment docs, ADR and CR status, one more backend test |

**Backend**:
- **Models**: `DirectoryConfiguration` (one row) and `ExternalIdentity` (provider `ldap`, `subject` = `entryUUID`, unique username per provider, one link per user). `User.mfa_required` and five new `LoginAttemptReason` values (`ldap_unavailable`, `ldap_disabled`, `ldap_ambiguous`, `ldap_no_email`, `ldap_email_conflict`).
- **Settings API** (`identity.directory.manage`, the platform administrator):
  - `GET`/`PATCH /api/v1/identity/directory/`, `POST …/test-connection/`, `POST …/test-user/`.
  - The service password is write-only and stored encrypted with `DIRECTORY_ENCRYPTION_KEY`; a read returns `bind_password_set` instead.
  - A save is refused for `ldap://` without StartTLS and for a filter without `{username}`. Turning sign-in on needs a passing test, and that test is cleared whenever a connection field changes.
  - `DIRECTORY_LOGIN_FORCE_OFF` turns sign-in off from the environment, whatever the screen says.
- **Sign-in**: `AuthenticationService.login` picks the check from the identifier.
  - An account's e-mail is checked locally, exactly as before.
  - A linked username, or any name while directory sign-in is on, is checked against the directory: search with the service account, then bind as the user.
  - The username is escaped in the filter, an empty password is refused before any bind, and TLS is verified.
  - Every step after the password check is shared with local sign-in (account state, MFA, session).
  - A directory outage fails closed, is logged, and does not count toward the lockout.
- **First sign-in**: makes the user (with an unusable local password), the profile names, the link, the `artist` role and, after commit, the People record. Later sign-ins refresh the name and e-mail.
  - An entry with no `mail` is refused.
  - An e-mail that a local account already has is refused, so no account is taken over by e-mail.
- **Passwords**: change-password and an administrator reset refuse a directory account (`400 password_managed_by_directory`). A forgotten-password request issues no token for one.
- **MFA**: off by default for directory accounts. `MFAPolicy.is_required`:
  - Superuser and staff accounts: still required.
  - `User.mfa_required`: required.
  - The blanket `MFA_REQUIRE_ALL` rule skips directory accounts unless the configuration's `require_mfa` is on.
  - The external-member rule applies to everyone.

  `POST /api/v1/identity/users/{id}/require-mfa/ {"required": bool}` needs `identity.user.require_mfa` (platform administrator and `org-admin`). `/auth/me` and the user serializers gain `auth_source` (`local`/`ldap`) and `mfa_required`.
- **Commands**:
  - `manage.py ldap_sync [--dry-run]` refreshes linked accounts and deactivates those whose entry is gone. An outage aborts it with nothing changed.
  - `manage.py ldap_link <email> <username> [--dry-run]` links an existing local account on purpose, removes its local password and ends its sessions.
- **Dependency**: `ldap3>=2.9.1` (`uv audit` clean).

**Frontend** (WP L.7):
- `src/api/identity/directory.ts` (types from `openapi.ts`; the two test results are pinned to the captured responses), and `usersApi.requireMfa`.
- **Settings → System → Directory (LDAP)** (`/settings/system/directory`, `modules/identity/pages/DirectorySettingsPage.tsx`):
  - The connection, search, attribute and new-account fields. The service password is shown only as set or not set: typing replaces it, an empty field keeps it, and "Remove the stored password" clears it.
  - The on/off switch is a separate control, because turning it on needs a passing test after any connection change.
  - Test connection, and Look up a username (the entry it would copy and what stops it signing in).
  - Warnings when the server forces sign-in off or has no encryption key.
  - Access: the route has its own `PermissionRoute`, a `routePermissionsRegistry` entry and a tab in the system-settings navigation. Each needs `identity.directory.manage`, and the tab shows on its own for someone who has that permission but not `settings.view`.
- **The person's Account section**:
  - "Directory (LDAP)" and "Two-factor required" badges.
  - A "Require two-factor sign-in for this login" switch (`identity.user.require_mfa`).
  - For a directory account, no Reset password and no Require password change.
- **The account's own Security page and the change-password page** tell a directory user to change the password in the directory.
- **Login**: the field reads "Username or email" (`type="text"`, `autocomplete="username"`). An identifier containing an `@` must be a valid address. The value is still sent as `email`, which is the field the backend reads.

## 2. Evidence

| Check | Result |
|---|---|
| Backend directory tests (`apps/identity/tests/security/test_directory_{sign_in,settings_and_mfa,commands}.py`) | **71 pass** (30 + 33 + 8). Covered:<br>• Off and forced off: no connection is made and local sign-in is unchanged.<br>• First sign-in makes one account, link, role and People record; the username matches whatever its case; a second sign-in makes nothing and refreshes the name and e-mail.<br>• Refused with the generic failure and the right ledger reason: no `mail`, an e-mail clash (on create and on refresh), a reused username, a deactivated account, a wrong or empty password, an unknown name, two entries, and the filter injection `*)(uid=*`.<br>• An account's e-mail is not a way in (added in this commit set).<br>• An outage fails closed, is logged and does not lock the account; wrong passwords still lock; a local account signs in during an outage; a missing key fails closed.<br>• Password: change, reset and forgot-password are refused for a directory account.<br>• Settings: permissions; the password is write-only and is not in the audit metadata; the `ldap://` and filter rules; enabling needs a test; a connection change clears the test.<br>• MFA: not asked of directory users under `MFA_REQUIRE_ALL`; the configuration's switch; `require-mfa` forces enrolment at the next request; an org-admin may set it and an artist may not; a vendor or client member is still required.<br>• `ldap_sync` and `ldap_link`, including their dry runs and outage handling |
| Backend mutations | **13 run, 13 caught**: empty-password refusal, filter escaping, the ambiguous match, outage not counted toward the lockout, e-mail clash on create and on refresh, write-only password, the directory MFA exemption, per-user MFA, plain `ldap://` refused, enabling needs a test, a connection change clears the test, account state checked after a directory bind |
| Backend regression | `apps/identity` and `apps/core`: see §2a. The full suite was not run locally (targeted only); CI runs it |
| `ruff check` / `basedpyright` | clean; no new basedpyright errors in the changed files. Three errors in `services/authentication.py` (lines near 348 and 396) predate this branch. `ruff format` was applied to new files and to files already formatted at HEAD only |
| Captured samples | `docs/sync/samples/identity/_directory_flow.json`, 33 responses from the real backend on the test database (only the directory itself is ldap3's in-memory mock); tool `docs/sync/tools/test_capture_directory.py` |
| Frontend gates | `pnpm typecheck` clean; `pnpm exec biome check src --diagnostic-level=error` 0 errors; `pnpm test` **1,175 pass** (115 files; 18 new); `pnpm build` ok; `unreachable.mjs`: only tests, `*RowKeys.ts` and the existing helpers |
| Frontend mutations | **10 run, 10 caught** after one survivor was fixed. The survivor: the MFA switch always sending `true`, which no test caught because none turned the switch off; a test for that now catches it. The other nine: password kept when not typed, the remove-password checkbox, field messages for a refused switch or lookup, password actions hidden for directory accounts, the switch's permission gate, the nav tab's permission gate, the `@`-only address check, and the Security and change-password notices |

### 2a. Regression run

`uv run pytest --no-cov apps/identity apps/core`: **1,789 passed**, 0 failed (2 min 47 s). The run was collected just before the e-mail-path test was added; that test passes on its own (`-k email_is_not`). An earlier run of the same command, before the fixes below, had two failures, both fixed in `a4983c98`: the API diagnostics test expects an empty login body to name both `email` and `password`, so `email` stays required; and the admin-registry test needs every concrete model registered, so `admin/directory.py` registers the two new models read-only.

## 3. Not done, and limits found

- **A non-staff `org-admin` cannot use the switch.** It gets `404` on `require-mfa`, as it does on every other account action on a person's page, because `UserSelector` shows other accounts only to staff and superusers. This predates CR-40, and changing it needs its own change request. The backend tests use a staff org-admin; `require_mfa_org_admin_not_staff` in the samples records the `404`.
- **No live run against a real OpenLDAP server.** CR-40 proposed one against an OpenLDAP container on the test harness; none is available here. The backend tests and the captures use ldap3's in-memory mock, which runs the real search, filter escaping and bind code but not the network, TLS or a real `slapd`'s answers. Run one before production use.
- **The default role is a text field** (a role code), not a picker. The server refuses an unknown code (`patch_bad_role`).
- **Not in this change** (ADR-0039 "Not decided here"): mapping directory groups to roles, SSO (SAML or OIDC), and Active Directory attribute presets.
- **Deployment**:
  - Set `DIRECTORY_ENCRYPTION_KEY` and run migration `identity/0003` (`docs/07-deployment/pre-deploy-checklist.md`).
  - Run `init_platform` so the two new permissions exist and `org-admin` gets `identity.user.require_mfa`.
  - `DIRECTORY_LOGIN_FORCE_OFF=true` is the emergency off.
