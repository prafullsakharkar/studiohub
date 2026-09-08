# Mock → Real Migration (studiohub-react → Django)

## What was discovered

- Frontend (660 files): mock authority is `src/mocks/mockRouter.ts` (in-memory
  DRF router, mock-first via `ApiClient.dispatch`, network fallback). MSW
  handlers are dormant (worker never started). Client: `ky` + React Query.
  Mode switch: `VITE_API_MODE=mock|rest|live` (default `mock`) or
  `localStorage vfx_api_mode_override`; base URL `VITE_API_URL`.
- Auth: Bearer JWT (localStorage), 401 auto-refresh. Org: `X-Organization-Id`
  header + `/api/organizations/:org/…` paths + `?organization_id=` fallbacks.
- Envelopes: DRF `{count,next,previous,results}` except org-nested flat
  resources, `GET /organizations/`, media/attachments (bare arrays).
- Backend already implemented ~200 routes (auth compat, org namespaced +
  legacy flat, production CRUD, deliveries/publishing/scheduling/audit/
  settings/intelligence). Docs in `docs/api/` (`frontend-backend-mapping.md`,
  `api-contract.md`, `msw-switch.md`) describe the in-repo frontend's prior
  migration; this task targets studiohub-react.

## What existed → reused

Auth login/refresh/logout/me; org namespaced CRUD + legacy flat orgs/
departments/teams/offices/people/clients/vendors/billing/singleton;
production CRUD + task bulk-assign/status/delete + timelog approve/reject +
review 14 actions + version publish flow + workflow actions; deliveries/
publishing/scheduling/audit/settings/intelligence routes; `seed_dev` +
`seed_production_mocks`; pagination/filter/error/org-scope infrastructure.

## What was missing → created

- Models: `production.ProjectMembership|EditorialCut|ProjectNote`
  (migration `0006`); `ShotStatus.ARCHIVED` (migration `0007`).
- Project-scoped API: 16 endpoints under
  `/api/organizations/<org>/projects/<project>/…` (members/summary/lists/
  editorial/notes/deliveries/schedule/resources/pipeline/files/activity).
- Nested org router: 17 resources under `/api/organizations/<org>/…`
  (slash-optional, id/code/slug orgs, per-resource pagination).
- Flat fallbacks: `/api/v1/positions|invitations|work-calendars|work-hours|
  calendars|holidays|roles|groups|permissions|api-keys|pats/` (bare arrays).
- `GET /api/v1/auth/memberships/` + `/api/v1/users/me/memberships/`;
  `GET /api/v1/projects/{id}/statistics/`;
  `POST /api/v1/reviews/{id}/participant-verdict/`;
  sequence `check-existence/` alias (+`archive/`); shot/asset/task
  `check-existence|bulk-create|update|archive|restore/` + single
  `archive|restore/`; task `bulk-restore/`; compat bare-array
  `/api/v1/attachments/`; paginated playlists.
- `seed_studiohub` command (runs `seed_dev` + react overlay, with dry-run, phasing, reporting, validation).
- `_seed_sequences` (was missing everywhere) + node-loader fix for workflow
  cross-references.

## What was modified (adapted, not redesigned)

- `SequenceService` logic generalized into `BulkOperationService`
  (Shot/Asset/Task inherit it); `SequenceViewSet` slimmed onto
  `BulkContractViewSetMixin` (same routes, union envelopes).
- Bulk/check responses now return a UNION of the react contract shapes and
  the legacy backend shapes (both frontends keep working; existing tests
  asserting legacy keys still pass).
- Production lists: id-or-code detail, `include_deleted|include_archived`,
  `client_name` project search.
- `InvitationEvent` dataclass now accepts `instance=/user=` (was 500 on every
  invitation mutation, including pre-existing routes).
- API key/PAT/invitation status words mapped at the compat layer
  (`Revoked↔cancelled/is_active`, capitalized outputs).

## Seed ↔ mock mapping

