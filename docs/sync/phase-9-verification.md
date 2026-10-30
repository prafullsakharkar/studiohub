# Phase 9 — Publishing: verification

Branch `sync/phase-9-publishing` (from `develop` after the Phase 8 merge, `ba5c1c33`), **not pushed, not merged**. Backend requests **CR-22**, **CR-23** and **CR-24** were approved and **applied** in one backend commit (`f20dc00e`, see §8); nothing is open from this phase.

## 1. Exit criteria

The plan names a scope and no exit test, so I set one: *an export job runs its course with the roles the studio seeds, a published file can be registered, deprecated, restored and revoked, and a revocation reaches the deliveries that hold the file.*

| Criterion | Result | Evidence |
|---|---|---|
| An export job runs to Exported from the page | ✅ live | `publishing.live` › a producer validates (the page says nothing was checked, because no rules are configured), starts the export, completes it; the page shows `Exported`, the legacy `status` word still says "Published" |
| Republish | ✅ live | a new Pending job appears; the exported one is untouched |
| A failure, a retry, a cancellation | ✅ live | Mark failed needs a reason before anything is sent, the reason shows on the job, Retry returns it to Pending, Cancel job is final |
| A file is deprecated and restored | ✅ live | from the file page, with a note |
| A supervisor revokes; only they read why | ✅ live | the reason is required; afterwards the file has no actions; the artist reads "revoked" and an empty reason |
| Registering is idempotent and a path names its content for good | ✅ live | an identical retry returns the same file; different content under the path is refused |
| Register many | ✅ live | one file registered, one refused with the rule it broke (`..`), each on its own |
| A revocation reaches deliveries | ✅ live | revoking the files of a version that a **Signed Off** delivery holds sends the delivery back to Ready, by the system, with the reason "content revoked" in its history |
| Role-correct UI | ✅ unit + live | the toolbar offers only what the job's status allows and the caller's codes permit; an artist reads and sees no controls |
| Scope: files, storage roots, destinations, project tab | ✅ with gaps | §3, §6 |

Live: `publishing` 3 tests on a fresh seed. Re-run on fresh seeds because the harness changed (its published versions now have shots, which an export job needs) or because shared list code changed: `deliveries` 4 (twice), `departments` 10, `work` 7.

## 2. Quality gates

| Gate | Phase 8 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 88 files / 744 | **90 files / 798** |
| Live tests | 11 files / 69 | **12 files / 72** |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2316 warnings | **2 errors (the same two) / 2272 warnings** |
| Clean `git worktree` | typecheck 0, 744/744 | **typecheck 0, 798/798** |
| Net size (frontend) | | 35 files, +10,000 / −2,032 against `develop` (mostly the captured sample, the tests and the screens) |

Mutation checks (break the code, expect a failure): the permission filter on the action bar, the required reason, a status in the action table, delete visibility by status, showing the legacy status word instead of `job_status`, sending the root's id instead of its code, showing a search box the route does not have, and an invented interface field.

## 3. What was built

