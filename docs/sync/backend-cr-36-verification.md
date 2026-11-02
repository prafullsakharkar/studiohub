# Phase 24 and CR-36: old docs removed, and a member bound to a show through the API: verification

Branch `sync/backend-cr-36` (from `sync/phase-24-docs-cleanup-and-cr-36`, which is from `develop` at `74a5453b`), **not pushed, not merged**. `main` was pushed at the owner's request (`1471f2b3`, develop through Phase 23). This branch **changes the backend** (CR-36, approved by the owner: "Approved CR-36").

## 1. Phase 24: the old frontend docs

On "Delete" (the owner's answer to the question about `frontend/docs/`): 46 tracked files, 5,021 lines: `access-control/` (and `access-control.md`), `api/`, `architecture/`, and the five root reports (`API_FRONTEND_PARITY`, `BACKEND_FRONTEND_CONSOLIDATION_REPORT`, `CALL_SITE_AND_DECIMAL_AUDIT`, `GLOBAL_PAGE_LAYOUT_AUDIT`, `SESSION-2026-09-30-consolidation`), plus 13 git-ignored generated files that were left under `docs/api`. Nothing in the tooling read any of it (checked: scripts, config, package.json). Two source comments that cited `docs/access-control` now cite ADR-0033. **Kept, because they were not named:** `frontend/docs/frontend` (the rewritten registry and the refactoring notes) and `frontend/docs/superpowers` (30 plan files). The root `CLAUDE.md` now states the frontend's real state and the sync rules.

## 2. CR-36: what the backend does now

`POST /api/organizations/projects/{id}/members/` takes `show`: omitted leaves a member's binding as it is, `null` releases them to the whole project, an id binds them (`scope: "SHOW"`); anything that is not a live show **of this project** is `400 {"show": ["Unknown show."]}` and nothing changes. It applies on create, on re-adding an existing member and on restoring a deleted one. The member rows (`GET` and the `POST` answer) carry read-only `show_id` and `show_code`. Contract **C-53**, decision **D-35** (`docs/production/`). No new permission: managing members is still superuser, global admin, or the project's creator.

The backend files: `api/serializers/membership.py`, `services/project_scoped.py` (`add_member(show=UNSET)`), `api/views/project_scoped.py`. Net 35 lines of source.

### One planned test became a different test

The approved plan said: "a member manager who is bound cannot widen their own binding". I first wrote a rule for it (a bound caller may only add members to their own show) and its tests failed with a 404 before reaching it: the members routes require **full** project access (`ProjectScopedAPIView._has_access`), so a member bound to a show gets 404 on every one of them. The rule was unreachable, so I **removed it** (no dead code) and a test now pins the 404 (`TestABoundMemberCannotManageMembers`). The guarantee holds, by a stronger existing guard.

## 3. The frontend

`ProjectMember` gains `show_id` and `show_code` (the pinned key list fails on the re-captured sample, as designed, and was updated); `addMember` takes `show`. The members panel (`modules/production/structure/panels.tsx`) gets a **Show** picker in the add form (only when the project has shows), a **Show** column, and for people who may change members a **per-row picker**.

There is no update route, so a change is an add, and the server's add has side effects on an existing member. **Captured** (`_membership_show_flow.json`): re-adding a suspended member who has two roles with only `{role, show}` answers `status: "active"`, `roles: ["Artist"]` (reactivated, a role lost); re-adding with their own `roles`, `status` and `scope` keeps `suspended` and both roles. `setMemberShow` therefore sends the member's own values back, and a test pins the exact payload. In the add form, "Whole project" sends **no** show (a new member is on the whole project, and someone already on the project keeps theirs); releasing is the row picker, which sends an explicit `null`.

## 4. Evidence

| Check | Result |
|---|---|
| Backend tests for CR-36 (`test_cr36_member_show.py`) | **16 pass**: bind on create; no show = whole project; re-add leaves the binding; null releases; move to another show; the list carries `show_id` and `show_code`; unknown, another project's, deleted and not-an-id shows refused with nothing stored; a refused show leaves an existing binding as it was; a non-manager cannot bind; a deleted membership restored with and without a show; **a member bound through the API sees only that show's shots and sees all of them again once released**; a bound project creator gets 404 on list and add |
| Backend mutations | **11 of 11 caught** (write field, project check, validation, `show_code`, list fields, re-add clearing, re-add ignoring, restore, create, view, deleted-show filter) |
| Backend regression | production, masterdata, audit and identity API tests: **3,087 pass**. The full backend suite was not run, as agreed |
| Frontend unit | 106 files / **1,049** tests (+1 file, +6; one existing test's mocks now route `/shows/`) |
| Frontend mutations | **9 caught** on the panel and the payload (drops status / roles / scope, release sends no show, the form always sends a show, plain text never names the show, selects shown to non-managers, picker with no shows, row select ignoring the binding), re-checked after a refactor |
| Live (real backend, fresh seed) | `memberShow.live` **1 of 1**: bind the artist to one of two shows from the real panel; the artist, signed in separately, sees only that show's shot; release from the row picker; status and roles unchanged; the artist sees all three shots. One live mutation caught (the panel never sends the show) |
| `tsc` / build / Biome / dead-file finder | 0 / OK / 0 errors, **801** warnings (the new files add none) / nothing new |
| Role smoke | **7 of 7** on the second run (§6) |

Fixture mistakes I made on the way, for the record: the live fixture first created shots with `show` instead of `show_id` (the shot input's name), so nothing was in a show and the bound artist rightly saw nothing; the first token read used the wrong response field.

## 5. An existing behaviour I noticed and did **not** change

Adding someone who is already a member writes `status` (the serializer default is `active`) and replaces `roles` with the one `role`. So today a plain re-add reactivates a suspended or terminated member and drops their other roles. That is how the endpoint was built ("idempotent add … updates") and it is why `setMemberShow` sends the values back. Whether it is intended is a question for you; it would be a separate change request if you want it fixed (the fix would be to default `status` to "leave as it is" for an existing member).

## 6. Smoke

**7 of 7 pass** (31.7 minutes), on the second run.

1. **First run: 6 of 7 (50.6 minutes).** The seeded artist's test never left sign-in: `#login-email-input` did not appear for the whole 10-minute test timeout. The failed test's trace shows three module requests of the login page (`schedulingFlow.ts`, `pickers.tsx`, `WorkspaceHeader.tsx`) with no response, and three `net::ERR_NETWORK_CHANGED` console errors: the host's network changed while the page loaded, the app never mounted, and `signIn` had no recovery. The same cause as the blank pages found in Phase 23, in a step that handling did not cover. The six other tests passed (one recovered by a route reload, `/assets`).
2. **Fix (`e2e/live/fixtures.ts`):** `signIn` loads the login page again, up to three times, when the email field does not appear within 30 s, logs `[role:signin-reload]`, and then fails with a clear message. No route check was relaxed.
3. **Second run: 7 of 7.** Four route reloads, each `ERR_NETWORK_CHANGED` and each recovered at the first reload (producer `/platform/health`, lead `/dashboard`, no-role `/media` and `/settings/system/values`); no sign-in reload was needed. The host's network is changing under the browser in most full runs, which is why the reload log is kept.

Nothing in this smoke touches the members panel (it visits static routes), so the CR-36 behaviour is proven by the unit tests, the backend tests and the live test in §4, not by this run.

## 7. Questions for the owner

1. ~~Merge into `develop` and push~~ (done at the owner's request, once green).
2. **The re-add behaviour in §5:** leave as is, or a change request?
3. **Department narrowing** (the same missing write path) and **removing a member** (no route) were left out of CR-36 as proposed. Want either?
