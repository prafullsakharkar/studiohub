# Frontend Entity → Django Model Data Mapping (Phase 2, refreshed 2026-09-12)

Source datasets: `studiohub-react/src/mocks/db/**` (frontend unchanged since 2026-09-10).
Rows flipped by P0-2/P1-1/P1-2 implementations are marked **[FLIP]** with code evidence.
Corrections from code verification are marked **[CORR]**.

## Global transformation rules

| # | Rule |
|---|------|
| T1 | Mock `id` (`org-apex-01`, `proj-001`, …) is **never** the DB key. DB key is UUID `id`. Mock ids resolve only as lookups (org `resolve_by_lookup`; entities id-or-`code` iexact). |
| T2 | Natural dedupe key `(organization[, project], code)` via `update_or_create`. |
| T3 | `camelCase → snake_case` on every multi-word field. |
| T4 | Denormalized `*_name/*_code/*_avatar` display fields are read-only serializer derivations. |
| T5 | Status words map on compat aliases only (invitations `Revoked→cancelled`, output `Pending\|Accepted\|Expired\|Revoked`; api-keys/PATs `status↔is_active`). DB keeps lowercase/boolean. |
| T6 | Mock user refs resolve to User FKs by email at seed; unknown ids ignored, never 500. |
| T7 | Mock `is_deleted` rows preserved as soft-deleted fixtures (restorable, never duplicated). |

## Organization domain

| Frontend Entity | Django Model | Key mappings |
|---|---|---|
| Organization | `organization.Organization` + `OrganizationBilling` | tier/quota/usage derived; billing auto get_or_create |
| OrganizationMembership | `organization.OrganizationMembership` | `serialize_frontend_membership` shape; header org ignored (user-scoped) |
| User | `identity.User` + `Profile` | names→profile, `fullName→display_name`, avatar, membership-derived role/perms |
| Department / Team / Office / Position | `organization.*` | direct; bare-array lists; id-or-code |
| Person | `organization.Person` | **[FLIP]** `fullName←name`; **nullable `organization` FK** (`backend/apps/organization/models/person.py:23`); scoped reads fail-closed, legacy NULL-org rows visible as documented global-directory exception (`backend/apps/organization/api/viewsets/person.py:16,54-55`) |
| Client / Vendor (+contacts/contracts) | `organization.Client/Vendor` + contact/contract models | `unique (org,code)`; nested routes inject parent+org server-side |
| Invitation | `organization.Invitation` | T5; `resend/accept/decline`; `unique (org,email) WHERE pending` |
| Role / Group / Permission / APIKey / PAT (+junctions) | `organization.*` | Role `unique (org,code)`; Permission `code` global; APIKey/PAT T5 |
| WorkCalendar / WorkHours / Calendar / Holiday | `organization.*` | direct; bare arrays |
| Billing | `OrganizationBilling` | real (`BillingView` get_or_create, PATCH staff-only) |
| Reports / Notifications | — (no models; `[]` stubs) | live callers (`organizationApi.ts:595,600`) render empty — P1-4 triage surface |

## Production domain

