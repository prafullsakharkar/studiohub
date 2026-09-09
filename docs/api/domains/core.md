# Core Domain API

Scope: technical infrastructure exposed over HTTP. Core provides reusable model/service
infrastructure (`BaseModel` hierarchy, soft delete, events, pagination, filters,
validators); it should expose **only** entities the frontend needs — no generic CRUD
just because models exist.

## Endpoints

### Attachments

Backend: `AttachmentViewSet` at `/api/v1/core/attachments/` (+ `/{uuid}/`), full CRUD,
`IsAuthenticatedPermission`, raw `ResponseMixin` (envelope removed in Phase 0).

Frontend contract: `/api/v1/attachments/` — `GET` list (**paginated** `{count,next,previous,results}`
via `StandardPagination`; filters: `entity_type`, `entity_id`, `category`, `search`), `POST` create,
`GET/{id}/`, `DELETE /{id}/`. No PATCH.

Status: **MATCHED via alias** — canonical remains `/api/v1/core/attachments/`; compat alias
at `/api/v1/attachments/` via `apps/core/api/urls_compat.py` (mounted in `config/v1_urls.py`) exposes
same viewset under both prefixes. Both are paginated (frontend's earlier bare-array expectation
was updated to paginatedShape; hook in `useAttachments` defensively handles arrays). Verified in
OpenAPI schema (`/api/v1/attachments/` and `/api/v1/core/attachments/` both listed, 0 errors).

### Tags

Backend routed `/api/v1/core/tags/` CRUD with `BasePagination`.
Status: **MISSING FRONTEND** — no frontend usage; leave as-is, do not advertise until a
consumer exists.

### Health

`GET /health/` → `{"status": "ok"}` (outside `/api/`). Infrastructure check only;
no frontend contract.

## Mock Entities → Real Models

| Mock entity | Django model | Status |
|---|---|---|
| `AttachmentItem` (mocks/db/production/attachments.ts) | `core.Attachment` | Model exists; serializer fields need mapping (`category`, `file_type`, `security_classification`) |
| MediaItem | **MISSING DOMAIN MODEL** (candidate: core media/file model) | Documented, do not invent silently |
| Tag mocks | `core.Tag` | N/A (unused) |

## Rules

- No business logic endpoints belong in core.
- File handling stays generic (validation, storage backends); domain meaning
  (what an attachment is *for*) belongs to the owning domain.
- Any new core endpoint must reuse existing pagination/error infrastructure after it is
  aligned with the frontend contract.
