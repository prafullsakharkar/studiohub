# API domain: masterdata

All paths are under `/api/v1/`. The machine-readable contract is the OpenAPI schema; the
operations and statuses are pinned by `apps/masterdata/tests/api/test_schema_snapshot.py`. The rules
behind them are in `docs/masterdata/CONTRACTS.md`.

## Common behavior

- Reads: any authenticated user. Writes: `masterdata.catalog.manage` or `masterdata.directory.manage`.
- `DELETE <detail>` soft-deletes (directory: `204`; catalogs: `200 {"success": true, "message": …}`).
  `DELETE <detail>?hard=true` permanently deletes an already soft-deleted row (`204`, needs
  `masterdata.hard_delete`). `POST <detail>/restore` undoes a soft delete.
- Errors: `{"detail", "error": {"code", "request_id"}}`; validation errors are
  `{"<field>": ["…"], "error": {"code": "validation_error", "request_id"}}`.
  `409` codes: `conflict`, `has_dependants`, `invalid_transition`, `contract_overlap`,
  `system_row_protected`, `not_soft_deleted`.
- Fields needing `masterdata.person.view_sensitive` or `masterdata.client.view_financial` are
  **omitted** from responses without it; writing one is `403`.

## Catalogs (`platform/master-data/<type>`, bare arrays, no trailing slash)

`statuses`, `task-types`, `asset-types`, `shot-types`, `review-types`, `file-types`, `software`,
`software/<id>/versions`. Actions: `POST …/archive`, `POST …/restore`, `POST …/reorder`.
Each row reports `"scope": "GLOBAL"` (constant). `GET platform/overview` returns the live counts
(`global_*_count`, `system_health`, `last_definition_update`).

## Directory and partners (trailing slash, paginated)

| Resource | Path | Extra actions |
|---|---|---|
| Departments | `departments/` | |
| Teams | `teams/` | |
| Offices | `offices/` | `headcount` is computed |
| Positions | `positions/` | |
| People | `people/` | `link-user`, `unlink-user`, `deactivate`, `reactivate` |
| Clients | `clients/` | |
| Vendors | `vendors/` | |
| Client / vendor contacts | `client-contacts/`, `vendor-contacts/` | purely sensitive: every call needs `person.view_sensitive` |
| Client / vendor contracts | `client-contracts/`, `vendor-contracts/` | `activate`, `terminate`, `adjust-end-date` |

Contract `status` is derived (`Draft`, `Active`, `Expired`, `Terminated`) and cannot be sent on
PUT/PATCH. Details and every contract change per phase: `docs/masterdata/DECISIONS.md`
("Frontend-facing contract changes in Phase 5 / 6 / 7").
