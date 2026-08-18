Custom Fields — Definition, Scope, Storage & Validation

Purpose

Define the custom field model StudioHub supports: scoping, data types, validation, storage and searchability.

Field definition

Each custom field definition should include:
- id, name, label, description
- entity_type (Asset, Shot, Task, Project, etc.)
- scope (organization|project|department)
- data_type (string, text, integer, decimal, boolean, date, datetime, uuid, choice, multichoice, user, team, project, asset, shot, task, url, json, file, duration)
- required (bool)
- default
- validation rules (regex, min/max, range)
- visibility (public/internal/finance)
- searchability (searchable, filterable, sortable, facetable)
- status (active|deprecated)
- owner (data steward)

Storage options & recommendation

- JSONB approach: store custom field values in a JSONB column per entity (e.g., metadata/custom_fields). Pros: flexible, simple. Cons: difficult to index at scale without projections.
- Typed value tables: create typed tables per data_type (custom_field_values_text, _number, _date, _ref) referencing entity and field. Pros: queryable, indexable. Cons: more schema complexity.
- Hybrid (recommended): store raw JSONB as the source of truth and maintain projection tables for fields that are marked searchable/filterable/sortable. Use projection builders in indexing pipeline to populate search index and secondary SQL columns as needed.

Validation & enforcement

- Server-side validation enforced in application services and API layer. Frontend validation is supplementary.
- When a field changes type or options, require a migration plan: validate existing values, provide dry-run, and then migrate or mark legacy values.

Search & indexing

- Only fields with searchability flags should be projected into the search index.
- Maintain a field capability registry (searchable/filterable/sortable/facetable) to drive index schema and projections.

Governance

- Field creation/rename/retire should require role with data stewardship permissions.
- Support dry-run imports and a preview of affected entities prior to committing schema changes.

