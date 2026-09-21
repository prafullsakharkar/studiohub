# ADR-0032: Backend Authorization Hardening

- **Status:** Accepted
- **Date:** 2026-09-18
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

The authorization audit (`docs/02-architecture/authorization.md`) found the
backend gate failing open in several places while the architecture
(`backend/.ai/ARCHITECTURE.md` §25, `AGENTS.md` §10) requires the backend to
be the final authority with deny-by-default semantics:

1. `HasPermission` allowed any action missing from `permission_map`, and
   `is_staff` bypassed every permission code in every organization.
2. The permission resolver ignored membership status, role/permission active
   flags, `RolePermission.granted`, soft-deletion, and role organization
   scope; revoked grants stayed cached for up to 1h (no invalidation wired).
3. Plain-APIView surfaces (analytics, billing) and several viewsets honored
   the `X-Organization` header without membership checks, enabling
   cross-organization reads for any authenticated user.
4. Bulk/task/invitation/project-member flows trusted client-supplied ids
   (assignees, teams, invitees, members) without organization validation.

Constraints:

- API contracts must not break: cross-organization access stays 404 (no
  existence leak), missing permission stays 403, unauthenticated stays 401,
  wrong-method stays 405 (ADR-0031 diagnostics rely on these shapes).
- No frontend changes in this stage; header-based org context
  (`X-Organization[-Id]`) remains the tenant-selection mechanism.
- Smallest architecture-compliant change: evolve Core → Identity →
  Organization → Production, no new framework.

---

# Decision

1. **Deny-by-default gate.** `get_permission_required()` returns `None` for
   unmapped actions (deny) and `()` only for explicitly open actions.
   `HasPermission` denies on `None`, allows on `()`, and no longer treats
   `is_staff` as a bypass. `is_superuser` remains a logged break-glass
   bypass. Unrouted method/URL combos (`action is None`) pass through so
   DRF's 405 handling is preserved.
2. **Staff resolves like everyone else.** Test `staff_client` fixtures now
   attach explicit full grants via real RBAC rows instead of relying on the
   bypass. Staff keeps admin-context listing (no-header unscoped reads) in
   selectors, but a header-selected org always scopes — including for staff.
3. **Fail-closed resolver.** `PermissionResolver` requires active,
   non-deleted users; active memberships; active, non-deleted roles;
   `granted=True` role-permission rows; active, non-deleted permissions.
   Organization-scoped roles apply only in their org (or globally when the
   role itself is global); without org context only global roles apply.
   Group membership goes through live `GroupMember` rows.
4. **Write-through invalidation.** `PermissionCacheService.invalidate_*` is
   called from `RoleService` (grant/revoke/assign/update/delete),
   `UserRole/GroupRole/GroupMember/Membership/Permission/User` services via
   the existing `invalidate_cache` hook. Re-granting flips `granted` back.
5. **Membership gates where codes don't apply.** Analytics, billing, and the
   intelligence-style membership check use `has_organization_access()`
   (staff/superuser or live membership); project-member creation requires
   staff/superuser or an ADMIN-priority membership; invitation accept/decline
   allows the invitee (email match) or an invitation-UPDATE grant holder.
6. **Access model recorded:** organization-wide within a tenant (any org
   member reaches every project); no per-project RBAC. Bulk services stay
   per-item org-scoped with per-item `not_found`; task assignees must be
   active org members, teams org-owned, statuses validated, bulk delete is
   soft-delete. `?include_deleted` requires the resource DELETE grant.
7. **Dead code removed:** unused `core/api/permissions/*` modules, both dead
   permission caches, empty placeholder modules. Always-`True` org stub
   permission classes and the `IsStaff`-vs-`HasPermission` split are kept
   and documented (global catalog/settings writes use the established
   `IsStaff` pattern; reads stay open).

---

# Consequences

- Positive: deny-by-default everywhere; revocation effective immediately;
  cross-org reads closed on analytics/billing/invitations/client-vendor
  restores; bulk/task inputs validated; 2000 backend tests green including
  new negative matrices.
- Negative/accepted variance: archive/restore code mapping stays
  domain-inconsistent (`UPDATE` vs `DELETE`); recorded as cosmetic — the
  security property (only permitted users) holds either way.
- Intelligence writes and audit reads stay membership-gated rather than
  code-gated (product surface decision); production scheduling stubs remain
  stubs (no persistence, no new risk).
- `validate_email_verified` fixed (field + polarity) but intentionally not
  wired into login — verification is not currently a login gate.
- Email verification, per-project RBAC, and PostgreSQL RLS remain explicit
  non-goals for this stage.

---

# Alternatives Considered

- **Keep the staff bypass and document it:** rejected — `is_staff` is handed
  out liberally (seeds, fixtures, admin flows) and equated authentication
  with authorization.
- **Require membership in `HasPermission` for all org codes:** rejected —
  breaks legitimate global-role flows (system operators without per-org
  memberships) that the header-scoped model supports.
- **Per-project RBAC now:** rejected as speculative — no product requirement;
  the org-wide model is recorded instead, with project-match guards where
  the request names a project.
