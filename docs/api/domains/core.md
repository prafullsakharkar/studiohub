# Core Domain API

Scope: technical infrastructure exposed over HTTP. Core provides reusable model/service
infrastructure (`BaseModel` hierarchy, soft delete, events, pagination, filters,
validators); it should expose **only** entities the frontend needs — no generic CRUD
just because models exist.

## Endpoints

### Attachments

Backend: `AttachmentViewSet` at `/api/v1/core/attachments/` (+ `/{uuid}/`), full CRUD,
`IsAuthenticatedPermission`, `ResponseEnvelopeMixin` (**must be removed** per
[pagination.md](../pagination.md)/[errors.md](../errors.md)).

Frontend contract: `/api/v1/attachments/` — `GET` list (**bare array**, filters:
`entity_type`, `entity_id`, `category`, `search`), `POST` create, `GET/{id}/`,
`DELETE /{id}/`. No PATCH.

Status: **MISMATCH** (path + envelope). Decision required: keep frontend path and adapt
routing, or move frontend to `/api/v1/core/attachments/`. Until production attachments UI
is wired to HTTP there is no live consumer; resolve when implementing production.

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
