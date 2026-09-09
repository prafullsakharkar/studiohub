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
| Django backend | `backend/apps/{core,identity,organization,production,settings,audit}` | Real implementation (reference architecture: `apps/organization`) |

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

1. ~~**Response envelope mismatch (BLOCKER).**~~ **RESOLVED (Phase 0).** The backend now
   emits raw DRF shapes (`{count,next,previous,results}`, plain objects, plain arrays)
   with unwrapped DRF error bodies. See [pagination.md](pagination.md) and
   [errors.md](errors.md).
2. ~~**Auth path + shape mismatch (BLOCKER for Phase B).**~~ **RESOLVED (Phase B).** Compat layer at
   `/api/v1/auth/{login,refresh,logout,me}/` now returns frontend shapes
   (`{tokens:{access,refresh}, user}` etc.) via `apps/identity/api/views/auth_compat.py`
   and `serialize_frontend_user` helper. See [authentication.md](authentication.md).
3. **Two divergent mock engines.** `mockRouter.ts` intercepts in-process; MSW handlers only
   catch what escapes it — **RESOLVED** for production via top-level `/api/v1/{projects,shots,...}/`
   (bypasses mockRouter when `dispatchMockRequest` removed).
4. ~~**Multi-tenant header.**~~ **RESOLVED (Phase B).** Both `X-Organization-Id` (frontend) and
   `X-Organization` (legacy) are now accepted (`core/middleware/organization.py` +
   `organization/middleware/organization_context.py`) and resolved to
   `request.organization` / `request.membership`.
5. **No base-URL mechanism.** The frontend uses same-origin relative `/api/v1/...` paths;
   deployment must serve Django same-origin or add a proxy/prefix option.
6. ~~**Production domain has no backend yet.**~~ **RESOLVED (Phase D):** `apps.production` now
   provides Projects/Shots/Assets/Tasks/Timelogs/Versions/Reviews/Playlists/Media/Workflows/
   Scheduling/Analytics at `/api/v1/{projects,shots,assets,tasks,timelogs,versions,reviews,media,playlists,workflows,scheduling,analytics}/`
   (paginated or bare-array per contract, `IsAuthenticated`, `search`/`ordering`/`filters`,
   custom actions `approve`/`publish`/`bulk-*` etc). See `domains/production.md`.
7. **OpenAPI is live (Phase 0–D).** `drf-spectacular` schema generates cleanly at
   `/api/schema/` (Swagger UI at `/api/schema/swagger-ui/`) — **0 errors** (now ~300+ ops);
   machine-readable contract available for CI comparison.
8. **Seed data (Phase A).** `apps/core/management/commands/seed_dev.py` provides an
   idempotent, env-gated seed for Org → Departments/Teams/Offices → Roles/Permissions →
   Users/Profiles/Memberships (password `password123`).
9. **Legacy flat aliases (Phase C):** `organizations` (conditional pagination, id-or-code),
   `departments`/`teams`/`offices` (bare array), `people` (paginated), `organization/` singleton
   via `apps/organization/api/urls_legacy.py`; v2 custom actions (`archive`/`switch`/`members/add` etc) via `@action`.

## Status Legend

Used throughout the mapping document:

`MATCHED` · `MISMATCH` · `MISSING BACKEND` · `MISSING FRONTEND` · `PLANNED` · `DEPRECATED`
