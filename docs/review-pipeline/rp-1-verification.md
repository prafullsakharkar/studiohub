# RP-1 Data model cleanup: verification

Branch `feature/rp-1-data-cleanup`, off `develop` at `4d346bf7`. **Not pushed, not merged.** The backend (PLAN WP 1.1 to 1.4) is commit `85485b9c`; the frontend follow-up (WP 1.5) is §4 and §5. WP 1.6 (column drop) is not started.

## 1. What changed

| WP | Contract | Change | Files (`backend/apps/production/`) |
|---|---|---|---|
| 1.1 | C-RP-01 | Version responses no longer carry `media_items`, `attachments`, `reviews`, `playlists`, `notes_list`, `activity`. `publishing_info` stays. The columns stay until WP 1.6. | `api/serializers/version/base.py` |
| 1.2 | C-RP-02 | `add-to-playlist` writes only the `PlaylistEntry`. With a playlist name and no id it writes nothing, as before for the rows. | `api/viewsets/version.py` |
| 1.3 | C-RP-03, C-RP-04 | `?version_id=` on `GET reviews/` and `GET playlists/`, matched through live `ReviewItem` and `PlaylistEntry` rows (an `Exists` subquery, so no duplicates and no `distinct`). Unknown or malformed values give an empty list. Playlists moved from `filterset_fields` to `PlaylistFilterSet`, built on the REST-framework `FilterSet` so `status`, `project` and `client_only` are generated as before. | `api/filtersets/review.py`, `api/filtersets/playlist.py` (new), `api/viewsets/playlist.py` |
| 1.4 | C-RP-05, C-RP-06 | Nullable `version` FK (`SET_NULL`) on `ReviewComment` and `ReviewAnnotation`, migration `0003_review_comment_annotation_version` (two `AddField`, no data step). Optional `version_id` on the `comments` and `annotations` actions, checked against the review's live items. A reply takes its thread's version. Every comment, reply and annotation answers `version_id`. | `models/review_parts.py`, `migrations/0003_…`, `api/serializers/actions.py`, `services/review.py`, `api/viewsets/review.py`, `api/serializers/review/parts.py` |

Docs: `docs/production/DECISIONS.md` D-18 and the "Not done" line of D-31 now point at RP-1.

## 2. Evidence

| Check | Result |
|---|---|
| RP-1 tests (`tests/test_rp1_data_cleanup.py`) | **27 pass.** They cover: <ul><li>no cache keys on list, detail, update and add-to-playlist (with stale JSON planted in the columns);</li><li>add-to-playlist by id and by name leaves the JSON alone;</li><li>reviews and playlists by version, with removed items and entries no longer matching;</li><li>junk and unknown ids give an empty list, and an empty value is no filter;</li><li>combined with `status`, `project` and `client_only`;</li><li>another project's version shows nothing;</li><li>comments and annotations: stored and returned on a version, absent or `null` stays on the whole review;</li><li>refused: a version not on the review, a removed item, another project's version, an unknown id, and a malformed id, with nothing written;</li><li>a reply takes its thread's version, and naming another is refused (for threads on a version and on the whole review);</li><li>older rows answer `null`.</li></ul> |
| Mutations | **15 of 15 caught.** Each check broke one rule, and a test failed: <ul><li>a key served again;</li><li>the JSON written again;</li><li>either filter going through deleted rows, or ignored;</li><li>the review filter raising on junk;</li><li>`client_only` lost;</li><li>the membership check skipped, or going through deleted items;</li><li>a reply keeping its own version, or naming another;</li><li>an annotation's version not stored;</li><li>the comment shape dropping `version_id`;</li><li>the viewset not passing it.</li></ul> One check first ran as *skipped*, because `ruff format` had wrapped its anchor line; it was rerun against the formatted line and caught. |
| Production app tests | `uv run pytest apps/production`: **1,603 pass**, on the test database. Targeted, as agreed; the full suite was not run. |
| `ruff check .`, `manage.py check`, `makemigrations --check` | clean |
| `ruff format` (changed files) | Nothing newly unformatted: the new files and `services/review.py` are formatted. Five changed files were already unformatted on `develop` and are left as they were. |
| basedpyright (changed files) | **0 errors** (gate unchanged). Warnings rose by a net 45 over five files (one file fell by 3): `reportUnknown*` on untyped DRF and filter method parameters, the same pattern as their neighbours. |
| OpenAPI schema vs `develop` | **Only the contracted changes:** <ul><li>`version_id` query parameter on `GET reviews/` and `GET playlists/`;</li><li>`version_id` (uuid, nullable) on the `Annotation` and `ReviewComment` request components;</li><li>the six keys gone from the two version components.</li></ul> Also `GET reviews/{uuid}/status-history/` lists `version_id`, because that operation already lists every review filter (`project_id` too, before RP-1). The schema warnings and errors count is the same before and after (174). |

