# Frontend ↔ backend sync (docs/sync)

The React app in `frontend/` was synced from the sibling `studiohub-react` repository with its mock layer removed, and it was badly out of contract with the Django REST backend. This folder is the record of making it a faithful client, phase by phase (Phases 0 to 28), and the tools that keep it one.

**The rule that held throughout:** the backend is the contract. No endpoint, field or error shape is used unless it was read from the backend code or captured from a real response (`samples/`). Backend code changed only for the change requests in [`backend-change-requests.md`](backend-change-requests.md), each approved by the owner first.

## Where things are

| File | What it is |
|---|---|
| [`00-backend-inventory.md`](00-backend-inventory.md), [`00b-backend-serializers.md`](00b-backend-serializers.md) | Every backend route, its permission codes and its serializer shapes |
| [`01-frontend-inventory.md`](01-frontend-inventory.md) | Every API call the frontend made at the start, and what it was missing |
| [`02-gap-analysis.md`](02-gap-analysis.md) | The differences between the two, ranked |
| [`03-phase-plan.md`](03-phase-plan.md) | The plan: 14 phases, scope and dependencies of each |
| [`phase-N-verification.md`](.) (1 to 28, plus `legacy-cleanup-verification.md`, `backend-cr-36-verification.md` and `backend-cr-37-verification.md`) | What each phase built, removed and found, the gates it passed, the questions it left |
| [`backend-cr-26-31-verification.md`](backend-cr-26-31-verification.md) | The last batch of backend changes (settings, tags, dashboard) |
| [`backend-change-requests.md`](backend-change-requests.md) | Every backend finding (CR-n), with evidence, the proposed diff and its status; owner questions (Q-n) |
| [`samples/`](samples/README.md) | Real responses captured from the backend; frontend tests build their mocks from these |
| [`tools/`](tools/README.md) | The capture scripts, the live backend harness, the role smoke runner, the dead-code finder |

## State after Phase 28 (the current one; the section below is the Phase 13 record)

- Phases 0 to 28 are merged into `develop` and `main` (identical trees). The backend changes that came after Phase 13 are CR-32, 33, 36 and 37 (team membership, a member bound to a show, a member edited and removed by id); CR-38 (a plain re-add must not reactivate or demote a member) is applied (`backend-cr-38-verification.md`).
- CI (`.github/workflows/ci.yml`) has four jobs: backend (ruff, pytest on Postgres 18), frontend (typecheck, Biome errors, vitest, build), secret scan, docs link check. `main`'s branch protection requires only backend, secret scan and docs; the frontend job is not yet a required check.
- Dependabot (`.github/dependabot.yml`) opens weekly grouped updates for the backend (uv), the frontend (npm), the Actions, Docker and compose. The npm entry ignores Express 5 (its bare `*` route breaks `frontend/server.ts`) and `@types/node` 25 and newer (CI runs Node 24). Its pull requests that change workflow files cannot be merged with the `gh` token in use (a fine-grained token); they were merged by merging the pull request's head with git.
- The backend runs on Django 6.1.2: mail is configured through `MAILERS` (built from the same environment variables), and `django-celery-beat`, which capped Django below 6.1, was removed because nothing used it.
- The signed-in app applies the studio's default localization (date, time and number formats, first weekday) and default theme (starting mode, accents, font): Phase 28. The studio time zone and the theme's radius, surfaces and text colours are not applied (`phase-28-verification.md` §3).

## State at the end of Phase 13

