# Search Contract

## Semantics

Parameter: `?search=<term>`. Behavior everywhere in the frontend/mock contract:

- Case-insensitive substring match (SQL `icontains`) OR-ed across declared fields.
- Applied before pagination.
- Composable with other filters and `ordering`.

## Supported Fields per Endpoint

| Endpoint | Search fields |
|---|---|
| `/api/v1/projects/` | `name`, `code`, `description`, `client_name` |
| `/api/v1/shots/` | `code`, `name`, `description` (+ router also: `sequence_code`, `assigned_artist_name`) |
| `/api/v1/assets/` | `name`, `code`, `category`, `description` (+ `assigned_artist_name` in router) |
| `/api/v1/tasks/` | `title`, `code`, `entity_code`, `entity_name`, `assignee_name`, `department`, `software`, `description` |
| `/api/v1/timelogs/` | `task_title`, `task_code`, `person_name`, `project_code`, `notes` |
| `/api/v1/reviews/` | `title`, `code`, `entity_code`, `lead_reviewer_name` |
| `/api/v1/audit/` | `user_name`, `user_email`, `action`, `entity_type`, `entity_code`, `description` |
| `/api/v1/workflows/` | name/description/category (per page usage) |
| organization flat lists | name/code and equivalent display fields per entity |

Note: where the MSW handler and the mock router disagree on extra fields, the union above
is the safe implementation target (searching more fields than the UI types is harmless;
searching fewer breaks the UI).

## Backend Implementation

Use the shared infrastructure — do not implement search per-app:

- Global `SearchFilter` is already a default backend
  (`config/settings/components/drf.py`).
- `apps/core/filters/SearchFilterMixin` provides `?search=` → icontains OR across
  `search_fields` for FilterSet-based apps.
- For related/denormalized display fields (`assignee_name`, `client_name`…), annotate the
  selector QuerySet (e.g. `SelectRelated` + `Concat` annotations) so `search_fields` can
  reference them — this follows the existing organization app selector pattern and avoids
  N+1 queries.

## Cross-Domain Search (NOT a REST contract)

The intelligence module's saved/global search reads mock data directly through TS imports
(`modules/intelligence/services/*`) — there is no HTTP search endpoint contract today.
Do not build one until that module is wired to HTTP.
