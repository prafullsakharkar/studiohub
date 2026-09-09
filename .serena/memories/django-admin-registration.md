# Django admin full registration (completed, pushed 5337787, 63 files)

## Inventory: 10 apps, 83 concrete models, 83 registered (was 41)
- Missing 37 + Tag/Attachment/IPBlacklist/Profile/UserMFA/org user_preference/user_session had config files NEVER LOADED (admin/__init__ didn't import them — Django autodiscovery only imports the package). Fixed all __init__ wiring.
- New: core/admin/base.py `StudioHubModelAdmin` (auto audit readonly); organization/admin/base.py `OrganizationScopedAdminMixin` + `OrganizationScopedModelAdmin` (get_queryset scoping by membership orgs, superuser bypass, fail-closed; org dropdown scoping; `organization_lookup` for junctions like role__organization/delivery__organization/resource__organization; `include_null_organization` for Role).
- Mixin applied to ALL org-scoped admins incl. audit (8) + settings (4). Identity models unscoped (platform security data, staff-only gate). Person/UserPreference/Permission/Organization unscoped (no org link).
- Secrets: OAuth access/refresh/client_secret + totp_secret EXCLUDED from admin forms entirely (PersonalAccessToken hashed_token stays readonly — one-way hash, existing precedent).
- New packages: production (11), deliveries, publishing, scheduling, intelligence admin with search/filter/autocomplete/list_select_related/date_hierarchy.
- Tests: core test_admin_registry (discovery w/ INTENTIONALLY_UNREGISTERED mechanism, no-dupes, URL resolution, class load, secrets, searchability) + org test_admin_isolation (8 scoping tests). 14 new tests.
- Verification: 1615 passed, 1 pre-existing skip; ruff clean (isort --fix on 21 files); check clean; makemigrations --check clean.
- Docs: docs/admin/DJANGO_ADMIN.md.