- **Typed API** (`src/api/publishing/`): `publishApi` (list, detail, create, edit, delete, validate, start/complete export, fail, retry, unpublish, republish), `publishedFilesApi` (list, detail, register, bulk register, deprecate, restore, revoke), storage roots and destinations; compiled key lists; `publishingFlow.ts`, the action tables (job and file), pinned to the captured server and to `docs/publishing/CONTRACTS.md`.
- **Export jobs** (`/publishing`, `/publishing/new`, `/publishing/:id/edit`, `/publishing/:id`): list by the job's real status; form (project and version chosen once; without a version, the shot or asset); workspace with an action bar built from the status and the caller's codes, a Details tab, a Validation tab that says plainly when no rules exist, and a Changes tab.
- **Published files** (`/publishing/files…`): list with Project, Status, Role and "latest of each role" filters and lifecycle row actions; a file page (where it is, the checksum, the state, the reason for a revocation for those who may see it, the actions); a registration form; and a **Register many** page that takes a manifest and reports each file.
- **Storage roots** and **destinations**: list and form each (the root's code is chosen once).
- **Project tab**: the project's registered files from the server (the files list filters by project).
- **Messages**: a move the status no longer allows says from where to where; a path already registered with other content says what that means.
- **Shared list**: `searchable: false` hides a search box the route does not support.
- **Live harness**: the published versions get shots.

## 4. Removed (no silent deletions)

Separate commit `67d78cd6` (9 files, −1,723 lines), unreachable from `main.tsx` and imported by no test: `CreatePublishModal`, `PublishCard`, `PublishDetailsModal`, `PublishHistoryModal`, `RepublishModal`, `UnpublishModal`, `usePublishing`, `PublishingService`, and the old `PublishingPage`. Also replaced in place: the project Publishing tab (313 lines), which showed placeholders and never called the API, and the `/publishing` registry entry, which was gated on `version.view` instead of `publishing.view`.

## 5. Findings (details in `backend-change-requests.md`, "Phase 9 findings")

1. **CR-22** — the export-job list ignores every filter but `search`; its rows carry no project id, the detail has no `version_id`, and there is no project route (404). A project's jobs cannot be listed and a job's files cannot be found from the job.
2. **CR-23** — `DELETE` on a job succeeds when a registered file refers to it, and in any status; the contract says it is refused for jobs with files.
3. **CR-24** — a publish destination's `type` is not validated (as CR-19 was).
4. The legacy `status` of a job calls both Validated and Exported "Published"; the screens use `job_status`, as the contract (API-PUB-08) intended.
5. Validating with no rules configured passes with nothing checked; the screen says so instead of showing a green tick.
6. Leaving the final Revoked state is 400 without an override reason and 403 with one: no role holds the override code, a superuser included.
7. The seeded matrix: a supervisor registers and **revokes** files but cannot delete jobs; a production-admin does everything but manage storage roots (a platform administrator's); a lead-artist and an artist read.
8. Deleting a storage root that holds files is a 400 "Retire it instead.", not a 409.
9. **My own slips this phase:** the first capture used a root the production-admin cannot create (403) and bodies missing `dcc_tool` and a shot, so most job calls failed until I fixed the script; my first project route (`/projects/{id}/publishing/`) does not exist; a `sed` mutation that matched nothing passed silently until I redid it; and the deliveries live bulk-cancel test, which I wrote last phase, had a race (ticking rows before the search had replaced the list) that this phase's harness change exposed. All found by runs.

## 6. Deferred / not done

- **Checksum verification** (`verify_published_files`) runs on the server by hand or cron; there is no screen for it, and files show the checksum state they have.
- **A file's history** (who deprecated or revoked it, when): the registry keeps it in a table the API does not expose; the file page shows when the status last changed.
- **Validation rules** are managed in the admin only, by design (no API).
- **Overrides** (`publishing.status.override`) are held by no role and have no screen.
- The Phase 6 to 8 deferrals stand.

## 7. Questions for the owner

Answered: **CR-22 / CR-23 / CR-24** approved ("go") and applied (§8). Nothing is open from this phase.

## 8. Follow-up: CR-22, CR-23 and CR-24 applied (one backend commit, targeted tests only)

| Change | Where | Contract |
|---|---|---|
| the job list filters: `status` (stored or read words, any case), `job_status`, `dcc_tool`, `entity_type`, `project`/`project_id`, `version`/`version_id` (a non-id is a 400); rows carry `project_id`, the detail `version_id` | `api/filtersets/publish.py` (`PublishFilterSet`), `api/viewsets/publish.py`, `api/serializers/publish.py` | API-PUB-15 |
| `DELETE` only for Pending and Cancelled jobs (409 `job_not_editable`), and never for a job that registered files refer to (409 `job_has_files`) | `api/viewsets/publish.py` (`perform_destroy`), `exceptions.py` | API-PUB-16 |
| a destination's `type` is one of the seven (a saved row keeps its old value when sent back unchanged) | `api/serializers/destination.py` | API-PUB-17 |

- **Tests:** `apps/publishing/tests/api/test_job_list_delete_type.py`, 18 tests; eight source changes were reverted in turn (status guard, files guard, `filterset_class`, list `project_id`, detail `version_id`, destination type, archived in Unpublished, tool case) and the file failed each time. The whole publishing app: **586 passed**; `ruff check apps/publishing` clean; `makemigrations --check` reports no changes. The full backend suite was **not** run.
- **Samples:** `_flow.json` was captured again with new probes (`status` Queued/Published/Unpublished/Banana, `job_status`, tool in two cases, version and project under both spellings, a non-id version, delete of a Validated job). The destination `S3` probe now records the 400.
- **Frontend:** the job list offers Status (stored words), Tool and Project filters; a project's tab shows **its export jobs and then its files**, both filtered on the server (the project is no column and no filter there); the job workspace has a **Files** tab (the files of the job's version, since the registry cannot filter by job; a job without a version says so). Contract tests rewritten to the new behaviour, two new unit tests (filters and scoped list; Files tab), each change mutation-checked (status key, tool key, project scope, version scope, project-tab jobs, and the `project_id` / `version_id` interface fields). Unit tests **798 / 90 files**, typecheck 0, build OK, Biome 0 errors in the files changed. `publishing.live` re-run against the changed backend (3/3) now also checks the filters, the ids and the delete rule.
- **Still true:** there is no per-project route for jobs (`/api/organizations/projects/{id}/publishing/` is 404); the screens use `?project_id=`. The files registry cannot be filtered by export job (`export_job_id` is returned but not a filter), so the Files tab shows the version's files.
