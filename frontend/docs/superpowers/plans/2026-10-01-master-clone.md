# Master-Clone (Roles/Groups/Departments/Positions) Implementation Plan

**Goal:** Admin-only, org-scoped "Clone Master X" on each workspace tab that creates only missing records, idempotently and transactionally.

**Architecture:** Reusable `CloneMasterService.clone(master_model, org_model, organization, conflict_keys, build_defaults)` in backend org services; four `POST clone-master/` actions on the org-scoped viewsets; frontend adds `Clone...` confirm action per tab + empty states + loading/error + refresh via that tab's query invalidation.

**Spec:** user request 2026-10-01 (clone semantics: add-missing only, no sync, no overwrite, no dup; DB-unique where possible; 403 without org-admin; E2E all four).

## Global Constraints
- Keep same UX across the four tabs; no mixed clone action.
- Backend enforces permission; frontend just reflects it.
- Real Django API only.

## Tasks (sequential)
1. Inventory masters: inspect masterdata models + organization Role/Group/Department/Position models, uniqueness keys.
2. Backend: shared clone service + 4 org-scoped endpoints + selectors/services + permission + migration if unique constraints needed.
3. Backend tests: idempotency, missing-only, no-dup, 403.
4. Frontend: per-tab UI (confirm dialog, empty state, clone button, refresh) + hook.
5. E2E: four-tab coverage incl. clone-then-new-master-clone-again + negative permission case.
6. Verify: backend pytest org suite, frontend tsc+vitest+build, E2E run, commit both repos.