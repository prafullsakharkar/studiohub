# Phase 5: Create-team contract fix (frontend)

## Problem
`src/modules/teams/pages/CreateTeamPage.tsx` POSTed a display-oriented Team payload
(`department_id`, `lead_id`, `focus_discipline`, `current_project_code`, `capacity_hours_weekly`,
`utilization_percentage`, `department_name`, `lead_name`, `lead_avatar`) to the real backend
`POST /api/organizations/{org}/teams/`, which returned `400`:
`{"organization":["This field is required."],"department":["This field is required."]}`.

Backend `TeamCreateSerializer` (backend/apps/organization/api/serializers/team/create.py + base.py)
requires: `code`, `name`, `organization` (FK), `department` (FK), `color`, `capacity`. Extra
fields in the request are silently ignored by the DRF ModelSerializer.

## Fix (frontend only)
`handleSubmit` now builds a backend-contract payload:
- name, code, description
- department: resolved as `form.department_id || depts[0]?.id` (form state initializes to ''
  before departments load asynchronously, so default department must be resolved in submit)
- organization: `currentOrganization?.id` (added `useOrganization` import)
- color: '', capacity: 1
- lead: OMITTED (nullable on model)

## Verified
- create POST → 200, navigates to `/teams/{backendId}` (0 console errors)
- update PATCH → 200
- delete/restore previously verified on shots
- `pnpm lint` (tsc --noEmit) clean

## Remaining limitation
Team `lead` is an FK to `AUTH_USER_MODEL`, but the form's Squad Lead selector returns **Person**
UUIDs from `/people/`. No Person→User mapping exists, so `lead` is null on create. Follow-up:
needs Person→User link or a user-picker. Documented in docs/api/REAL_API_GAPS.md.

## Note
Backend token expires frequently (~minutes). Frontend `localStorage['studiohub_access_token']`
must be refreshed by re-login at /login (credentials supervisor@studiohub.vfx / password123).
