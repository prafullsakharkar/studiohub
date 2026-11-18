# RP-18 verification: review copies before approval

Built 2026-11-18 on `feature/rp-18-auto-review-copies`, off `develop` at `04b11f9e` (v4.14.0), with every recommendation of Q-RP-82 to Q-RP-86 ([DECISIONS.md](DECISIONS.md#rp-18-answers)). Committed `bfaf6466`; merged into `develop` (`bf1ea85c`) and `main` (`cb002b08`), released in v4.15.0. CI was green on both on the first push. Contracts C-RP-47 to C-RP-49 ([CONTRACTS.md](CONTRACTS.md#rp-18-review-copies-before-approval)). New [ADR-0043](../adr/ADR-0043-review-copies-by-path-from-the-project-folder.md) (a path from a request, bounded by the project's review folder), which amends [ADR-0042](../adr/ADR-0042-review-media-from-studio-storage.md) (a note added there).

Why: RP-17 reads copies only from registered published files, and only published versions have those; publishing needs approval. So those copies arrived after the review they were for (rp-17-verification item 8).

## What was built

- **WP 18.1, the project's folder.**
  - `Project` gains `review_source_root` and `review_source_folder` (blank = off). Migration `production` `0015_rp18_review_folder` also adds error code `render_unreadable` to `ReviewMedia`.
  - `validators/review_source.py` holds the rules:
    - the root is upper-cased and must be listed in `PUBLISHING_STORAGE_MOUNTS` when written; a stored root that is no longer listed survives other writes;
    - the folder is normalized with the shared path rules, at most 512 characters, not a frame pattern, and never the whole root;
    - each field needs the other.
  - The folder is written on update only (`ProjectReviewFolderMixin`). It is read only with `project.update` (`ReviewFolderGatedMixin`, asked once per response like the budget); external members never see it.
- **WP 18.2, the route.**
  - `POST versions/{id}/review-media/from-storage/` takes `{path, first_frame?, last_frame?, color_space?}`. An unknown field is refused by name, and the upload's rights apply (C-RP-26).
  - `ReviewMediaService.open_from_path` joins the folder and the path and checks length, range and format. Every refusal is a 400 on one field that never names a directory. It then calls RP-17's `open_from_storage` with `published_file_id = None`: same busy check, same colour space.
  - Audit `review_media_from_path`. The version is neither published nor changed.
- **WP 18.3, reading.** `_storage_input` handles a path copy as follows:
  - It checks the stored path again against the project's **current** folder (`outside_folder`).
  - It resolves the folder under the root, so a folder that is a link off the root is refused (`outside_root`).
  - It resolves each file under the folder, so a link to another show's render on the same root is refused.
  - Every failure is `render_unreadable`. The log carries the row, the reason and the frame, never a path.
- **WP 18.4, remaking.**
  - `ReviewMedia.source` (`upload`, `published_file`, `storage_path`) and `storage_copy` replace the `published_file_id` checks in the remake, `process`, `_finish` and the selector's `remakable`.
  - A path copy can be remade while it is still in the folder on a listed root. Otherwise it gets a new 400 reason and counts in `skipped_storage`.
  - `source` is on the row and on each `differing` entry. `storage_readable` covers path copies.
- **WP 18.5, frontend.**
  - Types: `source`, `ReviewMediaSource`, `ReviewFromStorageInput`, `reviewMediaApi.fromStorage`, and the two project fields (optional, since they are gated). Row keys updated.
  - The project edit form has *Review folder: storage root* and *folder on the root* (`project.update`, edit only). This uses a new field option, `onlyOnEdit`, the mirror of `onlyOnCreate`; the create schema leaves those fields out.
  - The review movie panel gains **From studio storage** (`ReviewFromStorage.tsx`) for whoever may manage the copy:
    - a path input, with the `ROOT:folder/` prefix shown only to `project.update` holders (the project is read only when the form opens);
    - first and last frame, asked only for a frame pattern and filled from the version's frames;
    - the colour-space choice.
  - A path copy reads "made by the server from <name>, read from studio storage." The panel says whether the copy can be remade while the render is in the folder, or why not, and Remake follows `storage_readable`.
  - The copies notice and its list name the review folder, and the remake summary now says "their files on studio storage".
- **WP 18.6, tools.** [docs/api/review-copies-from-storage.md](../api/review-copies-from-storage.md) covers the call, the `Token` header, and personal access token scopes `version.view` + `version.update` (or `version.create`). A backend test checks that those scopes are enough and that `version.view` alone is a 403.
- **WP 18.7, capture, live, docs.**
  - New capture tool `docs/sync/tools/test_capture_review_folder.py` (real ffmpeg, a temporary root) → `_review_folder_flow.json`.
  - Recaptured the media, sequence, remake, colour, sequence-copies, storage-copies and rollup flows. The key sets show only `source` and the two project fields added; nothing was removed.
  - New live file `frontend/src/test/live/reviewFolder.live.test.tsx`.
  - Also: CONTRACTS, ADR-0043, the ADR-0042 note, `docs/apps/publishing.md`, and the pre-deploy checklist entry "From 4.14.x to 4.15.0".

## Gates

| Gate | Result |
|---|---|
| `ruff check .` | All checks passed (new files and files formatted at HEAD formatted; `viewsets/version.py` was not formatted at HEAD and was left so) |
| `manage.py check` | no errors (the usual MFA and API-key warnings of the testing env) |
| `makemigrations --check` | No changes detected |
| basedpyright, changed files | no new errors; the only error is in `models/project_membership.py:85` (`show_id`), unchanged and there before |
| Targeted backend: production, publishing, notifications, core | 3,347 passed |
| After the last changes: RP-18, RP-17, RP-16, bootstrap, publishing | 792 passed; RP-18 file 47 passed |
| OpenAPI | `manage.py spectacular` and `pnpm api:generate`: the new route, `ReviewMediaFromStorage`, `source`, the project fields and `render_unreadable`, nothing else |
| Frontend `pnpm typecheck` / `pnpm test` / `pnpm build` | pass / 175 files, 1,962 tests / pass |
| Biome | 0 errors, 910 warnings (the baseline) |
| `unreachable.mjs` | only tests, `*RowKeys.ts` and the helpers listed before |
| Captures (host's `/usr/bin/ffmpeg`) | RP-18 (new) and the seven recaptures all passed |
| Live (`SYNC_LIVE_MEDIA=1`) | `reviewFolder` 4/4; `reviewStorageCopies` 3/3 and `reviewMedia` 3/3 rerun, passing |

## Mutation checks

- **Backend, 14 of 14 killed** (`test_rp18_review_folder.py`). Each mutation below was caught:
  - the request skipping the folder;
  - the worker skipping its folder check;
  - the worker resolving under the root instead of the folder;
  - an unsafe path accepted;
  - an unlisted root accepted by the request;
  - an unlisted root accepted by a project write;
  - a pattern without its range accepted;
  - the folder shown to project readers;
  - the selector keeping a moved copy remakable;
  - the remake ignoring a changed folder;
  - `inside_folder` matching by prefix (`shows/a` against `shows/ab/…`);
  - the path put on the row;
  - `render_unreadable` not used;
  - `skipped_storage` missing path copies.
  
  "The range taken from the disk" from the plan does not apply: nothing lists the folder.
- **Frontend, 13 of 13 killed.** Each mutation below was caught:
  - the folder shown to everyone;
  - the project read on mount;
  - a range sent for a movie;
  - the range not prefilled;
  - a `#` in a folder taken for a pattern;
  - a path copy remakable after the folder moved;
  - a path copy saying nothing about storage;
  - `framesText` shown for a path copy;
  - the form offered to readers;
  - the notice ignoring path copies;
  - an edit-only field shown on create;
  - an edit-only field validated on create.
  
  The thirteenth, an edit-only field sent on create, survived at first. The guard was redundant, because the create schema already strips those fields, so I removed it and added a test that a folder named in the address of a new project is never sent.

## Found while building

1. **New error code `render_unreadable`, not `storage_unreadable`** (a change from the plan). RP-17's message names "the published file", which is wrong for a path copy. Both count the same way everywhere else.
2. **The folder is set on update, not on create** (as planned). The create form would have sent the fields and the server ignored them, so the form needed the new `onlyOnEdit` option. I first left those fields in the create schema, and a create form whose user arrives after mount then failed validation without saying anything (caught by an existing CR-55 test). Fixed by leaving them out of the create schema.
3. **Live races in my own test, not the product.** The edit page fills itself once from the record. Typing before that fill was undone, which sent only the folder, and the server rightly refused it ("A review folder needs its storage root."). Separately, the version page's buttons appear after `/auth/me`. The live test now waits for both.
4. **The production-admin role holds `project.view_budget`**, so the captured producer's project has every key. The contract test pins that; the artist's project has neither the budget nor the folder.
5. **A remake's status sentence changed** for RP-17 copies too: "their files on studio storage can no longer be read" (it was "their published files"), because path copies count in the same `skipped_storage`.

## Not done

- Nothing automatic on the server (Q-RP-85): render farms call the route ([docs/api/review-copies-from-storage.md](../api/review-copies-from-storage.md)).
- Left out of the commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.

## Files

- **Backend, new:**
  - `apps/production/validators/review_source.py`
  - `apps/production/api/serializers/project/review_folder.py`
  - `apps/production/migrations/0015_rp18_review_folder.py`
  - `apps/production/tests/test_rp18_review_folder.py`
- **Backend, changed:**
  - models `project.py`, `review_media.py`
  - project serializers `base.py`, `update.py`
  - `api/serializers/review_media.py`, `api/viewsets/version.py`
  - `services/review_media.py`, `selectors/review_media.py`
  - tests `test_rp16_sequence_copies.py` (the `source` key) and `core/tests/test_bootstrap.py` (production cap 15)
- **Frontend, new:**
  - `modules/production/review/ReviewFromStorage.tsx`
  - tests `api/production/__tests__/reviewFolderContracts.test.ts`, `modules/production/review/__tests__/reviewFolder.test.tsx`, `test/live/reviewFolder.live.test.tsx`
- **Frontend, changed:**
  - `api/production/{review,reviewRowKeys,structure,structureRowKeys}.ts`
  - the regenerated OpenAPI schema and types
  - `modules/directory/{types.ts,FieldInputs.tsx,formModel.ts}`
  - `modules/production/structure/configs.tsx`
  - `modules/production/review/{ReviewMoviePanel,ReviewCopiesNotice}.tsx`
  - `reviewStorageCopies.test.tsx` (an upload is `source: 'upload'`; the remake sentence)
- **Docs, new:**
  - ADR-0043
  - `docs/api/review-copies-from-storage.md`
  - `docs/sync/tools/test_capture_review_folder.py`
  - `docs/sync/samples/production/_review_folder_flow.json`
  - this report
- **Docs, changed:**
  - CONTRACTS, PLAN, DECISIONS
  - ADR-0042 (amendment note)
  - `docs/apps/publishing.md`
  - the pre-deploy checklist
  - `rp-17-verification.md` (item 8)
  - the seven recaptured samples
