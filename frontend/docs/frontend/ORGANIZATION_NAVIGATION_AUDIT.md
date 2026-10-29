# Organization Workspace & Navigation Audit — Superseded by Org Removal

Date: 2026-10-05 (original audit); **superseded 2026-10-19 by the org removal**
(see `docs/architecture/ORGANIZATION_REMOVAL_ADR.md`).

This audit tracked the pre-removal navigation model, where organization-scoped
functionality lived under `Organization → Workspace → Tab` with legacy
redirects from standalone routes.

## Current status: org navigation is gone

The org workspace, `/organizations/*` routes, the sidebar ORGANIZATION section,
and the legacy redirects into the workspace tabs were removed. The current
navigation is org-free:

```
HOME & WORKSPACE  : Dashboard
STUDIO (directory): Clients, Vendors, People, Departments, Teams, Offices
PRODUCTION        : Projects, Shots, Assets, Tasks, Timelogs, Versions,
                    Publishing, Deliveries, Reviews, Workflows, Scheduling
PLATFORM          : Platform Admin, API Health, Data Platform, Notifications,
                    Reports, Billing, QA Runner
AUDIT             : Audit & Activity, System Logs, Jobs & Tracks
```

- Standalone routes that were previously redirected into workspace tabs
  (`/clients`, `/vendors`, `/people`, `/departments`, `/teams`, `/offices`)
  are now canonical flat directory pages again.
- `/access` and `/organizations/:id/access*` no longer exist; platform RBAC
  surfaces live under Platform Admin.
- No `?tab=` org-workspace URLs and no `/organizations/` URL are reachable.
  The e2e suite asserts this (`no org URL is ever reachable`).

## Historical record

The original audit's migration matrix (standalone pages → workspace tabs,
Access & RBAC consolidation) described the org-era consolidation. That work was
fully inverted by the org removal: the flat directory routes are canonical and
the org workspace tabs are deleted.