## 3. Notes

- **An older frontend keeps working.** It reads none of the six keys and sends no `version_id`. Only its pinned row keys and captured samples needed the follow-up (§4).
- **Choice made while building:** a version on a comment is checked against the review's *live* items only when the comment is new. A reply on a thread whose version was later taken off the review is still accepted, on the thread's version (by the code; no test pins it yet). Refusing it would make a thread unanswerable.
- **`SET_NULL` on the FK:** versions are soft-deleted, and `ReviewItem` already protects a version shown in a review from a hard delete, so the null case is only reached by a hard delete of a version that left every review.

## 4. The frontend (WP 1.5)

| Where | Change |
|---|---|
| `src/api/production/review.ts`, `reviewRowKeys.ts` | `Version` loses the six lists. `ReviewReply`, `ReviewComment` and `ReviewAnnotation` gain `version_id`. `addComment` and `addAnnotation` take an optional `version_id`. The header comment states the RP-1 rules. |
| Version page, Reviews tab (`VersionWorkspace.tsx`) | Reads every page of `reviews/?version_id=`. Before, it read the entity's first 100 reviews and filtered them on the client, so it could miss some. Starting a review is unchanged. |
| Version page, Playlists tab (`VersionExtras.tsx`) | Reads `playlists/?version_id=`, no longer the whole project filtered on the client. Where the version sits in each playlist is unchanged. |
| Review viewer (`ReviewViewer.tsx`) | <ul><li>A comment or a drawing is sent on the version on show (side A while comparing).</li><li>The timeline markers, the feedback list and the saved drawings on the frame show that version's feedback and the whole review's, never another version's.</li><li>A whole-review item says "· whole review" when the review has more than one version.</li><li>The comment box names the version.</li><li>Switching versions drops an unsaved drawing, because a drawing belongs to one version.</li></ul> |
| Comments and Annotations tabs (`ReviewPanels.tsx`) | <ul><li>An **On** choice: "Whole review" (the default) or one of the review's versions.</li><li>A thread and an annotation show the code of their version. A reply does not repeat its thread's tag.</li><li>A version taken off the review since reads "a version no longer in the review".</li></ul> |
| OpenAPI snapshot and types (`src/core/api/generated/`) | Regenerated from this backend: the snapshot equals what `develop` generated, plus only the RP-1 changes. |

**Captures.** `docs/sync/tools/test_capture_production_review.py` was re-run on the test database, which rewrote `production/_review_flow.json`.
- **The tool needed CR-49 codes** (`REV_SQ010`, `REV_SH0010`, …) before it would run at all. It predates CR-49, which refuses codes without the project's prefix.
- **New calls:** 18 of them, prefixed `rp1_`: the two-version review RV004, comments and annotations on a version, the refusals, and the lists by version.
- **Diff against the old capture, call by call:**
  - the six keys left every version answer;
  - `version_id` was added to every comment and annotation;
  - the new `rp1_` calls appeared;
  - ids changed;
  - member rows gained `show_id` and `show_code` (CR-36, applied after this flow was last captured).
- Two test pins changed with the codes: a derived version code is now `REV_SH0010_COMPOSITING_V001`, plus one comment.
- `production/versions.json`, an early broad capture, still shows the old lists. No test reads it, so it was left alone.

## 5. Frontend evidence

