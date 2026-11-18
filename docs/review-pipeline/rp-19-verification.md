# RP-19 verification: copy ready to review

Built 2026-11-18 on `feature/rp-19-copy-notifications`, off `develop` at `fb63b0ba` (v4.15.0), with every recommendation of Q-RP-87 to Q-RP-91 ([DECISIONS.md](DECISIONS.md#rp-19-answers)). Committed `d17c3ccd`. Contracts C-RP-50 and C-RP-51 ([CONTRACTS.md](CONTRACTS.md#rp-19-copy-ready-to-review)). No ADR: the trust model does not change.

Why: a ready review copy told only the person who made it (RP-6). With RP-18, a render farm makes copies of versions still in review, and nobody who reviews the work heard of them; the version's artist did not either, when someone else made the copy.

## What was built

- **WP 19.1, the kind.** `Kind.REVIEW_MEDIA_TO_REVIEW` (`review_media_to_review`, "A copy is ready for you to review") and `SETTLED_VERSION_STATUSES` (`Approved`, `Archived`) in `notifications/constants.py`. Migration `notifications` `0004_rp19_review_media_to_review` (the field's choices only). The kind is mutable: it is not in `UNMUTABLE_KINDS`, so `mutable_kinds` lists it.
- **WP 19.2, who is told.**
  - `NotificationSources.version()` also answers the task's `task_reviewer_id` (a deleted task counts as none) and the version's `status`.
  - `ReviewMediaFinishedHandler` reads the version when the event is handled. The row's creator and the version's artist get `review_media_ready` or `review_media_failed`. A ready copy that is not a remake also tells the task's reviewer `review_media_to_review` while the version is not settled.
  - `merge` keeps the first kind a person matches, so a reviewer who made the copy, or is the artist, gets `review_media_ready` only.
  - A remake that becomes ready still returns before any lookup. The event's payload is unchanged.
- **WP 19.3, frontend.**
  - `NOTIFICATION_KINDS` gains the kind; the preferences label is *Copies to review*.
  - The row reads "<version> is ready for you to review".
  - The row opens the version's Media tab, like the other review-copy kinds (a `MEDIA_KINDS` set in `describe.ts`).
  - The regenerated OpenAPI schema and types differ only by the kind.
- **WP 19.4, capture, live, docs.**
  - New capture tool `docs/sync/tools/test_capture_copy_to_review.py` → `docs/sync/samples/notifications/_copy_to_review_flow.json`. It uses real ffmpeg and a temporary root; a farm account makes the copy by path (RP-18). The flow covers a ready copy, a remake, a failure through a link leaving the folder, a copy of an approved version, then the reviewer's mute and one more copy.
  - Recaptured `_review_notifications_flow.json` and `_pipeline_notifications_flow.json`: only `mutable_kinds` gains the kind (the rest is ids and dates).
  - New live file `frontend/src/test/live/copyToReview.live.test.tsx`.
  - CONTRACTS, DECISIONS, PLAN, `docs/apps/notifications.md`, and the pre-deploy checklist entry "From 4.15.x to 4.16.0".

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | All checks passed; the changed files were formatted at HEAD and are formatted |
| `manage.py check` | no errors (the usual two warnings of the testing env) |
| `makemigrations --check` | No changes detected |
| basedpyright, changed files | 0 errors |
| Targeted backend: notifications, production, core | 2,704 passed |
| RP-19 file | 20 passed |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 175 files, 1,966 tests / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Captures (host's `/usr/bin/ffmpeg`) | RP-19 (new) and the two recaptures passed |
| Live (`SYNC_LIVE_MEDIA=1`) | `copyToReview` 2/2 |

What the capture shows:
- **The reviewer** has one row, `review_media_to_review` for the first copy. There is none for its remake, for the failed copy or for the approved version's copy, and none after muting.
- **The artist and the farm account** each have `review_media_ready` for the two ready copies and `review_media_failed` (`render_unreadable`) for the failure.

## Mutation checks

- **Backend, 10 of 10 killed** (RP-19, RP-6 and RP-11 files). Each mutation below was caught:
  - the reviewer told on a remake;
  - the reviewer told on a failure;
  - the reviewer told for an approved version;
  - `Archived` not settled;
  - the artist not told when someone else made the copy;
  - the reviewer given `review_media_ready`;
  - the reviewer read from the task's assignee;
  - a deleted task still counted;
  - the new kind unmutable;
  - two kinds for one person.

  The first version of the last mutation (the later kind winning) survived. It was badly written: it reversed the groups, which still gave the creator's kind first. Rewritten so the reviewer's kind wins, it was caught by `test_a_reviewer_who_made_the_copy_is_told_it_is_ready_once`.
- **Frontend, 4 of 4 killed.** Each mutation below was caught:
  - the kind left out of `NOTIFICATION_KINDS`;
  - the Media tab not opened;
  - the sentence naming no version;
  - the row described as a ready movie.

  A missing label fails `tsc` (`Record<NotificationKind, string>`).

## Found while building

1. **The capture's farm account needed `version.update`.** An account that is not the version's artist may make its copy only with `version.update` (C-RP-26). So a render-farm account needs a role that holds it (`lead-artist` in the capture), or the artist's own token as [docs/api/review-copies-from-storage.md](../api/review-copies-from-storage.md) describes. With the artist's token, the artist is the creator and gets one row.
2. **The media worker writes these rows.** The event bus dispatches in process after commit, so the handler runs in `celery-media`, which finishes the copy. The checklist says to restart it.
3. **A test helper had to supersede the older ready copy**, as the worker does. A second ready row breaks `production_review_media_one_ready_uniq`.

## Not done

- No fallback to the project's supervisor (Q-RP-87); nothing for a review's lead reviewer (RP-11 covers reviews); no e-mail.
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- **Backend, new:**
  - `apps/notifications/migrations/0004_rp19_review_media_to_review.py`
  - `apps/notifications/tests/test_rp19_copy_to_review.py`
- **Backend, changed:**
  - `apps/notifications/constants.py`, `apps/notifications/events/handlers.py`
  - `apps/production/selectors/notification_sources.py`
  - tests `test_rp11_review_notifications.py` (`MUTABLE` gains the kind) and `core/tests/test_bootstrap.py` (notifications cap 4)
- **Frontend, new:** `src/test/live/copyToReview.live.test.tsx`
- **Frontend, changed:**
  - `src/api/notifications/notifications.ts`
  - `src/modules/notifications/{NotificationsPage.tsx,describe.ts}`
  - tests `notificationsContracts.test.ts` and `notifications.test.tsx`
  - the regenerated OpenAPI schema and types
- **Docs, new:**
  - `docs/sync/tools/test_capture_copy_to_review.py`
  - `docs/sync/samples/notifications/_copy_to_review_flow.json`
  - this report
- **Docs, changed:**
  - CONTRACTS, PLAN, DECISIONS
  - `docs/apps/notifications.md`
  - the pre-deploy checklist
  - the two recaptured samples
