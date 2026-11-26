# CR-58: verification

Branch `feature/ldap-admin-page`, off `develop` at `ff0f1842`. Change request: `docs/sync/backend-change-requests.md` CR-58, approved by the owner ("approved", 2026-11-26).

The branch has four commits:
- `68089a5c`, before the CR: a sidebar SETTINGS section that links every system settings screen;
- `185e3f94`: the change request;
- `b3ea14c9`: the backend;
- `7b9ff8dc`: the Directory (LDAP) screen.

## What changed

| Where | What |
|---|---|
| `identity/services/directory/accounts.py` (new) | `DirectoryAccountService.link` and `.sync`, the former bodies of the two commands. It also defines `DirectoryUnreachable` (503 `directory_unavailable`), `DirectorySignInOff` (409 `directory_sign_in_off`), `LinkResult` and `SyncResult`. A refusal is a `ValidationError` on `email` or `username`. |
| `identity/management/commands/ldap_link.py`, `ldap_sync.py` | Thin callers of the service. Arguments and output are unchanged. |
| `identity/api/views/directory.py`, `serializers/directory.py`, `urls.py` | `POST directory/link/` with `{email, username, dry_run}` and `POST directory/sync/` with `{dry_run}`. Both need `identity.directory.manage` and use the `sensitive` throttle. |
| `identity/tests/security/test_cr58_directory_link_sync.py` (new) | 22 tests. |
| `docs/sync/tools/test_capture_directory_link_sync_cr58.py` (new) | Writes `samples/identity/_directory_link_sync_cr58_flow.json`. |
| frontend `api/identity/directory.ts` | `link`, `sync`, `DirectoryLinkResult`, `DirectorySyncResult`. |
| frontend `identity/pages/DirectorySettingsPage.tsx` | Two cards, Link an account and Sync the directory accounts (details below). |
| frontend `layouts/Sidebar.tsx`, `Header.tsx` | The SETTINGS section, and the user menu entry for an administrator who can manage only the directory. |
| Docs | `identity/CONTRACTS.md` API-ID-09; the ADR-0039 implementation note; `CLAUDE.md`. |

The two new cards on the Directory (LDAP) screen:
- **Link an account:** Check, then Link after a confirmation. A refusal is shown on its field.
- **Sync the directory accounts:** Preview, then Sync now after a confirmation.

## The behaviour (captured)

**Linking:**
- A check is a 200 with `linked: false` that names the entry's DN. A link is a 200 with `linked: true`.
- These are 400 on `email`: no account has the address, the account is already linked, or the address is not valid.
- These are 400 on `username`: no entry, more than one entry, or the entry is already linked to another account.
- An outage is a 503 with "The directory cannot be reached (…); nothing changed."
- An artist gets a 403.

**Syncing:**
- The preview lists the leaver, and the sync deactivates them: `{"deactivated": ["leaver"], "refreshed": 2}`. Afterwards a preview has nobody to deactivate.
- An outage is a 503, and sign-in being off is a 409. An artist gets a 403.

## Checks

- **Backend tests:** `test_cr58_directory_link_sync.py` and `test_directory_commands.py`, 30 passed. Everything in `identity/tests/security/`, plus `test_has_permission_gate.py`, `core/tests/test_contract.py` and `test_contract_regression.py`: 690 passed. Not the full suite (targeted tests only).
- **Lint and types:**
  - `ruff check` is clean.
  - The changed files were formatted at the base and are formatted again.
  - `basedpyright` shows 0 errors; the warnings are the same kinds the existing views and tests have.
  - `manage.py check` is clean.
- **Backend mutation checks**, each caught by a test:
  1. a link that ignores the dry run;
  2. no actor in the security event;
  3. a dry-run sync that deactivates;
  4. an ambiguous username treated as a leaver;
  5. an outage not caught (500 instead of 503);
  6. a sync while sign-in is off;
  7. the link route without its permission;
  8. the sync route without its throttle.
- **Frontend checks:** `pnpm typecheck`, `biome check src` (0 errors), `pnpm test` (193 files, 2,190 tests), `pnpm build`. The unreachable check lists only tests, helpers and the existing `permissionCatalog`.
- **Frontend mutation checks**, each caught after one test was strengthened (spaces around the username):
  1. a check that links;
  2. Link enabled without a check;
  3. an edit that keeps the old check;
  4. Link without the confirmation;
  5. the generic text for an outage;
  6. Sync now enabled without a preview;
  7. a confirmed sync sent as a dry run;
  8. Preview enabled while sign-in is off;
  9. the username not trimmed.
- **Sidebar mutation checks**, each caught:
  1. the directory link under `settings.view`;
  2. a screen dropped from the sidebar;
  3. a screen under the wrong code;
  4. the user menu gate;
  5. the user menu link.

## Not done

- No live run: the throwaway live backend has no directory to talk to. The captured responses come from the real API layers against ldap3's in-memory server, the same fake the backend tests use.
- The sync runs inside the request. That is fine for a studio's few hundred linked accounts; thousands would want a background task.
