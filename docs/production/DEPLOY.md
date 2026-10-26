# Deploying the production hardening work

Branch `feature/production-hardening`, commits `0bd495b` (phase 1) onwards. What changed and why: `DECISIONS.md` (D-01 to D-25); every API change with its before and after: `CONTRACTS.md` (C-01 to C-35); what is still planned: `PLAN.md`.

**What was and was not run.** Everything below was developed and tested against the pytest test database only (last full suite: 4147 passed, 1 skipped). Nothing was ever run against a staging or production database, and none of the preflight steps in section 1 has been run by the author. Treat section 1 as a gate you pass, not a formality.

## 1. Before you migrate (read-only)

Run these against a copy or the real database, in this order, and keep the output.

1. **`docs/production/STAGING_AUDIT.sql`.** SELECT statements only. It lists rows the new status, timelog and separation-of-duties rules would not have allowed (statuses outside the valid set, approved timelogs without an approver or approved by their own author, and so on). Run each block on its own. Nothing here stops the migrations; it tells you which existing rows will look odd afterwards.
2. **`uv run python manage.py report_production_data`** (add `--fail-on-findings` to make it exit 1 when anything is listed). It reads the database chosen by `DJANGO_ENV` and changes nothing. What it lists and what to do:

   | Section | Meaning | Action |
   |---|---|---|
   | Codes that differ only by case | Two rows of one project (soft-deleted included) whose codes are equal ignoring case. **Migration 0025 refuses to run while any exist.** | Rename or archive one of each pair, then rerun. |
   | Frame ranges running backwards | `frame_out < frame_in` (versions: `end_frame < start_frame`). **Also blocks 0025.** | Correct the numbers. |
   | Shots naming no sequence | A shot's `sequence_code` matches no sequence of its project. They keep `sequence = NULL` after 0027 and their text. | Create the sequence or accept; nothing blocks. |
   | Sequences of episodic projects without an episode | Left empty by 0029 because their shots do not share one episode, or there are no shots. | Set the episode through the API when convenient; older rows can be edited without it. |
   | Shots whose episode differs from their sequence's | An older mismatch, left alone until the shot is moved. | Review. |
   | Tasks whose stored hours differ from approved timelogs | The old `logged_hours` column (typed by clients or seeded) is no longer shown; responses show the approved sum. | Know that these numbers disappear from the UI. |
   | Archive flag versus soft delete | Counts only, not findings. **"Flag only" is the number of rows migration 0031 will soft-delete** (they leave default lists). | Look at the numbers per model before migrating; keep the output. |

## 2. Migrate

`uv run python manage.py migrate` (production 0023 to 0031, scheduling 0003). In order:

| Migration | What it does | Can it fail on existing data? |
|---|---|---|
| production 0023 `status_history` | New append-only history table. | No. |
| 0024 `status_override_and_timelog_adjustment` | Two additive columns. | No. |
| 0025 `code_and_frame_constraints` | Case-insensitive unique codes (six models) and frame-order checks. | **Yes, on purpose**: it stops with a message listing the conflicting rows and changes nothing. Fix them (section 1) and rerun. |
| 0026 `shot_sequence` | Adds `Shot.sequence`. | No. |
| 0027 `fill_shot_sequence` | Links each shot to the sequence its `sequence_code` names (any case, soft-deleted sequences included). | No; unmatched shots stay `NULL`. Reverse does nothing. |
| 0028 `sequence_episode` | Adds `Sequence.episode`. | No. |
| 0029 `fill_sequence_episode` | Fills the episode of a sequence only when all its shots agree on one. | No; the rest stay `NULL`. Reverse does nothing. |
| 0030 `protect_history_rows` | Delete rules only (`PROTECT`); emits no SQL. | No. |
| 0031 `reconcile_archive_flag` | **Soft-deletes** the Task, Asset, Version, Playlist and Workflow rows that have the old `is_archived` flag set and are not soft-deleted, so they leave default lists. The column is untouched. | No, but it changes what users see: check the "flag only" counts first (section 1). Reverse does nothing; ids are logged (`archive_flag_reconciled`). |
| scheduling 0003 `leave_rejected_by` | Two additive columns on leave requests. | No. |

Tests exist for forward, back and forward again of 0023 and 0024 (`test_migration_roundtrip.py`) and for 0025 to 0029 and 0031 (`test_migrations_hierarchy.py`, including the refusal of 0025, the fill rules of 0027 and 0029 and the rows 0031 touches); 0030 has none (no SQL). The two "fill" migrations log a count of filled and unmatched rows.

## 3. After migrating

