# Production API contract changes

Every change to a URL, field, status code or permission that a client can observe is recorded here, per phase of `PLAN.md` §4. Same pattern as `docs/identity/CONTRACTS.md`. Branch: `feature/production-hardening`.

## Phase 1 — authorization hot fixes (WP A1, A5, A7)

| ID | Endpoint | Before | After | Client impact |
|---|---|---|---|---|
| C-01 | `GET/POST /api/v1/automations/rules/`, `GET/PATCH/PUT/DELETE /api/v1/automations/rules/{id}/`, `GET /api/v1/automations/audit-logs/` | Any authenticated user could read, create, change and delete every project's rules and read every execution log (F-C1). | Needs `automation.view` (GET), `automation.create` (POST), `automation.update` (PATCH/PUT), `automation.delete` (DELETE) **and** an active membership of the rule's project. A rule outside the caller's projects answers **404**, exactly like an unknown id. Rules without a project (platform-global) are visible and writable by platform admins only. | A user without the codes gets 403 (was 200). Lists shrink to member projects. |
| C-01a | `POST /api/v1/automations/rules/` | `project` came only from `workflow_id`. | New optional body field `project_id` (UUID, code or mock id). A project is **required** unless the caller is a platform admin or `workflow_id` resolves to a workflow that has one. A project the caller cannot use and an unknown project give the same **400** `{"project_id": ["Unknown project."]}`; a missing project gives `{"project_id": ["A project is required."]}`. | Clients that created rules without a project must send `project_id`. |
| C-01b | `workflow_id` on rules | Resolved globally; any workflow could be linked. | Resolved inside the caller's projects and, when the rule has a project, inside that project. Unknown, foreign and wrong-project workflows give **400** `{"workflow_id": ["Unknown workflow."]}`. Non-UUID values (`wf-001`) are still ignored, as before. | none for valid input |
| C-02 | `/api/organizations/projects/{project}/{members,summary,dashboard,sequences,shots,tasks,assets,versions,reviews,editorial,notes,deliveries,schedule,resources,pipeline,files,activity}` | Membership only. A non-member got **403**, an unknown project 404, which confirmed that a project exists (F-M12). | Needs the permission code of the matching flat endpoint (below) **and** membership. The code is checked first and does not depend on the project. A non-member and an unknown project both answer **404**. | Non-member 403 → 404. Callers without a code get 403 (was 200). |
| C-02a | `POST .../notes` | Any member. | Needs `note.create`. | |
| C-02b | `POST .../members` | Platform admin only. | Unchanged, plus the `project.update` code. | none for admins |
| C-03 | Role catalog (`manage.py init_platform`) | `sequence.view`, `version.view`, `media.view` were enforced by the flat endpoints but granted to no seeded role. | Added to the catalog and granted to every seeded production role. New: `automation.{view,create,update,delete}` (production-admin, vfx-supervisor, org-admin) and `note.create` (all production roles). | **Run `uv run python manage.py init_platform` on every database after deploying.** It only adds missing rows; role edits made since are kept. Until then non-admin users get 403 on automation and notes. |
| C-04 | `GET /api/v1/analytics/kpis/`, `GET /api/v1/analytics/departments/` | Counted every project for any authenticated user (F-M13). | Counts only the caller's member projects. Platform admins and superusers still count everything. | Dashboards of non-admins show smaller numbers. No permission code is added (`analytics.view` is not seeded). |
| C-05 | `episode_id` on shot create/update | Resolved by code across **all** projects, so `EP101` could match another project's episode (F-H6). | Resolved inside the shot's project. A foreign or unknown episode gives the same **400** `{"episode_id": ["Unknown episode."]}` (the message "Episode does not belong to the selected project." is gone). | none for valid input |
| C-05a | `GET /api/v1/shots/?episode_id=` | Resolved to one global episode, then filtered. | Matches by id or code (case-insensitive, mock id `ep-101` supported) among the shots the caller can see. `EP101` returns one shot set per visible project; combine with `project_id` to narrow. Unknown values return an empty list. | Lists without `project_id` now include every visible project's `EP101`. |

### Permission code per nested route (GET)

| Route | Code | Route | Code |
|---|---|---|---|
| members, summary, dashboard, pipeline, notes | `project.view` | sequences | `sequence.view` |
| shots | `shot.view` | tasks, resources | `task.view` |
| assets | `asset.view` | versions | `version.view` |
| reviews | `review.view` | editorial | `track.view` |
| deliveries | `delivery.view` | files | `media.view` |
| activity | `audit.view` | schedule | `schedule.view` |

### Frontend change list

1. Send `project_id` when creating an automation rule.
2. Treat 404 on `/api/organizations/projects/{project}/...` as "no access or unknown" (it used to be 403 for non-members).
3. Expect smaller analytics numbers for non-admin users.
