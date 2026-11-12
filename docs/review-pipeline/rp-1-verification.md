# RP-1 Data model cleanup: verification (backend)

Branch `feature/rp-1-data-cleanup`, off `develop` at `4d346bf7`. **Not committed, not pushed.** This covers PLAN WP 1.1 to 1.4 (backend). WP 1.5 (frontend) and WP 1.6 (column drop) are not started.

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

- **An older frontend keeps working.** It reads none of the six keys (`frontend/src/api/production/review.ts:12`) and sends no `version_id`. Only the frontend's pinned row keys (`VERSION_KEYS`) and captured samples need the follow-up (WP 1.5).
- **Choice made while building:** a version on a comment is checked against the review's *live* items only when the comment is new. A reply on a thread whose version was later taken off the review is still accepted, on the thread's version (by the code; no test pins it yet). Refusing it would make a thread unanswerable.
- **`SET_NULL` on the FK:** versions are soft-deleted, and `ReviewItem` already protects a version shown in a review from a hard delete, so the null case is only reached by a hard delete of a version that left every review.

## 4. Next

- WP 1.5, frontend:
  - drop the six keys from `Version` and `VERSION_KEYS`;
  - use `version_id` in `VersionWorkspace` and `VersionExtras`;
  - send the version on screen from `ReviewViewer` and show it in the panels;
  - refresh the captures from the test database;
  - role smoke of the review viewer.
- WP 1.6: `STAGING_AUDIT.sql` for the six columns, to run on staging and production, then the drop migration as its own commit.
