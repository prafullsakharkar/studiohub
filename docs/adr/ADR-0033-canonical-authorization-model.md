# ADR-0033: Canonical Authorization Model (Per-Project/Show RBAC, Scope Tiers, Dot Codes)

- **Status:** Accepted
- **Date:** 2026-09-23
- **Decision Makers:** Architecture Team
- **Supersedes:** ADR-0032 decision 6 only (org-wide production access model)
- **Superseded By:** None

---

# Context

ADR-0032 hardened the backend gate (deny-by-default `HasPermission`, fail-closed
resolver, cache invalidation, membership gates) **but recorded the access model as
"organization-wide within a tenant — any org member reaches every project; no
per-project RBAC".**

The platform authorization baseline — agreed in the phased access-control program,
documented in `studiohub-react/docs/access-control/{RBAC,SCOPES,ACCESS-MATRIX,
IMPLEMENTATION-AUDIT}.md`, and required by the enterprise roadmap — instead mandates:

```text
User → Authentication → Platform Role → Organization Membership →
Organization Role → Project/Show Membership → Permission → Scope →
Resource → Action → ALLOW / DENY
```

The Phase 1 audit additionally found the backend itself split across duplicate
authorization paths (`AuthorizationResolver`/`PermissionChecker`, unused `HasRole`,
legacy org permission classes), a second undocumented privilege tier (`is_staff`
shortcuts), and two incompatible permission-code formats (dot in identity/organization,
colon in production/platform/audit/deliveries/publishing/scheduling).

# Decisions

## D1 — Per-project RBAC is canonical

