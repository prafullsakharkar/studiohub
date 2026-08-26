# StudioHub API Contract & Integration Documentation

This directory is the **authoritative API contract** between the React frontend and the
Django REST Framework backend. Its purpose is to let the frontend switch from the MSW /
mock layer to the real Django backend **without changing endpoint paths, request/response
shapes, pagination, filtering, or error handling**.

> Implementation standards (views, serializers, services, selectors) live in
> [`docs/05-api/`](../05-api/) and `docs/03-backend/`. This directory documents the
> *contract* — what crosses the wire — and the integration checklist.

## Source of Truth

| Layer | Location | Role |
|---|---|---|
| Frontend API client | `frontend/src/api/client/ApiClient.ts` (ky) | Transport: headers, auth, refresh, error parsing |
| Mock router (Layer A) | `frontend/src/mocks/mockRouter.ts` | Primary mock engine, intercepts inside `ApiClient` before network |
| MSW handlers (Layer B) | `frontend/src/mocks/handlers/` | Service-worker fallback for requests that escape the mock router |
| Mock DB | `frontend/src/mocks/db/` | Fixture entities → must map to real Django models |
| Django backend | `backend/apps/{core,identity,organization,settings,audit}` | Real implementation (reference architecture: `apps/organization`) |

**The frontend API contract is primary.** Where backend behavior differs, Django adapts,
unless a documented contract change is agreed.

## Documents

| Document | Contents |
|---|---|
| [api-contract.md](api-contract.md) | Complete endpoint inventory (all domains), conventions, CRUD matrix |
| [authentication.md](authentication.md) | JWT login/refresh/logout/me contract, token storage, 401 handling |
| [pagination.md](pagination.md) | `{count,next,previous,results}` envelope + bare-array endpoints |
| [filtering.md](filtering.md) | Query-parameter filtering contract per domain |
| [searching.md](searching.md) | `?search=` semantics and supported fields |
| [errors.md](errors.md) | DRF-style error JSON shapes and status-code semantics |
| [permissions.md](permissions.md) | Auth → org scope → role → permission enforcement chain |
| [uploads.md](uploads.md) | File/media upload contract |
| [versioning.md](versioning.md) | URL versioning, trailing slashes, resource naming |
| [frontend-backend-mapping.md](frontend-backend-mapping.md) | Frontend call ↔ MSW handler ↔ Django endpoint status matrix (**integration checklist**) |
| [backend-implementation-plan.md](backend-implementation-plan.md) | Phased implementation order |

### Domain Contracts

| Document | Contents |
|---|---|
| [domains/core.md](domains/core.md) | Attachments, tags, health, media/file infrastructure |
| [domains/identity.md](domains/identity.md) | Auth, users, roles, permissions, sessions, MFA |
| [domains/organization.md](domains/organization.md) | Organizations, departments, teams, offices, people, clients, vendors, memberships, invitations, RBAC |
| [domains/production.md](domains/production.md) | Projects, shots, assets, tasks, timelogs, versions, reviews, playlists, workflows, scheduling |

## Executive Summary of Findings

1. **Response envelope mismatch (BLOCKER).** The frontend parses responses directly
   (`PaginatedResponse<T>`, plain objects, plain arrays). The current Django default
   (`StandardPagination` + `ResponseEnvelopeMixin`) wraps everything in
   `{success, status_code, message, data, meta.pagination, errors}`. The backend must
   return raw DRF shapes on the wire.
2. **Auth path + shape mismatch (BLOCKER).** Frontend calls `/api/v1/auth/login|refresh|logout|me/`
   expecting `{tokens:{access,refresh}, user}` / `{access}`. Backend implements
   `/api/v1/identity/login/…` returning `{access, refresh, session:{…}}`.
3. **Two divergent mock engines.** `mockRouter.ts` intercepts in-process; MSW handlers only
   catch what escapes it. Some endpoints exist **only** in one layer (task bulk ops and
   `versions/:id/promote/` are MSW-only; media/playlists/workflows/scheduling are
   mockRouter-only).
4. **Multi-tenant header.** Every authenticated request sends `X-Organization-Id`; the
   backend organization context middleware must consume it.
5. **No base-URL mechanism.** The frontend uses same-origin relative `/api/v1/...` paths;
   deployment must serve Django same-origin or add a proxy/prefix option.
6. **Production domain has no backend yet.** Projects/shots/assets/tasks/versions/reviews/
   playlists/workflows/scheduling/analytics/platform exist only as mocks; models are
   MISSING and must be documented, not silently invented.

## Status Legend

Used throughout the mapping document:

`MATCHED` · `MISMATCH` · `MISSING BACKEND` · `MISSING FRONTEND` · `PLANNED` · `DEPRECATED`
