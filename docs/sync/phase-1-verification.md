# Phase 1 — Foundation: verification

Branch `sync/phase-1-foundation` (from the Phase 0 tip `28bddad`), 28 commits, **not pushed**. No backend file was modified. Backend changes are only proposed, in [backend-change-requests.md](backend-change-requests.md).

## 1. Exit criteria

| Criterion | Result | Evidence |
|---|---|---|
| Login **without** MFA | ✅ live | `auth.live.test.ts` › *signs in, keeps the access token out of storage, and /auth/me works with the real JWT*; wrong password → `401 "Invalid username or password."`, no tokens |
| Login **with** MFA | ✅ live | `auth.live` › MFA login (challenge with no tokens, wrong code `401 mfa_code_invalid`, garbage challenge `401 mfa_challenge_invalid`, real TOTP code, recovery code once only); `departments.live` signs the pre-enrolled superuser in with a real TOTP code |
| Refresh | ✅ live | fresh tab exchanges its refresh token first (1 request, token rotated); 401 → one refresh → retry; 8 concurrent expired requests → 1 refresh |
| **Two tabs racing** | ✅ live, mutation-verified | Two tabs restoring at the same instant, 6 concurrent requests, all succeed, ≤ 2 refreshes, session still alive afterwards. **With the cross-tab lock disabled the same test fails against the real backend** (`SESSION_EXPIRED 401: Session is no longer active`: the backend revokes the whole session when a rotated refresh token is presented again). A first version of this test passed even with the lock disabled (the race never happened because of request ordering); it was rewritten until the mutation was caught |
| Logout and session expiry | ✅ live | logout sends `{refresh}` and the old token then gets `401 "Session has been revoked."`; a session ended "elsewhere" fails the next call cleanly, clears tokens and notifies listeners |
| Departments list: pagination, search, ordering | ✅ live (ordering: see §5) | 32 rows → page 1 shows 25, "Next page" shows the other 7; server-side search finds `LIVE-02x` rows that are not on page 1; type filter; export of **all** 32 rows while 25 are visible |
| Departments create with server field errors inline | ✅ live | duplicate code **and** a name clash ignoring case (`uq_name_ci`) both shown inline from the real 400; creation verified by a follow-up GET |
| Normalizer and refresh tests green | ✅ | 19 normalizer tests (real error bodies), 12 refresh/lock tests, 9 ApiClient auth tests |
| typecheck / test / build green | ✅ | below |

Live runs: `pnpm test:live` → **3 files, 32 tests passed** against a real Django (`docs/sync/tools/live_backend.py`, §6).

## 2. Quality gates (vs the Phase 0 baseline)

| Gate | Phase 0 | Now |
|---|---|---|
| `tsc --noEmit` | 0 errors | **0 errors** (and 0 on a **clean checkout**; the baseline had 1 there, see §4.1) |
| Unit tests | 47 files / 168 passed | **65 files / 345 passed** (+ 3 files / 32 live) |
| Unit tests on a clean checkout | 23 failures (they depended on the local `.env`) | **0** |
| `pnpm build` | OK | **OK** |
| Biome | 2 errors / 4142 warnings | **2 errors (the same two) / 3822 warnings** |
| Net size | | 131 files changed, +6,857 / −12,949 lines (excluding generated types and samples) |

## 3. What was built

