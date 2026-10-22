# ADR-0034: Identity Is Platform-Global (No Organization FK)

- **Status:** Accepted
- **Date:** 2026-10-22
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

`AGENTS.md` describes StudioHub as organization-aware and requires every
organization-aware domain to enforce organization isolation. The Identity
module section says to reuse `apps/identity` for users, authentication, roles,
permissions, security, and devices.

However, the Identity module as it runs today is **platform-global**:

- `apps/identity` has no organization foreign key, model field, or import
  (`grep` for `organizations` under `apps/identity/models` returns nothing).
- `apps/organization` is not registered in `INSTALLED_APPS` and has no tracked
  source in the runtime tree.
- The user directory selector is explicitly platform-global for staff, with a
  self-service carve-out (`apps/identity/selectors/user.py`).
- RBAC is flat and platform-global: `Role`, `Permission`, `Group`, `UserRole`,
  `GroupMember`, `GroupRole` carry no tenant column.
- The authentication chain (`SessionBoundJWTAuthentication` →
  `PersonalAccessTokenAuthentication` → `APIKeyAuthentication`) resolves
  platform users, not per-organization identities.
- Project/show authorization is owned by `apps.production`
  (`ProjectMembership`) and is the only per-project dimension the SPA consumes
  (`api/serializers/frontend_user.py`).

`ADR-0033` already establishes the canonical authorization flow:

```text
User → Authentication → Platform Role → Organization Membership →
Organization Role → Project/Show Membership → Permission → Scope →
Resource → Action → ALLOW / DENY
```

The runtime has not yet implemented the organization-membership tiers of that
flow, but Identity cannot invent a tenant boundary that the rest of the platform
does not have. Doing so would either leak organization identifiers into the
identity tables or create a second, competing ownership model.

# Decision

## D1 — Identity is platform-global until an organization domain exists

Identity models, services, selectors, RBAC tables, and authentication remain
platform-global. No organization FK, tenant column, or organization-scoped
query may be added to `apps/identity` while `apps/organization` is absent from
the runtime.

## D2 — Organization isolation is enforced where tenancy exists

Where a real tenant dimension exists (project/show membership in
`apps.production`, and any future organization domain), isolation is enforced
by that domain, not by Identity. Identity resolves *who* the principal is; the
tenant domain decides *what they may reach*.

## D3 — Self-service vs. platform-wide access is explicit and tested

Every global Identity read/write surface must make its scoping explicit:

- Self-service endpoints (own user, own profile, own sessions, own tokens)
  scope to `request.user`.
- Platform-wide endpoints (user directory, roles, groups, permissions) require
  an explicit permission code and are deny-by-default.
- A future organization tier must be introduced as an additive decision
  (new ADR) that updates `ADR-0033`'s flow, not by silently adding tenant
  columns to Identity.

## D4 — `AGENTS.md` organization language is aspirational for Identity

The organization-isolation requirement in the root `AGENTS.md` applies to
domains that carry a tenant key. For Identity it is documented here as a
**future** constraint. When an organization domain is reinstated, this ADR must
be revisited and either superseded or amended.

# Consequences

## Positive

- One canonical identity and authorization source; no duplicated tenant
  columns or dead organization FKs.
- Matches the running system, so audit and tests describe reality.
- Leaves room for a future organization tier without a destructive rewrite.

## Negative / risks

- The platform currently cannot express "user X only exists in organization Y";
  multi-tenant deployments must rely on deployment-level isolation until an
  organization domain is implemented.
- `AGENTS.md` and this ADR disagree on wording; this ADR is the resolution and
  must be referenced when the discrepancy is encountered.

## Follow-ups

- Revisit if/when `apps/organization` returns to `INSTALLED_APPS`.
- `ADR-0033` remains authoritative for the authorization flow; this ADR only
  resolves the Identity ownership boundary.
