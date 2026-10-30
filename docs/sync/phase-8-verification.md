# Phase 8 — Deliveries: verification

Branch `sync/phase-8-deliveries` (from `develop` after the Phase 7 merge, `93aefef3`), **not pushed, not merged**. No backend file changed. Backend requests added, all proposed and unapplied: **CR-17**, **CR-18**, **CR-19**, **CR-20**, **CR-21**.

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

Live: `deliveries` 3 tests, run twice on fresh seeds. No other live file was re-run: this phase changed no shared code (no directory, form or auth change); the harness gained a producer user and a delivery fixture only.

## 2. Quality gates

| Gate | Phase 7 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 86 files / 684 | **88 files / 742** |
| Live tests | 10 files / 65 | **11 files / 68** |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2362 warnings | **2 errors (the same two) / 2317 warnings** |
| Clean `git worktree` | typecheck 0, 684/684 | **typecheck 0, 742/742** |
| Net size (frontend) | | 34 files, +10,285 / −2,841 against `develop` (most of the additions are the captured sample, the tests and the screens) |

Mutation checks (break the code, expect a failure): the permission filter on the toolbar, the required rejection reason, delete visibility by status, the project route, hiding Remove for a checked item, the due-date conversion, the sign-off permission, Send from Ready, delete of Submitted, and an invented interface field (the compile-time key lists).

## 3. What was built

- **Typed API** (`src/api/deliveries/`): `deliveriesApi` (list, detail, create, update, delete, add/remove version, validate, retry, prepare, sign off, reopen, send, client approve/reject, complete, cancel, revise, bulk cancel, history, QC, passcode, a project's deliveries), `destinationsApi`; compiled key lists; `deliveryFlow.ts`, the action table (which actions each status offers and which code each needs, pinned to the captured server and to `docs/deliveries/CONTRACTS.md`).
- **List** (`/deliveries`): search and sort, the client's answer, due date (red when overdue), size, items; Edit and Delete only where the status allows; bulk "Cancel deliveries" with one reason and a per-id summary; CSV export; a link to destinations.
- **Form** (`/deliveries/new`, `/deliveries/:id/edit`): project, client and code are chosen once (create only), method, destination, due day, write-only passcode, notes.
- **Workspace** (`/deliveries/:id`): header with status, client answer, facts; an action bar built from the status and the caller's codes, each behind a dialog that asks for what the call needs (notes, transfer reference, a required rejection reason) and keeps the server's reason on screen; tabs for Items (add a published version, remove while allowed, per-file detail, "frozen record" once sent), Quality checks (runs, outcomes, in words), Status history, Details (including the audited passcode reveal and the manifest checksum), and Changes.
- **Destinations** (`/deliveries/destinations…`): list and form (seven types, default, active, credentials flag).
- **Project tab** replaced by the scoped list from the project route.
- **Messages**: a failed check lists what failed ("The files match their checksums (1 file(s) are missing…)"), a refused version says why ("That version is not published. Publish it first."), a move the status no longer allows says from where to where.

## 4. Removed (no silent deletions)

Separate commit `45a64c8a` (10 files, −1,319 lines), all unreachable from `main.tsx` and imported by no test: `CreateDeliveryModal`, `AddVersionModal`, `DeliveryApprovalModal`, `DeliveryRejectModal`, `DeliveryCancelModal`, `DeliveryCard`, `useDeliveries`, `useDeliveryWorkspace`, `DeliveryService`, and `shared/utils/mediaUtils.ts` (its only users were these). Also replaced in place: the old `DeliveriesPage` (356 lines) and `DeliveryWorkspacePage` (930 lines), and the project Deliveries tab (245 lines), which never called the API: it ran on an in-memory list of placeholders.

Left alone on purpose: the delivery repository interface and REST adapter in `api/repositories/` and `ClientDeliveryHealth` on the dashboard (Phase 12 owns the dashboard).

## 5. Findings (details in `backend-change-requests.md`, "Phase 8 findings")

1. **CR-17** — the delivery lists ignore every filter but `search`: status, client, project, method and destination change nothing (checked as an administrator across two projects). The list offers search and sorting only; a project's deliveries use the project route.
2. **CR-18** — `DELETE` succeeds on Submitted and Completed deliveries, against the contract ("Draft or Cancelled only") and the idea of a record of what was sent. The screens offer delete for Draft and Cancelled only.
3. **CR-19** — a destination's `type` accepts any text.
4. **CR-20** — an item cannot be removed once the delivery was validated or prepared: the append-only QC rows protect it and the answer is a generic 409. The screen hides Remove for a checked item and says why; a mistaken item means cancelling the delivery.
5. **CR-21** — history, QC and the sign-off carry user ids, not names.
6. `client_name` is absent (not empty) when a delivery has no client — found by a contract test, not by reading.
7. A supervisor can sign off and reopen (`delivery.approve`) but not send or read the passcode — the matrix in `CONTRACTS.md` §10, confirmed live; a superuser is not exempt from separation of duties.
8. **My own slips this phase:** the first capture failed because I used a test helper whose registrar is not a platform administrator here (I register the files as the real superuser now); the first project-filter probe was uninformative because a member's list is already narrowed to their project, so I re-probed as an administrator across two projects; the bulk action was first labelled "Cancel", the same word as the dialog's dismiss button; my first live assertion expected an empty toolbar before the page had loaded. Each was caught by a run, not by reading.

## 6. Deferred / not done

- **List filters** (status, client, project, method) until CR-17.
- **Quality-check specs** (resolution, codec): the backend lists them as LATER; only the six built-in checks exist.
- **Overrides** (`delivery.status.override`, `delivery.sod.override`) are held by no role and have no screen; the history shows an override badge if one ever happens.
- **A client-facing view or download link**: none exists by design (SEC-DLV-06).
- **Notifications** when a delivery is signed off, sent or answered (backend LATER).
- **Re-preparing a Ready delivery** (refreshing the snapshot after a file changed) is not offered; it was not captured, so the screen does not claim it.
- The Phase 6 and 7 deferrals stand.

## 7. Questions for the owner

1. **CR-17 and CR-18** are the two that matter: without CR-17 a long delivery list can only be searched, and without CR-18 a sent delivery can be deleted by anyone holding `delivery.delete` (a production-admin and above) through the API. Approve, defer or drop?
2. **CR-20**: should a checked item be removable (the contract says yes), or is "cancel and start again" the intended rule? The screen follows the server until you decide.
3. **CR-19, CR-21**: small; approve with the others or leave.
