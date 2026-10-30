# Phase 8 — Deliveries: verification

Branch `sync/phase-8-deliveries` (from `develop` after the Phase 7 merge, `93aefef3`), **not pushed, not merged**. No backend file changed. Five backend requests were found and then **applied** on the owner's go, in one backend commit with tests (§8): **CR-17** to **CR-21**.

## 1. Exit criteria

The plan names a scope and no exit test, so I set one: *a delivery runs from Draft to Completed with the roles the studio seeds, the guards hold, and a rejected delivery can be revised.*

| Criterion | Result | Evidence |
|---|---|---|
| Draft → Validating → Ready from the page | ✅ live | `deliveries.live` › a supervisor adds two published versions from the picker, validates (the checks open), prepares; the manifest checksum is a real SHA-256 |
| Nobody signs off what they prepared | ✅ live | the supervisor's Sign off is refused and the dialog says "You prepared this delivery, so someone else must sign it off."; the status stays Ready |
| A different person signs off, then sends | ✅ live | the producer signs off (Send is not offered before), sends with a transfer reference; every file is `frozen_at` and the Add control is gone |
| Passcode only for holders of `delivery.view_secret` | ✅ live + unit | the page asks for it only on request; the producer reads the real value, a supervisor has no button |
| Client answer, complete, history | ✅ live | approve with notes → Approved → Complete → Completed; the history lists every move in the reader's words (Ready, Completed) |
| Reject, then revise | ✅ live | a rejection needs a reason before anything is sent (browser-side), the reason shows on the delivery; Revise opens a new Draft with `revision_of` and the same versions |
| Cancel and bulk cancel | ✅ live | two drafts cancelled together from the list with one reason |
| Role-correct UI | ✅ unit + live | the toolbar offers only what the status allows and the caller's codes permit; an artist reads and sees no controls |
| Scope: items, QC and history tabs, destinations, project tab | ✅ with gaps | §3, §6 |

Live: `deliveries` 4 tests (3 at first, a fourth added with the fixes), passing on fresh seeds. No other live file was re-run: this phase changed no shared code (no directory, form or auth change); the harness gained a producer user and a delivery fixture only.

## 2. Quality gates

| Gate | Phase 7 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 86 files / 684 | **88 files / 744** |
| Live tests | 10 files / 65 | **11 files / 69** |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2362 warnings | **2 errors (the same two) / 2316 warnings** |
| Clean `git worktree` | typecheck 0, 684/684 | **typecheck 0, 744/744** |
| Net size (frontend) | | 34 files, +10,285 / −2,841 against `develop` (most of the additions are the captured sample, the tests and the screens) |

Mutation checks (break the code, expect a failure): the permission filter on the toolbar, the required rejection reason, delete visibility by status, the project route, hiding Remove for a checked item, the due-date conversion, the sign-off permission, Send from Ready, delete of Submitted, and an invented interface field (the compile-time key lists).

## 3. What was built

