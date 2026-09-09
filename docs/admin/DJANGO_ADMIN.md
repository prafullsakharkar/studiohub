# StudioHub Django Admin

## Architecture

Each backend app owns an `admin/` package mirroring the API layout:

```text
apps/<domain>/admin/
├── __init__.py        # imports every admin class (required for autodiscovery)
├── base.py            # shared per-app admin bases (organization only)
└── <model>.py         # one ModelAdmin per model (grouped where cohesive)
```

Django autodiscovery imports `<app>.admin` for every installed app, so every
admin class **must be reachable from the package `__init__.py`**. Files that
are not imported there never load (this previously left Tag, Attachment,
IPBlacklist, Profile, and UserMFA unregistered despite having config files).

Shared bases (reuse before reinventing):

| Class | Location | Purpose |
|---|---|---|
| `StudioHubModelAdmin` | `apps/core/admin/base.py` | Auto-marks audit/system fields (`id`, `created_at`, `updated_by`, …) read-only when present |
| `OrganizationScopedAdminMixin` | `apps/organization/admin/base.py` | Tenant isolation for admin rows + organization dropdown |
| `OrganizationScopedModelAdmin` | `apps/organization/admin/base.py` | Mixin + base combined, for directly-owned models |

Core stays domain-neutral: it must never import business domains, so all
organization awareness lives in the organization app, which every domain app
already depends on.

## Registered apps / models

All 10 StudioHub apps are covered (83 concrete models, 0 missing):

- **core**: Attachment, Tag
- **identity**: BackupCode, IPBlacklist, KnownDevice, LoginAttempt, OAuthAccount, OAuthProvider, Profile, SecurityEvent, TrustedDevice, User, UserMFA
- **organization**: APIKey, OrganizationBilling, Branding, Calendar, Client, ClientContact, ClientContract, Department, Group, GroupMember, GroupRole, Holiday, Invitation, OrganizationMembership, Office, Organization, OrganizationSettings, Permission, Person, PersonalAccessToken, Position, Role, RolePermission, Team, UserPreference, UserRole, UserSession, Vendor, VendorContact, VendorContract, WorkCalendar, WorkHours
- **settings**: FeatureFlag, Localization, OrganizationSetting, SettingCategory, SettingDefinition, SystemSetting, Theme
- **audit**: Activity, APIRequest, AuditLog, BackgroundJob, ChangeLog, ErrorLog, LoginHistory, Track
- **production**: Asset, Media, Playlist, Project, Review, Sequence, Shot, Task, Timelog, Version, Workflow
- **intelligence**: KnowledgeDocument
- **deliveries**: DeliveryDestination, DeliveryPackage, DeliveryVersionRef
- **publishing**: PublishDestination, PublishItem, PublishValidationRule
- **scheduling**: CalendarEvent, Holiday, Resource, ResourceLeave, ResourceSchedule

Intentionally excluded: Django/contrib internals outside StudioHub's scope
(auth groups/permissions stay at Django defaults). There is currently no
excluded StudioHub model; exemptions live in
`INTENTIONALLY_UNREGISTERED` in
`backend/apps/core/tests/admin/test_admin_registry.py`.

## Organization isolation

`OrganizationScopedAdminMixin`:

- `get_queryset` filters rows to the staff user's member organizations
  (fail closed: no memberships → no rows). Superusers bypass (global access).
- The `organization` dropdown (`formfield_for_foreignkey`) offers only the
  user's organizations.
- Models linked indirectly configure `organization_lookup`
  (e.g. `UserRoleAdmin.organization_lookup = "role__organization"`,
  `DeliveryVersionRefAdmin` uses `delivery__organization`).
- Models with a nullable organization link set
  `include_null_organization = True` (e.g. `RoleAdmin` keeps global roles visible).

Models without any organization link (Identity models, `Person`,
`UserPreference`, `Permission`, `Organization` itself) are staff-only by
Django's own `is_staff` gate and carry no tenant scope.

## Conventions

- One file per model (grouped only where cohesive: `oauth.py`,
  `delivery.py`, `publishing.py`, `scheduling.py`).
- `list_display`: identity columns first (`code`/`name`/`title`), then
  parent links, status fields, timestamps last. No file/binary/JSON blobs
  and no secrets in lists.
- `list_filter`: status/type/boolean flags + `organization` on scoped models.
- `search_fields`: codes, names, emails, and denormalized `*_code`/`*_name`
  fields. Every autocomplete target must define `search_fields`.
- `autocomplete_fields` for FKs to high-volume models (users, projects,
  shots, tasks, clients, vendors…); scoped automatically via the related
  admin's `get_queryset`.
- `list_select_related` on FKs shown in `list_display` (no N+1).
- `date_hierarchy` on high-volume date fields (due dates, start times).
- `readonly_fields`: inherited from `StudioHubModelAdmin` for audit fields;
  declare only business read-only fields per model.
- Reversible secrets (`access_token`, `refresh_token`, `client_secret`,
  `totp_secret`) are `exclude`d from admin forms entirely — never displayed
  or edited. (One-way hashes such as `hashed_token` may stay read-only.)

## How to register a new model

1. Create `apps/<domain>/admin/<model>.py` with a `ModelAdmin` subclass
   (extend `OrganizationScopedModelAdmin` when the model has an
   `organization` FK, `StudioHubModelAdmin` otherwise).
2. Register with `@admin.register(Model)`.
3. Import the admin class in `apps/<domain>/admin/__init__.py`.
4. Run `uv run python manage.py check` (admin system checks validate
   `list_display`, `search_fields`, autocomplete targets, …).
5. The discovery test
   (`apps/core/tests/admin/test_admin_registry.py`) fails for any concrete
   model without registration — either register it or add a reasoned entry
   to `INTENTIONALLY_UNREGISTERED`.

## Performance rules

- Never put JSON blobs, file/image fields, or markdown bodies in
  `list_display`.
- Set `list_select_related` for every FK rendered in the list.
- Prefer `autocomplete_fields` over raw `<select>` for large relations;
  `raw_id_fields` remains available for pathological cases.
- Keep `search_fields` to indexed text columns.

## Running / testing

```bash
uv run python manage.py check          # admin system checks
uv run pytest apps/core/tests/admin apps/organization/tests/admin -q
uv run pytest -q                        # full suite
```

Admin smoke test with a superuser:

```bash
uv run python manage.py createsuperuser  # once
uv run python manage.py runserver        # visit /admin/
```
