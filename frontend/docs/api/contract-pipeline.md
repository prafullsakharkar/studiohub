# API Contract Generation & Validation Pipeline

This document describes how the StudioHub React frontend keeps its API layer
synchronized with the **Django REST Framework backend contract**, using the
Django OpenAPI schema as the single source of truth.

## Goal

The frontend must never silently diverge from the backend. Both the **Mock
(MSW)** and **Real REST** modes must share one contract. The Django OpenAPI
schema (emitted by drf-spectacular) is authoritative; everything else in the
frontend derives from or is validated against it.

```
Django OpenAPI schema (drf-spectacular)
        │  pnpm api:generate
        ▼
Generated TypeScript types (openapi.ts)
        │
        ├── consumed by Mock (MSW) and Real REST adapters
        └── validated by pnpm api:validate  →  catches stale MSW handlers
```

## Source of Truth

| Artifact | Location | Notes |
| :--- | :--- | :--- |
| Django OpenAPI schema | `src/core/api/generated/schema/django-openapi.yml` | Committed snapshot, regenerated from the backend |
| Generated TS types | `src/core/api/generated/openapi.ts` | Auto-generated, do not edit by hand |
| Type bridge | `src/core/api/generated/openapiBridge.ts` | Re-exports `paths`, `components`, `operations`, `Schemas` |
| Compile-time guards | `src/core/api/generated/openapiTypeChecks.ts` | Fail `tsc` if a referenced schema/operation disappears |

## Commands

| Command | Description |
| :--- | :--- |
| `pnpm api:generate` | Regenerate `openapi.ts` from the committed schema snapshot. |
| `pnpm api:generate --fetch` | Fetch a fresh schema from a running backend (`DJANGO_SCHEMA_URL`, default `http://localhost:8000/api/schema/`) then regenerate. |
| `pnpm api:validate` | Verify MSW handlers are in sync with the OpenAPI contract. |

## Regenerating Types

```bash
# 1. Dump the schema from the Django backend
#    (backend: DJANGO_ENV=testing uv run python manage.py spectacular \
#       --file src/core/api/generated/schema/django-openapi.yml --validate)

# 2. Regenerate TypeScript types
pnpm api:generate

# 3. Verify nothing diverged
pnpm typecheck   # tsc --noEmit
pnpm test
pnpm api:validate
```

If the backend is running locally, the fetch form does all of this:

```bash
pnpm api:generate --fetch
```

## Using the Generated Types

```ts
import type { Schemas, Operations, Paths } from '@/core/api/generated';

// A DRF serializer schema type
const asset: Schemas['AssetDetail'] = ...;

// A response body type for a specific operation
type DeptList = ResponseBody<'organizations_departments_list', 200>;
```

Hand-written domain types in `src/types/*` should remain aligned with these
generated types. Where the backend defines a shape, prefer referencing the
generated type (via the bridge) over hand-maintaining a duplicate.

## Contract Validation (`pnpm api:validate`)

The validator statically scans the MSW handler modules
(`src/mocks/handlers/*.ts`) for `http.<method>('<url>', ...)` registrations
and compares them against the OpenAPI schema's `paths`.

Two checks run:

1. **Uncovered routes (warning):** contract routes with no corresponding MSW
   handler. The MSW handler set is the *secondary* mock layer; the primary
   in-memory engine lives in `mockRouter.ts`, so partial coverage is expected.
2. **Invented routes (error, fails CI):** MSW `/api` routes that do not exist
   in the OpenAPI contract. These can mask real backend routes and indicate a
   genuine divergence from the source of truth.

### Current Findings

Running `pnpm api:validate` against the current codebase reports:

- **591 contract routes** parsed from the Django schema.
- **232 MSW routes** registered across handler modules.
- **26 MSW `/api` routes not present in the OpenAPI contract.** Examples:

  - `*/api/v1/organizations/:organizationId/master-data/software/...` — the
    schema exposes these under `/api/v1/platform/master-data/...` instead.
  - `*/api/v1/settings/pipeline/` — not present in the schema.
  - `*/api/v1/organizations/:organizationId/...` (departments/teams/offices/
    people) — the schema uses the nested `/api/organizations/{id}/...` shape.

These are genuine divergences between the existing mock layer and the backend
contract, and should be reconciled as a follow-up (align the MSW route shapes
with the schema's nested `/api/organizations/{organization_id}/...` and
`/api/v1/platform/master-data/...` paths).

## Workflow for a Backend Contract Change

1. Backend changes a serializer/endpoint.
2. Developer dumps the fresh schema and runs `pnpm api:generate`.
3. `pnpm typecheck` fails if any compile-time guard (schema/operation name)
   referenced by the frontend changed.
4. `pnpm api:validate` flags MSW routes that no longer match the contract.
5. `pnpm test` verifies runtime behavior still conforms.
6. Commit the updated `django-openapi.yml` + `openapi.ts` together with the
   handler changes.

## Mock vs REST Parity Suite

The **API-PARITY** test group (`src/core/testing/parity/`) runs the *same*
repository scenario through both the **Mock adapter** and the **REST adapter**
and compares the resulting API contract (HTTP status class, response body
shape, pagination envelope, and error format).

```
ParityScenario
      │  runParityScenario()
      ├── Mock leg  → bundleFor('mock')  → normalized outcome
      └── REST leg  → bundleFor('rest')  → normalized outcome
               │
               ▼
         compare()  → matched | divergence
```

Design rules:
- The parity comparison lives **only** in the test harness, never in
  application components (no mock-vs-rest branching at runtime).
- Each scenario uses only the standard `IRepository` operations so both
  adapters implement the identical interface.
- If no REST backend is configured (`VITE_API_URL` unset) or the REST leg
  raises a network error, the REST leg is reported as **`blocked`**, never as a
  parity failure. This keeps the suite green in hermetic test environments
  while surfacing the gap.

Files:
- `src/core/testing/parity/parityHarness.ts` — harness (`runParityScenario`,
  `isRestBackendConfigured`, normalization/`shapeOf` comparison).
- `src/core/testing/parity/parityScenarios.ts` — Project/Task/Asset/Shot CRUD,
  404 error-shape, and pagination-envelope scenarios.
- `src/core/testing/parity/paritySuites.ts` — the `api-parity` `TestGroup`
  wired into `TestRunnerEngine.getTestGroups()` and the TestingPage "Core API &
  CRUD" category.
- `src/core/testing/parity/parityHarness.test.ts` — Vitest validation of the
  harness mechanics (mock leg always resolves; CRUD self-consistency; 404
  shape).

### Running Parity

```bash
pnpm test                    # full Vitest suite (includes parity harness tests)
node_modules/.bin/tsx scripts/runTestSuiteEngine.ts   # runner incl. API-PARITY group
```

To verify parity against a real backend, set `VITE_API_URL` to a reachable
Django instance and run the suite; REST legs will then be exercised and
compared for equivalence.
