# RP-25 verification: slates on downloaded copies

Built 2026-11-20 on `feature/rp-25-download-slates`, off `develop` at `a9064a24` (v4.21.0), with every recommendation of Q-RP-113 to Q-RP-116 ([DECISIONS.md](DECISIONS.md#rp-25-answers)). Not committed yet. Contracts C-RP-59 and C-RP-60 ([CONTRACTS.md](CONTRACTS.md#rp-25-slates-on-downloaded-copies)). One migration (`production` `0018`, additive); no new route, permission code or setting, and no ADR (who may download is RP-23's).

Why: RP-23 lets copies leave StudioHub as files, but a downloaded copy was the copy that plays, so once renamed or forwarded nothing in it said which show, shot or version it was, or that it was confidential. A slate inside the copy would shift every stored frame number (Q-RP-63), so only the downloaded file gets one.

## What was built

- **The project's switch and line** (WP 25.1, Q-RP-113, Q-RP-114): `review_slates` (off) and `review_slate_note` (blank, at most 120 characters, one line: control characters refused by `validators/slate.py`). Read and written with the project, in its change log; migration `0018`; `test_bootstrap.py`'s limit raised to 18.
- **The slated download** (WP 25.2, Q-RP-115), in the job after the copy is checked:
  - the slate's lines, one text file each (empty ones left out): the project's code and name, the shot's or asset's code, the version's code, the task, the artist, the frames and rate, "Made" with the burn-in date (kept by remakes), and the project's line;
  - the copy is read back with ffprobe (size, rate, sample aspect ratio, audio sample rate) and a two-second card is encoded the same way: black, `drawtext` from the files with expansion off, each line sized to fit the width, silent stereo AAC when the copy has audio;
  - the card and the copy are joined with the concat demuxer and `-c copy` into `download.mp4` (`+faststart`); the result must have the card's frames plus the copy's and must decode without an error;
  - any failure (or a missing font) leaves the copy ready without a slate: `probe.slate` false, `probe.slate_skipped` `slate_failed` or `font_missing`, logged. Stills never get one.
- **The download serves it** (WP 25.3): `review_media_links.download_path` picks `download.mp4` when `probe.slate` is true; the name, headers, checks and `X-Accel-Redirect` are RP-23's. Playback, the thumbnail and the filmstrip are unchanged. The audit row's metadata gains `slate`.
- **Copies that differ** (WP 25.4, Q-RP-116): `slate` is a reason for movie and sequence copies whose `probe.slate` is not the switch (no key counts as without); the line alone never counts; keep stores `kept_for.slate`. The copies read gains `review_slates` and `slate_out_of_date`, as RP-20 added its grade count.
- **The probe shows `slate` and `slate_skipped`** (C-RP-59), so a client can tell whether a download has a slate.
- **Frontend** (WP 25.5):
  - the project form's *Put a slate before downloaded review copies* and *Slate line* (shown and sent only while the switch is on, so turning it off keeps the line; at most 120 characters);
  - "Slates on downloaded review copies" on the project page; Duplicate keeps both fields;
  - the copies notice names the slate ("1 review copy was made without the slate; the project now puts one before downloads.", or "with a slate; the project now leaves it off."), lists it as a reason, and counts it among the settings when other reasons differ too;
  - the Download link's title says when the file has a slate first;
  - types, row keys, regenerated OpenAPI types.
- **Captures** (WP 25.6):
  - the new `test_capture_review_slates.py` (`production/_review_slates_flow.json`), with a real ffmpeg: the default; a line with quotes and `%`; a line break, a tab and 121 characters refused; a copy made with the switch off, counted as differing, remade with the slate (keeping its date); a movie without audio, an EXR sequence and a still made with it on; what each download holds beside its copy; the download and playback; the audit row; the line alone; the switch turned off;
  - eleven flows whose project, probe or copies shapes gained fields were recaptured (review colour, download, folder, media, remake, sequence, sequence copies, storage copies, rollup, shot grades, workspaces). Compared with the committed samples they only gain `review_slates`, `review_slate_note`, `slate`, `slate_skipped` or `slate_out_of_date`; the workspaces tool's duplicate also sends the two fields, as the dialog does.

What the capture measured (real ffmpeg, frames counted from packets; brightness of a 64×36 grey frame):

| Copy | Copy frames | Download frames | Download's first frame | Two seconds in |
|---|---|---|---|---|
| Movie with audio (remade) | 48 | 96 | 8.2 (the card) | 128.0 = the copy's first frame |
| Movie without audio | 48 | 96 | 8.2 | 128.0 = the copy's first frame |
| EXR sequence, 12 frames | 12 | 60 | 5.9 | 103.9 = the copy's first frame |
| Switch off | 48 | the copy itself | 128.0 | — |

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | All checks passed; new files and the files formatted at HEAD are formatted (none of the unformatted HEAD files was reformatted) |
| `manage.py check` / `makemigrations --check` | no issues / No changes detected |
| basedpyright, changed files | 0 errors in the changed source files and the new test; the 23 reported in older test files are on lines this work did not touch |
| Targeted backend: `apps/production` and `apps/core/tests/test_bootstrap.py` | 2,286 passed (31 new; the last full run had one failure, RP-5's whole set of probe keys, fixed and its file rerun: 111 passed) |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 184 files, 2,065 tests (23 new) / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Captures | the new one and the eleven recaptured pass (the host's `/usr/bin/ffmpeg`) |
| Live (`SYNC_LIVE_MEDIA=1 run_role_smoke.sh --vitest`) | `reviewSlates` 1/1: a project created with the switch and line, a movie uploaded; the probe says `slate`; the Media tab's Download title says so; the downloaded file is two seconds longer than the copy the player streams (from each MP4's `mvhd`), and the copy's length is its frames over its rate |

## Mutation checks

Backend: 12 mutations, 11 failed the tests. "A still given a slate" (the job's guard removed) passed because `_slate_lines` refuses a still too; with both guards removed the tests fail. Frontend: 9 of 9 failed. The files were restored and byte-compared each time.

| Mutation | Failed |
|---|---|
| Playback serves the slated file | 1 |
| The switch not checked | 1 |
| A still given a slate (one guard / both guards) | 0 / 1 |
| The copy re-encoded in the join | 1 |
| `expansion` left on for the slate's text | 1 |
| A failed slate step fails the copy | 4 |
| The download serves the copy when a slated file exists | 5 |
| `slate` not counted as differing | 3 |
| A still counted as differing | 1 |
| The joined file's frame count not checked | 1 |
| Keep ignores the slate | 1 |
| The audit row without `slate` | 2 |
| Frontend: the line always shown | 1 |
| Frontend: the line not capped at 120 | 1 |
| Frontend: Duplicate drops the switch / the line | 1 / 1 |
| Frontend: no line on the project page | 1 |
| Frontend: the notice never names the slate alone | 2 |
| Frontend: the notice ignores the slate | 1 |
| Frontend: the notice says the switch the wrong way | 2 |
| Frontend: the Download title never mentions the slate | 1 |

"The line alone counted as differing" from the plan's list has no code to break: the line is not recorded on a copy, so nothing can compare it. The test that changes only the line and expects no difference stands for it.

## Found while building

1. **The probe was not shown.** The serializer shows only listed probe keys, so a client could not tell whether a download had a slate; `slate` and `slate_skipped` were added to it (as RP-20 added `grade_skipped`). Found by the capture.
2. **A long line ran off the card.** At the usual size a 120-character line is about 2,600 px wide on a 1920 copy; each line's size is now capped to fit inside the margins (checked by rendering a card).
3. **The copies read counts per reason.** The plan only named the reason; the read also gained `review_slates` and `slate_out_of_date`, so the notice can say what differs without reading the list.
4. **Whole-shape tests needed the new keys.** RP-5's probe (stored and shown) and RP-23's audit metadata tests, and RP-14, RP-15 and RP-16's counts, compare whole objects; they now include the new keys.
5. **The capture's own measurement** found no frame two seconds into a two-second copy; that brightness is only measured where the file is longer.

## Not done

- A slate inside the copy that plays; per-viewer or forensic marks; who downloaded on the slate (Q-RP-114 C).
- Slates on stills; a studio-wide template or logo; downloading several copies at once.
- The pre-deploy checklist line (the migration; disk: about one more copy's size per slated copy) is written with the release.
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- Backend:
  - `apps/production/models/project.py`, `validators/slate.py` (new), `migrations/0018_rp25_review_slates.py` (new), `api/serializers/project/{base,create,update}.py`, `api/serializers/review_media.py`;
  - `transcode/ffmpeg.py`, `services/review_media.py`, `services/review_media_links.py`, `api/views/review_media_stream.py`, `selectors/review_media.py`;
  - tests: `apps/production/tests/test_rp25_download_slates.py` (new); `test_rp5_review_media.py`, `test_rp14_remake.py`, `test_rp15_colour.py`, `test_rp16_sequence_copies.py`, `test_rp23_review_downloads.py`; `apps/core/tests/test_bootstrap.py`.
- Frontend:
  - `src/api/production/structure.ts`, `structureRowKeys.ts`, `review.ts`, `reviewRowKeys.ts`; `src/core/api/generated/openapi.ts`, `schema/django-openapi.yml` (regenerated);
  - `src/modules/production/structure/configs.tsx`, `components/ProjectWorkspace.tsx`, `components/CloneProjectDialog.tsx`, `review/ReviewCopiesNotice.tsx`, `review/ReviewCopyDownload.tsx`;
  - tests: `src/api/production/__tests__/reviewSlatesContracts.test.ts`, `src/modules/production/review/__tests__/reviewSlates.test.tsx`, `src/test/live/reviewSlates.live.test.tsx` (new); `reviewColourContracts`, `reviewRemakeContracts`, `workspaceContracts`, `reviewSequenceCopies` tests updated.
- Docs: `docs/sync/tools/test_capture_review_slates.py` (new), `test_capture_workspaces.py`; `docs/sync/samples/production/_review_slates_flow.json` (new) and the eleven recaptured flows; `docs/review-pipeline/CONTRACTS.md`, `PLAN.md`, `DECISIONS.md`, `rp-25-verification.md` (new); `docs/10-security/tpn-immediate-remediation.md`.
