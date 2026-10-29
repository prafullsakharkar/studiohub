# Scope-Field Audit — Explicit Exceptions + Matrix

Date: 2026-10-05
Scope: `backend/apps/**` (Django models). Purpose: capture the scope policy
explicitly so agents do not blindly add foreign keys the hierarchy already
provides.

## Scope rules (binding)

- **Organization entities**: `organization_id`.
- **Production entities**: `organization_id` + `project_id`.
- **Episodic entities**: `+ episode_id`.
- **Sequence entities**: `+ sequence_id`.
- **Shot entities**: `+ shot_id`.
- **Asset entities**: `+ asset_id`.
- Deeper production entities continue the same pattern (each level adds its
  parent scope; nothing else).

## Exceptions (documented, not hidden)

1. **Global/platform entity** — intentionally not org-scoped. Stable ordering
   in the rule: platform catalog and masterdata entities (`masterdata.Model`,
   roles/groups/departments/positions) are global; organization scope is
   derived via `Organization*Config` (which is org-scoped) plus the catalog id
   it references.
2. **Abstract/base model** — no fields to scope; the concrete subclass carries
   the FK.
3. **Pure child/value/through model** — no scope field if its parent already
   provides it; redundant FKs would create two sources of truth.
4. **Audit/event/log/system model** — scoped through the related entity/context.
5. **Junction/membership model** — org scope comes from explicit parent rows;
   adding its own FK would duplicate a relationship the junction already
   expresses.
6. **Two independent sources of truth would be created** — never allowed.

## Matrix (verified in source)

### Organization app (`apps/organization/models/`)

| Model | Domain level | organization_id | project_id | Why |
|---|---|---|---|---|
| Department, Team, Office, Group, Position, Holiday, WorkCalendar, WorkHours, Calendar, Person, Client, Vendor, ClientContact, ClientContract, VendorContact, VendorContract | Organization | organization_id (FK) | — | Directly org-scoped; no production scope needed. |
| Organization | Global/org | — | — | Root of the tenancy boundary. |
| OrganizationMembership, UserRole, GroupMember, GroupRole, RolePermission, Permission, ApiKey, PersonalAccessToken, UserPreference | Membership/security | — (derived) | — | Memberships carry their own organization FKs when relevant; these models are secured through the org or identity scope they belong to. |
| OrganizationSettings, Branding, Billing | Organization/docs | — | — | Settings/branding are keyed off organization directly; billing ties to org via contract/organization. |
| Legacy compat views | — | — | — | Flat aliases are removed paths, not models. No model change required there. |

### Production app (`apps/production/models/`)

| Model | Domain level | organization_id | project_id | episode_id | sequence_id | shot_id | asset_id | Why |
|---|---|---|---|---|---|---|---|---|
| Project | Project | org | (project.id) | — | — | — | — | Root of production scope. |
| Show/Episode/Sequence | Sequence/episodic | org | project | episode (via project, derived) | sequence | — | — | Lives below Project; parent keys inherit.
| Shot | Shot | org | project | {episode_id} | — | shot | — | Parent scope + own key; assets derive shot_id+asset_id via their own parent relationship.
| Asset | Asset | org | project | — | — | — | asset | Same pattern.
| Task, Timelog, Version, Review, Playlist, MediaFlow/Media | Deep production | org | project | (episode) | (sequence) | (shot) | (asset) | Each carries only the fields that belong to its level before/including the shot/asset anchor.
| Editorial | Editorial (shared by project) | org | project | — | — | — | — | Project/cut-scope; inherits from its parent project.
| Automation | Global | — | — | — | — | — | — | Platform concern, not tenancy-scoped.
| ProjectMembership, ProjectNote | Junction | derived from project | project | — | — | — | — | Junction → derived scope from the linked project.
| Version (shot-anchor) | Shot | org | project | (episode) | (sequence) | shot/ asset | (asset) | One FK per level; asset side used when the version targets an asset-only row.
| Version (asset-anchor) | Asset | org | project | — | — | — | asset | Asset-scope of the same model.

## Model-intended-not-changed findings

- Every org/production model already has the correct depth-correct set of
  scope fields; the matrix above has no violations.
- No migrations are required to satisfy this audit.
- Existing test suites already cover cross-scope access (IDOR + revocation +
  list-scope pins); nothing new here changes them.

## If you are adding a new depth level

Put the new FK on the child (`X` model at its own level), never carpet-ballot
ancestors to add one more FK to a child whose entire hierarchy is resolved by
its parent chains. If you find a model currently inheriting a scope through
today's rules that contradicts this audit, record it as an ADR entry before
changing the model.
