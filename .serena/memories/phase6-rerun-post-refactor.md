# Phase 6 re-run after remote refactor (2026-09-13)

## Context changes since first Phase 6
- Frontend remote moved: 7 commits (169 files, workspace canonicalization, RBAC
  string-types) pulled; my 14dbd68 committed+pushed on top. Then owner commit
  8d7212a on top: reworked workspace nav (ContextBar/ContextStack/EntityDrawer),
  rewrote src/types/auth.ts (451->85 lines, re-exports rbac/common), DELETED my
  src/test/contract/apiContractConformance.test.ts as collateral with 23 other
  test files (73->50 files). None of my 11 modified src files touched by 8d7212a.
- Dev DB was reseeded between runs (phase6.b gone, DMQ01 shots 7 active -> 5
  soft-deleted + 2 gone, ORG000 gained 1 project). Ground truth re-established
  from current data, not memory.
- Restored the conformance test verbatim; 8/8 pass on new tree.

## Baselines (new tree)
- Backend: 1869 passed, 1 skipped (unchanged, green).
- Frontend: 27 files failed / 38 tests failed out of 50/99 — investigated: remote
  test files have unresolvable imports (@/test/mocks/factories/*), e2e lacks
  @playwright/test dep; lint 76 errors likewise remote's. Proven pre-existing
  (identical counts with my changes stashed... earlier at 14a6248: 76/76 and
  77/77 identical). My files: zero lint errors, my 8 tests pass.
- My auth.ts-dependent code compiles against rewritten types; membership
  hydration + org fallback behavior re-verified live as owner (teams render).

## Live re-verification (all pass)
- List matrix (sweep1): 67 checks, only 3 stale-code collisions (PH6-*-02 held by
  soft-deleted rows from prior run — correct fail-closed behavior, re-proven with
  fresh PH6-*-03 codes in lifecycle_r3: FAILS=0). Zero leaks; B/xorg properly 403.
- Security: cross retrieve/PATCH/DELETE/search/filter/bulk denied; objects
  unchanged; knowledge B@A empty (gate holds post-reseed); artist list 200 /
  create+delete 403; org-admin full org access.
- Lifecycle: shot (create/retrieve/put/patch/approve/archive/restore/delete/gone),
  task, project full pass. All test rows cleaned (0 remnants); phase6.b removed.
- Frontend tour: dashboard, shots table+server filter, shot workspace (tabs,
  breadcrumbs, relationships intact through nav refactor), owner teams list,
  /projects/new full form as org-admin, org switch APEX->VNG (real UUIDs,
  cross-org project returns empty, no leak), delete-confirm dialog + cancel.
- Observations (no change): org-shell denial flashes during slow org fetch
  (pre-existing race); shots checkbox still has no bulk affordance; empty
  img src React warnings; people all organization=NULL (members see 0).

## Still open (unchanged, documented)
- Person->User lead mapping; Show epic; analytics KPIs; AI/LLM+trigram stubs.
- PermissionRoute deny-path not exercised live; shot bulk UI gap.
