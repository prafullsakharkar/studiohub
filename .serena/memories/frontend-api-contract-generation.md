# API Contract Generation & Validation Pipeline (StudioHub React frontend)

## What was added
Frontend-only contract pipeline making the Django OpenAPI schema the single source of truth for both Mock (MSW) and Real REST modes. Lives in `/srv/local/code/studiohub-react` (NOT this backend repo).

- `src/core/api/generated/schema/django-openapi.yml` — committed Django OpenAPI snapshot (591 routes, drf-spectacular, 2.3MB).
- `src/core/api/generated/openapi.ts` — auto-generated TS types (openapi-typescript v7.13.0). Type-only; does not grow the JS bundle.
- `src/core/api/generated/openapiBridge.ts` — re-exports `Paths`, `Operations`, `Components`, `Schemas`, `SchemaByName`, `ResponseBody`.
- `src/core/api/generated/openapiTypeChecks.ts` — compile-time guards (NOT a .test.ts, since those are excluded from tsc) that fail `pnpm typecheck` if a referenced schema/operationId disappears. Uses real names: `AssetList`, `AssetDetail`, `ProjectList`, `TaskList`, `organizations_departments_list`.
- `src/core/api/generated/openapiBridge.test.ts` — vitest type smoke test (3 tests).
- `scripts/generate-api-contract.mjs` — `pnpm api:generate` (from committed schema) / `--fetch` (from `DJANGO_SCHEMA_URL`).
- `scripts/validate-api-contract.mjs` — `pnpm api:validate`; statically scans MSW handler modules for `http.<method>('url')` and compares against schema paths.
- `docs/api/contract-pipeline.md` — full workflow doc.

## Gotchas
- Scripts must be `.mjs` (frontend package.json has `"type": "module"`; `.cjs` forces CommonJS and breaks `import`).
- Don't put `*/` inside a `.mjs` block comment (terminates it).
- `openapi-typescript` v7.13.0 devDependency. pnpm install is slow (~2min lockfile supply-chain check). Run `node_modules/.bin/tsc --noEmit` directly to avoid the pnpm install check.
- Backend schema dump requires `DJANGO_ENV=testing` to use `.env.test` (defaults to "local" -> .env.local which doesn't exist). Test DB at 192.168.1.109:5439 IS reachable.

## Validation findings (current state) — RECONCILED (2026-09-19)
- 591 contract routes vs 223 MSW routes. 432 uncovered (warning; MSW is secondary layer — primary mock engine is `mockRouter.ts` ~7k lines).
- `api:validate` now EXITS 0 with 0 invented routes. The original 26 split into:
  - **17 validator false-positives (fixed)**: org-scoped master-data routes are concrete instantiations of schema's generic `/api/v1/organizations/{organization_id}/master-data/{data_type}` (+`/{item_id}/config`, `/custom`). Validator now uses param-tolerant matching via `matchesAnyContract`/`contractToRegex` in `scripts/validate-api-contract.mjs` (a literal MSW segment matches a schema `{param}` at the same position).
  - **9 genuinely-invented dead routes (removed)**: 4 v1-aliases of correct non-v1 org subresource handlers (departments/teams/offices/people), 1 `/api/v1/organizations/{id}/unarchive/` (all in `organizationHandlers.ts`), 2 `/api/v1/settings/pipeline/` (`settingsHandlers.ts` deleted + import removed from `handlers/index.ts`), 2 nested `/shows` handlers in `showHandlers.ts`.
- Verified: api:validate EXIT 0, tsc EXIT 0, vitest 143 passed (33 files), tsx runner 127 passed, vite build EXIT 0.

## Architecture notes
- Mock layer duplicated: `src/mocks/mockRouter.ts` (used by ApiClient.dispatch) AND `src/mocks/handlers/*.ts` (MSW, 17 modules) — independent state/auth, drift risk.
- `src/core/api/generated/contract.ts` is hand-maintained from docs JSON, separate from the new OpenAPI codegen.

## Mock/REST Parity suite (added)
- `src/core/testing/parity/parityHarness.ts` — `runParityScenario`, `isRestBackendConfigured`, `shapeOf` comparison. Runs same scenario through RepositoryFactory.createAll('mock') vs ('rest'), compares status class + body shape + error format + pagination envelope.
- `src/core/testing/parity/parityScenarios.ts` — Project/Task/Asset/Shot CRUD, 404 error-shape, pagination scenarios.
- `src/core/testing/parity/paritySuites.ts` — `api-parity` TestGroup wired into TestRunnerEngine.getTestGroups() and TestingPage 'api' category.
- `src/core/testing/parity/parityHarness.test.ts` — 4 vitest tests validating harness mechanics.
- Key gotcha: in vitest, REST fetch failures map to 500 AppError (NOT network error), so blocked-detection keys off `getApiBaseUrl()` being empty OR isNetworkError — never trust isNetworkError alone.
- Parity scenarios must let AppError propagate (not catch+return) so `execute()` captures it as an error outcome.

## Verification
`pnpm typecheck` EXIT 0, `vitest run` 128 passed (baseline was 125/29), `vite build` EXIT 0.

After parity suite + route reconciliation: `vitest run` 143 passed (33 files), `tsx scripts/runTestSuiteEngine.ts` 127 passed (API-PARITY group runs; REST legs report blocked without a configured backend), `vite build` EXIT 0.

## Reconciliation follow-ups (still open)
1. Unify duplicated mock state (`mockRouter.ts` vs `src/mocks/handlers/`).
2. Add CI step gating on `pnpm api:validate` + `pnpm typecheck`.
