# StudioHub Seed Data

Canonical command: `uv run python manage.py seed_studiohub --force`

## Source of truth

`studiohub-react/src/mocks/db/**` (resolved via `$STUDIOHUB_REACT_MOCKS`,
sibling `studiohub-react/` checkout, or in-repo `frontend/` fallback).
Frontend mock data is never modified; the one known inconsistency
(`sequences.ts` → project `VEL1`, intent `VEL01`) is normalized at seed time.

## ID strategy (§5)

Backend PKs are UUIDs; mock ids are strings (`proj-001`, `usr-001`). They are
incompatible as keys, so the deterministic mapping is by **natural key**
(org code, project code, entity code). Mock ids resolve through id→code maps
rebuilt from the mock on every run (projects, tasks, users). No broken FKs:
unresolvable references are skipped and reported, never guessed.

## Mock → model → field mapping (abridged; full per-entity detail in
`docs/api/MOCK_DATA_INVENTORY.md`)

| Mock entity (file) | Django model | Natural key | Notes |
|---|---|---|---|
| mockOrganizations | organization.Organization | `code` | slug lowercased; status Active |
| mockUsers | identity.User (+Profile) | `email` | password `password123` (dev only); names from mock |
| memberships[] | organization.OrganizationMembership | `(user, organization)` | role reconciled to mock value on re-run |
| project_memberships[] | production.ProjectMembership | `(organization, project, user)` | role/roles/scope/vendor/client passthrough; restores soft-deleted |
| mockProjects | production.Project | `(organization, code)` | supervisor/coordinator by email; org from mock org id |
| mockSequences | production.Sequence | `(project, code)` | `lead_artist` FK + `lead_artist_name`; mock `is_deleted` → soft-deleted |
| mockShots | production.Shot | `(project, code)` | mock `is_deleted` → soft-deleted |
| mockAssets | production.Asset | `(project, code)` | — |
| mockTasks | production.Task | `(project, code)` | assignee/reviewer by email |
| mockTimelogs | production.Timelog | `(task, person, date, duration)` dedupe filter | `get_or_create` has no DB uniqueness, so pre-existing rows are skipped explicitly |
| mockVersions | production.Version | `(project, code)` | — |
| mockReviews | production.Review | `(organization, code)` | reviewers JSON preserved |
| mockPlaylists | production.Playlist | `(organization, code)` | entries JSON preserved |
| mockMediaAssets | production.Media | `(organization, project, entity_type, entity_id, media_type)` | code/name/title/file_name mapped |
| mockWorkflows | production.Workflow | `(organization, code)` | nodes/transitions preserved |
| mockEditorialCuts | production.EditorialCut | `(organization, project, code)` | — |
| mockProjectNotes | production.ProjectNote | `(organization, project, subject, entity_code)` | author by name (free text) |
| activities (seed_dev) | audit.Activity | `(description, user)` | `metadata.project_id/code` linked post-seed |
| mockClients/Vendors/People/Depts… | organization.* (seed_dev) | code/email per model | unchanged foundation |

## Command options

```bash
seed_studiohub --force [--reset] [--skip-base] [--dry-run] [--skip-validate]
               [--validate-only] [--organizations] [--production]
               [--permissions] [--access] [--content]
```

- `--dry-run`: runs everything inside a rolled-back transaction; prints the
  normal summary with zero writes.
- `--organizations` / `--production` / `--permissions` / `--access` /
  `--content`: run only those overlay phases (dependencies auto-included).
  `--permissions` only ensures the 36-code catalog.
- `--validate-only`: runs relationship/integrity validation, no seeding.
- `--reset`: forwarded to `seed_dev` (destructive; requires `--force`
  outside DEBUG). Default runs never delete.
- `--skip-base`: overlay only (needs existing foundation for FK fallbacks).

Phase order: base → orgs → access-users → production → access-projects →
content → validate. Users are seeded before production so assignees/authors
resolve; project memberships need projects, so they run after.

## Entities, supplemental data, and test users

Supplemental (backend-only, documented here): Django accounts for every mock
user (19; seed_dev covers 4), 9 supplemental global roles (viewer,
client-viewer, auditor, vendor-*, client-admin/producer) with least-privilege
sets, and `metadata.project_id` on activities. Mock display role names map to
existing global roles where semantics match (`Production Manager`→
`vfx-supervisor`, `Producer`→`vfx-supervisor`, `Organization Owner`→
`org-admin`); roles are global by code, so cross-org memberships reuse them.

Test users (all `password123`):

| Email | Orgs (mock) | Highlights |
|---|---|---|
| supervisor@studiohub.vfx | APEX, VNG, WETA | multi-org supervisor; no FSP access |
| admin@studiohub.vfx | APEX, VNG | platform admin |
| lead@studiohub.vfx | APEX (Producer), WETA (Artist) | producer flow |
| artist@studiohub.vfx | APEX only | artist + lead-artist project roles |
| client@studiohub.vfx | APEX | client reviewer, 1 project |
| vendor.artist@cinematrix.vfx | APEX | vendor scope + vendor_id |
| multirole@studiohub.vfx | APEX | multi-role |
| viewer.guest@studiohub.vfx | APEX | read-only viewer |
| compliance.auditor@studiohub.vfx | APEX | audit-focused |
| producer.lead@apex.vfx, owner@apex.vfx, admin.ops@apex.vfx | APEX | producer / owner / ops-admin |

Cross-org contrast: APEX 4 projects, VNG 2, WETA/FSP 1 each; users hold
different roles per org, so tenant leaks are obvious.

## Roles & permissions

36-code catalog (`module:action`, matching frontend checks) seeded by
`seed_dev`; overlay only ensures it exists. Supplemental roles carry minimal
sets (see `SUPPLEMENTAL_ROLES` in the command).

## Reset, idempotency, soft deletes

- Default: preserve everything; create missing; update deterministic rows.
- `--reset`: seed_dev deletes seed-owned rows, then reseeds.
- Soft-deleted rows matching incoming natural keys are **restored** (never
  duplicated); mock `is_deleted` rows are applied as soft-deleted **after**
  seeding, giving permanent restore-flow fixtures (currently 3 sequences +
  2 shots: NK_030, NK_040, AETH_102, NK_010_090, NK_010_099).

## Validation

Post-seed checks (fail the command on criticals): project/org ownership
mismatches across 13 scoped models, project-membership org drift, duplicate
natural keys, permission-catalog coverage vs frontend codes (warning),
membership-less users (warning), project-less orgs (warning).

## Known limitations

- `VEL1`→`VEL01` typo normalization (documented above).
- Timelog natural matching is heuristic (task+person+date+duration).
- Activity→project linkage is heuristic (code/name/context match); 2
  org-level activities intentionally stay unlinked.
- `?mock_error=` simulation stays a frontend test-harness concern.
