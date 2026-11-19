# RP-23 verification: downloading a review copy

Built 2026-11-19 on `feature/rp-23-review-download`, off `develop` at `eec94418` (v4.19.0), with every recommendation of Q-RP-105 to Q-RP-108 ([DECISIONS.md](DECISIONS.md#rp-23-answers)). Committed `c58da79c`; merged into `develop` (`a80f3053`, then the CI fix `f3fa5014` as `fb2cc453`) and `main` (`de9edb13`), released in v4.20.0. CI on `develop` failed once (see [After the merge](#after-the-merge)) and was green after the fix, and on `main` on its first push. Contracts C-RP-56 and C-RP-57 ([CONTRACTS.md](CONTRACTS.md#rp-23-downloading-a-review-copy)). One migration (`0017_rp23_review_downloads`, one field with a default). No new route, permission code or setting, and no ADR: the link is C-RP-21's signed link with a new output, checked the same way, and the switch only narrows. The TPN note is in `docs/10-security/tpn-immediate-remediation.md`.

Why: review copies could only be played. Saving one meant asking for the file, or "Save video as" on a file named after the token, and nothing recorded it.

## What was built

- **The switch** (`Project.review_downloads`, Q-RP-105):
  - `internal` (the default), `everyone` or `nobody`; another value is 400 on the field;
  - set on the project form ("Who may download review copies"), shown on the project page when it isn't the default, and kept by Duplicate;
  - a change is in the project's change log (old value, new value, who).
- **The link** (C-RP-56):
  - `download_url` on a review copy, signed like the others, for a ready copy only;
  - it's given to studio members under `internal`, to vendor and client members too under `everyone`, and to nobody under `nobody`. A platform administrator is never external;
  - the setting is read once per request, so the version list doesn't read it once per row (RP-5's query limit still holds).
- **The download** (`review-media/{id}/download/`, Q-RP-106):
  - serves the copy's proxy (the MP4, or the JPEG of a still) as `attachment; filename="<version code>.mp4"`, or `filename*=utf-8''…` for a name that isn't ASCII;
  - it has C-RP-21's other headers, and works behind `MEDIA_ACCEL_PREFIX`;
  - each request checks the user, their access to the version and the setting again;
  - the token names its output, so a playback link used for `download` is a 404.
- **The record** (C-RP-57, Q-RP-107):
  - an audit row per download: `export`, the version, the user, the client address, the file name;
  - written for a request without a range or with one from byte 0, so a resumed download isn't counted twice;
  - playback and refused requests write none.
- **Frontend** (Q-RP-108):
  - a **Download** link (`ReviewCopyDownload`) in the review movie panel and the review player, shown only when the server gives `download_url`;
  - types and keys: `download_url` (`REVIEWMEDIA_KEYS`), `review_downloads` (`PROJECT_KEYS`), `REVIEW_DOWNLOADS`.
- **Captures:**
  - the new `test_capture_review_download.py` (`production/_review_download_flow.json`) uses a real ffmpeg movie and still, and the built-in roles. It covers each value of the setting, a studio member and a client in a review, the headers, a playback token, a link given before `nobody`, a bad value, and the audit row as `audit/` lists it.
  - Ten flows whose project or copy shapes gained a field were recaptured: review colour, folder, media, remake, sequence, sequence copies, storage copies, rollup, shot grades and workspaces. Compared with the committed samples they only gain `download_url` or `review_downloads`. The workspaces tool's duplicate also sends `review_downloads`, as the dialog does.

## Gates

| Gate | Result |
|---|---|
| `ruff check apps/production` | All checks passed; the changed files were formatted at HEAD and are formatted; the new ones are formatted |
| `manage.py check` / `makemigrations --check` | no issues / No changes detected |
| basedpyright, changed files | 0 errors |
| Targeted backend: `apps/production` | 2,220 passed (29 new) |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 180 files, 2,027 tests / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Captures | the new one and the ten recaptured pass (the host's `/usr/bin/ffmpeg`) |
| Live (`SYNC_LIVE_MEDIA=1 run_role_smoke.sh --vitest`) | `reviewDownload` 2/2 |

## Mutation checks

12 of 12 failed the tests, and the files were restored and byte-compared.

| Mutation | Failed |
|---|---|
| `download_url` given to an external member under `internal` | 1 |
| The setting not checked again by the stream view | 3 |
| A playback token accepted for `download` | 1 |
| `inline` instead of `attachment` | 4 |
| An audit row for each range | 2 |
| The file name not ASCII-safe | 1 |
| Frontend: a copy that isn't ready offered | 1 |
| Frontend: the panel without the link | 3 |
| Frontend: the player without the link | 1 |
| Frontend: Duplicate drops the setting | 2 |
| Frontend: the form defaults to `everyone` | 1 |
| Frontend: the project page names the wrong value | 2 |

## Found while building

1. **Project updates write no audit row.** The plan said the change would be "audited as a project change". Updates go through the change-tracking signals instead, and a change of the setting is in the project's change log with the old and new value and who. A test pins that, and the plan says so now.
2. **Playback already said `inline; filename="proxy.mp4"`.** Django's `FileResponse` names the file it serves. Playback is unchanged; the tests check it isn't an attachment.
3. **Two panel tests asserted "no link at all"**, meaning no link to the published file (RP-17, RP-18). The Download link is a link too, so they now look for the published file's link by its name.
4. **The OpenAPI types were regenerated** (`manage.py spectacular` under `DJANGO_ENV=testing`, then `pnpm api:generate`). They gain `review_downloads` and `download_url`, and also RP-22's `ungraded` and its `id` text, which RP-22 did not regenerate.
5. **The live run sends the upload with Node's fetch**, as RP-5's does (jsdom's `File` loses its bytes). The download itself is the page's own link, followed as a browser would follow it.

## After the merge

- **CI on `develop` (`a80f3053`) failed on one test outside the production app.** `apps/core/tests/test_bootstrap.py` caps each app's migrations, and production's limit of 16 didn't allow 0017. The targeted runs covered only `apps/production`, so they missed it. The fix raises the limit to 17 and names 0016 (RP-20, which raised the limit without naming it) and 0017 in the comment. The bootstrap tests pass: 26, and 25 with one failure when the limit is put back at 16.

## Not done

- Several copies at once, a playlist or a review as a zip; forensic watermarks or per-viewer burn-ins; download limits.
- Originals, EXR frames or graded LUTs.
- The client case in the live run: it needs an external member with MFA. The backend tests and the capture cover it.
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- Backend:
  - `apps/production/models/project.py`, `migrations/0017_rp23_review_downloads.py`;
  - `apps/production/api/serializers/project/{base,create,update}.py`, `api/serializers/review_media.py`;
  - `apps/production/api/views/review_media_stream.py`;
  - `apps/production/services/review_media_links.py`, `services/review_media.py`;
  - `apps/production/tests/test_rp23_review_downloads.py` (new).
- Frontend:
  - `src/core/api/generated/openapi.ts`, `schema/django-openapi.yml` (regenerated);
  - `src/modules/production/review/ReviewCopyDownload.tsx` (new), `ReviewMoviePanel.tsx`, `ReviewViewer.tsx`;
  - `src/modules/production/structure/configs.tsx`, `components/ProjectWorkspace.tsx`, `components/CloneProjectDialog.tsx`;
  - `src/api/production/review.ts`, `reviewRowKeys.ts`, `structure.ts`, `structureRowKeys.ts`;
  - tests: `reviewDownload.test.tsx`, `reviewDownloadContracts.test.ts` (new), `reviewFolder.test.tsx`, `reviewStorageCopies.test.tsx`, `workspaceContracts.test.ts`; `src/test/live/reviewDownload.live.test.tsx` (new).
- Docs:
  - `docs/sync/tools/test_capture_review_download.py` (new), `test_capture_workspaces.py`;
  - `docs/sync/samples/production/_review_download_flow.json` (new) and the ten recaptured flows;
  - `docs/review-pipeline/CONTRACTS.md`, `PLAN.md`, `DECISIONS.md`, `rp-23-verification.md` (new);
  - `docs/10-security/tpn-immediate-remediation.md`.
