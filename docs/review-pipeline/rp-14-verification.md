# RP-14 verification: remaking review copies

Branch `feature/rp-14-media-slates`, off `develop` at `f7f99139` (v4.10.0). Planned, answered (Q-RP-63 to Q-RP-67 = A, "go ahead") and built on 2026-11-17. Contracts C-RP-37 and C-RP-38 ([CONTRACTS.md](CONTRACTS.md#rp-14-review-copies-remaking)). **Not committed.**

## What was built

| WP | Done |
|---|---|
| 14.1 Remake one copy | `POST review-media/{id}/remake/` (`ReviewMediaService.remake`): a new `queued` row for the version's `ready` movie or still, its upload a hard link to the kept one (`os.link`, a copy if linking fails), `remake_of` naming the remade copy, `created_by` the caller. The remade copy stays `ready` and shown until the new one is ready; a failed remake leaves it and can be retried. Refusals: a sequence, a row that is not ready, a missing upload (400, one sentence each); busy and switched off (409). Audit `review_media_remake`. The burn-in date is fixed as processing first starts (`burn_in_date`) and carried by remakes (Q-RP-66). A remade copy that becomes ready writes no `review_media_ready`; a failed one tells whoever asked (Q-RP-67; `ReviewMediaFinished` gains `remake`). Migration `production` `0011_rp14_remake`: `remake_of`, `burn_in_date`. |
| 14.2 A project's copies | `ReviewMediaSelector.differing` and `copies_summary`; `GET projects/{id}/review-copies/` (`project.view`, full internal access) and `POST projects/{id}/review-copies/remake/` (`project.update`, the same reach): each differing movie remade on its own; the answer counts the remade, busy, sequence and missing ones. Rows made before RP-12 (no `burn_ins` key) count as without burn-ins. |
| 14.3 Slates | Dropped (Q-RP-63 = A). |
| 14.4 Frontend | `reviewMediaApi.remake`, `reviewCopiesApi`, `ReviewMedia.remake_of`, `ReviewCopies`, `ReviewCopiesRemade` and their row keys. The review movie panel: **Remake** on a ready movie or still (not a sequence) for those who manage the copy, disabled while a job runs; a remake's job says the current copy stays; a failed remake says so. `ReviewCopiesNotice` on the project's Versions tab: "N review copies were made without burn-ins; the project now adds them." with **Remake them** for `project.update`, then "Remaking N review copies…" while the counts are read again every 10 seconds; the sequence sentence. OpenAPI schema and `openapi.ts` regenerated. |
| 14.5 Cleanup | `apps/core/services/notifications.py` (`NotificationService`, a stub from before RP-6) removed with its re-export and test assertion; the three unused `notification.*` setting codes removed from `SettingDefinitionCodes` and its `ALL` list; the row in `docs/02-architecture/service-layer.md`. Its own commit. |
| 14.6 Capture, live, docs | `docs/sync/tools/test_capture_review_remake.py` → `docs/sync/samples/production/_review_remake_flow.json` (real ffmpeg); RP-5 and RP-12 samples recaptured (rows gain `remake_of`). Live: `frontend/src/test/live/reviewRemake.live.test.tsx`; the harness now sets a burn-in font. CONTRACTS, DECISIONS, PLAN, ADR-0040 amendment, `docs/production/CONTRACTS.md` pointer, pre-deploy checklist, this report. |

## For the owner: details settled while building

Each is written up in [CONTRACTS.md](CONTRACTS.md#rp-14-review-copies-remaking), "Details settled while building RP-14":

1. **No slates, as answered.** I had suggested them before reading the viewer; the plan records why they were dropped.
2. **The project's count only drops as remakes finish.** The old copy stays shown (and differing) until its remake replaces it, so the notice says "Remaking N review copies" and reads the counts again every 10 seconds; it disappears once every copy matches. Pressing the project remake twice is harmless: the second time each version is skipped as busy.
3. **The burn-in date is fixed when the worker first takes the copy**, and a retry keeps it. A remake starts with the original's date. Copies made before this release have none; their remakes use the day the original row was created.
4. **A failed remake can be retried**, like any failed upload, and the copy it was remaking stays shown meanwhile.
5. **A copy made while the burn-in font was missing counts as differing.** Remaking it with the font still missing makes another copy without burn-ins (RP-12's fallback); fix the font first.
6. **The live harness had no burn-in font on this host** (the worker image's Debian path); every live copy fell back to no burn-ins. It now picks a DejaVu Sans found on the host. The first live run caught this.

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | clean |
| `ruff format` | new files formatted; every changed file formatted at HEAD still is (`apps/settings/constants/settings.py` was not, and was not formatted) |
| `manage.py check` | no issues |
| `makemigrations --check` | no changes |
| `basedpyright` on the 11 changed and new backend files | 0 errors (2 found in the new test, fixed) |
| Backend tests, targeted: `apps/production apps/notifications apps/core/tests apps/settings` | **2,853 passed** |
| `test_rp14_remake.py` | 21 passed |
| Changed elsewhere | `test_bootstrap.py` allows `production` eleven migrations; `test_selectors_services.py` no longer checks `NotificationService` |
| Frontend `pnpm typecheck`, Biome (`--diagnostic-level=error`) | clean, 0 errors |
| Frontend `pnpm test` | 167 files, 1,850 tests passed |
| Frontend `pnpm build` | built |
| Unreachable code | only tests, row keys and the known helpers |
| Capture tools (RP-14 new; RP-5 and RP-12 recaptured) | pass, real ffmpeg |
| Live (`SYNC_LIVE_MEDIA=1 run_role_smoke.sh --vitest src/test/live/reviewRemake.live.test.tsx`) | 2 of 2 passed on the third run: the first two failed on a test bug (the project's write answer has no `id`) and on the harness's missing font (point 6 above) |
| Live regression (`reviewMedia.live`, RP-10 and RP-12) | 3 of 3 passed with the new harness and panel |

## Mutation checks

Each change was made alone and must make a test fail; every file was restored afterwards (checked with `git status`/`git diff`).

**Backend** (21 of 22 caught; the survivor is equivalent):

- a copy that is not ready is remade
- the upload is moved instead of linked (the hard-link test)
- a sequence is accepted
- the remake's date is not the original's; a pre-RP-14 copy's remake dates from today
- processing does not fix the date; processing overwrites it; the burn-in ignores the stored date
- the event does not say it is a remake
- the remake keeps the uploader; does not name its copy; is audited as an upload; works while switched off
- a missing upload is counted as busy (project remake)
- a ready remake notifies; a failed remake tells nobody
- the matching copies are the ones remade; copies made before RP-12 are not counted; a deleted version's copy is counted; stills are counted
- the project remake skips full access (the vendor member)
- **Survived, equivalent:** removing the explicit busy check. The database's one-job-per-version constraint refuses the new row and the service answers the same 409 (`review_media_busy`); the explicit check stays so the common case does not depend on an exception.

**Frontend** (15 of 15 caught): Remake on a sequence; Remake without the right (the first version of this mutant was a no-op of mine, `&& true &&`; rewritten to remove the panel's right check, caught); Remake enabled while a job runs; a remake's job read as an upload's; a failed remake not saying the copy stays; remake posting to retry; the project remake posting to the read route; the notice shown when nothing differs; its button ignoring `project.update`; the button staying after remaking; the on/off sentences swapped; skipped copies not told; singular read as plural; the sequence sentence dropped; `remake_of` missing from the row keys (typecheck).

## Live run

A fresh `live_backend.py` seed with `SYNC_LIVE_MEDIA=1` (a harness thread runs the media job with the host's ffmpeg). The manager uploads a movie with burn-ins off; it becomes ready without them, and `review-copies` answers 0. The manager turns the switch on. The real `ReviewCopiesNotice` reads "1 review copy was made without burn-ins; the project now adds them."; **Remake them** posts, the notice says "Remaking 1 review copy. Each one replaces its old copy when it is ready.", the harness makes the remake, the version's newest row is ready with `remake_of` the original and `burn_ins: true`, the original is `superseded`, and the notice goes away by itself once the counts read 0. Then the real version page's Media tab shows "With burn-ins"; **Remake** makes another copy, which replaces the first.

## Not done in RP-14

- Slates (Q-RP-63), remaking sequences (Q-RP-64), remaking on its own when the switch changes (Q-RP-65).
- OpenColorIO, LUTs and HDR; frames read from studio storage; object storage; downloading a review copy.

## Files

Backend, new: `apps/production/migrations/0011_rp14_remake.py`, `apps/production/tests/test_rp14_remake.py`.
Backend, changed: `apps/production/{models,services,selectors,events}/review_media.py`, `apps/production/api/{serializers/review_media.py,viewsets/review_media.py,viewsets/project.py}`, `apps/notifications/events/handlers.py`, `apps/core/tests/test_bootstrap.py`.
Cleanup (own commit): `apps/core/services/notifications.py` (deleted), `apps/core/services/__init__.py`, `apps/core/tests/test_selectors_services.py`, `apps/settings/constants/settings.py`, `docs/02-architecture/service-layer.md`.
Frontend: `src/api/production/{review.ts,reviewRowKeys.ts,__tests__/reviewRemakeContracts.test.ts}`, `src/modules/production/review/{ReviewMoviePanel.tsx,ReviewCopiesNotice.tsx,__tests__/reviewRemake.test.tsx}`, `src/modules/production/components/project-tabs/ProjectVersionsTab.tsx`, `src/core/api/generated/{openapi.ts,schema/django-openapi.yml}`, `src/test/live/reviewRemake.live.test.tsx`.
Docs and tools: `docs/review-pipeline/{PLAN,DECISIONS,CONTRACTS}.md`, this report, `docs/adr/ADR-0040-review-media-processing.md`, `docs/production/CONTRACTS.md`, `docs/07-deployment/pre-deploy-checklist.md`, `docs/sync/tools/{test_capture_review_remake.py (new),live_backend.py}`, `docs/sync/samples/production/{_review_remake_flow.json (new),_review_media_flow.json,_review_sequence_flow.json}`.
