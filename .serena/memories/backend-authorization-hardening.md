# Backend authorization hardening (v2.1.0, ADR-0032)

Backend-only RBAC overhaul: audit (`docs/02-architecture/authorization.md`) + all 10 implementation phases. Released as v2.1.0 (commits 4716013, 2c4de32; tag v2.1.0; https://github.com/prafullsakharkar/studiohub/releases/tag/v2.1.0). No frontend files touched.

## Gate (apps/identity/permissions/permission.py, core/api/viewsets/base.py)
- `HasPermission` denies actions missing from `permission_map` (returns None), allows explicit `()` entries, no longer bypasses `is_staff`. `is_superuser` break-glass kept + logged. New `has_object_permission` denies org-mismatched objects (defense in depth; queryset scoping stays primary).
- Unrouted method/URL combos (`action is None`) pass through so DRF 405 handling is preserved (contract tests pin 405s).
- Map gaps closed: role `list_users`/`list_groups` → VIEW, user-role `create` → ASSIGN; identity open actions (user list/retrieve/me, profile, trusted-device, user-session self/admin) declared as explicit `()`.

## Resolver (apps/identity/resolvers/permission.py)
- Fail-closed: inactive/deleted users → empty; only `status="active"` memberships; active non-deleted roles; `granted=True` role-permissions; active non-deleted permissions.
- Org namespacing: org-scoped roles apply only in their org; without org context only global roles apply. Groups resolved via live `GroupMember` rows (M2M traversal ignores through-model `is_deleted`).
- NOTE: most RBAC domain managers do NOT exclude soft-deleted rows (only SoftDeleteManager does; OrganizationMembershipManager is a plain Manager) — every hop filters `is_deleted=False` explicitly.

## Cache invalidation (Phase 7)
- `PermissionCacheService.invalidate_by_id / invalidate_role_holders(_by_id) / invalidate_group_members / invalidate_permission_holders`, wired via the existing `invalidate_cache` hook in Role/UserRole/GroupRole/GroupMember/Membership/Permission/User services. Revocation effective immediately (proven by `test_permission_revocation.py`).
- Deleted `identity/cache/permission.py`, `identity/authorization/cache.py` (zero callers), 7 unused `core/api/permissions/*` modules + 3 empty placeholders. `IsStaff` (core) kept — established pattern for global catalog/settings writes.

## Surface gates (Phase 5)
- Analytics KPIs/departments + billing GET: `has_organization_access()` (staff/superuser or live membership), 404 otherwise — previously any authenticated user could read any org by header.
- Org settings PATCH requires UPDATE (was VIEW); invitation accept/decline = invitee email-match OR invitation-UPDATE grant (strangers 404 via scoping); project-member POST requires staff/superuser/ADMIN-priority membership; task bulk_assign (member assignee, org-owned team), bulk_status (validated), bulk_delete (per-instance soft-delete); `?include_deleted` requires DELETE grant; `resolve_organization` first-membership fallback removed.
- Adopted postures (ADR-0032, do not "fix" without product decision): org-wide access within a tenant (no per-project RBAC); intelligence writes + audit reads membership-gated; audit retry/cancel/resolve need `audit:update` (new codes, seeded); masterdata catalog + settings theme/flag writes staff-only via new `StaffWritesRequiredMixin`.

## Real bugs found during implementation (beyond the audit)
- `IsOrganizationOwner` filtered nonexistent `is_owner` field (FieldError if called) → ADMIN-priority check. `RolePriority` has NO owner value.
- `InvitationService.accept/decline` omitted required model `user` arg (TypeError) → pass `request.user`.
- `MembershipService.suspend/accept/reactivate` called model methods that didn't exist (AttributeError) → added transitions to the model.
- `RoleService.grant_permissions` didn't flip `granted=False` rows back on re-grant → fixed + test.
- `validate_email_verified` doubly broken (wrong attr, inverted logic) → fixed as opt-in primitive, NOT wired into login (verification is not a login gate).

## Audit false positives corrected (Appendix B of authorization.md)
- Serializer `created_by` is in `Meta.exclude` (not writable). `instance.delete()` soft-deletes (only queryset `qs.delete()` hard-deletes).

## Test infra (reuse these)
- `apps/organization/tests/rbac_helpers.py`: `grant_permissions(user, *codes, organization=None)`, `grant_all_known_codes(user)`, `all_known_permission_codes()` (introspects 7 constants modules + audit), `ensure_permission()` (derives unique module/action; IntegrityError fallback).
- All 6 `staff_client` fixtures now attach full grants (staff resolves like everyone else). `backend/conftest.py` autouse cache-clear (permission cache is process-global locmem; PKs collide across rolled-back tests).
- 60+ new tests: `test_has_permission_gate.py`, `test_permission_revocation.py`, `test_invitation_actions.py`, `test_plain_view_gates.py`, `test_task_bulk_authorization.py`, `test_authorization_negatives.py`, +2 member-management tests in `test_contract_compat.py`.

## Gotchas (do not repeat)
- `StaffWritesRequiredMixin` MUST be first in viewset bases — after `BaseViewSet` the MRO finds `GenericAPIView.get_permissions` first and the mixin silently never runs (caught by test).
- `update_or_create` on managers with `select_related` joins fails on Postgres (`FOR UPDATE` + outer join) — use get-then-save in helpers.
- `Permission` unique `(module, action)` vs code-keyed rows: derive distinct pairs per code.
- Headerless legacy nested routes now 404 (fail-closed); tests must send `X-Organization-Id` (`credentials()` persists per test, or `**_hdr(parent)` per call).
- `OrganizationMembershipFactory` default role has sequential priority (NOT admin); admin tests must set `priority=RolePriority.ADMIN` explicitly.

## Verification
- `manage.py check` clean; full backend suite 2000 passed / 1 skipped; ruff clean on all touched files; `makemigrations --check` clean.

## Follow-ups / accepted variance
- v2.1.0 tag predates CI-fix commits 27b0058 (docs links + ruff) and b0f7ae3 (timezone freeze) — consider v2.1.1 if a clean tag is wanted.
- Archive/restore code mapping stays inconsistent (UPDATE vs DELETE) — cosmetic, recorded.
- Per-project RBAC, email-verification login gate, PostgreSQL RLS: explicit non-goals.
