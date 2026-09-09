# Uploads Contract

## Current State

- `ApiClient.upload(file, path, …)` exists (builds `FormData`, POST) but is **currently
  unused** by any frontend module — no live upload contract yet.
- Mock media/attachment entities carry URL fields only
  (`source_url`, `preview_url`, `thumbnail_url`, `file_url`): the mocks never transfer
  bytes.

## Contract When Wired

Based on the client implementation and mock entity shapes:

- Transport: `multipart/form-data` POST to the resource collection endpoint
  (`/api/v1/media/`, `/api/v1/attachments/` or the production entity's attachment route).
- Auth: standard `Authorization: Bearer` header + `X-Organization-Id`.
- Extra form fields mirror the JSON create bodies (`entity_type`, `entity_id`,
  `category`, `media_type`, …).
- Response `201`: serialized entity with server-resolved URLs — same shape as the list
  items.
- Errors: standard error contract (400 field errors, 413 for oversized files).

## Backend Mapping

- Existing infrastructure: `apps/core/models` `Attachment` with file validation,
  exposed at `/api/v1/core/attachments/` (GET/POST list + detail CRUD).
- Media storage settings in `config/settings/components/storage.py`; dev media served at
  `/media/…`.
- Decision required before production phase: canonical attachment route for production
  entities (`core.attachments` reused vs a production-owned endpoint). Documented as an
  open decision in [domains/production.md](domains/production.md).

## Rules

1. Do not base64-encode files in JSON bodies; always multipart.
2. Upload endpoints must validate size/type server-side (reuse core validators).
3. Virus/malware scanning and CDN delivery are infrastructure concerns — see
   `docs/06-infrastructure/` when implemented.
