# Frontend Entity → Django Model Data Mapping

Source datasets: `studiohub-react/src/mocks/db/**` (seeded via `seed_studiohub`,
idempotent `update_or_create`/`get_or_create` on natural keys).

## Global transformation rules

| # | Rule |
|---|------|
| T1 | Mock `id` (`org-apex-01`, `proj-001`, `cli-001`, …) is **never** the DB key. DB key is UUID `id` (+`uuid` alias). Mock ids resolve only as **lookups** (org: `resolve_by_lookup` id/code/slug/mock-id; entities: id-or-`code` case-insensitive). |
| T2 | Natural dedupe key is `(organization[, project], code)` via `update_or_create`. |
| T3 | `camelCase → snake_case` on **every** multi-word field (`clientName→client_name`, `dueDate→due_date`, `fileSizeMb→file_size_mb`, …). |
| T4 | Denormalized `*_name/*_code/*_avatar` display fields are read-only derivations added by list/detail serializers (e.g. `project_code←code`, `supervisor_name`, `assigned_artist_name`). |
| T5 | Status words map on compat aliases only: invitations input `Revoked→cancelled`, output `Pending|Accepted|Expired|Revoked`; api-keys/PATs `status↔is_active` (`Active|Revoked`). DB keeps lowercase/boolean. |
| T6 | Mock user refs (`usr-001`, `supervisor_id`, `person_id`, …) resolve to User FKs by email at seed time; unknown display-ids are ignored, never 500. |
| T7 | Mock `is_deleted` rows are preserved as soft-deleted fixtures (restorable, never duplicated). |

## Organization domain (`mockOrganizations`, `mockUsers`, `organization.ts`, `workspaceData.ts`, `clientVendorDetails.ts`)

| Frontend Entity | Django Model | Key mappings |
|---|---|---|
| Organization | `organization.Organization` + `OrganizationBilling` (tier/quota/usage) | `code/slug/name/headquarters/email/primary_contact_name` direct; `tier/logo_url/crew_count/offices_count/active_projects_count/storage_*` derived by serializer; billing seeded with plan defaults |
| OrganizationMembership | `organization.OrganizationMembership` | `userId→user FK`, `organizationId→organization FK`, `role/permissions/status/is_primary/department` direct-ish; list shape via `serialize_frontend_membership` (`user_id/organization_id/organization_name/organization_code/status`); header org ignored (user-scoped) |
| User | `identity.User` + `Profile` | `firstName/lastName→profile`, `fullName→display_name‖first+last‖email`, `avatarUrl→avatar.url‖None`, `role/permissions/organization_id/department→membership-derived`; email lowercased on login |
| Department / Team / Office / Position | `organization.*` (org FK + code) | direct; detail id-or-code; bare-array lists |
| Person | `organization.Person` | `fullName←name` (`source="name"`); org/team/role/skills/timezone are compat-derived defaults; paginated |
| Client / Vendor | `organization.Client/Vendor` (`unique (org,code)`) | direct; contacts/contracts nested under `/clients/<pk>/contacts\|contracts` (same for vendors) |
| Invitation | `organization.Invitation` | T5 mapping; `resend/accept/decline` actions |
| Role / Group / Permission / APIKey / PAT | `organization.*` | direct; Role `code` slug-global-unique, Permission `code` global (`projects:create`); APIKey/PAT T5 mapping |
| WorkCalendar / WorkHours / Calendar / Holiday | `organization.*` | direct; bare arrays; id-or-code |
| Billing / Reports / Notifications | `OrganizationBilling` / — / — | billing GET (auto get_or_create) + PATCH staff-only; reports/notifications have **no model → `[]`** |

## Production domain (`mockProjects`, `mockSequences`, `mockShots`, `mockAssets`, `mockTasks`, `mockTimelogs`, `mockVersions`, `mockReviews`, `mockMediaAssets`, `mockPlaylists`, …)

