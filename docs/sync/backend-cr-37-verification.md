# CR-37: a project member edited and removed by id, a department set: verification

Branch `sync/cr-37-member-detail` (from `develop` at `1cdef773`), **not pushed, not merged**. This branch **changes the backend** (CR-37, approved by the owner: "Approved CR-37"). The frontend CI job is a separate branch, `sync/ci-frontend` (§6).

## 1. What the backend does now

| Route | Behaviour |
|---|---|
| `PATCH /api/organizations/projects/{id}/members/{member_id}/` | Changes **only what is sent**: `role`, `roles`, `role_id`, `status` (`active`, `on_leave`, `terminated`, `suspended`, case-insensitive), `show` (`null` releases to the whole project, an id binds; another project's or a deleted show is `400 Unknown show.`), `department` and `department_id` (the text a task's department is matched against; blank clears). A `role` without `roles` also sets `roles` to `[role]`, so the change shows. An empty body, or only fields that are not editable, is `400 Nothing to update.` Answers `200` with the member row. |
| `DELETE …/members/{member_id}/` | `204`, a soft delete: the member loses the project at once and is no longer listed; adding the user again restores the same row. What they were assigned is left alone. |
| both | Same privilege as adding (superuser, global admin, or the project's creator, else `403`). A member narrowed to a show or a department gets `404` (full project access is required), as on every members route. **Nobody may take their own membership off the project**: `DELETE`, or `status` other than `active`, is `400 "You cannot take your own membership off the project."` (platform administrators included, for themselves only). |
| `POST …/members/` | **Unchanged.** |

Backend files: `api/serializers/membership.py` (a shared mixin for the two resolvers, the update serializer), `services/project_scoped.py` (`update_member`, `remove_member`), `api/views/project_scoped.py` (`ProjectMemberDetailView`), `api/urls_project_scoped.py`. No migration. Contract **C-54**, decision **D-36** (`docs/production/`).

### Found while building it (not in the request)

- **A restored member kept the department they had.** `add_member`'s restore branch resets the other fields to "fresh values" but never the department text, which only became reachable now that the API can set one. Fixed (`membership.department = ""`), with a test (`test_a_restored_member_starts_fresh_without_the_department_they_had`) that a mutation shows is load-bearing.
- **An unmapped method on the new route answers `403`, not `405`** (the permission layer runs first: the platform's known CR-06 behaviour). I first added `http_method_names` to get a 405, found it could never be reached, and removed it. The test pins the 403.
- **The captured evidence for the access claim was wrong the first time** (the member held no permission codes, so even an active member got 403); I re-captured with the codes granted, and the numbers in the request (active 200, suspended 404, removed 404) are from that.

## 2. The frontend

The members panel (`modules/production/structure/panels.tsx`) gets, for people who may change members: a **Status** select (the four the server knows; disabled, with the reason as its title, on the signed-in person's own row), a **Department** field (the department is set when the field is left, trimmed; nothing is sent if it did not change), a **Remove** action with a confirmation (not offered on the own row), and the **show picker now sends only `{show}` in a `PATCH`**: the Phase 25 workaround that re-added a member with their own role, roles, status and scope (`setMemberShow`) is deleted. The API module gets `updateMember`, `removeMember`, `ProjectMemberPatch` and `MEMBER_STATUSES`; `addMember`'s input is back to `{user_id | email, role, show?}`.

The server's refusals (for instance the own-membership rule) reach the person as the central error handler's toast; the panel's own `notify.fromError` is redundant with it (the store de-duplicates, so it is said once) and is kept so a rejected promise never escapes an event handler.

## 3. Evidence

| Check | Result |
|---|---|
| Backend tests for CR-37 (`test_cr37_member_detail.py`) | **25 pass**: every field on its own; a role alone is the list; a canonical role linked, an unknown one refused; an empty body and unknown-only fields refused; user, project and external ids not editable; **status takes access away and gives it back (the member really gets 404, then 200)**; show bound, released, and another project's or a deleted show refused; department set, cleared, and **a department set through the API narrows what the member lists (case-insensitive) and widens again when cleared**; removal loses access and drops the row from the list; an add restores the same row **without the old department**; assignments left alone; a removed member cannot be changed or removed again; unknown, other-project and other-project's-id members are 404; unmapped methods refused; a non-manager refused with nothing changed; a member narrowed to a show gets 404; the creator and an administrator cannot remove or deactivate themselves, can still change everything else about themselves, an administrator can remove someone else |
| Backend mutations | **16 of 16 caught** (empty body accepted, role alone leaves the list, role_id never linked, show not validated, status and department not editable, own status change allowed, own removal allowed, own re-activation refused too, another project's member editable, a removed member editable, no manager check on either verb, update never saved, remove does nothing, restore keeps the department) |
| Backend regression | production, masterdata, audit and identity API tests: **3,111 pass** (3,087 before + 24; one more test was added after). The full backend suite was not run, as agreed |
| Frontend unit | 106 files / **1,055** tests (+6; the member tests were rewritten around `PATCH`) |
| Frontend mutations | **12 of 13 caught** on the panel and the API module (update and remove routes, a missing status, extra fields on a patch, the own-row guards, removal without a confirmation, confirming that removes nothing, an unchanged or untrimmed department, the Remove column for non-managers). The one not caught, "a refusal is swallowed", is **equivalent**: the central error handler already reports it, so the toast is the same; the test counts it and asserts it is said exactly once |
| Live (real backend, fresh seed) | `memberShow.live` **2 of 2**: bind from the panel and the artist sees only that show; release; **suspend and the artist gets 404 on the project, active again and 200**; a department set and cleared; **Remove with a confirmation, then the artist is gone from the list and gets 404; adding them again restores them**. One live mutation caught (a status change that sends nothing). Two failures on the way were mine: a race (the test used the department field before the table re-rendered it) |
| `tsc` / build / Biome / dead-file finder | 0 / OK / **0 errors, 801 warnings** (unchanged) / nothing new |
| Role smoke | **7 of 7** on the third run (§5) |

## 4. Decisions you made, and one I did not

You approved CR-37 as written: the self-protection guard, `POST` unchanged, delete as a soft delete. I added nothing that is not in it, except the department reset on restore above (a consequence of making a department settable) and the shared serializer mixin.

## 5. Smoke

**7 of 7 pass** (21.6 minutes), on the third run. The history, in full:

1. **First run: 6 of 7 (40.5 minutes).** The platform administrator's test: `/workspace: the error boundary caught a render error`. `/workspace` is a redirect to the dashboard; the trace shows two of the dashboard's module requests (`DashboardErrorState.tsx`, `DashboardWidget.tsx`) with no response, and `net::ERR_NETWORK_CHANGED` plus request timeouts in the console at that moment: the host's network changed, a lazy module failed to load and the error boundary caught the rejected import. The earlier handling reloaded **blank** pages only, not this form of the same failure. (The second test of that run was the supervisor, whose `/error-logs` recovered by a reload; the other four passed.)
2. **Fix (`e2e/live/roles.smoke.spec.ts`):** a page that lands on the error boundary is reloaded up to three times as a blank page is, each reload logged with its kind and the last console error. A real render error returns on every load and still fails.
3. **Second run: 7 of 7**, with five route reloads, each `(blank)` with `ERR_NETWORK_CHANGED` and each recovered on the first reload (`/settings/account/security`, `/platform/admin` twice, `/publishing/files`, `/settings/system/localizations`); no sign-in reload needed.

This smoke visits static routes, so it does not exercise the members panel: CR-37's behaviour is proven by the backend tests, the unit tests and the live test in §3.

## 6. Frontend CI (branch `sync/ci-frontend`, commit `bfd16e5d`, from `develop`)

A `frontend` job in `.github/workflows/ci.yml`: Node 24, pnpm 10.12.1 (the lock file's), from `frontend/`: `pnpm typecheck`, `pnpm exec biome check src --diagnostic-level=error`, `pnpm test`, `pnpm build`; on every push to `main` and `develop` and every pull request. Pinned the way the file already is (`actions/checkout` as before; `actions/setup-node` v4.4.0, commit `49933ea5288caeca8642d1e84afbd3f7d6820020`, looked up through the GitHub API, not guessed). **Verified in a clean `git worktree`** with no `.env` and no `node_modules`: install, `tsc`, Biome, 1,049 tests and the build pass; the Biome and `tsc` steps exit non-zero on a deliberate fault and zero again once it is removed. **Not run on GitHub**: it will run for the first time on the first push, so the first real result is the proof of the workflow (the YAML parses, and every command in it was run). The browser smoke and the live vitest files need a seeded backend and stay manual. I did not add a Dependabot entry for `npm`.

## 7. Questions for the owner

1. ~~Merge `sync/cr-37-member-detail` and `sync/ci-frontend` into `develop` and push~~ (done at the owner's request, once green).
2. ~~Dependabot for `frontend/` (npm)~~ (added on the CI branch at the owner's request: weekly, minor and patch updates grouped).
3. **What next?** Of the deferred features: applying the chosen theme and locale (the settings exist and change nothing), scheduling week/day/timeline views, the delivery milestone picker, cancelling a leave (needs a backend change), the checksum screen.
