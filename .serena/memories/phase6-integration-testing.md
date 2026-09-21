# Phase 6 Full Integration Testing (2026-09-13)

## Suites (all green at end)
- Backend: `manage.py check` clean; pytest **1850 passed, 1 skipped** (incl. 2 new).
- Frontend: `pnpm lint` clean, `pnpm build` clean, vitest **171/171**.
- Live sweep vs dev server (:8000): 33/33 pass (part 2) + targeted re-verification.
- Ruff clean on all touched files. Pre-existing ruff debt in seed_dev.py (16 I001/F401
  at 525+, newer-ruff style vs old code) left untouched — not mine.

## Fixes (correct layer each time, no mock changes)
1. **Knowledge org bypass (backend)**: intelligence `_resolve_organization`
   (knowledge.py + search.py) trusted X-Organization-Id with no membership check.
   Fail-closed for non-staff without live membership (mirrors ActivityCompatViewSet).
   Tests: test_list_cross_org_header_leaks_nothing, test_retrieve_cross_org_404.
2. **Seed RBAC gap (seed_dev)**: 24 org-domain codes granted to zero roles ->
   all non-superusers 403 on org endpoints. Added codes + grants (views org-wide,
   CRUD to org-admin, catch-all covers platform-admin). Matrix in
   `_role_perm_matrix`, `_assign_role_permissions` for backfill. No dupes (16 roles).
3. **404→500 mislabel (frontend errorMapper)**: status-carrying errors now map via
   ApiError.fromDrfResponse; 404s log NOT_FOUND once, no retry.
4. **Non-superuser lockout (frontend)**: RESTAuthAdapter hydrates memberships from
   /api/v1/users/me/memberships/ on login+bootstrap; OrganizationContext falls back
   to membership-synthesized orgs. Verified as owner@apex.vfx (teams render).

## Key verification results
- Isolation live: B-token@A-org -> 403 + zero leaks on projects/shots/tasks/assets/
  teams/nested/search/filter/bulk-update/check-existence. Cross PATCH/DELETE denied,
  objects confirmed unchanged.团队 team retrieve/PATCH 403 (proper denial).
- Lifecycle live: shot (create/retrieve/put/patch/approve/archive/restore/delete/gone),
  task, project — all 201/200/204/404 as appropriate. Test data fully cleaned.
- Frontend tour (supervisor): tables, server filter+search (DRF envelope verified),
  pagination control, Inspector drawer, detail tabs (9 shot / 15 project), breadcrumbs
  org->project->sequence, org switching (cross-org detail 404s correctly), /projects/new
  form renders through PermissionRoute.
- Owner tour post-fix: dashboard + teams/departments/clients/offices all real data.
- Permission granularity: artist list 200 / create+delete 403; org-admin create 201-path
  (400 on bad FK proves perm passed).

## Gotchas
- Dev tokens expire in minutes; sweep scripts must handle 401 + RemoteDisconnected
  (dev-server reload drops in-flight requests) with retry.
- user0@example.com is inactive -> created phase6.b (ORG000/viewer) for A/B tests,
  deleted afterwards incl. sessions/login-history. Zero PH6/PWTEST remnants.
- People seed rows all organization=NULL -> members see 0, staff see 10 (correct scoping).
- "All Active Projects" select still sends current project_id (page needs project ctx).
- Shot-card checkbox has no bulk affordance (UI gap, backend bulk fine).

## Open / deferred
- Person->User lead mapping (Phase 5 note) still open.
- Show epic, analytics KPIs, AI/LLM+trigram search: documented stubs (unchanged).
- Frontend PermissionRoute deny-path not exercised live (org-shell gate fires first);
  covered by routePermissions unit tests.
