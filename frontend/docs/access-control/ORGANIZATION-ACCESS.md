# ORGANIZATION ACCESS — Tenant Boundary and Switcher Semantics

Canonical contract for the organization tier.

## Boundary

Authentication proves identity; **an active organization membership** gates
what exists inside an org. Without it, the user sees no data, no orgs, no org
detail (404/403), no production records.

## Server-filtered organization list

`GET /api/v1/auth/me/organizations/` returns exactly the orgs the caller may
access:

- superuser → all non-deleted organizations
- member → only organizations with an active `OrganizationMembership`

The org switcher reads this endpoint only. It never enumerates a full
directory and filters locally.

## X-Organization-Id header

Clients send `X-Organization-Id: <uuid>` (from the server-provided list) to
select the active tenant on requests. The header is a scope selector, not
proof of membership — the backend re-resolves the user's membership against
it and denies when absent.

## Cache hygiene (org switch)

Switching the active organization cancels in-flight queries and clears all
cached query data. Auth state is preserved; the new org drives fresh fetches.

Verified by:
- `apps/organization/tests/api/test_organization_isolation.py`
- `apps/organization/tests/test_authorization_negatives.py`
- e2e: `organization-isolation.spec.ts`
