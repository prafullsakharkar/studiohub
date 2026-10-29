# TESTING — Access Control Test Suites

## What is covered where

| Layer | What | Examples |
|---|---|---|
| Backend unit/security | gate + scope semantics | `apps/identity/tests/permissions/test_has_permission_gate.py`; `apps/production/tests/security/test_canonical_access_matrix.py`; `apps/organization/tests/test_authorization_negatives.py`; `apps/organization/tests/security/test_privilege_escalation.py` |
| API contract | RBAC, header semantics, isolation | every app's `tests/api/` + `apps/core/tests/test_contract_regression.py` |
| Frontend unit | route guards, component gates, engine | `src/__tests__/permissions/` (CanonicalCanApi, ComponentGuards), `src/routes/__tests__/RoutePermissionGuard.test.tsx` |
| Integration | org isolation + roundtrips | `src/features/organizations/__tests__/` |
| E2E (mock) | page/route/tenant flows | `e2e/route-authorization.spec.ts`, `e2e/organization-isolation.spec.ts`, `e2e/project-show-isolation.spec.ts` |
| E2E (REST) | live Django parity | `e2e/rest-authorization.spec.ts` (run with `E2E_BASE_URL` + `E2E_EXTERNAL_SERVER=1`) |

## How to run

```bash
# backend (requires uv environment)
cd backend && uv run pytest apps/

# frontend
cd studiohub-react && pnpm exec vitest run

# e2e (mock mode is default)
cd studiohub-react && pnpm exec playwright test e2e/

# e2e against a live Django backend (provisioned by seed_dev)
VITE_API_MODE=rest VITE_API_URL=http://127.0.0.1:8000 PORT=3101 pnpm dev
E2E_BASE_URL=http://localhost:3101 E2E_EXTERNAL_SERVER=1 pnpm exec playwright test e2e/rest-authorization.spec.ts
```

## Coverage expectations

- backend: ≥ 72% (pytest fail-under); currently at 78%
- frontend: vitest only fails on errors, not on a global threshold
- e2e: all specs must pass in both mock and REST modes before merging
