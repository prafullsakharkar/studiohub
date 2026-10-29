# Organization Workspace: Consistent Card/Table Views + CRUD — Design

Date: 2026-10-08
Status: approved in chat (architecture A, CRUD-tabs-only scope, backend+frontend pagination)
Path: architectural (superpowers/brainstorming)

## 1. Outcome and scope

Every list-bearing Organization Workspace tab that supports mutations gets a
consistent Card View and Table View with a persisted toggle and complete CRUD,
built on the existing StudioHub shared stack. No new architecture, no per-tab
UI forks.

In scope (mutations exist): people, departments, teams, positions, offices,
clients, vendors, projects, work-calendars, calendars, holidays, DCC software,
lifecycle statuses, pipeline task types, asset/shot/review/file types,
API keys, personal access tokens, roles, groups, users.

Out of scope (read-only or single-form, unchanged): overview, profile,
branding, settings, general, work-hours, permissions catalog, master-data
simulation, activity feed.

## 2. Architecture (approach A: adopt, don't build)

Each CRUD tab keeps its data hooks, mutations, create/edit modals, detail
navigation, and workspace integration untouched. Only the list presentation
layer is replaced:

```
<Tab> → per-tab entity config → ProductionView (table + grid modes)
      → existing create/edit modals (unchanged)
      → DeleteDialog / ArchiveDialog (existing shared)
```

All per-tab variance lives in one entity config object colocated with the
tab, e.g.
`src/modules/organization/components/tabs/configs/departmentsConfig.ts`:

- `entityType` (drives saved-view + pagination storage keys)
- `FieldDefinition[]` (columns; `render` overrides only for genuinely
  custom cells such as software-stack chips or portal quick-jumps)
- card field allowlist: title, subtitle, badges, meta rows, actions
- search placeholder, filter definitions, default sort
- permission strings (`*.create/update/delete`, resolved against the
  existing `definitions/*Definition.ts` matrices — no new strings)
- create/edit/delete wiring (existing mutation hooks + modal components)
- detail navigation (existing `openTab` + route)

Reused as-is: `ProductionView` (view-mode switcher, saved views, column
visibility, selection, bulk toolbar), `EntityTable`/`TableView` (search,
sort, server-mode pagination props), `GridView` with one shared card
renderer, `DeleteDialog`/`ArchiveDialog`, `EmptyState`, `Button`
permission props, `BulkActionBar`, `usePersistedPagination`.

Explicitly NOT built: `EntityViewToggle`, `EntityCard`, `EntityCardGrid`,
`EntityTable`, `EntityToolbar`, `EntityFilters`, `EntityActions`,
`EntityDetail`, `DeleteConfirmation`, `EntityEmptyState` as new components —
the named shared equivalents above already exist and are used instead.

## 3. Per-tab mapping

- Cards today (departments, teams, offices, clients, vendors, projects,
  work-calendars, master-data catalogs): content maps 1:1 into shared card
  renderer fields; custom bits become config `render` overrides.
- Tables today (people, positions, holidays, api-keys, pats, statuses):
  columns map to `FieldDefinition[]`; row click keeps existing detail
  behavior via `onRowClick`.
- Split list+inspector (roles, groups, users): only the left list becomes
  the unified table; the right inspector follows selection unchanged.
- `deletable: false` configs (clients, vendors, catalogs): View/Edit only.
- Edit appears only where an edit form exists; otherwise create-only flow
  is preserved.
- Behavior fix included: deletes that currently skip confirmation
  (calendars, holidays, work-calendars) route through `DeleteDialog`.

## 4. Backend changes (studiohub repo)

`apps/organization/api/viewsets/legacy.py` (+ `Compat*` aliases):
nested routes switch `pagination_class None → StandardPagination`;
per-resource `search_fields` / `ordering_fields` (name, code, city,
country, title as applicable); add missing `FilterSet`s (department,
seniority, facility, status). Backward compatibility: pagination applies
only when the request carries paging params; bare-array responses are
preserved otherwise, so existing consumers keep working. Frontend passes
`search` / `ordering` / `page` / `page_size` through the existing
`organizationApi` params into `EntityTable` server mode.

## 5. Permissions

Tab visibility and route guards unchanged. New in-tab enforcement from the
existing definition matrices: Create hidden without `*.create`; Edit/Delete
row and bulk actions hidden without `*.update` / `*.delete`
(`BulkActionBar.canPerform` for bulk). No new permission strings.

## 6. Preferences

Per-section, per-user persistence reuses existing keys — no new storage:
`studiohub_saved_views_v1` (view mode + saved views),
`studiohub_pagination_prod_view_<entityType>` (page + page size).
Column visibility and sort persist through the same saved-view mechanism.
`SavedViewsBar` ships collapsed/secondary; the primary affordance is the
Card/Table toggle.

## 7. Testing and rollout

1. Config-validation contract test per tab (required fields, permission
   strings resolve, detail routes exist).
2. Existing suites stay green; DOM-role query updates from cards→table
   migration are part of the work (`TeamDepartmentOfficeForms`,
   `PositionsTab*`, selector tests).
3. Playwright UI pass per converted tab, admin + restricted role: toggle
   persists across reload; create/edit/delete round-trip; search/filter/
   sort hit the server (asserted via network); gated actions hidden.
4. Rollout batches, each independently verifiable: (0) backend pagination,
   backward-compatible; (1) departments + people; (2) teams + offices +
   positions; (3) remaining catalogs + access sections.
5. `tsc --noEmit` clean and full `vitest run` green at every batch.

## 8. Non-goals

New design system, new table/card architecture, per-tab bespoke patterns,
touching read-only tabs, new permission strings, client-side-only
pagination (rejected: user chose backend+frontend server pagination).