`ProjectMembership` (active, project-bound) gates access to project and production
entities. Organization membership **alone** grants only organization-level resources.
Org-wide production visibility requires an explicit organization-scope grant (an org
membership whose role has `RoleScope.ORGANIZATION`, or priority ADMIN, conferring the
resource's view code). Every production entity listing/detail is narrowed to the
caller's member projects unless such a grant exists.

**This supersedes ADR-0032 decision 6** (org-wide production access). Project and show
isolation is a core enterprise requirement (managed staffing per production, external
vendor/client compartmentalization).

## D2 — SHOW is a first-class scope tier

Scope lattice: `GLOBAL → ORGANIZATION → PROJECT → SHOW → DEPARTMENT → TEAM → ASSIGNED →
OWN` with terminal external branches `VENDOR_PROJECT(_ASSIGNED)` / `CLIENT_PROJECT`.
`ProjectMembership` gains a nullable `show` FK; a show-bound membership narrows project
grants to that show. A project-wide membership covers all of its shows; a show grant
never covers sibling shows.

> **Amendment (2026-10-28, TPN review TM-002): external members are compartmentalized.**
> The production selectors used to scope by project only, so a vendor or client member saw the
> whole project. A `ProjectMembership` that names a vendor (`vendor_id`) or a client (`client_id`)
> is now *external* on that project and sees only what it was given; a membership naming neither is
> internal and behaves as before. The rules live in `apps/production/selectors/external_scope.py`
> and are deny-by-default:
>
> - **Vendor:** the tasks of the vendor (by `vendor_id` or `vendor_code`, case-insensitive) and what
>   is reached through them: the task's shot, asset, sequence and episode, its versions and
>   timelogs, the reviews containing those versions, and media attached to any of it.
> - **Client:** the reviews they participate in, the versions in them, and media attached to those.
> - **Both:** the project record (with budget, totals, client and other vendors removed), their own
>   membership, the playlists and notes they created, and the project's workflow definitions.
> - **Not shown to external members:** shows, editorial, automation, status history, task templates,
>   other members, and every whole-project view (statistics, dashboard, summary, schedule, notes,
>   deliveries). Deliveries, publishing and scheduling are filtered by `visible_project_ids`, which
>   now lists internal projects only.
>
> **Amendment (2026-10-28, TPN review TM-002, part 2): internal members can be narrowed.**
> `Episode`, `Sequence`, `Shot` and `Asset` now carry a nullable `show` link, so a show-bound
> membership can be enforced. The rules live in `apps/production/selectors/internal_scope.py` and are
> deny-by-default:
>
> - **Show-bound membership** (`ProjectMembership.show`): the episodes, sequences, shots and assets
>   assigned to that show; the tasks on those; and the versions, timelogs, reviews containing those
>   versions, and media attached to any of it. Records not assigned to a show are hidden from it.
> - **Department** (`department` text, case-insensitive, or `department_id`): the project's tasks of
>   that department and what they reach (shot, asset, sequence, episode, versions, timelogs, reviews,
>   media), the same reach a vendor has.
> - **Both** must hold. A membership with neither is *full* and unchanged. Workflows, playlists, notes,
>   members and templates are project-wide for every internal member.
> - **Whole-project views are not available to a narrowed member**: statistics, dashboards, and the
>   records filtered by `visible_project_ids` (deliveries, publishing, schedules, task templates),
>   because their totals and lists would reveal what the narrowing hides.
> - **Creating** into a project as a show-bound member files the record under their show, so it does not
>   vanish from their own view. `manage.py assign_shows` assigns existing records to a show.
>
> - **Assigning through the API:** `show_id` is accepted on create and update of episodes, sequences,
>   shots and assets (`null` clears it). The show must belong to the record's project (another project's
>   show answers `400 Unknown show.`). Only a platform administrator, a full project member, or a member
>   bound to a show (their own show only, and they cannot clear it) may set it; a department-narrowed or
>   external member gets `403`.
>
> - **Also narrowed for internal members (follow-up):** playlists (those the member made, and those whose
>   entries are all inside the reach), project notes (the member's own), and media attached to sequences,
>   episodes and reviews. `manage.py check_narrowing [--project CODE]` flags a show-bound member with no
>   record assigned to the show and a department that no task of the project carries (exit status 1).
>
> Not done: media attached to other entity types stays project-wide.

## D3 — Canonical permission code format

`<resource>.<action>` in dot notation with singular resources
(`shot.view`, `project.create`, `organization.role.view`). Legacy colon codes
(`shots:read`, `projects:create`) are migrated — constants, seeds, and existing DB rows —
via a single data migration; the frontend already normalizes legacy codes, so the wire
contract remains compatible.

## D4 — `is_staff` is not an authorization tier

Removed from every authorization path (selector scoping, org-context access helper,
project-scoped gates, settings viewsets, masterdata catalog writes). Superuser remains
the only break-glass (already logged via `authorization_superuser_bypass`).
Platform-level surfaces are gated by explicit permission codes
(`settings.view`/`settings.manage`, `platform.master_data.configure`) resolvable through
global `Role` grants, with superuser break-glass until platform roles are provisioned.

> **Amendment (masterdata Phase 8, 2026-10-23):** `platform.master_data.configure` (and
> `platform.master_data.create`) no longer exist. Masterdata writes are guarded by
> `masterdata.catalog.manage`, `masterdata.directory.manage` and `masterdata.hard_delete`; personal
> and financial fields by `masterdata.person.view_sensitive` and `masterdata.client.view_financial`
> (see `docs/masterdata/DECISIONS.md` D9). `init_platform` removes the old codes and their grants.

## D5 — Authorized organization listing

`GET /api/v1/auth/me/organizations/` (alias `GET /api/v1/users/me/organizations/`)
returns exactly the organizations the caller may access: active memberships, or all
organizations for superusers. Clients never enumerate the full directory and filter
client-side.

## D6 — User directory is organization-scoped

`UserViewSet` list/retrieve require `identity.user.view` and return users sharing an
active membership in the request organization; superusers are unrestricted. This replaces
the "member-directory open to any authenticated user" contract (cross-org identity leak).

# Consequences

- Backend denies cross-project/cross-show access independent of the frontend.
- Existing org-scoped seeded roles holding production codes must declare
  `RoleScope.PROJECT` (or narrower); org/production admin roles declare
  `RoleScope.ORGANIZATION`. Seed data updated accordingly.
- Permission-catalog data migration renames colon codes to dot codes
  (idempotent, FK-preserving).
- Legacy duplicate authorization modules
  (`apps/identity/authorization/`, `HasRole`/`RoleResolver`,
  `apps/organization/permissions/*`) are deleted; the single canonical chain is
  `HasPermission → PermissionCacheService → PermissionResolver`.
- Contract posture from ADR-0032 is preserved: cross-org ⇒ 404, missing permission ⇒
  403, unauthenticated ⇒ 401.
- Frontend follows in plan Phase 4 (`can()` engine) and Phase 7 (org switcher via
  `/me/organizations`).
