# Filtering Contract

## General Rules

- Filters are query parameters on LIST endpoints only.
- Reserved params never treated as field filters: `page`, `page_size`, `limit`, `offset`,
  `search`, `ordering`.
- Mock behavior (`applyFiltersAndSearch`): any non-reserved param does a case-insensitive
  **exact match** against the item field; items missing the key pass. Real FilterSets must
  declare each supported parameter explicitly (below); undeclared params should be ignored
  by DRF, which is acceptable.
- Boolean-ish filters arrive as strings: `'true'` / `'false'` (e.g. `billable`,
  `client_only`, `is_published`, `is_archived`, `is_active`). The tasks module also uses
  an `'ALL'` sentinel meaning "no filter".

## Per-Domain Parameters

### Projects `/api/v1/projects/`
`status`, `type`, plus generic exact-match fields; `search`; `ordering`.

### Shots `/api/v1/shots/`
`project_id`, `status`, `sequence_code`; `search`.

### Assets `/api/v1/assets/`
`project_id`, `category`, `status`, `department_id`; `search`.

### Tasks `/api/v1/tasks/`
`project_id`, `entity_type`, `entity_id`, `department`, `team_id`, `assignee_id`,
`vendor_id`, `status`, `priority`, `is_archived` (`'ALL'` sentinel honored; archived
hidden by default).

### Timelogs `/api/v1/timelogs/`
`task_id`, `person_id`, `project_id`, `status`, `billable` (`'true'/'false'`),
`start_date` (≥), `end_date` (≤). Results always sorted `date` descending unless
`ordering` overrides.

### Versions `/api/v1/versions/`
`project_id`, `entity_type`, `entity_id`, `department`, `status`,
`is_published` (`'true'/'false'`).

### Reviews `/api/v1/reviews/`
`project_id` (matches id or code), `entity_code`, `status`, `client_only='true'`.

### Media / Attachments / Playlists
- media: `entity_type`, `entity_id`, `media_type`, `project_id`
- attachments: `entity_type`, `entity_id`, `category`
- playlists: `project_id`, `client_only='true'`, `status`

### Workflows / Automations
- workflows: `project_id`, `project_code`, `category`, `is_active`, `department`
- scheduling events: `project_id`, `project_code`, `event_type` (**comma-separated
  multi-value**), `department`, `office_id`, `assignee_id`
- scheduling resources: `type`, `department_id`, `office_id`, `status` (→
  availability_status), `is_overbooked='true'`

### Organization (legacy flat)
- organizations: `status`, `tier`, `location`
- clients/vendors/people/departments/teams/offices: generic exact-match fields as used by
  pages (e.g. `department_id`, `office_id`, `organization_id`)
- namespaced v2 tree: use backend FilterSets already defined in
  `apps/organization/api/filtersets/`

### Audit `/api/v1/audit/`
No dedicated params beyond `search` in the mock; backend FilterSet supports more.

## Backend Mapping

| Contract feature | Django mechanism |
|---|---|
| Exact-match field filters | `django-filter` `FilterSet` fields |
| Multi-value comma lists | custom `BaseInFilter` / `CSVFilter` |
| `'true'/'false'` booleans | `BooleanFilter` with string coercion |
| Date ranges (`start_date`/`end_date`) | `DateFromToRangeFilter` |
| Soft-delete visibility (`is_archived`) | queryset default exclusion + explicit filter |
| Reusable bases | `apps/core/filters/` mixins (`SearchFilterMixin`, `OrderingFilterMixin`, `DateRangeFilterMixin`, `StatusFilterMixin`, `OrganizationFilterMixin`, `SoftDeleteFilterMixin`) |

Global `filter_backends` are already configured
(DjangoFilterBackend, OrderingFilter, SearchFilter) in
`config/settings/components/drf.py`.
