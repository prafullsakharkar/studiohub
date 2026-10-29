# Phase 4 — Audit & activity viewer: verification

Branch `sync/phase-4-audit` (from the Phase 3 tip; `git log sync/phase-3-masterdata..HEAD` lists the commits), **not pushed**. No backend file changed. Q-08 was decided at the start of the phase: self-deactivation stays as designed.

## 1. Exit criteria

| Criterion | Result | Evidence |
|---|---|---|
| Editing a department shows a ChangeLog row with the actor and the field diff in its History panel | ✅ live | `audit.live` › *editing a department…*: create + update rows (newest first); expanding the update shows `name` and `color` before → after; the actor is shown. Same component is the Activity tab of departments, teams, offices and people, and a new History tab on clients and vendors |
| Saving a form updates an open History | ✅ live | the real team form saved next to an open `EntityHistory`: the API then lists `update, create` with `changed_fields: ['capacity']` |
| Audit log, change log, activity, API requests, tracks, background jobs (cancel / retry), error logs (resolve) | ✅ unit + live | `LogListPage` + 7 configs; live: change log filters (`target_type`, `change_type`) on the server, cancel a queued job, retry a failed one, resolve an error; a user without `audit.view` gets 403 on reads and actions |
| Login history path fixed | ✅ | the Logins tab went to a path that does not exist; it now opens the identity security log (Phase 2) |
| Client-side audit/activity shims removed | ✅ for masterdata, ⏳ production | 24 `trackEntityMutation` calls removed from the directory hooks; the remaining one and `useActivityStore` belong to production modules (Phases 5–7) |
| Quality gates | ✅ | below |

Live: `audit.live` 6 tests (the job test consumes seeded rows, so rerun it on a fresh seed); earlier files not re-run this phase except through the unit suite.

## 2. Quality gates

| Gate | Phase 3 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 70 files / 498 | **73 files / 517** (+ 6 live files / 48 tests) |
| `pnpm build` | OK | **OK** |
| Biome | 2 errors / 3612 warnings | **2 errors (the same two) / 3469 warnings** |
| Net size (frontend) | | 37 files, +1,196 / −6,013 |

Mutation check: dropping the `entity_id` match on audit events fails its test.

## 3. What was built

| Area | Where |
|---|---|
| Capture | `docs/sync/tools/test_capture_audit.py` → `samples/audit/_audit_flow.json` (edits through the API, then every audit route, filters, actions, a non-privileged caller) |
| Typed API | `api/audit/audit.ts`; row types pinned to the capture with exhaustive `Record<keyof T, true>` tests |
| History | `components/history/EntityHistory` (ChangeLog by `target_type` + `target_id`, diff, load older, audit events via the CR-03 workaround, no request without `audit.view`) |
| Log viewer | `modules/audit/viewer/{LogListPage,configs}` replacing seven pages; workspace shells and routes unchanged |

## 4. Removed (no silent deletions)

| What | Why |
|---|---|
| Seven audit pages (about 4,250 lines, replaced in place) | hand-written per log, backed by `auditServices`/`auditRepositories` with their own param names; replaced by one viewer |
| `modules/audit/{services/auditServices,repositories/auditRepositories,hooks/useAudit,hooks/useEntityChangeLog}.ts` | fed only the replaced pages and the flat Activity tabs (import-graph walk); separate commit |
| 24 `trackEntityMutation` calls in the directory hooks | wrote fake local activity events (a comment says they simulated server auditing in mock mode); History is now the backend's; separate commit |

## 5. Findings (details in backend-change-requests.md, Q-15)

- **CR-04 confirmed live:** positions, contracts, contacts and catalog rows leave no change log, and a client edit that only touches `contact_name` leaves none (the tracked client fields are a subset). History is silent for those. A live test pins this so it fails (usefully) when the backend starts tracking them.
- ~~AuditLog gets no rows for plain masterdata edits; the audit-event half of History is normally empty.~~ **Wrong, corrected in Phase 6:** the in-process capture saw no rows because AuditLog lines are written on commit, which a rolled-back test transaction never reaches. A real server writes one line per create/update/delete ("update by <user>: masterdata.Department updated"), shown under "Audit events". The Phase 4 live test counted every list item in the panel and passed only because it asserted before the events query returned; it now counts the change-log list only.
- Cancelling a cancelled job and retrying a non-failed one answer 200 without effect, so only valid actions are offered.
- **My own errors:** the new `logs` directory is matched by the repo's ignore rules, so the first commit would have been broken on a fresh checkout (caught before pushing, directory renamed `viewer`); the confirm button of the "Cancel" job action was itself labelled "Cancel" (found by the live run).

## 6. Deferred / not done

- `useActivityStore` and the last `trackEntityMutation` call (assets, shots, tasks, episodes, sequences, projects): Phases 5–7.
- Status-history on shots/tasks/versions: Phases 6–7 (the panel takes them as another source).
- Roles/groups/users History: RBAC writes emit SecurityEvents (Phase 2 security log), not ChangeLogs.
- A shared ignore-rule check for new directory names was not added.
