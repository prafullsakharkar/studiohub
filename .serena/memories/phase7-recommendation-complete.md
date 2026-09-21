# Complete the recommendation: CI-green (2026-09-13)

## Finding
Backend CI (`ruff check .`) was red: 52 errors on the dirty tree (prior-phase
code, none from Phase 6/7 files). The Phase 7 "recommended CI checks" were
therefore incomplete.

## Resolution (all verified)
- `ruff check --fix`: 37 safe auto-fixes (import sorting, unused imports across
  masterdata/scheduling/production/deliveries/seed files).
- Manual: 3x B007 (`org_code` -> `_org_code` in seed_demo_data loops),
  2x B904 (`from None`, matches codebase convention in core/production base
  viewsets), 1x F841 (dead `get` local in production base viewset),
  1x UP017 (auto-fixed).
- 11x DJ001 in masterdata/models/config.py: NOT a bug — override text fields
  need tri-state NULL (inherit) vs "" (explicit empty). Documented in module
  docstring + per-line `# noqa: DJ001`. No model/migration change (would have
  broken override semantics).
- Final: `ruff check .` clean; `manage.py check` clean;
  `makemigrations --check` clean; pytest WITH coverage 1869 passed / 76.11%
  (>= 72% gate); docs link check 375 files OK.
- Frontend CI steps re-confirmed green on current tree (lint, 179 tests, build);
  no frontend changes since that run.

## Rule reinforced
New ruff-clean code can still sit in a red tree: always run the repo-root
`ruff check .` (what CI runs), not just changed-file checks, before declaring
CI complete.
