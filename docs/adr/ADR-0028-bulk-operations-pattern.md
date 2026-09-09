ADR-0028: Bulk Operations Pattern

Status: Accepted

Context
-------
StudioHub manages enterprise-scale production data. Operations frequently
touch many records at once (importing many sequences, archiving a shot list,
updating statuses across a project). Naive per-item requests are slow and
produce chatty clients; a single atomic transaction over many rows risks
rolling back legitimate records because of one bad row.

The platform needs a consistent, reusable way to expose bulk create/update/
archive/restore/delete across domains that:

- is organization-scoped and fail-closed by default,
- reports partial success per record,
- lets clients reconcile conflicts before creating (e.g. existing or
  soft-deleted codes),
- keeps each item's failure from blocking the others.

Decision
--------
Domains that need bulk operations expose dedicated RPC-style `@action`
endpoints (not generic auto-generated `bulk/` endpoints) that delegate to a
service method. The contract is:

- `POST /api/v1/<resource>/bulk-create/`   `{items: [...]}`
- `PATCH /api/v1/<resource>/bulk-update/`  `{items: [{id, ...fields}]}`
- `POST /api/v1/<resource>/bulk-archive/`  `{ids: []}`
- `POST /api/v1/<resource>/bulk-restore/`  `{ids: []}`
- `POST /api/v1/<resource>/existence-check/` `{items: [...]}` (optional)

Response envelope (consistent across all bulk endpoints):

    {
      "processed": int,
      "successful": int,
      "failed": int,
      "results": [
        {"index": int, "status": str, "id"?, "code"?, "deleted_at"?, "error"?, "entity"?}
      ]
    }

- `results[index]` corresponds to the input item at that index.
- `status` values are per-operation:
  - bulk-create: `created | exists | soft_deleted | duplicate | invalid`
  - bulk-update: `updated | not_found | invalid`
  - bulk-archive: `archived | not_found`
  - bulk-restore: `restored | not_found`
  - existence-check: `new | exists | soft_deleted | duplicate | invalid`
- Each item is validated and saved in its own transaction so partial success
  is preserved and reported.
- Business logic lives in a `BusinessService` (service layer), never in the
  view or serializer.

Conflict reconciliation
-----------------------
Where uniqueness applies, clients run `existence-check` before `bulk-create`
to classify rows. When a code already exists as a soft-deleted record, the
client is expected to prompt to restore rather than blindly creating an
inconsistent duplicate.

Soft delete / archive
---------------------
Bulk archive maps to soft-delete (see ADR-0014). Bulk restore un-deletes.
Hard deletion is avoided where the domain requires recovery/history.

Consequences
------------
Positive:
- Consistent, predictable bulk contract across domains.
- Partial success is reported per record; one bad row does not block others.
- Organization/permission checks are centralized in the service.
- Clients can reconcile conflicts before creating.

Negative:
- Custom `@action` endpoints are hand-maintained per domain (not free from
  generic viewsets).
- Requires per-domain serializers for bulk payloads.
- Not a single generic CRUD endpoint; more code than naive bulk routes.

Rationale
---------
This mirrors the existing Task bulk actions (bulk-assign/status/archive/delete)
and generalizes them into one documented contract. It keeps business rules in
the service layer, preserves the service/selector architecture (ADR-0003), and
avoids a one-size-fits-all generic bulk endpoint that cannot express
per-domain status semantics.

References
----------
- ADR-0003 — Service & Selector Pattern
- ADR-0008 — API Design Principles
- ADR-0014 — Soft Delete Strategy
- `docs/api/domains/production.md` — Sequence bulk endpoints