| Frontend Entity | Django Model | Key mappings |
|---|---|---|
| Project | `production.Project` | supervisor/coordinator/client/vendor name→FK resolution; `statistics/` counts |
| Sequence / Shot / Asset / Task | `production.*` | `project_code→project`; `start/end_frame→frame_in/out`; names→FKs; `unique (project,code)`; archive/restore semantics per union envelope |
| Timelog | `production.Timelog` | task/project/person code→FK; default order `-date,-created_at` |
| Version | `production.Version` | entity/shot/asset/task/artist FKs; `publish/unpublish/archive/promote/add-to-playlist` |
| ReviewSession | `production.Review` | JSON nests direct; 13 actions; no `client_only` |
| MediaItem | `production.Media` | bare-array list; no status field |
| Playlist | `production.Playlist` | paginated list; `client_only/share_settings/is_archived`; 6 actions |
| Workflow | `production.Workflow` | nodes/transitions JSON; 5 actions; legacy `automation_rules` JSONField retained (no longer the rules store) |
| ProjectMembership | `production.ProjectMembership` | `unique (project,user)`; email→user FK, unknown→404 |
| EditorialCut / ProjectNote | `production.*` | code→project; entity/author mappings; natural keys |
| DeliveryPackage (+destinations) | `deliveries.*` | **[FLIP]** read-shape vocab mapped (`Prepared→Ready`, `Complete→Completed`, `backend/apps/deliveries/api/serializers/delivery.py:13-16`); destination write-only aliases `rate/region` (`destination.py:13-18`); `code` stays **global-unique** (watch item vs per-org natural keys elsewhere); retry semantics tested |
| PublishItem (+destinations/rules) | `publishing.*` | **[FLIP]** `STATUS_OUTPUT_MAP` (`Pending→Queued`, `Validated/Exported→Published`, `Cancelled→Unpublished`, `backend/apps/publishing/api/serializers/publish.py:13-28`) + `PublishRetrySerializer` (`publish.py:213-217`) |
| AuditLog / Activity (+6 more) | `audit.*` | flat alias maps `target_*→entity_*`, `metadata→changes_diff`; append-only; `activity/` compat alias routed (P1-3) |

## Other domains

| Frontend | Django | Notes |
|---|---|---|
| Scheduling resources/events/schedules/leaves/holidays | `scheduling.*` | bare arrays, real, org-scoped; capacity/overbooking computed by selectors over these models (no new models); resolve flags excess bookings `Overbooked` |
| Settings UI (schema/layout, no hooks) | `settings.*` | no contract; `settings/pipeline/` intentionally absent |
| Knowledge docs | `intelligence.KnowledgeDocument` | `unique (org,slug)`; like/link real |
| AutomationRule / AutomationAuditLog | `production.AutomationRule` / `production.AutomationAuditLog` | org-scoped rules CRUD (nested-trigger serializer; mock workflow ids ignored); append-only logs via `services.automation.log_execution` (no write endpoint) |
| Global search, AI chat/risks/summaries, analytics dashboard | — (stub views, no models except knowledge) | DOCUMENTED-STUB — triage verdicts in REAL_API_GAPS P1-4 |
| SavedSearch / RecentSearch | `intelligence.SavedSearch` / `intelligence.RecentSearch` | org+user-scoped; server-set owner; blank recent query → 400 |
| Attachments | `core.Attachment` | **[CORR]** compat `/api/v1/attachments/` confirmed bare array (`pagination_class=None`, `backend/apps/core/api/viewsets/attachment.py:60`); canonical `/api/v1/core/attachments/` paginated is EXTRA. Entity link via metadata/`storage_key`; frontend `entity_type/entity_id` still need mapping layer (P2-3) |
| Tags | `core.Tag` | `name` global-unique; no frontend caller (EXTRA) |
| Master-data family (software/versions/statuses/task-types/asset-types/shot-types/review-types/file-types, platform + org-scoped) | **[FLIP]** `masterdata.*` — `Software`, `SoftwareVersion`, `MasterStatus`, `MasterTaskType`, `MasterAssetType`, `MasterShotType`, `MasterReviewType`, `MasterFileType` (`models/catalog.py:13-117`); `Organization{Software,Status,TaskType,AssetType,ShotType,ReviewType}Config` (`models/config.py:13-128`); `Platform{Role,Group,Department,Position}` (`models/platform.py`); `CatalogModel(scope GLOBAL/ORGANIZATION)` + `OrgConfigModel` bases (`models/base.py:16-78`) | Largest gap closed; 11 API tests green |
| Show | — | Epic-deferred |

## Known non-matches (intentional, do not "fix" from the backend)

- Playlists/roles/permissions mock-side shape quirks: backend follows typed contract; owner sign-off required.
- `settings/pipeline/`, review `client_only`, reviewer-name search: no callers.
- Flat `audit/` POST: append-only, unrouted.
- Show entity/routes: no model — roadmap epic.
- Master-data resolved this pass (was listed here as missing).
