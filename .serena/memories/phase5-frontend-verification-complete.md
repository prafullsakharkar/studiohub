# Phase 5 Frontend↔Real Django API Verification — COMPLETE

Verified end-to-end in `studiohub-react` (sibling repo, pnpm dev :3000) with Playwright against real Django (:8000).

## Confirmed
- **No MSW**: all requests hit `http://127.0.0.1:8000` (login POST 200; projects/shots/tasks/reviews/analytics 200). VITE_USE_MSW=false, VITE_API_MODE=rest.
- **Login + token refresh rotation**: access token stored in `localStorage['studiohub_access_token']`, refresh in `studiohub_refresh_token`. Access token expires quickly; frontend `ApiClient` auto-refreshes via `/auth/refresh/` and rotates the refresh token (persisted). Manual raw fetch bypasses refresh → must refresh token manually first.
- **Auth/org headers**: raw API calls need `Authorization: Bearer <access>` AND `X-Organization-ID: <org-uuid>`. Frontend also sends `?project_id=&show_id=` (synthetic show id `show-<project-uuid>-main`). Mock ids (`proj-001`, `show-nk99-main`, `org-apex-01`) are sent first then corrected to real UUIDs via ProductionContext/OrganizationContext synthetic resolution.

## Pages verified
- **Projects** `/projects`: 8 real projects, real UUID links, client-side filter search works (typed "Cyberpunk" → only Cyberpunk 2099 shown).
- **Shots** `/shots`: DRF pagination working — request `?page=1&page_size=8&project_id=<uuid>&include_deleted=false&show_id=show-<uuid>-main` → 200, UI "Showing 1 to 7 of 7 records" (7 shots for DMQ01).
- **Tasks** `/tasks`: real empty state "0 Total Tasks" (seed produced no tasks for DMQ01); request hit Django 200 with `project_id&is_archived=false&show_id` filters. Data-dependent, not integration failure.

## Shot lifecycle (soft-delete archive) — VERIFIED
POST /api/v1/shots/ → 201; PATCH /{id}/ → 200; DELETE /{id}/ → 204 (soft archive); active list excludes it (count stays 7); include_deleted=true list shows it (archivedFound, status preserved); POST /{id}/restore/ → 200 (status back to "In Progress"). Test record `PWTEST001` created+restored+re-archived, cleaned up (delete 204).

## Notes / gotchas
- Shot `status` choices reject `'active'` ("not a valid choice") — omit status to use default "Not Started".
- Real org UUIDs (Apex Digital = 25c65215-8eac-49ee-bbe8-7340462b4164; project DMQ01 = 8825e19d-53bf-466e-b11d-6fcc9a914c9c).
- Backend suite: 1842 passed, 1 skipped, 3 subtests passed. Org scoping 9/9. Masterdata 11/11.
