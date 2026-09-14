# StudioHub E2E (Playwright) — State & Fixes

## Runtime
- Chromium download blocked by network; Playwright configured with `channel: 'chrome'` (system Chrome at `/usr/bin/google-chrome`).
- Run with `npx playwright test` (NOT `pnpm test:e2e` — wrong binary path, "unknown command 'test'").
- Backend: Django REST at `http://127.0.0.1:8000` (seeded), frontend dev server on :3000, `VITE_API_MODE="rest"`.

## Working credentials (seeded backend)
- `supervisor@studiohub.vfx` / `password123` — Alex Chen, VFX Supervisor, APEX, `is_superuser:true`. THE default valid account.
- Also work: `artist@studiohub.vfx`, `vendor.artist@cinematrix.vfx`, `client@studiohub.vfx` (password123).
- `virat.kohli@studiohub.vfx` / `password123` → 401 (NOT seeded with that password). Many specs previously used this → failed.
- LoginForm defaults: `supervisor@studiohub.vfx` / `password123`. Fast-login personas all use password123.

## Key helper
- `e2e/helpers.ts` → `loginAs(page, email=DEFAULT_EMAIL, password=DEFAULT_PASSWORD)` and constants. Replaces inline login blocks.

## Real UI headings (specs were asserting wrong text)
- `/projects` → heading "Productions & Shows" (NOT "Projects|Production Projects")
- `/organizations` → heading "Studio Organizations" (page title h1). Empty state h3 also contains "Organizations" → use `exact:true` to avoid strict-mode violation.
- `/testing` → heading "API & Test Suite Runner"; error tab content heading "6. Error Handling & HTTP Status Lab" (NOT "Simulated Network & API Error Conditions"). Error tab button is "Error Simulation Lab" (also matches "Error Lab" → use exact).
- Logout: open button `aria-label="User account menu"` (`#user-menu-btn`) then click "Sign Out".

## Status
- 39/40 E2E specs pass (15 of 16 previously-failing fixed, committed `b61bad6`).
- `e2e/test-suites.spec.ts` STILL FAILS (deferred by user decision): drives in-app "API & Test Suite Runner" on /testing, runs 121 cases, asserts 100% pass. Runner cases were built for MSW mock data — hardcoded sample IDs/endpoints don't exist in Django backend, so many fail. No per-test timeout (apiClient has 30s timeout, so run is just very slow, >270s). Making it green = large subsystem rework, possibly backend seed changes. Revisit as separate task.

## Also
- Unit test suite fully green: 189 tests / 52 files (committed `15de179`), incl. shared test factories in `src/test/` and `__tests__/test-utils.tsx` global AuthContext mock granting `['*']`.
- Playwright `test-results/` and `playwright-report/` are tracked in git (not ignored) — pre-existing mess; exclude from commits.
