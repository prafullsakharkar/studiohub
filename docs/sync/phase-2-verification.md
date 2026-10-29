# Phase 2 — Identity & access administration: verification

Branch `sync/phase-2-identity` (from the Phase 1 tip; `git log sync/phase-1-foundation..HEAD` lists the 13 commits), **not pushed**. Backend changes made this phase were the three the owner approved before it started (CR-02 `b728528`, Q-03 `553b481`, Q-05 `ad874da`, on the Phase 1 branch). **No backend file changed during Phase 2 itself.** CR-12 (a real backend bug) and Q-07…Q-12 are proposals only, in [backend-change-requests.md](backend-change-requests.md); none is applied.

## 1. Exit criteria

| Criterion | Result | Evidence |
|---|---|---|
| An admin creates a user | ✅ live | `identityAdmin.live` › *Create login*: the real `AccountSection` makes `POST /identity/users/` then `POST /people/{id}/link-user/`; the person's `user` is set |
| …assigns a role | ✅ live | same test, role picker → `POST /roles/{id}/users/`; the section lists the held role |
| …that user's next `/auth/me` shows the new permissions | ✅ live | the new user signs in: `permissions` contains `shot.view`, `role` is "Live Viewer" |
| …and the UI reacts | ✅ live | a second session assigns the role; the target's `useCan('shot.view')` flips `false → true` after `refreshUser()` with no reload. Role/group changes made in the UI also re-read `/auth/me/` (`useAfterAccessChange`) |
| MFA enroll → login-with-challenge round trip | ✅ live | `SecurityPage` "Turn on" (QR + key, wrong code rejected earlier in Phase 1's page, real code from the key), 10 recovery codes shown once; a new login returns `mfa_required` with no tokens; the challenge with a fresh TOTP signs in; recovery codes regenerated with password + a recovery code; MFA turned off with a new code |
| Create-login partial failure | ✅ unit | user created, link fails (409) → "Retry link" re-links the same user id and does **not** call `POST /users/` again (a second create would fail as a duplicate) |
| Backend guards surface correctly | ✅ live | escalation `403`, own-assignment `400`, both with the server's sentence |

Live: `auth` 18, `restricted` 4, `departments` 10, `identityAdmin` 4 → **4 files, 36 tests** against a real Django on the pytest test database (each file run on a fresh seed with a short pause; running them in one process hits the login throttle and TOTP replay protection, not a defect).

## 2. Quality gates

| Gate | Phase 1 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 65 files / 345 | **67 files / 412** (+ 4 files / 36 live) |
| `pnpm build` | OK | **OK** |
| Biome | 2 errors / 3822 warnings | **2 errors (the same two) / 3691 warnings** |
| Net size (frontend) | | 69 files, +4,509 / −7,014 |

Mutation checks that fail as intended: removing the permission gate on group tabs; removing the "at least one scope" guard; always sending `code` instead of `recovery_code`.

## 3. What was built

| Area | Where |
|---|---|
| Typed API modules | `src/api/identity/{rbac,users,account,ledgers,mfa}.ts` + contract tests against the captures |
| Roles, groups, permission catalog | `modules/identity/pages/{Roles,RoleDetail,Groups,GroupDetail,Permissions}Page.tsx`, routes `/access/{roles,groups,permissions}[/:id]` |
| Security log | `SecurityLogPage.tsx`, `/access/security` (events, login history, attempts: date window + client paging; IP blacklist add/pause/remove) |
| Account section on a person | `components/AccountSection.tsx` in the person page's former Security tab (create/link/unlink login, nine lifecycle actions, roles) |
| My account | `account/{Profile,Security,Sessions,Tokens}Page.tsx`, `/settings/account/*` (`/settings` now redirects there; the `/platform/admin/pipeline` redirect is gone); header menu entry |
| Shared | `MfaEnrollmentPanel` (extracted from the MFA setup page), `errorText()`, open page permission `page.account` |

## 4. Removed (no silent deletions)

| What | Why |
|---|---|
| `modules/access/*` except `ProductionRoleSelect` (22 files incl. 5 tests) and `core/access/{useAccessManagementStore,domainPermissions}.ts` | The old workspace edited an in-browser RBAC store; nothing reached the server. Unreachable from `main.tsx` after the routes switched (import-graph walk, not grep). `ProductionRoleSelect` stays: People still imports it (Phase 3) |
| `components/permissions/PermissionMatrix.tsx`, `modules/settings/pages/RolesSecurityPage.tsx` | Only referenced by the removed catalog section / an unrouted page; `SettingsPage` loses its "Roles & Security Matrix" tab (it already links to `/access`) |
| `modules/people/components/PersonSecurityTab.tsx`, `handleUpdateSecurityStatus`, `personApi.setPersonPassword` | Hard-coded "Enforced (YubiKey/TOTP)" / "Encrypted WireGuard VPN" text, a status that was only React state, and a call to `/people/{id}/set-password/`, which does not exist |
| `/settings → /platform/admin/pipeline` redirect | Replaced by `/settings → /settings/account/profile` (Q3) |

Each is its own commit (`1961fd3f`, `deb47133`) so it can be reverted alone.

## 5. Findings (details in backend-change-requests.md)

- **CR-12 (bug, needs approval):** user e-mail differing only by case → 500.
- Q-07 roles/groups create returns no `id` (UI reads back by code); Q-08 admins can deactivate/delete themselves (UI blocks it); Q-09 trusted-device tree 401s; Q-10 unpaginated ledgers (UI windows + pages client-side); Q-11 profile fields write-only; Q-12 user state/roles not exposed, users list 403 without `identity.user.view`.
- **My own errors, caught by live runs/captures and fixed:** typed role/group sub-resources as ids when the API embeds refs (contract test now pins it); read the sub-resource permission rules from `permission_map` and gated reads on `.update` (the real rules are in `get_permission_required`); assumed self-assignment could demo the UI reacting (the backend forbids it); a harness TOTP-step replay made the first manager sign-in flaky.

## 6. Deferred / not done

- Admin views of another user's sessions and MFA reset (`sessionsApi.adminList/adminRevokeAll`, `mfaApi.adminReset` exist and are tested; no screen yet).
- Timezone/language/phone in the profile (Q-11).
- `ProductionRoleSelect` and the People list/CRUD (Phase 3); system settings under `/settings/system` (Phase 11).
- The old Permissions simulator UI (`PermissionsSimulatorModal`, `usePermissionStore`) is unreferenced by routes but untouched; to be decided with the Phase 11 settings work.

## 7. Process notes

- Live backend only through pytest on the throwaway test database (name asserted); no `.env.local` DB, no `manage.py test`, no full backend suite, no `git stash`.
- An accidental repo-wide Biome `--write` on `modules/auth` reformatted nine unrelated files; they were restored to HEAD before committing.
- The first removal commit missed three edited files (it built red); amended before any push.