| Check | Result |
|---|---|
| Unit tests | **151 files, 1,605 tests pass** (1,599 before; +6). <ul><li>New: the RP-1 contract tests on the captures; the viewer shows only the shown version's and the whole review's feedback; the panels' version choice and tags; a drawing belongs to one version.</li><li>Rewritten: the version Reviews and Playlists tabs now serve the captured `?version_id=` answers, and assert that the client no longer filters.</li><li>Updated: three request-body assertions now expect `version_id`.</li></ul> |
| Mutations | **16 of 16 caught.** Each check broke one rule, and a test failed: <ul><li>either tab asks the old way;</li><li>the viewer's comment or drawing sent without a version;</li><li>the viewer showing every version's feedback, or hiding the whole review's;</li><li>no "whole review" label;</li><li>either panel ignoring the version chosen;</li><li>no version tag on a thread or an annotation;</li><li>a reply repeating the tag;</li><li>a whole-review item tagged with a version;</li><li>the choice defaulting to the first version;</li><li>switching versions keeping the draft;</li><li>saved drawings of every version shown.</li></ul> |
| Live (real backend, fresh factory seed on the test database) | `review.live` **4 of 4**, including a new RP-1 test, through the real panels: <ul><li>a comment on the second version of a two-version review and an annotation on the first are stored on those versions;</li><li>a version not on the review is refused with 400;</li><li>the second version's page lists that review and the playlist that holds it;</li><li>the version answer has no `playlists`.</li></ul> **Live mutation:** with the comment panel ignoring the version chosen, the live test failed, because the comment was stored with `null`. |
| `tsc` / build | 0 errors / OK |
| Biome | **0 errors.** 862 warnings, down from 863 before RP-1: the new code adds none, and my first draft's `any` casts in the tests were typed. |
| Unreachable-file check | Only tests, `*RowKeys.ts` and helpers, as before |

The Playwright role smoke was not run. It visits static routes as each role and does not open the review viewer, so the live vitest above is the browser-level check for RP-1.

## 6. WP 1.6, step 1: the read-only check

`docs/review-pipeline/STAGING_AUDIT.sql` has eight SELECT statements, PostgreSQL only:
1. Per column: how many versions hold something, how many of those are archived, and how many hold something that is not a list.
2. Per column (2a to 2f): up to 20 of the most recently changed versions that hold something, with their first 300 characters, to judge by eye whether any of it was typed by a person.
3. The entries of the `playlists` copy with no live playlist entry behind them: adds by name, which never made an entry, and versions since taken off the playlist.

It was not run on any non-test database.

`backend/apps/production/tests/test_rp1_staging_audit_sql.py` (3 tests) runs every statement on the test database and checks that each is SELECT-only. It plants values and checks what is reported. **Mutations: 5 of 5 caught** (removed entries still counted, archived rows not told apart, a non-list not reported, adds by name hidden, a sample left out). The archived-rows mutation was missed the first time, because the only version with `activity` in the test was the archived one; the test was strengthened, and it is caught now.

## 7. WP 1.6, step 2: the drop

The owner chose (2026-11-12) to have the drop written before the audit output came in. **Running the check moved to the deploy checklist**: it runs on each database before migration 0004 (`docs/07-deployment/pre-deploy-checklist.md`). The migration's header says so too.

- **The change:** migration `production` `0004_drop_version_json_copies` removes the six fields from `Version`. It can be reversed, but a reverse brings the columns back empty.
- **What referenced them:** nothing outside tests. The serializers stopped in WP 1.1, `add-to-playlist` in WP 1.2, and the seed commands never wrote them (checked: `seed_studiohub`, `seed_production_mocks`). No admin or raw SQL other than `STAGING_AUDIT.sql` names them.
- **Tests:**
  - `test_rp1_data_cleanup.py` now checks that the model has none of the six fields, in place of planting stale JSON.
  - `security/test_cross_project_references.py` checks that no playlist entry was written, in place of an empty `playlists` copy.
  - **Removed:** `test_rp1_staging_audit_sql.py`. It ran the SQL against the schema before 0004, so it cannot pass after it. It passed, with 5 of 5 mutations caught, at `83167cec`, and the SQL has not changed since except for its header comment.
- **Evidence (test database):**
  - `apps/production`: 1,604 pass. That is 1,603 before, plus the 3 audit tests, minus those 3 removed, plus the new model check.
  - `apps/publishing`, `apps/deliveries` and `apps/scheduling`, which also use `Version`: 1,792 pass.
  - `ruff check .`, `manage.py check` and `makemigrations --check`: clean.
  - basedpyright: 0 errors on the changed files.
  - No API change beyond C-RP-01, so nothing changed in the frontend.