`seed_studiohub` resolves mocks from `$STUDIOHUB_REACT_MOCKS` → sibling
`studiohub-react/` → in-repo `frontend/`. Overlay filters react arrays per
org (mock org id → Django org code), rewrites mock user ids to emails,
writes temp TS files through the existing node-based loader, and seeds
memberships/editorial/notes/activity-links directly. `update_or_create` /
`get_or_create` throughout → idempotent; soft-deleted rows matching incoming
keys are restored, mock `is_deleted` rows stay soft-deleted as restore
fixtures. Memberships are strictly mock-driven (all 19 mock users get
accounts; no blanket grants). Known normalization (documented in command):
sequence `VEL1` → `VEL01` (mock typo; file untouched). Seeded: 4 orgs,
19 users, 23 org memberships, 8 projects (4/2/1/1), 9 sequences, 9 shots,
11 assets, 11 tasks, 8 timelogs, 5 versions, 4 reviews, 2 playlists, 5 media,
3 workflows, 3 editorial, 3 notes, 23 project memberships, 14 activity links.
Full detail: `docs/SEED_DATA.md`.

## Frontend switch (no frontend code changes)

```bash
# studiohub-react/.env (or shell env)
VITE_API_MODE=rest
VITE_API_URL=http://localhost:8000
```

(or `localStorage vfx_api_mode_override=rest`). `RepositoryFactory` then
instantiates `REST*Adapter`s; `ApiClient` sends Bearer + `X-Organization-Id`.
Mock files stay in place as rollback. Backend:

```bash
cd backend
uv run python manage.py migrate
uv run python manage.py seed_studiohub --force   # dev DB (Postgres per .env.*, or DB_ENGINE=sqlite)
uv run python manage.py runserver                 # :8000
```

DB note: PostgreSQL is the default and remains the production DB. An opt-in
SQLite mode was added for local frontend development without Postgres
(`DB_ENGINE=sqlite`, optional `DB_SQLITE_PATH`; see `.env.example`):
migrate + `seed_studiohub --force` + full contract verified working on
SQLite (including JSON `metadata__project_id` lookups). No Postgres-specific
fields exist in app models, keeping both backends portable.

## Verification performed

- `manage.py check`, `makemigrations --check`, `ruff check` (changed files),
  repo `basedpyright` (0 errors on new/changed files).
- 45 new contract tests
  (`production/tests/test_frontend_contract.py`,
  `organization/tests/api/test_contract_compat.py`) — all pass; existing
  sequence/scoping suites pass (32).
- Live server checks: login → mock-driven memberships (e.g. supervisor: 3 orgs, no FSP) → projects per org →
  project summary/counts → slashless nested lists → note create (201) →
  check-existence states → VNG isolation (own 2 projects; NK99 via VNG → 404).
- Formerly-failing suites now fixed: 9 organization integration tests
  (stale `organization=` service kwargs → positional; `uuid` ORM lookup →
  `id`; dead `pytest.lazy_fixture` lines removed; `with_statistics`
  implemented on queryset/manager/model; transaction test rewritten
  behaviorally; delete assertions aligned to canonical soft-delete),
  core `OrderingQuerySetMixin.ordered`, and all ruff findings.

## Remaining / intentional gaps

- ~~Mock `lead_artist` sequence search~~ — closed: `Sequence.lead_artist`
  FK + `lead_artist_name` (migration `0008`), serializer + filterset search,
  seeded from mock.
- ~~Media title/code/file_name~~ — closed: fields added (migration `0008`),
  serializer + flat/nested files search, seeded (update_or_create backfill).
- ~~Scheduling lists~~ — closed: all five viewsets return bare arrays per
  contract; 8 existing tests updated from paginated assertions.
- Deliveries/publishing/intelligence frontend services import mocks directly
  (no apiClient) — backend routes exist; UI wiring is frontend-side.
- `?mock_error=` simulation and MSW-only `bulk-delete` (tasks) are
  test-harness concerns, not backend scope.
