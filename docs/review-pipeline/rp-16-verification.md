# RP-16 verification: sequence copies after a settings change

Built 2026-11-17 on `feature/rp-16-sequence-copies`, off `develop` at `f446bd6b` (v4.12.1), with every recommendation of Q-RP-73 to Q-RP-76 ([DECISIONS.md](DECISIONS.md#rp-16-answers)). Not committed. Contracts C-RP-41 to C-RP-43 ([CONTRACTS.md](CONTRACTS.md#rp-16-sequence-copies-after-a-settings-change)); [ADR-0040](../adr/ADR-0040-review-media-processing.md) amended ("keeping a sequence's frames").

## What was built

- **WP 16.1, keeping frames.**
  - New setting `REVIEW_MEDIA_SEQUENCE_KEEP_DAYS` (default 14, at least 0): `config/env.py`, `components/storage.py`, imported by name in `base.py`, and both `.env.example` files.
  - `ReviewMedia.frames_until` (migration `production` `0013_rp16_sequence_copies`, which also adds `kept_for`).
  - `_finish` keeps a sequence's `source/` folder until `frames_until` when the setting is above 0; with 0 the frames go at once as before.
  - Superseding and removing clear `frames_until` (the folder goes with the row).
  - The ten-minute sweep clears `source_path` and `frames_until` of ready sequences past their time and hands `<folder>/source` to the media worker (`discard_later`), as for abandoned uploads; it logs `review_media_frames_expired`.
  - The row gains `frames_until`: shown only while the frames are kept (`ReviewMedia.frames_kept`), so a row past its time reads `null` before the sweep has run.
- **WP 16.2, remaking a sequence.**
  - `_remake` takes a ready sequence whose frames are kept. The new row copies the range and name and hard-links each frame into its own `source/` (a copy where linking fails). It keeps `color_space`, the burn-in date and the original's `frames_until` (Q-RP-74).
  - A sequence whose frames are gone (past their time, swept, or deleted by hand) is refused: "The frames of this sequence are no longer kept. Upload the frames again."
  - The project remake goes through the same path for every differing copy. `skipped_sequence` now counts the sequences whose frames are gone.
- **WP 16.3, the list.** `ReviewMediaSelector.differences` returns each differing copy with why it differs (`burn_ins`, `colour`). The copies read gains:
  - `differing`: the first 100 copies, oldest first, each `{review_media_id, kind, version {id, code}, record_code, remakable, frames_until, why}`;
  - `differing_more`.
  - The counts are derived from the same answer, so they cannot disagree with the list.
- **WP 16.4, keep as they are.**
  - `POST projects/{id}/review-copies/keep/` (`project.update`; reach as C-RP-38) takes 1 to 100 ids, all or none.
  - Each id must be a differing copy of the project that cannot be remade.
  - Each copy stores `kept_for` (the project's burn-in switch and the transform it would be made with now) and is left out of the counts while the project's settings give the same.
  - Audit `review_media_kept`. A 400 while the colour config cannot be read.
- **WP 16.5, frontend.**
  - Typed API: `frames_until` on the row, `differing` / `differing_more`, `ReviewCopyDiffering`, `reviewCopiesApi.keep`, and row keys.
  - **The review-copies notice:**
    - says how many sequences can still be remade and how many no longer have their frames;
    - has a **Show which** list, each copy linking to its version page with its record code, what differs and whether it can be remade ("frames kept until …");
    - offers **Remake them** whenever anything listed can be remade (kept sequences included);
    - offers **Keep as they are**, behind a confirmation, for whoever may change the project.
    - The remake summary says how many sequences were left because their frames are gone.
  - **The review movie panel** offers Remake on a sequence while its frames are kept (titled "from the kept frames") and says "Frames kept until <date>" or "Frames no longer kept".
- **WP 16.6, capture, live, docs.**
  - New capture tool `docs/sync/tools/test_capture_review_sequence_copies.py` → `_review_sequence_copies_flow.json`.
  - The RP-14 tool pins `REVIEW_MEDIA_SEQUENCE_KEEP_DAYS=0`, so it still captures the refusal of a sequence whose frames went.
  - Recaptured the media, sequence, remake and colour flows (`frames_until`, `differing`).
  - New live file `reviewSequenceCopies.live.test.tsx`. Docs: CONTRACTS, DECISIONS, PLAN status, ADR-0040, and the pre-deploy checklist.

## For the owner: details settled while building

1. **A kept copy counts again with everything that differs.** Once the project's settings change, a copy kept as it is is listed with all its differences, the burn-ins it was kept with included (for example `why: ["burn_ins", "colour"]` after a view change). It is not listed with only the newest change. Keeping is "these copies are fine with these settings", and the new settings undo that whole judgement.
2. **`frames_until` reads `null` once the time has passed, even before the sweep has run.** The sweep runs every ten minutes, so for up to ten minutes a row may still have frames on disk that are no longer offered. Remake refuses them in the same window, so the page and the server agree.
3. **The RP-12 and RP-14 tests and capture tools that check "frames go when ready" now pin `REVIEW_MEDIA_SEQUENCE_KEEP_DAYS=0`.** That rule is still the setting's 0, so they test it rather than being dropped. The RP-12 sequence capture now records the default (frames kept). The copies count tests in RP-14 and RP-15 compare the counts without the new list, which RP-16's tests cover.
4. **`reviewRemake.live` had compared the copies read with three keys since RP-15** (it lacked `colour_out_of_date`; RP-15's live run covered only the media and colour files). It now uses `toMatchObject` and expects an empty list.
5. **The capture's "Ensure this field has at least 1 elements."** is DRF's own sentence for an empty `review_media_ids`; it was left as DRF writes it.
6. **The colour sample changed meaning.** In RP-15's capture the project remake left the sequence (`skipped_sequence: 1`). Under RP-16 its frames are kept, so the same flow remakes both copies (`queued: 2`) and the counts return to zero.
7. **Keeping a copy is not offered for a movie whose upload has gone missing.** It counts as remakable (its row still names the upload), so the project remake reports it in `skipped_missing`; the plan's Q-RP-76 C (keep movies too) was not chosen.

## Gates

| Gate | Result |
|---|---|
| `uv run ruff check .` | All checks passed |
| `manage.py check` (`DJANGO_ENV=testing`) | only identity.W001 and W002 (no MFA key or pepper in the testing env, as before) |
| `makemigrations --check --dry-run` | No changes detected |
| `ruff format` on new files and on changed files formatted at HEAD | clean. `config/env.py` is not formatted at HEAD; it was formatted by mistake, then restored, and carries only the five new lines |
| basedpyright on changed non-test files | 0 errors |
| RP-16 tests (`test_rp16_sequence_copies.py`) | 21 passed |
| Targeted: `apps/production apps/notifications apps/core/tests apps/settings` | **2,908 passed** |
| Frontend `pnpm typecheck`, `pnpm test`, `pnpm build` | clean; **171 files, 1,909 tests** passed; built |
| `pnpm exec biome check src` | no errors; 910 warnings, as at HEAD (counted in a temporary worktree) |
| `node ../docs/sync/tools/unreachable.mjs .` | only the generated bridges, the permission catalogue and test helpers, as before |
| OpenAPI | `manage.py spectacular` and `pnpm api:generate`: the keep route, `ReviewCopyDiffering`, `ReviewCopiesKeep`/`Kept`, `frames_until`, and three reworded descriptions, nothing else |
| Captures (host's `/usr/bin/ffmpeg`) | RP-16 (new), remake, media, sequence and colour all passed |

## Mutation checks

**Backend** (13 of 13 caught, by `test_rp16_sequence_copies.py`):
- frames deleted at ready with a window set;
- the sweep discarding frames before their time;
- a remake starting a new window;
- a remake moving the frames instead of linking them;
- a sequence past its time remade;
- the project remake still skipping sequences;
- superseding keeping `frames_until`;
- the list showing copies that match;
- a kept copy still counted;
- a kept copy not counted again after a burn-ins change;
- the same after a view change;
- keep accepted for a copy that can be remade;
- `frames_until` shown past its time.

**Frontend** (12 of 12 caught, by `reviewSequenceCopies.test.tsx` and the contract test):
- a sequence never offering Remake (RP-14's rule);
- a sequence whose frames are gone offering it;
- the panel not saying until when;
- Remake them only for movies;
- keep posting every listed copy;
- keep without asking;
- Keep shown without `project.update`;
- the list not linking to the version;
- "and N more" left out;
- the sequence sentence ignoring kept frames;
- a kept sequence's date left out;
- the counts not read again after keeping.

## Live run

Run with `SYNC_LIVE_MEDIA=1 docs/sync/tools/run_role_smoke.sh --vitest …`, one at a time, against the throwaway backend with the host's ffmpeg and the built-in config:
- **`reviewSequenceCopies.live`** (new): 2 of 2.
  1. A ready EXR sequence has `frames_until`; the version page says "Frames kept until …" and offers Remake.
  2. After a change of view, the copies read lists the copy (`why: ["colour"]`, remakable). The notice says it can be remade and links it to its version. "Remake them" remakes it from its kept frames with the new view, keeping the original's `frames_until`, and the list empties.
  - The first run failed on a test fault: the project PATCH answers the update serializer's fields without `id`, so the test read `projects/undefined/review-copies/`. It now reads the project back with a GET.
- **`reviewColour.live`**: 2 of 2 (now expects "1 can be remade while its frames are kept." in its notice).
- **`reviewRemake.live`**: 2 of 2 (its stale three-key comparison fixed, item 4).
- **`reviewMedia.live`**: 3 of 3.
- "Keep as they are" is not run live: it needs a sequence whose frames are gone, which takes days or a database edit. The backend tests and the capture cover it on a real database; the jsdom tests cover the screen.

## Files

Backend:
- **new:** `migrations/0013_rp16_sequence_copies.py`, `tests/test_rp16_sequence_copies.py`;
- **changed:** `models/review_media.py`, `services/review_media.py`, `selectors/review_media.py`, `api/serializers/review_media.py`, `api/viewsets/project.py`, `config/env.py`, `config/settings/{base,components/storage}.py`, both `.env.example`, `tests/test_rp{12,14,15}_*.py` (pinned to 0 days where they test RP-12's rule; counts compared without the list), `apps/core/tests/test_bootstrap.py` (production 13).

Frontend:
- **new:** `api/production/__tests__/reviewSequenceCopiesContracts.test.ts`, `review/__tests__/reviewSequenceCopies.test.tsx`, `test/live/reviewSequenceCopies.live.test.tsx`;
- **changed:** `api/production/{review,reviewRowKeys}.ts`, the regenerated OpenAPI schema and types, `review/{ReviewCopiesNotice,ReviewMoviePanel}.tsx`, the RP-14 and RP-15 contract and screen tests, `test/live/{reviewColour,reviewRemake}.live.test.tsx`.

Docs and samples:
- **new:** `docs/sync/tools/test_capture_review_sequence_copies.py`, `docs/sync/samples/production/_review_sequence_copies_flow.json`, this report;
- **changed:** `docs/review-pipeline/{CONTRACTS,DECISIONS,PLAN}.md`, `docs/adr/ADR-0040-review-media-processing.md`, `docs/07-deployment/pre-deploy-checklist.md`, `docs/sync/tools/test_capture_review_{remake,sequence}.py`, and the four recaptured samples (media, sequence, remake, colour).

Left out of any commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.
