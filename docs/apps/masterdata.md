# Application: masterdata

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in
`docs/masterdata/` (`CONTRACTS.md`, `DECISIONS.md`, `PLAN.md`, `AUDIT.md`, `VERIFICATION.md`).

## 2. Application information

```text
Application: masterdata  (apps/masterdata)
Domain:      Platform-global reference data
Purpose:     Lookup catalogs, organizational structure, people, and business partners
Owner:       Platform team
Dependencies: core, identity (users and permissions), audit (events become AuditLog rows)
Status:      Hardened (phases 3 to 8)
```

## 3. Domain responsibility

**Owns:** statuses, task/asset/shot/review/file types, software and versions; departments, teams,
offices, positions, people; clients, vendors, their contacts and contracts.

**Does not own:** authentication, roles and permissions (Identity); production entities, schedules,
deliveries (they hold foreign keys to masterdata rows). There is **no organization dimension**
(ADR-0034): no organization FK and no `scope` column.

## 4. Dependencies

Masterdata imports `core` and `identity` only. It never imports `production`, `scheduling`,
`deliveries` or `projects`; those apps point at masterdata rows with foreign keys
(`Asset.department`, `Task.team`, `Resource.department/team`, `DeliveryPackage.client`) and a
masterdata delete is refused while a live row still uses it. Figures that would need those apps
(utilization, project counts) are omitted from the API until the owning app exposes a selector
keyed by UUID.

## 5. Folder structure

```text
apps/masterdata/
  models/        catalog.py, base.py, department.py, team.py, office.py, position.py, person.py,
                 client*.py, vendor*.py, contact.py, contract.py
  services/      catalog.py, software.py (catalogs); directory.py (base), organization.py, person.py,
                 partner.py, contact.py, contract.py; hierarchy.py, identity_link.py, lifecycle.py
  selectors/     catalog.py, directory.py
  validators/    catalog.py, directory.py
  events/        records.py (domain events), handlers.py (audit handler)
  signals/       identity_sync.py (name and e-mail follow Identity)
  api/           viewsets/{lookup,records,directory,partners,catalog,gating}.py, serializers/, filtersets/,
                 schema.py (OpenAPI helpers), urls.py
  permissions/   access.py (field-level checks)
  constants/     permissions.py
  admin.py       read-only
  migrations/    0001 to 0009
  tests/
```

## 6. Models and constraints

All platform-global, soft-deletable. Highlights (full list in `CONTRACTS.md`):

- `code` and `name` unique ignoring case among live rows (partial `Lower()` constraints).
- Hierarchies (`Department`, `Position`): `parent <> id` check; cycles and the 6-level limit in the service.
- One primary contact per client/vendor; one live headquarters; one live person per user; person e-mail unique.
- Contracts: `expiry >= effective`; stored status Draft/Active/Terminated (`Expired` is derived);
  PostgreSQL exclusion constraint forbids overlapping MSAs per client/vendor.
- Foreign keys from children to their client/vendor are `PROTECT`.

## 7. Services, selectors, events

Reads go through selectors; every write goes through a service that validates, runs in one
`transaction.atomic()`, and publishes a domain event after commit. `MasterdataAuditHandler`
turns events into `AuditLog` rows carrying field **names** and ids only, never values.
Hierarchy and headquarters writes take a PostgreSQL advisory lock before any row lock.

## 8. Permissions

Reads need authentication only. Writes: `masterdata.catalog.manage` (catalogs) or
`masterdata.directory.manage` (everything else); hard delete also `masterdata.hard_delete`.
Fields: `masterdata.person.view_sensitive` (personal data), `masterdata.client.view_financial`
(money). A field the caller may not see is omitted; writing one is 403; filtering, ordering and
searching on one is 403 (search silently skips it). See `docs/adr/ADR-0037-masterdata-access-model.md`.

## 9. API

Catalogs: `/api/v1/platform/master-data/<type>` (bare arrays). Directory and partners:
`/api/v1/{departments,teams,offices,positions,people,clients,vendors,client-contacts,vendor-contacts,client-contracts,vendor-contracts}/`
(paginated). `DELETE` soft-deletes; `?hard=true` permanently deletes a soft-deleted row;
`POST …/restore` undoes. Actions: catalogs `archive`, `restore`, `reorder`; people `link-user`,
`unlink-user`, `deactivate`, `reactivate`; contracts `activate`, `terminate`, `adjust-end-date`.
Errors use the core format; 409 carries a specific `error.code` (`conflict`, `has_dependants`,
`invalid_transition`, `contract_overlap`, `system_row_protected`, `not_soft_deleted`).
OpenAPI is documented per operation and pinned by `tests/api/test_schema_snapshot.py`.
Full route list: `docs/api/domains/masterdata.md`.

## 10. Audit and logging

Service events (above). Personal and financial fields never reach `ChangeLog` snapshots
(`audit_exclude_fields`), logs (query-string redaction, database error `DETAIL` redaction) or audit
events.

## 11. Testing

`apps/masterdata/tests/`: models and constraints, services, API matrices (anonymous, plain user,
manager, hard delete), field gating, PostgreSQL race tests (overlapping contracts, cycles,
headquarters, primary contact, user link), migration tests for 0005 to 0009 (forward, backward,
loud failure), OpenAPI snapshot, admin, cross-module. Race tests need PostgreSQL.

## 12. Known limits and follow-ups

- Catalog caching (D7) is not implemented; measure first.
- FU-1: `org-admin` still holds `masterdata.catalog.manage`; move it to a platform-level role.
- The stored `active_projects`, `active_tasks_count`, `headcount`, utilization columns are unused by the API.
- `btree_gist` must be creatable by the migration role (migration 0007).