1. **`uv run python manage.py init_platform` on every database.** It only adds: existing role grants are kept. New permission codes: `automation.view|create|update|delete`, `timelog.view_all`, `production.code.rename` (production-admin), `schedule.view_rates` (full roles: pay rates and e-mail addresses in the resource planner). `production.status.override` and `production.sod.override` are in the catalog and granted to nobody. The role-to-code matrix is `DECISIONS.md` D-07 and is pinned by `tests/test_permission_matrix.py`. Without this step the full roles see `null` pay rates, lead-artists and artists cannot open the scheduling board, and the new checks have nobody to hold them.
2. **Run `report_production_data` again** and compare with section 1. The case and frame sections must now be empty.
3. **Smoke checks (as a non-admin member of one project):**
   - `GET /api/v1/shots/` returns shots with `sequence_id` and `current_version`; `GET /api/v1/tasks/` returns `logged_hours` and `pending_hours`.
   - An approval PATCH without the approve code answers 403; an illegal status move answers 400.
   - `GET /api/v1/scheduling/events/` shows only events of your projects (plus studio-wide ones); `GET /api/v1/scheduling/resources/` shows `hourly_rate_usd: null`.
   - `POST /api/v1/shots/bulk-create/` with `{"items": [{"project_id": "...", "code_prefix": "SH"}]}` creates `SH0010` (then `SH0020`, ...).
4. Seeded data: the seed commands still create sequences without an episode and shots with the old free-text fields; the report will list them. Not a problem for the API.

## 4. Rolling back

- Code: redeploy the previous release. The schema is additive except as noted, so older code runs on the migrated schema, but it will not know the new rules.
- Schema: `migrate production 0022` and `migrate scheduling 0002` reverse everything. **Reversing 0023 drops `StatusHistory` with all its rows** (the approval and status trail); the fill steps (0027, 0029) do not restore anything because they never removed anything. Take a backup first if you may need to go back.

## 5. Behaviour users will notice

| Who | What changes |
|---|---|
| Members without the matching code | 403 on project-scoped lists and on the scheduling board; an unknown or foreign project is a 404, not a 403. Smaller analytics numbers. |
| Anyone editing shots, tasks, versions, reviews | Status, approval flags, publish, hero, archive and hours fields are read-only on create/update (400 when changed); use the actions. Illegal status moves are a 400; approving your own work is a 403 unless `production.sod.override`. |
| Timelogs | `timelog.view` shows your own; the project's need `timelog.view_all`. Approved logs are final; corrections are new entries (`adjustment_of`). |
| Codes | Upper-cased everywhere, unique ignoring case; no spaces or slashes; shot and asset codes freeze once a version exists (`rename-code`, production-admin only). |
| Scheduling | Events follow their visibility and project; leave is decided once, by someone else, with the reason hidden from bystanders; pay rates need `schedule.view_rates`. |
| Versions, playlists, workflows | Archiving now removes them from the default lists (like tasks and shots); `?is_archived=true` shows them; `is_archived` is read-only. |
| Dashboards | Hours are the approved sum with pending hours beside them; a shot's current version is its latest published version. |

## 6. Frontend change list (all phases, in one place)

From `CONTRACTS.md`; the contract IDs have the exact before and after.

1. Send `project_id` when creating an automation rule. Treat 404 on project-scoped routes as "no access or unknown". Expect smaller analytics numbers for non-admins. (C-01 to C-08)
2. Stop sending `supervisor_approved`, `is_published`, `is_hero`, `supervisor_verdict`, `is_archived`, `logged_hours`, `current_version`, `sequence_code` on create/update; call the action, or use `sequence_id`. A full PUT that echoes stored values is fine. (C-09 onwards)
3. Approvals through PATCH need the approve code (show the 403). Do not rely on `playlists/{id}/reorder/` to edit entries. Remove unknown keys from action bodies.
4. Status changes: handle `400 {"status": [...]}` and 403; offer only legal moves in the shot and version selectors (D-03); show 403 `separation_of_duties`; a repeated decision is 409.
5. `bulk-status`: read `results` and `failed_count`; 200 or 207. `POST /projects/` makes the caller a member (do not add them again). `GET .../status-history/` exists for five entities.
6. Timelogs: stop editing approved ones; use `adjustment_of`; a rejection needs a reason; show hours as logged plus pending.
7. Codes: expect upper case; send `sequence_id` and, on episodic projects, `episode_id` for sequences; show frame-range errors; use `rename-code` after the first version; bulk import may send `code_prefix`; the episode form may show a 7-character code.
8. Archiving: archive shots before their sequence and sequences before their episode, or handle the 400 and `has_children`.
9. Scheduling: users without `schedule.view` get 403 on the board; read-only status, decision fields and `total_days` on the leave form, and handle 403 (own leave) and 400 (already decided); fewer events for non-members; placeholders for `null` rates; do not show "Booked on another project" as a real title; event and resource edit forms now work; offer only the user's own projects; disable status changes out of Completed or Cancelled.
10. Archived items: stop sending `is_archived`; archive and restore versions, playlists and workflows with the actions; list archived ones with `?is_archived=true`.
11. Treat an empty `current_version` as "no versions yet"; link with `current_version_id`.

## 7. Not done, on purpose

Phases P7 to P12 of `PLAN.md` (shot to asset links, task templates and entity links, version numbering, relational reviews and notes, the contract phase that drops legacy columns) and these items inside finished phases:

- dropping the `is_archived`, `sequence_code`, `Task.logged_hours` and `Shot.current_version` columns (final cleanup; `is_archived` itself is retired in behaviour, D-25);
- the head and tail handles split (B7) and manual ordering (B6);
- assets: `Asset.version` and its JSON `versions` list are untouched (D-16);
- open questions Q5, Q6 and Q10 (assets and templates).