| Frontend Entity | Django Model | Key mappings |
|---|---|---|
| Project | `production.Project` (`unique (org,code)`) | `supervisor_id/_email/_name→supervisor FK` (staff fallback), same for coordinator; `client_id/_name/contact_*, vendor_ids/names/team_ids` direct; read adds `project_code/supervisor_name/coordinator_name`; `GET {id}/statistics/` → counts dict |
| Sequence | `production.Sequence` | `project_code→project FK` (fallback first org project); `start_frame→frame_in`, `end_frame→frame_out`; `lead_artist_id→lead_artist FK`, `lead_artist→lead_artist_name`; read adds `project_id/project_code/project_name/shots_count/lead_artist_id` |
| Shot | `production.Shot` | `project_code→project FK`; `sequence_code` direct (+`sequence` query alias); `assigned_artist_id→assigned_artist FK`; `pipeline` JSON direct; read adds `project_id/project_code/frame_count/assigned_artist_id/_name` |
| Asset | `production.Asset` | `project_code→project`; department/team/assignee names→FKs where applicable; read adds `project_*/department_*/team_*/assigned_artist_*/parent_asset_id` derivations |
| Task | `production.Task` | `projectCode/entityCode→project/entity FKs+codes`; `assigneeId/reviewerId/teamId/vendorId→assignee/reviewer/team/vendor` FKs/fields; `dueDate/estimatedHours/loggedHours→due_date/estimated_hours/logged_hours`; query aliases `project_id/team_id/assignee_id` (UUID), `vendor_id` (iexact); body `bulk-assign` takes `task_ids+assignee_id/team_id` |
| Timelog | `production.Timelog` | `task_id/task_code→task FK` (code org-scoped), `project_id/project_code→project FK`, `person_id→person FK` (defaults to request user); `durationHours/activityCategory/hourlyRateUsd→duration_hours/activity_category/hourly_rate_usd`; default order `-date,-created_at` |
| Version | `production.Version` | `versionNumber→version_number`, `entityType/Id/Code/Name→entity_*`, `shotId/assetId/taskId→shot/asset/task FKs`, `artistId→artist FK`, `isPublished/isHero/isArchived→is_published/is_hero/is_archived`, `fileSizeMb/startFrame/endFrame/publishingInfo/mediaItems/notesList→snake_case`; actions `publish/unpublish/archive/promote/add-to-playlist` |
| ReviewSession | `production.Review` | `supervisorVerdict→supervisor_verdict`, `leadReviewer→lead_reviewer FK + lead_reviewer_name`; `reviewers/comments/notes/annotations/activity/versions` JSON direct; `participant-verdict` body `{participant_id→reviewers[].id/user_id, verdict, notes→verdict_notes+verdict_date}`; **no `client_only`** (Playlist field) |
| MediaItem | `production.Media` | `fileName/mediaType/fileFormat/storageTier/sourceUrl/previewUrl/thumbnailUrl/fileSizeMb/entityType/entityId/projectId→snake_case + FKs`; bare-array list |
| Playlist | `production.Playlist` | `projectId→project FK`; `clientOnly/shareSettings/isArchived→client_only/share_settings/is_archived`; `entries[]` JSON; actions `add-entry/remove-entry/reorder/share/archive/restore`; list **paginated** |
| Workflow | `production.Workflow` | `nodes/transitions` JSON direct; `simulate/clone/activate/deactivate/archive`; automations **no model → stub echoes** |
| ProjectMembership | `production.ProjectMembership` (`unique (project,user)`) | `userId/user_id/email→user FK` (unknown email → 404), `role/roles/scope/status` direct; POST 201 new / 200 existing; GET `{count,results}` |
| EditorialCut | `production.EditorialCut` | `project_code→project` (uppercased); `sequenceCode/cutType/durationFrames/durationTc/startTc/endTc/sourceEdlFilename/xmlManifestUrl/totalShotsInCut/matchedVfxShots/unmatchedShots/editorialNotes/editorName/conformedBy/burnInLut/thumbnailUrl→snake_case` |
| ProjectNote | `production.ProjectNote` | `project_code→project`; `entityType/Id/Code/Name→entity_*`; `authorName/authorAvatar/authorRole→author_*` (author defaults to request user); natural key `(org,project,subject,entity_code)` |
| DeliveryPackage | `deliveries.DeliveryPackage` | `projectId→project FK`, `clientId→client FK`; `entityCode→entity_code`; status flow via 8 detail POST actions |
| PublishItem | `publishing.PublishItem` | `projectId→project FK`; `entityCode→entity_code`; 4 detail POST actions |
| AuditLog (flat `/api/v1/audit/`) | `audit.AuditLog` | `target_type/target_id/target_name→entity_type/entity_id/entity_code`; `actor→user_id/user_name (profile.display_name‖email)/user_email`; `metadata→changes_diff`; UPPERCASE `action` filter matched iexact against lowercase DB choices; list-only (append-only) |

## Other domains (compact)

| Frontend | Django | Notes |
|---|---|---|
| Scheduling resources/events/schedules/leaves/holidays | `scheduling.*` | direct; bare-array lists; CRUD + `update-status/book/block/approve/reject`; capacity/overbooking aggregates are stubs |
| Settings categories/definitions/flags/themes/localizations | `settings.*` | direct; `settings/pipeline/` intentionally absent (mock-only, no caller) |
| Audit resources / Activity | `audit.*` | read-only; flat alias maps shape per row above |
| Knowledge docs | `intelligence.KnowledgeDocument` | `slug/project_code/category` direct |
| Attachments | `core.Attachment` | entity link via metadata; canonical paginated + `/api/v1/attachments/` bare compat |
| Tags | `core.Tag` | `name` global-unique |

## Known non-matches (intentional, do not "fix" from the backend)

- Playlists / roles / permissions mock-side shape bugs (mock returns paginated, typed callers expect bare for roles/permissions and paginated for playlists): backend follows the **typed contract**; needs owner sign-off before either side changes.
- `settings/pipeline/`, review `client_only`, reviewer-name search: no callers — not implemented.
- Flat `audit/` POST: append-only — not routed.
- Show entity/routes: no model — see `docs/13-roadmap/show-production-context-epic.md`.
