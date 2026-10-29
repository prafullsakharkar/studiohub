# Phase 07 — API Architecture & Parity (audited 2026-09-23)

Target shape (verified as built):

```text
Application (hooks → services → repositories)
    ↓  Canonical Repository/API Contract (api/repositories/interfaces + types/drf)
    ↓  Mock Adapter  OR  REST Adapter   (factory by VITE_API_MODE, no fallback)
```

Same frontend contracts in both modes: `IRepository` family + `PaginatedResponse`
(`count/next/previous/results`) + `QueryParams` + `ApiError` normalization at
every boundary (`ApiClient`, `QueryProvider`, `notify`, `ApiErrorState`).

## 1. Layer map (all live, none deleted — each serves a mode or caller class)

| Layer | Files | Role | State |
|---|---|---|---|
| `ApiClient` | `api/client/*` | HTTP + mock dispatch for `BaseRepository` subclasses | Delegates per mode |
| `BaseRepository` + 7 subclasses | `core/repository`, audit/editorial/review/timelog/playlist/workflow/sequence modules | ApiClient-backed repos | Via ApiClient |
| Factory adapters 8+8 | `api/repositories/adapters/{mock,rest}` | Primary path for project/task/asset/shot/org/auth/delivery/publishing | Mock: session memory; REST: live HTTP |
| `mockRouter` (6.7k lines) | `mocks/mockRouter.ts` + `masterDataMockRouter` | ApiClient's mock backend | **Durable**: IndexedDB + rollback + multi-tab broadcast |
| MSW `handlers/*` (15 files) | `mocks/handlers` | Opt-in HTTP interception (`VITE_USE_MSW`) | Session-only module arrays |
| Seeds | `mocks/db/{seed,schema,storage,migrations,reset,platformOrgSeed}` | Initial state, versioning, backend-push payloads | Single-sourced builders |
| Test fixtures | `test/mocks/factories/*` + `test/mocks/server.ts` (bare MSW, self-contained tests) | Unit-test builders | Distinct purpose, KEEP |
| Errors | `ApiError extends AppError`, `errorMapper`, `centralErrorHandler` | Layered (normalize → report), not duplicated | KEEP |
| Schemas | zod (`auth`, dashboard) vs `crud/fieldSchemas` (form config) vs generated contract | Validation vs UI config vs contract — distinct | KEEP |
| Types | `types/*` domain + `drf` envelope; `core/api/generated` re-exports (barrel) | Single source + generated mirror | KEEP |

## 2. Parity verification (this phase)

- `src/__tests__/parity/ApiParity.test.ts`: 4/4 pass (endpoint registry vs
  OpenAPI, DRF envelope, detail lookup, org roster).
- DRF envelope (`count/next/previous/results`) emitted by all three mock paths
  (`BaseMockAdapter`, `paginateDRF` in handlers, mockRouter) and consumed as
  `PaginatedResponse` in both modes.
- Persistence: mockRouter path durable across reload; adapter/handler paths
  session-scoped ("session persistence" = refetch-safe, not reload-safe).
  Refresh flows work wherever currently required (query invalidation per mutation).
- Executed change: CI comment referenced non-existent
  `src/test/contract/apiContractConformance.test.ts` → repointed to the real
  parity suite. Zero behavior change.

## 3. Remaining mock/REST differences requiring backend coordination

1. **Cross-path state divergence**: adapters, mockRouter, and MSW handlers hold
   *separate* in-memory states — a mutation via one path is invisible to the
   others until reload/reseed. Needs backend-verified single source or documented
   path ownership per domain (frontend cannot fix alone: REST truth lives server-side).
2. **Endpoint coverage gaps**: 25 mockRouter domains vs 8 adapter domains vs 15
   MSW handler files — domains outside the adapter set (audit, reviews, scheduling…)
   have no REST-adapter implementation to compare against; confirm each maps to a
   real DRF viewset + serializer (`docs/api/generated`, `django-openapi.yml`).
3. **Bulk/custom actions** (`bulk-create/update/archive/restore`, `check-existence`,
   `approve`, `publish`): mock shapes mirror `types/bulk`, but server acceptance
   (status codes, partial-success semantics, idempotency) needs backend sign-off.
4. **Auth flows** (refresh rotation, 401/403 mapping in `mockAuthGuard` vs real
   DRF responses): verify against backend auth implementation.
5. **Filter/ordering/pagination dialects**: mock `applyFiltersAndSearch` supports a
   subset; confirm server-side `filtering.md`/`pagination.md` parity per endpoint.
6. **Seed data vs backend fixtures**: `platformOrgSeed` builders push mock records
   to real endpoints — field spellings (snake_case/camelCase aliases) must be
   re-verified on every backend serializer change.
7. **Reload persistence**: only the mockRouter path survives reload; if E2E/QA
   flows require reload-stable mocks on adapter-covered domains, that needs a
   backend-backed (or IndexedDB-backed adapter) decision, not a frontend hack.

No backend code was created. Next: per-domain path-ownership decision (item 1)
is the precondition for any mock-layer deletion.
