# RP-17 verification: review copies from studio storage

Built 2026-11-18 on `feature/rp-17-studio-storage-frames`, off `develop` at `63afd57c` (v4.13.0), with every recommendation of Q-RP-77 to Q-RP-81 ([DECISIONS.md](DECISIONS.md#rp-17-answers)). Committed `d06c0572`; merged into `develop` (`b312f437`) and `main` (`e2d9a19e`), released in v4.14.0. CI was green on both on the first push. Contracts C-RP-44 to C-RP-46 ([CONTRACTS.md](CONTRACTS.md#rp-17-review-copies-from-studio-storage)). New [ADR-0042](../adr/ADR-0042-review-media-from-studio-storage.md) (the media worker reads studio storage). [ADR-0040](../adr/ADR-0040-review-media-processing.md) amended ("copies from studio storage").

## What was built

- **WP 17.1, shared path rules.** `normalize_relative_path`, `is_sequence_pattern`, `frame_file_name`, `resolve_mount` and their limits moved unchanged from `publishing/domain/paths.py` to `core/utils/paths.py`. Publishing re-exports them, so production uses the same rules without importing publishing.
- **WP 17.2, the row.** `ReviewMedia` gains `storage_root` (the root's code), `storage_path` (the registered path or frame pattern) and `published_file_id` (a UUID, not a foreign key: production does not import publishing). It also gains error code `storage_unreadable`. Migration `production` `0014_rp17_storage_copies`.
- **WP 17.3, opening.**
  - `POST publishing/files/{id}/review-copy/` (`publishing.view` and the files' reach) runs `publishing/services/review_copy.py`. It checks the version's review-media reach (404), the upload's rights (C-RP-26, 403) and review media being on (409). It then checks `refusal(file)`: revoked; not `main` or `proxy`; checksum `mismatch` or `missing`; root not in `PUBLISHING_STORAGE_MOUNTS`; or a format or frame count the worker refuses. One sentence on `detail`, 400.
  - It then calls `ReviewMediaService.open_from_storage`, which validates the colour space, locks the version, applies the busy check, queues the row and audits `review_media_from_storage`.
  - The file shape gains `review_copy_refusal`.
- **WP 17.4, reading.**
  - For a row from storage, `process` builds the input with `_storage_input`. Each file (each frame) is resolved with `resolve_mount` under the root's directory, must be a regular file whose leading bytes are its format, and gets a symbolic link in the row's folder (`source/frame.<8 digits>.<ext>` or `source.<ext>`). ffmpeg reads the links with the upload's arguments.
  - `_unlink_storage` removes only links, after success and after failure; nothing is written under a root.
  - A refused read logs `review_media_storage_unreadable` with the row, a fixed reason (`revoked`, `root_not_read`, `missing`, `outside_root`, `unreadable`, `content`, `not_a_sequence`) and the frame, never a path.
  - Copies from storage keep nothing, so `frames_until` stays `null`.
  - Also: `_delete_folder` now refuses an empty folder or one outside `REVIEW_MEDIA_DIR` (it logs `review_media_delete_refused`). A row from storage has no `source_path`, and the old code would have removed `MEDIA_ROOT` itself for an empty one.
- **WP 17.5, remaking and revoking.**
  - A copy from storage is remade by reading its file again, at any time, while the file can be read (not revoked, root still listed); otherwise 400 "The published file of this copy can no longer be read: …".
  - The project remake gains `skipped_storage`. `differing` entries gain `published_file_id`, and the row gains `published_file_id` and `storage_readable`.
  - Revoking a file (`PublishedFileService.change_status` to Revoked) calls `ReviewMediaService.forget_storage` in the same transaction. The copies stay; a job still to run fails with `storage_unreadable`.
- **WP 17.6, frontend.**
  - Typed API: the new fields, `reviewMediaApi.fromPublishedFile`, and row keys.
  - The review movie panel:
    - **From a published file** (for holders of `publishing.view` who may manage the copy) lists the version's main and proxy files when opened. Each shows its path, frames and an unchecked checksum, then either the server's refusal or **Make the copy**, which uses the colour-space choice.
    - A copy from storage reads "made by the server from the published file <name>", linked to the file's page for `publishing.view` holders.
    - It says whether the copy can be remade at any time or its file can no longer be read. Remake follows `storage_readable`.
    - A failed storage job after three attempts says to make the copy again from the published file.
  - The copies notice says how many sequences can be remade from their published files and how many can no longer read them. Each listed copy says the same, and the remake summary counts `skipped_storage`.
  - The published file page gains **Make review copy** (or the refusal) for holders of `version.update` or `version.create`.
- **WP 17.7, capture, live, docs.**
  - New capture tool `docs/sync/tools/test_capture_review_storage_copies.py` (real ffmpeg, a temporary root) → `_review_storage_copies_flow.json`.
  - Recaptured the media, sequence, remake, colour and sequence-copies flows and the publishing dependencies flow (only the new keys changed shape).
  - The live harness mounts a temporary root `LIVE` with the frames and the movie.
  - New live file `reviewStorageCopies.live.test.tsx`.
  - Docs: CONTRACTS, DECISIONS, PLAN status, ADR-0042, ADR-0040, `docs/apps/publishing.md`, and the pre-deploy checklist (read-only mounts into `celery-media`).

## For the owner: details settled while building

1. **Deprecated files can be used**; Revoked ones cannot. A copy is refused only for the reasons in C-RP-44.
2. **A copy from storage has `source_size` 0** (nothing was uploaded), and the panel does not show a size for it. Its `source_name` is the file's name, with `[first-last]` for a sequence.
3. **The picker hides revoked files, thumbnails and sidecars** that the files list returns. Other refused files are listed with the server's sentence, so it is visible why (for example the root not being read).
4. **`publishing/services/review_copy.py` returns `Any`, not `ReviewMedia`.** `test_dependency_direction` forbids publishing from importing production models outside `models/`, even for a type annotation, so the service goes through production's service, selector and permission helpers only.
5. **The publishing `_flow.json` capture tool fails at HEAD, before RP-17.** It creates sequence `SQ010` in project `PUB`, which the project-code prefix rule (CR-49) refuses. That sample was not recaptured: no test pins the `PublishedFile` keys to it. The depth sample, which does pin them, was recaptured.
6. **The live test uses one of the harness's published versions.** Files register only to published versions, and publishing needs an approval by someone other than the version's producer (separation of duties), so the test's own version could not be published.
7. **A retry of a failed storage job reads the file again** (up to three attempts, as for uploads). The final message says to make the copy again from the published file, not to upload it.

## Gates

| Gate | Result |
|---|---|
| `uv run ruff check .` | All checks passed |
| `manage.py check` (`DJANGO_ENV=testing`) | only identity.W001 and W002, as before |
| `makemigrations --check --dry-run` | No changes detected |
| `ruff format` on new files and on changed files formatted at HEAD | clean |
| basedpyright on changed non-test files | 0 errors |
| RP-17 tests (`test_rp17_storage_copies.py`) | 34 passed |
| Targeted: `apps/production apps/publishing apps/deliveries apps/notifications apps/core/tests apps/settings` | 4,189 passed; 2 failed and 1 error, all fixed or explained below. Rerun after the fixes: the review-media, publishing and core tests, **1,461 passed** |
| Frontend `pnpm typecheck`, `pnpm test`, `pnpm build` | clean; **173 files, 1,934 tests** passed; built |
| `pnpm exec biome check src` | no errors; 910 warnings, as at HEAD |
| `node ../docs/sync/tools/unreachable.mjs .` | only tests, row keys and test helpers |
| OpenAPI | `manage.py spectacular` and `pnpm api:generate`: the review-copy route, `ReviewCopyFromFile`, `review_copy_refusal`, `published_file_id`, `storage_readable`, `skipped_storage` and the `storage_unreadable` value, nothing else |
| Captures (host's `/usr/bin/ffmpeg`) | RP-17 (new), media, sequence, colour, remake, sequence copies and publishing depth all passed |

The targeted run's three problems:
- `test_bootstrap` was collected before the migration cap moved to 14. It passes on rerun.
- `test_dependency_direction[publishing]` flagged the `ReviewMedia` annotation import (item 4). Fixed.
- `test_cr37_member_detail` errored on a PostgreSQL deadlock inserting `identity_permission`. A capture tool was seeding the same test database at the same time. It passes on rerun.

## Mutation checks

**Backend** (10 of 10 caught, by `test_rp17_storage_copies.py` and the no-secrets test):
- `resolve_mount` not called on a frame;
- a frame's signature not checked;
- a movie's signature not checked (survived at first; a test for a movie replaced on disk by something else was added);
- the link folder removed by following the links;
- a revoked file accepted;
- `mismatch` accepted;
- a root that is not listed accepted;
- the revoke not clearing the storage fields;
- a storage copy given a keep window;
- the path put on the row.

**Frontend** (9 of 9 caught, by `reviewStorageCopies.test.tsx`):
- `canRemake` ignoring storage (survived at first, because the revoked capture is a sequence; now also checked on a movie);
- `framesText` for a storage copy;
- the picker shown without `publishing.view`;
- the file linked without it;
- sidecars offered;
- the refusal ignored;
- the files read before the picker opens (survived at first, because the check ran before any query could start; now it waits);
- the listed copy's state ignoring storage;
- the file page's action shown without a version right.

## Live run

Run with `SYNC_LIVE_MEDIA=1 docs/sync/tools/run_role_smoke.sh --vitest …`, one at a time, against the throwaway backend with the host's ffmpeg:
- **`reviewStorageCopies.live`** (new): 3 of 3.
  1. The version page's picker lists the frames and the harness's plate. The plate's root is not read: it shows the server's sentence and no button. **Make the copy** on the frames gives a ready sequence (frames 1001 to 1008) linked to its file, with Remake.
  2. **Make review copy** on the movie's file page gives a ready 48-frame movie.
  3. Revoking the movie's file leaves its copy shown with `storage_readable: false`. A remake is refused 400, the file reads "This file was revoked; …", and the panel says the file can no longer be read and offers no Remake.
  - The first run failed in setup: files register only to published versions (item 6).
- **`reviewMedia.live`**: 3 of 3, after the harness change.

## Files

Backend:
- **new:** `apps/core/utils/paths.py`, `apps/publishing/services/review_copy.py`, `production/migrations/0014_rp17_storage_copies.py`, `production/tests/test_rp17_storage_copies.py`;
- **changed:**
  - production: `models/review_media.py`, `services/review_media.py`, `selectors/review_media.py`, `api/serializers/review_media.py`;
  - publishing: `domain/paths.py`, `services/files.py`, `api/serializers/file.py`, `api/viewsets/file.py`;
  - tests: `tests/test_rp{14,15,16}_*.py` (`skipped_storage`, `published_file_id`), `publishing/tests/api/test_no_secrets_in_logs_or_responses.py`, `apps/core/tests/test_bootstrap.py` (production 14).

Frontend:
- **new:**
  - `review/ReviewFromPublishedFile.tsx`;
  - tests: `api/production/__tests__/reviewStorageContracts.test.ts`, `review/__tests__/reviewStorageCopies.test.tsx`, `test/live/reviewStorageCopies.live.test.tsx`;
- **changed:**
  - API: `api/production/{review,reviewRowKeys}.ts`, `api/publishing/{publishing,publishingRowKeys}.ts`, the regenerated OpenAPI schema and types;
  - screens: `review/{ReviewMoviePanel,ReviewCopiesNotice}.tsx`, `publishing/FilePages.tsx`;
  - tests: the RP-14, RP-15 and RP-16 tests (`skipped_storage`), `test/live/liveBackend.ts`.

Docs and samples:
- **new:** `docs/adr/ADR-0042-review-media-from-studio-storage.md`, `docs/sync/tools/test_capture_review_storage_copies.py`, `docs/sync/samples/production/_review_storage_copies_flow.json`, this report;
- **changed:**
  - docs: `docs/review-pipeline/{CONTRACTS,DECISIONS,PLAN}.md`, `docs/adr/ADR-0040-review-media-processing.md`, `docs/apps/publishing.md`, `docs/07-deployment/pre-deploy-checklist.md`;
  - tools: `docs/sync/tools/live_backend.py`;
  - samples: the five recaptured review samples and `publishing/_dependencies_flow.json`.

Left out of any commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.
