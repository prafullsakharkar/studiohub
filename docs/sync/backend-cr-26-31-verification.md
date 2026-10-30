# Backend requests CR-26 to CR-31: verification

Branch `sync/backend-cr-26-31` (from `develop` after the Phase 12 merge, `628a7ef9`), **not pushed, not merged**. Approved by the owner with "go" after the Phase 12 report, on the recommendation "apply all six now, in two commits, before Phase 13". Backend files were touched only for these six requests. `main` is untouched (`9b52784f`).

## 1. What was applied

| CR | Change | Where | Tests |
|---|---|---|---|
| 26 | the six settings lists answer their filters (`.queryset` → `.qs`) | `apps/settings/api/viewsets/{category,definition,system,feature_flag,theme,localization}.py` | 7 |
| 27 | a definition's `choices` are `{value, label}` objects with unique values; a `select` / `multiple_select` needs at least one; a 400 under `choices` otherwise | `apps/settings/serializers/definition.py` | 5 |
| 28 | tags: reads for anyone signed in, writes need `settings.manage`; `is_system` is a platform administrator's to set; a system tag is changed or deleted only by one; hex colour; create and update answer `id` | `apps/core/api/viewsets/tag.py`, `serializers/tag.py` | 9 |
| 29 | flag `percentage` 0 to 100, end after start; `schedule` needs both dates, parseable, with a zone, `end > start` (400 keyed by field); `week_start` 0 or 1; theme colours `#rrggbb`; the last active theme cannot be deleted | serializers for flag, localization, theme; `api/viewsets/{feature_flag,theme}.py` | 8 |
| Q-21 | `status` is "on"; `is_enabled` is read-only and follows it (`enable` sets it, `disable` and `schedule` clear it, create and patch derive it); an enabled boolean flag is now on for a user; a scheduled flag with no start is off, not a `TypeError` | `serializers/feature_flag.py`, `services/feature_flag.py`, `models/feature_flag.py` | 3 |
| 30 | `schedule.milestones` of the project dashboard are the project's own, read through the `scheduling.project_milestones` provider (`completed` / `in_progress` / `overdue` / `upcoming`; `[]` when none); the five invented phases are gone | `apps/production/selectors/dashboard.py` | 3 |
| 31 | one overdue rule for the per-task flag and the count; a Cancelled delivery is neither late nor upcoming; `completed` and `signed off` count as delivered | same | 4 |

New tests: 22 + 9 (settings, tags) and 7 (dashboard). Contract text: `docs/api/dashboard.md`, `docs/sync/backend-change-requests.md` (statuses and an "Applied" note per group).

## 2. Deviations from what was proposed (read these)

1. **Q-22 (exclusive activation) was not applied.** A theme's and a localization's `is_active` defaults to **true** and is the same field as "available": light and dark themes, several languages, are meant to be active together, and a new row starts active, so an exclusive rule would silently deactivate rows on every create. The model has no `is_default` / "current" marker. If the studio wants "the active theme", it needs a new field and a migration; that is a separate request. What I did instead is the part of CR-29 that follows without the field: **the last active theme cannot be deleted** (the request said "the active theme"; with several active that would have made every delete a two-step).
2. **Dashboard milestones** are now in the payload for anyone who may read the dashboard (`project.view`), not only for `schedule.view`. The milestone names and dates are project information a member already sees; the card on the page still reads Scheduling, which stays gated by `schedule.view`.
3. **`total_deliveries` still counts cancelled deliveries.** So `delivered + late + upcoming + cancelled = total` (not `... = total` without the cancelled). I did not add a `cancelled` field, to leave the payload's shape alone.
4. A Rejected delivery past its date stays **late** (the client said no; it is still owed).
5. A signed-off delivery counts as **delivered**, as the request proposed and as the screens already did, although it has not been sent yet. It is one word in `DELIVERED_STATUSES` if you would rather not.

## 3. Evidence

- **Targeted backend runs** (never the full suite): `apps/settings` + `apps/core` + `apps/identity/tests/security` 1171 pass and **1 fail that is not mine**: `apps/core/tests/test_bootstrap.py::TestFreshInitialMigrations::test_there_is_one_initial_migration_chain_per_app` (deliveries has three migrations, the test allows two; no migration was touched here). `apps/production` 1305 pass. `ruff check` clean on the changed apps; `makemigrations --check` reports no changes (no model field changed); `basedpyright` on the changed files shows no new error (the six `get_queryset` overrides and the generic-type warnings in `dashboard.py` were already there).
- **Existing tests that pinned the old behaviour and were changed** (each one asserted a bug): `test_tag_viewsets.py` (4 writes now use the platform administrator), `test_authorization_security.py::test_authenticated_user_can_create_tag` (now `cannot`, 403), `test_scoped_credential_gate.py` (tags moved from "views that check no code" to the open account-level list: a narrow key is still refused), `test_settings_viewsets.py::test_delete_viewset` (another theme stays active), `test_dashboard.py` (no invented milestones).
- **Mutation checks** (one source change reverted at a time, the new tests must fail): 47 on the backend (38 for settings and tags, 9 for the dashboard), **46 caught**; the frontend changes were checked with 3 more, all caught. The one that was not: making `is_enabled` writable again. It is equivalent, because `validate()` overwrites the key from `status` on every save; it is kept as defence in depth. Two tests also failed first on a bad fixture (a Completed milestone needs `completed_at`; the check constraint said so) and were fixed.
- **Captures re-run against the changed backend:** `docs/sync/samples/settings/_flow.json` (195 calls; every changed status is an intended fix: 7 writes now 400, 5 tag writes now 403, the select-strings definition now 400, the last active theme 400) and `docs/sync/samples/dashboards/_flow.json` (47 calls; late 2 → 1, two real milestones instead of five invented ones, none for an empty project, no finished task flagged overdue). `test_capture_settings.py` was changed so the tag section writes as the administrator and probes the artist's 403s.
- **Frontend:** the contract and screen tests that asserted the old bugs now assert the fixed behaviour (settings 50, dashboards 42). The tag form uses the id the create now returns instead of searching by name. Three dashboard workarounds were removed in their own commit (`getDeliveryFigures`, `taskIsOverdue`, the HUD's `deliveries` prop). Kept on purpose: the browser-side narrowing of the small settings lists (the server still has no `search`), the forms' own checks (they put the message under the field without a round trip), and the milestones card reading Scheduling.

## 4. Gates

| Gate | Phase 12 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 99 files / 964 | **99 files / 964** (settings +2, dashboards −2) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2105 warnings | **2 errors (the same two) / 2106 warnings** |
| Live tests (one fresh seed per file, against the changed backend) | not comparable (see below) | **14 files / 64, all pass** |

## 5. Not done / for later

- The browser-side narrowing of the settings lists and the forms' duplicate checks could be dropped in the consistency pass (Phase 13); they are harmless.
- `search` and `ordering` on the settings lists remain unsupported by the server (not part of CR-26).
- The deliveries migration-count test fails on `develop` too; it is outside this batch.
- The commit message of `0009a2b9` says "9 new" tests; it is 7 tests and 9 mutation checks.
- The live count: this directory holds 14 live files and they hold 64 tests. The "15 files / 82" I quoted in the Phase 12 report does not match that listing and I could not reconcile it, so read this run, not that figure. All 14 files passed, each on a fresh seed.