- **Typed API** (`src/api/deliveries/`): `deliveriesApi` (list, detail, create, update, delete, add/remove version, validate, retry, prepare, sign off, reopen, send, client approve/reject, complete, cancel, revise, bulk cancel, history, QC, passcode, a project's deliveries), `destinationsApi`; compiled key lists; `deliveryFlow.ts`, the action table (which actions each status offers and which code each needs, pinned to the captured server and to `docs/deliveries/CONTRACTS.md`).
- **List** (`/deliveries`): search, sort and the Project, Status, Client and Method filters (server-side), the client's answer, due date (red when overdue), size, items; Edit and Delete only where the status allows; bulk "Cancel deliveries" with one reason and a per-id summary; CSV export; a link to destinations.
- **Form** (`/deliveries/new`, `/deliveries/:id/edit`): project, client and code are chosen once (create only), method, destination, due day, write-only passcode, notes.
- **Workspace** (`/deliveries/:id`): header with status, client answer, facts; an action bar built from the status and the caller's codes, each behind a dialog that asks for what the call needs (notes, transfer reference, a required rejection reason) and keeps the server's reason on screen; tabs for Items (add a published version, remove while the delivery is being prepared, per-file detail, "frozen record" once sent), Quality checks (runs, outcomes, in words), Status history, Details (including the audited passcode reveal and the manifest checksum), and Changes.
- **Destinations** (`/deliveries/destinations…`): list and form (seven types, default, active, credentials flag).
- **Project tab** replaced by the scoped list from the project route.
- **Messages**: a failed check lists what failed ("The files match their checksums (1 file(s) are missing…)"), a refused version says why ("That version is not published. Publish it first."), a move the status no longer allows says from where to where.

## 4. Removed (no silent deletions)

Separate commit `45a64c8a` (10 files, −1,319 lines), all unreachable from `main.tsx` and imported by no test: `CreateDeliveryModal`, `AddVersionModal`, `DeliveryApprovalModal`, `DeliveryRejectModal`, `DeliveryCancelModal`, `DeliveryCard`, `useDeliveries`, `useDeliveryWorkspace`, `DeliveryService`, and `shared/utils/mediaUtils.ts` (its only users were these). Also replaced in place: the old `DeliveriesPage` (356 lines) and `DeliveryWorkspacePage` (930 lines), and the project Deliveries tab (245 lines), which never called the API: it ran on an in-memory list of placeholders.

Left alone on purpose: the delivery repository interface and REST adapter in `api/repositories/` and `ClientDeliveryHealth` on the dashboard (Phase 12 owns the dashboard).

## 5. Findings (details in `backend-change-requests.md`, "Phase 8 findings")

1. **CR-17** — the delivery lists ignored every filter but `search`. **Applied** (§8): status (the read or the stored word), client, project, destination and method now filter, on the list and on the project route.
2. **CR-18** — `DELETE` succeeded on Submitted and Completed deliveries. **Applied**: only a Draft or a Cancelled one can be deleted.
3. **CR-19** — a destination's `type` accepted any text. **Applied**: one of the seven.
4. **CR-20** — an item could not be removed once the delivery was validated or prepared (a generic 409). **Applied**: it can; its check rows stay as history.
5. **CR-21** — history, QC and the sign-off carried user ids, not names. **Applied**: names beside the ids.
6. `client_name` is absent (not empty) when a delivery has no client — found by a contract test, not by reading.
7. A supervisor can sign off and reopen (`delivery.approve`) but not send or read the passcode — the matrix in `CONTRACTS.md` §10, confirmed live; a superuser is not exempt from separation of duties.
8. **My own slips this phase:** the first capture failed because I used a test helper whose registrar is not a platform administrator here (I register the files as the real superuser now); the first project-filter probe was uninformative because a member's list is already narrowed to their project, so I re-probed as an administrator across two projects; the bulk action was first labelled "Cancel", the same word as the dialog's dismiss button; my first live assertion expected an empty toolbar before the page had loaded. Each was caught by a run, not by reading.

## 6. Deferred / not done

- **Quality-check specs** (resolution, codec): the backend lists them as LATER; only the six built-in checks exist.
- **Overrides** (`delivery.status.override`, `delivery.sod.override`) are held by no role and have no screen; the history shows an override badge if one ever happens.
- **A client-facing view or download link**: none exists by design (SEC-DLV-06).
- **Notifications** when a delivery is signed off, sent or answered (backend LATER).
- **Re-preparing a Ready delivery** (refreshing the snapshot after a file changed) is not offered; it was not captured, so the screen does not claim it.
- The Phase 6 and 7 deferrals stand.

## 7. Questions for the owner

Answered: CR-17 to CR-21 "go" (apply as suggested). Nothing is open from this phase.

## 8. Follow-up: CR-17 to CR-21 applied (backend commit `68e846fc`, targeted tests only)

| Change | Where | Contract |
|---|---|---|
| list filters: `status` (read or stored word, any case), `client_status`, `delivery_method`, `client`/`client_id`, `project`/`project_id`, `destination`/`destination_id`; a non-id is a 400, an unknown status is an empty list | `api/filtersets/delivery.py`, `DeliveryViewSet.filterset_class`, the project route through the delivery provider | API-DLV-20 |
| `DELETE` only for Draft and Cancelled (409 `delivery_not_editable`) | `DeliveryViewSet.perform_destroy`, `DELETABLE_STATUSES` | API-DLV-21 |
| destination `type` must be one of the seven; a saved row keeps its old value when sent back unchanged | `DestinationListSerializer.validate_type` | API-DLV-22 |
| a checked item can be removed | `DeliveryQCCheck.item` `SET_NULL`, migration `0003_qc_item_set_null` (`remove_version` already cleared the current run) | API-DLV-23 |
| names beside ids | `signed_off_by_name`, `client_answered_by_name`, `actor_name`, `checked_by_name` | API-DLV-24 |

- **Tests:** `apps/deliveries/tests/test_list_delete_names.py`, 38 tests; each of the six source changes was reverted in turn and tests failed. The whole deliveries app: **587 passed**; the whole production app (it owns the project route): **1,298 passed**; `ruff check` clean; `makemigrations --check` clean. The full backend suite was **not** run.
- **Samples:** `deliveries/_flow.json` was captured again. The capture now uses valid destination types, probes the filters on rows in several states (including one left Ready), and shows the refused deletes and the removal of a checked item.
- **Frontend:** the list and the project tab have the filters back; Remove is offered for every item while the delivery is being prepared; the history, checks and details use the names the server sends (the identity lookup, `UserName`, is gone); contract tests rewritten to the new behaviour. Unit tests **744 / 88 files**, typecheck 0, build OK, Biome the same two errors and 2,316 warnings.
- **Live:** `deliveries` now has 4 tests, all passing against the fixed backend: the lifecycle (names in the history), reject and revise (a sent delivery cannot be deleted), bulk cancel (the list filters, a cancelled one is deleted), and a checked item removed and the filters used with the read word `Ready`.
