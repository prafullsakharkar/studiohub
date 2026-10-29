# PROJECT ACCESS — Production Membership Scoping

Canonical contract for project/show scope (ADR-0033 D1/D2).

## Model

`ProjectMembership` (organization + project + optional show + role + status)
is the only grant of production access. A row with `show_id` narrows to a
single show within the project; without it, all shows in the project are
covered.

Only `organization_id` + `user_id` may coexist per project (unique together);
project-wide and show-bound rows alternate, they don't stack.

A membership removed (or soft-deleted) revokes access on the next request.

## Enforcement

Every production endpoint (project, shot, asset, task, version, review,
media, playlist, workflow, show, archive/restore, bulk):

1. `HasPermission` — explicit permission code check (deny-by-default).
2. `ProductionBaseSelector.scope_by_request` — org scoping.
3. `ProductionBaseSelector.scope_by_project_membership` — project scoping:
   org-admin-tier org members are org-wide; everyone else sees only projects
   they are a member of.

`Show` lists honor show-bound memberships in the same way.

## Route guard

`ProjectRoute` (frontend) resolves project/show context from the **server
payload only** — the logged-in user's memberships, not the mock fixture set.
A forged `/projects/<other>` or `/shows/<other>` URLs fail closed.

## Verified by

- `apps/production/tests/security/test_canonical_access_matrix.py`
- `apps/production/tests/security/` (isolation + nested-route tests)
- `apps/organization/tests/security/test_privilege_escalation.py`
- e2e: `project-show-isolation.spec.ts`
