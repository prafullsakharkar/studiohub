# Phase 23: the invented show id removed, and the frontend docs corrected: verification

Branch `sync/phase-23-show-context-and-docs` (from `develop` at `537a7688`, which holds Phases 14 to 22), **not pushed, not merged**. No backend file was touched. `main` is untouched.

Two parts, as proposed at the end of Phase 22 (the owner's "Phase 23" followed "merge and push").

## 1. The invented show id

### What was wrong

The toolbar project switcher and the project workspace page stored `activeShowId = "show-<project id>-main"` in the production store, and `usePermissions` passed it into every permission check as `showId`. No such show exists: it was a string made up on the client.

It matters because the backend does bind a membership to **one real show** (`ProjectMembership.show`, ADR-0033 D2; `/auth/me` returns `scope: "SHOW"` and `show_id` for it), and `core/permissions/access.ts` refuses a SHOW-scoped member when the context names a different show. So a show-bound member was denied everything in the UI, because their real `show_id` never equals the made-up one. Evidence in code: `membershipAllows` in `access.ts` (`memberShow !== context.showId` returns false); the test below fails with the made-up id put back.

How reachable it is today: the membership API has no `show` field (the serializer cannot set one); only the management command `assign_shows` binds a membership to a show. So no screen could produce such a member, which is why nothing showed it. It is a latent defect, not an active one, and I am recording it as that.

The same family: `/shows/:showId` rendered the **project** workspace with the show's id used as the project id (`projectId || id || showId`), which could never be found. Nothing in the app linked to it.

### What it is now

- The store (`useProductionStore`) holds no show: `activeShowId`, `setActiveShow` and `clearShow` are gone, with their uses in `ProjectSwitcher`, `ProjectWorkspacePage`, `AppLayout`, `usePermissions` and `sessionCleanup`. A caller that means a show passes its real id (`useCan(code, { showId })`, `can({ showId })`); that stays supported.
- The persisted state is **version 1** with a migration that drops the stored `activeShowId`, so browsers that stored the made-up id do not keep it for good (a test seeds a version-0 state and checks the stored copy too).
- `/shows/:showId` is `ShowRedirectPage`: it reads the show (`GET /api/v1/shows/{id}/`, which answers `project_id`) and opens that project; a show that cannot be read gets a "Show not found" state with a link to the project list. Verified live.

## 2. The frontend docs

`frontend/CLAUDE.md` is read at the start of every session, and it described a codebase that no longer exists. Corrected to the file tree:

| Claimed | Reality |
|---|---|
| `BaseRepository`, module `repositories/`, "create a repository, then a service" | removed in Phase 20; the typed API is `src/api/<app>/` |
| `shared/crud`, `shared/views`, `core/repository`, `core/workspace` | removed (Phases 13, 20, 22) |
| `<Can>`, `<HasRole>`, `<ProtectedComponent>` | removed in Phase 13; the gates are `useCan`, `PermissionGate`, `PermissionButton` |
| an `@/components` barrel and `components/{data,workspace,entity,navigation}` | never existed in this tree |
| `types/auth.ts`, `drf.ts`, `crud.ts`; `ProjectService` as the import example | the types are `common.ts` and `identity.ts`; the service is gone |
| modules `intelligence`, `platform` (notifications, billing, reports) | `intelligence` does not exist; `platform` holds health; the real module list is now written out |

`frontend/docs/frontend/CANONICAL_COMPONENTS.md` named **54 sources, 40 of which do not exist**. It is rewritten from the file tree, and I checked mechanically that every path and every named export in it exists (the check found one wrong row, `PermissionControl`, which exports hooks and a wrapper, now stated correctly). `docs/sync/README.md` is brought up to Phase 23 and its deferral list to what is actually still open. Two empty leftover directories (`core/activity/__tests__`, `api/analytics/__tests__`) were removed.

**Not touched, and stale in places:** the other documents under `frontend/docs/` (`access-control/`, `api/`, `architecture/`, the audit reports). They are dated analyses and plans, several of them about the removed organization model; I did not audit them and did not edit them. They should be read as history.

## 3. Gates

| Gate | After Phase 22 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 103 files / 1,039 | **105 files / 1,043** (+2 files, +4 tests: show-bound permissions, the show redirect; the store test was rewritten, 3 tests before and after) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 0 errors / 802 warnings | **0 errors / 801 warnings** (the new files add none) |
| Dead-file finder | tests, key lists, helpers only | **the same** |
| Live vitest (fresh seed) | `bulkRoutes` 3/3, `auth` 18/18 | `showRedirect.live` **2 of 2** (a real show opens its project; a missing show says so) |
| Playwright role smoke | 7 of 7 (third run) | **7 of 7** on the fourth run (see §5) |

Net for the phase (frontend, against `develop`): 17 files, +334 / −305.

## 4. Mutation checks (break the code, expect a test to fail): 5 caught

The permission defaults given a made-up show again; the redirect using the show id as the project id; no not-found state; the persisted-state version left unchanged (migration never runs); the migration keeping the old key. The live test was not mutated separately (its unit twin was).

## 5. Smoke

**7 of 7 pass** (21.2 minutes), after four runs that did not. The history, in full, because it changed the smoke spec:

1. **First full run: 6 of 7.** The no-role user: `/scheduling/capacity: expected to be refused, was shown`.
2. **Stress run, the two roles that failed, 4 repeats each: 3 of 8 failed** (`/access/roles`, `/deliveries`, `/scheduling/capacity`). With the spec extended to attach what the page said, the evidence in every case was `text=""` and `guard=[]`: the page was **blank** and the route guard had never run. The spec counted a blank page as "shown".
3. **Stress run, blank pages now reported as their own problem, 6 runs: 2 failed** (`/automations`, `/scheduling/milestones`). Each blank page's console showed `net::ERR_NETWORK_CHANGED`: Chrome aborts a page's in-flight requests when the **host's network changes**, so the app's modules never loaded and it never mounted. Nothing about the route, the guard or this branch is involved.
4. **Spec fix, then the full run: 7 of 7.** The spec waits for the app to mount before reading, reloads a page that stays blank (up to 3 times), and lists every reload. This run had **4 reloads in 3 roles** (`/settings/account/sessions`, `/deliveries/destinations`, `/settings/system/themes`, `/login-history`), each with `ERR_NETWORK_CHANGED`, each recovered at the first reload. So the host's network did change under the browser during this run too; the reload log keeps that visible. A route that stays blank after three reloads is still a failure, and a refused route still has to end on the forbidden page: no expectation was relaxed.

**Phase 22's first failure** (production admin, `/system-logs` read as shown, no 403, a "Request Timeout" toast) has the same signature, and I now think it was the same cause. That is an inference: the evidence capture did not exist then, so I cannot prove it.

Changes to `frontend/e2e/live/roles.smoke.spec.ts`: wait for `#root` to have content before reading; a blank page is reloaded up to three times and the reloads are logged (`[role:reloads]`, `[role:premount]`); a route that is still blank is reported as "the page stayed blank" with the requests still pending and the last console errors; a mismatch on a route expected to be refused prints the URL, the page text and the guard's console decisions.

## 6. Questions for the owner

1. ~~Merge into `develop` and push~~ (done at the owner's request, once green).
2. **Show-bound memberships:** the model and the permission engine support them; the API and the screens cannot create one. Either that feature is to be finished (a `show` field on the membership API and a picker in the project members panel, a backend change request first) or the model field and the `SHOW` scope handling are dead weight. I have not decided this for you.
3. **What next?** What I know is left that is not a feature: the older documents under `frontend/docs/` (audit them, mark them historical, or delete them), and the deferred features in `docs/sync/README.md`. If you have a feature in mind, name it.
