# Review pipeline: plan

Decisions: [DECISIONS.md](DECISIONS.md). Contracts: [CONTRACTS.md](CONTRACTS.md). Findings: [ANALYSIS.md](ANALYSIS.md).

The rules of the earlier programmes apply to every phase:
- one branch per phase, `feature/rp-N-<name>`, off `develop`;
- a contract entry for every API change, before the code;
- tests on the pytest test database (never the development database), targeted runs only, unless asked;
- mutation checks on the tests that matter;
- a frontend follow-up served from captured responses (`docs/sync/samples/`);
- a verification report, `docs/review-pipeline/rp-N-verification.md`;
- a stop after each phase. Commit, merge and push only when asked.

## RP-1 Data model cleanup

**Status:** backend WP 1.1 to 1.4 built on `feature/rp-1-data-cleanup`, not committed ([rp-1-verification.md](rp-1-verification.md)). WP 1.5 (frontend) and WP 1.6 (column drop) not started.

**Goal.** Records are the only truth for what a version is in and what is said about it, so later phases (notes, roll-up, notifications) are built on them and not on copies.

### Why

1. A version answers six JSON lists: `reviews`, `playlists`, `notes_list`, `media_items`, `attachments` and `activity`.
   - These are caches, not truth (production DECISIONS D-18). The reviews and playlists they describe have been records since D-30 and D-31 (`ReviewItem`, `PlaylistEntry`).
   - No code writes five of them. The sixth, `playlists`, is appended to by `POST /versions/{id}/add-to-playlist/` (`backend/apps/production/api/viewsets/version.py:158`), even when the add names no playlist id. It never loses an entry when the version leaves a playlist.
   - The frontend reads none of them (`frontend/src/api/production/review.ts:12`).
2. The frontend cannot ask "which reviews or playlists hold this version". It reads every review of the entity, or every playlist of the project, and filters on the client (`VersionWorkspace.tsx:42`, `VersionExtras.tsx:19`). With more than 100 reviews on an entity, it misses some.
3. A review comment or annotation does not say which version it is on (`backend/apps/production/models/review_parts.py`). In a review of several versions, a note on frame 1012 has no picture. ShotGrid and ftrack link every note to the version.

### Work packages

| WP | What | Where |
|---|---|---|
| 1.1 | **The six cache keys leave every version response** (C-RP-01). `publishing_info` stays: it is written by `publish`. The model columns stay until WP 1.6. | `api/serializers/version/base.py`; the OpenAPI schema |
| 1.2 | **`add-to-playlist` stops writing `Version.playlists`.** The `PlaylistEntry` row is the only record (C-RP-02). | `api/viewsets/version.py` |
| 1.3 | **`version_id` filter on reviews and playlists** (C-RP-03, C-RP-04). It matches through the live `ReviewItem` and `PlaylistEntry` rows, keeps every other filter and the caller's narrowing, and never raises a 400 (the `project_id` alias style). Playlists get a `PlaylistFilterSet` in place of `filterset_fields`, keeping `status`, `project` and `client_only`. | `api/filtersets/review.py`, new `api/filtersets/playlist.py`, `api/viewsets/playlist.py` |
| 1.4 | **A version on comments and annotations** (C-RP-05, C-RP-06). A nullable `version` FK (`SET_NULL`) on `ReviewComment` and `ReviewAnnotation`, with a migration (no data step; old rows stay on the whole review). The `comments` and `annotations` actions accept an optional `version_id`. It must be a version of that review (a live `ReviewItem`), or the answer is 400. A reply takes its thread's version; a different one is 400. Every comment and annotation shape gains `version_id`. | `models/review_parts.py`, migration, `api/serializers/actions.py`, `services/review.py`, `api/serializers/review/parts.py` |
| 1.5 | **Frontend follow-up.** Drop the six keys from `Version` and `VERSION_KEYS`. Read reviews and playlists of a version with `version_id`, and remove the client-side filters. The review viewer sends the version on screen with every comment and annotation, and the panels show which version each one is on (or "Whole review"). Captures refreshed from the test database. | `frontend/src/api/production/review.ts`, `reviewRowKeys.ts`, `VersionWorkspace.tsx`, `VersionExtras.tsx`, `ReviewViewer.tsx`, `ReviewPanels.tsx` |
| 1.6 | **Contract step: drop the six columns.** This is a separate commit at the end of the phase, and only after the owner has run the read-only query in `STAGING_AUDIT.sql` on staging and production and seen what the columns hold. The values are caches (D-18), so a drop loses no truth. Anything that looks hand-entered is reported first. | `models/version.py`, a migration, `docs/review-pipeline/STAGING_AUDIT.sql` |

### Not in RP-1

- Attachments on a version (CR-52, proposed in frontend phase 32) stay as proposed. When CR-52 is approved, attachments are records, not the old `attachments` key.
- The version's activity: the frontend already reads the audit trail for the "Changes" and "Status history" tabs, so nothing replaces the `activity` key.
- Project notes on a version (`ProjectNote` with `entity_type` Version) are RP-2.
- `Playlist.share_settings` is unchanged (Q-RP-8 = B).

### Tests (targeted, test database)

- The version list, detail, create, update, publish, unpublish, promote and add-to-playlist answers have none of the six keys, and still have `publishing_info`.
- `add-to-playlist` leaves `Version.playlists` as it was, by id and by name.
- `version_id` on reviews and on playlists:
  - it matches only through live rows (a removed item or entry no longer matches);
  - an unknown or malformed value gives an empty list, not a 400;
  - it combines with `project_id` and `status`;
  - it does not widen what a partial member sees (a show-bound member asking for a version of another show gets nothing).
- Comments and annotations:
  - `version_id` of a version in the review is stored and returned;
  - one of a version not in the review is 400, and so is an item that was removed;
  - a version of another project is 400;
  - a reply takes its thread's version;
  - a reply naming another version is 400;
  - leaving it out keeps the old behaviour (`version_id: null`);
  - the review detail returns `version_id` on every comment, reply and annotation.
- The OpenAPI schema changes only in the places listed in C-RP-01 to C-RP-06.

Mutation checks: break each rule above (filter through deleted rows; skip the review-membership check; let a reply keep its own version; write the playlists JSON again; put a key back) and expect a failing test.

### Gates

- Backend from `backend/`:
  - `uv run ruff check .`;
  - `uv run python manage.py check`;
  - `uv run python manage.py makemigrations --check --dry-run`;
  - targeted `uv run pytest apps/production`;
  - basedpyright: no new errors in the changed files.
- Frontend from `frontend/`:
  - `pnpm typecheck && pnpm test && pnpm build`;
  - `pnpm exec biome check src` (0 errors);
  - the unreachable check.
- A browser role smoke of the review viewer (comment on a version in a two-version review), against a seeded backend on the test database.

### Release notes (draft)

- *Upgrading:* one migration (two nullable columns). WP 1.6 adds a second migration that drops six JSON columns from `production_version`; run `STAGING_AUDIT.sql` first. Deploy the frontend with the backend: an older frontend still works, because it reads none of the removed keys and sends no `version_id`.
- *API:* the version responses lose six keys nobody read. Reviews and playlists can be filtered by `version_id`. Comments and annotations name their version.

## RP-2 to RP-6

Not planned in detail yet. Each phase is written here before it starts, from [ANALYSIS.md §8](ANALYSIS.md#8-draft-phases-to-be-fixed-after-9-is-answered) and [DECISIONS.md](DECISIONS.md).