- Phases 0 to 12 and backend requests CR-13 to CR-31 are merged into `develop` and `main`. Phase 13 (hardening) is described in [`phase-13-verification.md`](phase-13-verification.md).
- Every screen reads and writes through typed modules in `frontend/src/api/<app>/` that are pinned to captured responses by contract tests (compile-time key lists in `*RowKeys.ts`, mutation-checked).
- Authorization uses backend permission codes (`useCan`); role names are labels only. The access token lives in memory, the refresh token in `localStorage` with a cross-tab lock, and a session that ends (here or in another tab) clears the workspace tabs and chosen projects the browser kept.
- The 22 backend change requests that were applied are listed in the table in `backend-change-requests.md` (CR-02, 13 to 31, Q-03, Q-05). **Not applied, by decision or priority:** CR-01, 03 to 11 (the frontend works around each) and the open owner questions Q-01, Q-02, Q-04, Q-06. Q-22 (one default theme and one default localization) was applied afterwards as a new `is_default` field.

## How to check that it still holds

From `frontend/`:

```bash
pnpm typecheck && pnpm test && pnpm build      # unit and contract tests run against the captured samples
pnpm exec biome check src                      # 2 known errors (useHookAtTopLevel) are the baseline
node ../docs/sync/tools/unreachable.mjs . | grep ^unreached   # files nothing reachable from main.tsx imports
```

Against a live backend (a throwaway factory-seeded one, on the pytest test database, never the development database):

```bash
# one file at a time, each on a fresh seed
cd ../backend && SYNC_LIVE_INFO=/path/live.json SYNC_LIVE_STOP=/path/stop \
  uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q -s ../docs/sync/tools/live_backend.py &
cd ../frontend && SYNC_LIVE_INFO=/path/live.json pnpm test:live src/test/live/<file>   # 15 files, 82 tests at the end of Phase 12

# the browser role smoke: six roles open every route, plus a phone-width accessibility pass
docs/sync/tools/run_role_smoke.sh [--grep "<role>"]       # about 25 minutes for everything
```

Re-capture a sample after a backend change with the matching `docs/sync/tools/test_capture_*.py` (`SYNC_SAMPLES_OUT=../docs/sync/samples uv run pytest …`), then run the frontend tests: the ones that pinned the old behaviour fail and show what to update. That is how CR-26 to CR-31 were followed through.

## Habits worth keeping

- **Verify a backend claim against the running backend** before writing it down; read the whole permission path, not only `permission_map`.
- **Mutation-check every test that matters:** break the code, expect the test to fail. A test that has never failed has proved nothing (several did not, and were fixed).
- **A clean `git worktree`** is the only trustworthy "works on a fresh checkout" check.
- **Never run `biome check --write` on a whole directory**, and never `git stash` in a repository where someone else keeps stashes.
- New screens: a `DirectoryListPage` / `DirectoryFormPage` config over a typed `resourceApi` module (`src/modules/directory`, `src/api/masterdata/resource.ts`); every route needs an entry in `core/permissions/routePermissionsRegistry.ts`; pages are loaded with `lazyNamed` in `AppRoutes` (a test fails on a static page import).

## Deferred (see the phase reports for the full lists)

What the later phases settled: the five directory workspaces and the Person workspace (Phases 14 to 16), team membership (CR-32, CR-33), shot, asset and project workspaces (Phases 18, 19, 21), the legacy data layer and the legacy production types (Phases 20 and 22), the client-side activity feed (legacy cleanup), the invented show id (Phase 23), and binding a project member to a show (CR-36, `backend-cr-36-verification.md`), and editing, removing and limiting a member to a department (CR-37, `backend-cr-37-verification.md`).

Phase 26 added the week, day and timeline views to the scheduling calendar (`phase-26-verification.md`; read-only, no backend change). Phase 27 replaced the pasted delivery id on a milestone with a picker (`phase-27-verification.md`). Phase 28 applied the studio's default localization (date, time and number formats, first weekday) and default theme (starting mode, accents, font) to the signed-in app (`phase-28-verification.md`). Still open: dashboard history and burn-up charts, render-farm and storage tiles (no backend data), applying the studio's time zone and the rest of the theme (radius, surfaces, text colours, font size; `phase-28-verification.md` §3), a leave cancel endpoint, a screen for checksum verification, a "finished" project status (the server refuses `Completed`; it would be a backend request). `main` is behind `develop` by many phases and is only updated when the owner asks.
