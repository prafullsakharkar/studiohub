# MASTER DATA — Global Catalog, Org Overrides, Initialization

## Architecture

```
Global Master Definition   (active platform catalog rows; org-agnostic)
        ↓
Organization Initialization   (baseline seeded on org creation)
        ↓
Organization Configuration    (org-scoped records / per-row overrides)
```

## What a new organization provisions (automatic on create)

- starter roles + permission grants (canonical `DEFAULT_ROLE_SPECS` from
  `apps/organization/constants/default_roles.py`)
- organization settings row
- branding row
- default work calendar (UTC, Mon–Fri)
- org-scoped master-data configs for every enabled global catalog entry
  (statuses, task types, asset types, shot types, review types, file types,
  software)

Global records are never written from a tenant surface.

## Mutation rules

- Global catalog writes: `platform.master_data.configure` grant only
  (superuser break-glass; staff has no privilege).
- Org-level override rows are per-organization and isolated.
- The read path resolves effective values (global default + enabled configs)
  via `apps/masterdata/services/resolution.py`.

## Verified by

- `apps/masterdata/tests/test_organization_initialization.py`
