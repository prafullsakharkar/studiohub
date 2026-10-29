# Master data: platform-global reference data

Status: current (rewritten in masterdata Phase 7; the previous text described the
organization clone-and-config design, which no longer exists).

## What it is

`apps/masterdata` owns the reference data the rest of the platform points at. All of it is
**platform-global**: there is no organization (tenant) dimension, no per-organization override
or "enable" layer, and no `scope` column. A catalog row exists once and applies everywhere.

| Group | Models | API mount |
|---|---|---|
| Lookup catalogs | statuses, task types, asset types, shot types, review types, file types, software, software versions | `/api/v1/platform/master-data/<type>` (bare arrays, no trailing slash) |
| Organizational structure | departments, teams, offices, positions | `/api/v1/<name>/` (paginated) |
| People | people (optional link to an Identity user) | `/api/v1/people/` |
| Business partners | clients, vendors, their contacts and contracts | `/api/v1/clients/`, `vendors/`, `client-contacts/`, `vendor-contacts/`, `client-contracts/`, `vendor-contracts/` |
| Overview | live row counts per catalog | `/api/v1/platform/overview` |

## Rules that hold everywhere

- Every write goes through a service in `apps/masterdata/services/`; views and serializers do not mutate.
- `DELETE` is a soft delete. A row that anything live still points at cannot be deleted (409
  `has_dependants`). `DELETE ?hard=true` needs `masterdata.hard_delete` and an already deleted row.
  `POST …/restore` undoes a soft delete.
- Reads need authentication only; writes need `masterdata.catalog.manage` (catalogs) or
  `masterdata.directory.manage` (everything else). Personal data needs
  `masterdata.person.view_sensitive`; money needs `masterdata.client.view_financial`; a field the
  caller may not see is omitted from responses.
- Masterdata must not import production, scheduling, deliveries or projects. Those apps hold
  foreign keys to masterdata rows (for example `DeliveryPackage.client`, `Resource.department`).

## Where the details are

The contracts, decisions and plan live in `docs/masterdata/`:

- `CONTRACTS.md`: every approved rule, with its status.
- `DECISIONS.md`: what was decided, when, and why (including the frontend-facing changes per phase).
- `PLAN.md`: work packages by phase.
- `AUDIT.md`: the findings the work started from.