| Area | Where | Notes |
|---|---|---|
| Error normalization | `src/api/errors/normalizeApiError.ts` | flat DRF, nested / `many=True`, SimpleJWT, `error.{code,request_id}`, bare arrays, proxy HTML, `Retry-After` (seconds or date, or the DRF throttle text). Top-level `code` beats the generic envelope code. A field named `code`/`message` is a field error, not envelope metadata |
| Token storage / refresh | `core/auth/{tokenStorage,refreshLock,sessionRefresh}.ts`, `ApiClient.ts` | Q6: access token in memory only (legacy storage key purged), refresh token in `localStorage`; `navigator.locks` with a `localStorage` lease fallback (plain http has no `navigator.locks`); refresh token read **inside** the lock; waiters share one promise and reject together; only 400/401/403 from the refresh endpoint end the session; BroadcastChannel + `storage` events for rotations and logouts; public auth routes never carry a bearer header or trigger a refresh |
| Auth flows | `modules/auth/*` | MFA step (TOTP/recovery, remember device, back to the password step on an expired challenge), forgot-password (was a 600 ms `setTimeout` that claimed success), `/reset-password?token=`, change-password, `/auth/mfa-setup` |
| Restricted sessions | `core/auth/AuthProvider.tsx`, `routes/AuthenticatedRoute.tsx` | §4.2 |
| Typed contracts | `src/core/api/generated/{openapi.ts,schema/}`, `src/api/{identity,masterdata}/` | schema regenerated and committed; typed modules for MFA and departments |
| Data layer | `src/shared/data/` | `createQueryKeys`, `toPage` (paginated and bare-array routes), `listFetcher`, `fetchAllRows`, `usePaginatedList`, `exportAll` |
| Forms | `src/shared/forms/` | `applyServerErrors` / `useServerForm` |
| Permissions | `core/permissions/{access,permissionMap,backendCodes,useCan}.ts` | §4.3 |
| UX primitives | `components/system/{ConfirmDialog,QueryBoundary}.tsx`, `api/client/upload.ts`, `core/notifications/notify.ts` | confirm (shows the server's reason, e.g. 409 `has_dependants`), loading/error/empty/403 states, upload with progress and cancel, request id in toasts for 5xx |
| Trailing slashes | `api/client/url.ts` | §4.4 |
| Honest health page | `modules/platform/{health,pages}/` | §4.5 |

## 4. Findings during this phase (and corrections to Phase 0)

### 4.1 Pre-existing defects fixed
- **A clean checkout did not typecheck or pass tests.** The repo-wide `generated/` ignore rule kept `frontend/src/core/api/generated/` out of the initial import, so `ApiClient` imported a file git never had; `pnpm api:generate` had no input. Verified in a clean `git worktree`. Fixed: `ContractValidator` (it only logged warnings against a stale mock-era `contract.ts`) removed; the generated types and schema snapshot are tracked. The tests that needed the developer's git-ignored `.env` (`VITE_API_URL`) are pinned in `vitest.config.ts`; my first fix (`test.env`) did **not** work (`getApiBaseUrl` reads `import.meta.env`), and a local re-run with `.env` moved aside gave a *false pass* from the transform cache. Only the clean worktree was trustworthy.
- **Every 401 was "session expired".** A mistyped current password on the change-password form signed the user out; a wrong password on the login page toasted "your session has expired". Now classified: public auth routes and `401 invalid_credentials` are credential failures shown by the form.
- **Nested `role="dialog"`** (`Dialog` wrapped `Modal`, both declared it).
- **The API health page was fabricated** (probed 16 non-existent paths, swallowed failures, invented latency with `Math.random()`, "chaos simulator"). `server.ts` probed `/api/health`; Django serves `/health/` (verified live: 200).
- **Forgot password never called the backend.**
- **Lists showed only page 1** (25 rows) and filtered that page client-side; the departments cards displayed `head_name`/`member_count`, which the backend does not have ("0 Members").
- Login form: pre-filled demo credentials, a "keep me signed in 30 days" checkbox that sent nothing, a 6-character login password rule the backend does not have.
- A redaction rule in the Phase 0 capture tool replaced validation **messages** (e.g. `"password": ["This field is required."]`) with `<redacted>`; fixed for new captures, limitation documented in `samples/README.md`.

### 4.2 Restricted sessions (missed by Phase 0)
`apps/identity/authentication/restrictions.py`: a user who owes MFA enrollment (policy requires it of superusers) or a password change can reach **only** `me`, `logout` and the endpoints that settle the debt. Every other endpoint, **including plain reads**, is `403 {detail, code: "mfa_enrollment_required" | "password_change_required"}`. Phase 0's captures used `force_authenticate`, which skips this. Found when the live departments test, run as a superuser, got `403 "Set up two-factor authentication before continuing."`. Consequences handled: the specific code survives normalization; `AuthProvider.restriction` is set from the login flag **or** the first 403 (so it works after a reload); the route guard sends the user to `/auth/mfa-setup` or `/auth/change-password`; the enrollment page exists (it is a prerequisite for any superuser to use the app). Samples: `identity/_restricted_sessions_flow.json`.

### 4.3 Permissions
- **188** distinct codes are consumed as gates outside the definition files (Phase 0's "290 invented" counted the definitions too); **145** of those are not backend codes. `PERMISSION_MAP` maps them, each with the viewset evidence; kinds: `codes`, `open` (the backend only requires authentication), `unbacked` (no endpoint: always denied, superuser included).
- Admin **screens** (Platform Admin, Access workspace) are offered to people holding the corresponding write code, even though the endpoints behind them are open; two existing tests encoded exactly that policy and were kept.
- `hasElevatedAccess` now means "superuser or an administrator-only backend code". Its old probe list included `platform.admin.view`, which became correctly "open", so without this every user would have been elevated.
- Tests: evaluator against the real `/auth/me/` payloads; every map target exists in the backend catalog snapshot; a source scan fails on any gate string that resolves to no rule.
- 32 codes were found by that scan *after* I thought the map was complete (review/shot/task/version/delivery transitions and the audit page codes).

### 4.4 Trailing slashes
I first claimed (code comment, commit) that a slash-less write is redirected and lost. **Checked against the live backend: wrong.** `GET /api/v1/departments` → 200 and `POST` → 201, no redirect. The real constraint is the other direction: `GET /api/v1/platform/master-data/software/` → **404**. 501 `/api` routes: 427 canonical-with-slash, 40 slash-less only (`platform/master-data/*`, `platform/overview`), 17 registered in both forms (project-scoped tree). The normalizer canonicalizes to the slash form and never adds one to the slash-less families; comment, tests and commit text corrected.

### 4.5 New backend facts (details in backend-change-requests.md)
`change-password` does not compare `confirm_password` (Q-03); `/auth/me/` does not say what the session owes (Q-04); a user with no roles is labelled "Artist" (Q-05); invalid filter values are 400 on departments but 200-empty on tasks (Q-06); `/health/` is liveness only; the password policy is 12+ characters, not common, not all digits (the server returns every failing reason); department names are unique ignoring case; wrong MFA code and stale challenge are **401** (not 400); attachments accept an empty body (Q-02).

## 5. Not done / deliberately deferred (nothing hidden)

| Item | Why / where it goes |
|---|---|
| Typed modules for every app | Only auth, MFA and departments exist. Others arrive in the phase that owns the screen. The 19 un-schema'd views (CR-08) are typed there, validated against samples |
| `// TODO(sync-phase-N)` markers | None were needed: regenerating `openapi.ts` introduced **no** compile errors, because the modules use hand-written types, not the generated ones |
| Client role matrix, scope/external/field/workflow engines, `systemRoles`, access-management store | The **evaluation** no longer uses them (it is `access.ts`), but they still feed the Access workspace, the production tabs and the simulator. Symbol-level analysis found 5 modules (816 lines) with no references and they were removed; the rest goes with the screens that use them (Phase 2, 5–7) |
| Client "activity" store | Login/logout recording removed; ~10 modules still write fabricated activity entries. Replaced by the backend History tab per module (Phase 4 and each module phase) |
| Settings placement (Q3), `/settings → /platform/admin/pipeline` redirect | Phase 2 / 11 |
| Global rate-limit countdown | `Retry-After` is exposed to forms and shown (forgot-password); there is no app-wide countdown or disabled-until state |
| `exportAll` | Built, tested, wired to Departments only; the shared table toolbar integration comes as tables migrate |
| Upload with progress | Tested with a fake `XMLHttpRequest` (progress, 413 with proxy HTML, 429 `Retry-After`, 401 → refresh → retry, cancel). **Not exercised live**: jsdom's XHR would be subject to CORS against the live server |
| **Ordering** live | The default `ordering=name` is sent and honoured by the server; toggling asc/desc/none is covered by unit tests only |
| Login page marketing text | "SOC-2 Ready", "99.4% Parity", "TLS 1.3 / MPAA / CDSA" and similar are static claims; left in place (design content), flagged |
| Command palette "Database Inspector & Storage" (IndexedDB) | Mock-era; flagged for Phase 13 |
| Fully clean `ApiClient` | `BaseRESTAdapter` is still a second path into it; consolidated in the Phase 13 consistency pass |

## 6. Reproduce

```bash
# unit + type + build (from frontend/)
pnpm typecheck && pnpm test && pnpm build && pnpm exec biome check src --reporter=summary

# live end-to-end (real Django on the pytest test database; throwaway, flushed when the run ends)
cd backend
SYNC_LIVE_INFO=/tmp/live.json SYNC_LIVE_STOP=/tmp/live.stop \
  uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q -s ../docs/sync/tools/live_backend.py &
# wait for /tmp/live.json, then:
cd ../frontend && SYNC_LIVE_INFO=/tmp/live.json pnpm test:live
touch /tmp/live.stop        # stops the server
```
A live run consumes its seeded state (the enrollment and password-change users, TOTP steps): restart the server for another run.

New captures: `docs/sync/tools/test_capture_{auth_flows,departments_flow,restricted_flow}.py` (see `tools/README.md`; pytest test database only, rolled back).

## 7. Removals (separate commits; every file listed)

| Commit | Removed | Why |
|---|---|---|
| `35a8256` | `ContractValidator` calls in `ApiClient`; untracked `generated/validator.ts` and `contract.ts` (local files, never committed; copies were not kept in the repo, the sibling `studiohub-react` has them) | logged warnings against a stale mock-era contract; broke clean checkouts |
| `36b84aa` | `core/testing/**` (11 files, 5,994 lines), `pages/TestingPage.tsx` + `pages/testing/**` (4, 1,687), `scripts/run-engine-tests.ts`, `scripts/runTestSuiteEngine.ts`; the `/testing` route, its permission-registry entry, sidebar item, command-palette entry, ApiHealth link, `TestRunner` special cases in the error handler | tested the removed mock layer; its parity harness made real requests and "passed" by reporting an unparsable URL as *blocked* |
| `4d8aa33` | `ReportsPage`, `NotificationsPage`, `DataPlatformPage` (376 lines), routes, sidebar items, registry entries (Q2) | no backend module; `/api/v1/reports/` is gone |
| `279bb87` | `getDemoUsers`, `useDemoUsers`, `demoUserUtils`, the `DemoUser` type, the demo block/handler in `LoginPage`, their test (153 lines) | the backend has no demo-users endpoint; the block was behind a constant `false` |
| `8b231c9` | login/logout "activity" recording in `AuthProvider` | fabricated local audit entries; the backend records logins itself |
| `75857cd` | `apiHealthData.ts`, `ApiHealthDashboard`, `components/health/*` (6 files, 2,295 lines), the "99.98%" sidebar badge and "SLA 99.98% Operational" label | simulated data presented as live telemetry |
| `a08beca` | `apiAuthorization`, `bulkAuthorizationEngine`, `resourceAuthorizationEngine`, `roleStore`, `EntityActionsMenu` (816 lines) | no references once evaluation went through `access.ts` |
| in feature commits | the "keep me signed in 30 days" checkbox, pre-filled login credentials, the 6-character login password rule, the old departments form fields (`head_*`, `capacity_*`, `member_count`), the `ADMIN_ONLY` prefix list and `ROLE_PERMISSIONS` lookup in `rbac.ts` | see §4.1 / §4.3 |
| (not in git) | `frontend/src/features/organizations/` | a tree of empty directories, no files |

34 tracked files, 11,410 lines deleted.

## 8. Process notes

- Two commits were made while a test was red (a command chain that committed regardless of the result): one was amended and one redone before anything else was built on them; every later commit was gated on a green typecheck and test run. `89f151a` (*pin VITE_API_URL*) is superseded by `9da84c5`, which is the change that actually works.
- By mistake I ran `git stash; git stash pop` in `/frontend`. With nothing to stash, the `pop` applied the **top of your existing stash** (`stash@{0}`, "WIP on develop: Task 2 round 1") and conflicted in `.serena/project.yml`; git keeps the entry on a conflicted pop. I restored that file to `HEAD`; the working tree is clean and **all four of your stashes are intact**. Nothing else was touched.

## 9. Decisions and approvals needed

1. **Go for Phase 2** (identity and access administration), including whether I should push the `sync/phase-0-discovery` and `sync/phase-1-foundation` branches (neither is pushed).
2. **CR-02** (seed the 18 enforced-but-unseeded permission codes; role assignment as agreed in Q7) must be approved before Phase 2 can be tested with non-superusers. No other CR blocks Phase 2.
3. Optional, low priority: Q-03 (compare `confirm_password`), Q-04 (`pending_actions` in `/auth/me/`), Q-05 (no-role label), Q-02 (file-less attachments).
