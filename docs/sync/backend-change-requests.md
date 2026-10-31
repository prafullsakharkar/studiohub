# Backend change requests

Rule (HARD RULE 1): no backend file is changed without explicit approval. Each entry states the problem, evidence, the minimal proposed diff, and whether a frontend workaround exists. **Status:** entries are PROPOSED unless marked otherwise below. On 2026-10-29 the user approved CR-02, Q-03 and Q-05; they were applied as three separate backend commits (see the table). Everything else is still unapplied.

| ID | Title | Blocks frontend work? | Severity |
|---|---|---|---|
| CR-01 | Stale deprecation registry marks the only directory/RBAC routes as deprecated | No (frontend ignores the headers) | Medium |
| CR-02 | 18 enforced permission codes are never seeded | **APPLIED** (`b728528`): seeded and assigned per Q7 | High |
| CR-03 | `AuditLog` list has no `target_id` filter | Worked around: `/audit/?search=<id>` matches `target_id`; EntityHistory keeps rows whose `entity_id` is the record | Medium |
| CR-04 | ChangeLog does not track several editable models | **Confirmed live (Phase 4):** positions, client/vendor contracts and contacts, catalog rows leave no entry; clients track only some fields | Medium |
| CR-05 | Dev seed commands are broken | No (tests use factories) — but blocks a seeded dev backend for e2e/manual verification | Medium |
| CR-06 | Unmapped methods return 403 instead of 405 on `MethodPermissionMixin` views | No | Low |
| CR-07 | Superuser fallback permission list contains non-catalog codes | No (frontend treats `is_superuser` as all) | Low |
| CR-08 | 19 views missing from the OpenAPI schema; 35 untyped `OBJECT` responses | No (hand-written types from samples) | Low |
| CR-09 | `CONTRACTS.md` states default page size 20; actual 25 | No (doc only) | Low |
| CR-10 | Server-side CSV/Excel export (`?format=csv` on list views; renderers already exist in `apps/core/api/renderers/`) | No (client-side export works up to ~10k rows) | Low — optional |
| CR-11 | httpOnly refresh-token cookie for the SPA | No (refresh token in `localStorage` with XSS hygiene) | Low — optional, security hardening |
| CR-13 | `archive` on projects and shows was missing from the viewsets' permission_map (403 even for a superuser) | **APPLIED** (`archive` only; see the amended entry): `check-existence` on projects/shows turned out to be unimplemented, so it stays fail-closed | Medium — bug |
| CR-14 | A timelog that is not an adjustment accepts negative `duration_hours` | **APPLIED**: 400 unless an adjustment (create and update) | Medium — bug |
| Q-16 | An `artist` can update any task of the project (assignee, status), not only their own | Question for the owner | — |
| Q-17 | Task Board / Calendar / Timeline views were not rebuilt in Phase 6 | Question for the owner | — |
| CR-15 | `archive` is missing from the `permission_map` of the media and review viewsets (403 for everyone, like CR-13) **APPLIED**: media `archive` needs `media.update`, reviews `review.delete` (C-47); the screens now use the `archive` action | Low — bug |
| CR-16 | Missing validation: a review accepts any `status` on create, an empty review comment is saved, any text is accepted as a verdict, media `media_type` is free text, workflow `code` is not unique (a clone repeats `<code>-COPY`) **APPLIED for status, comment text and verdicts** (C-48..C-50); `media_type` stays free text and workflow `code` uniqueness is not enforced (by decision) | Low |
| Q-18 | Automation rules are stored but nothing fires them (`execution_count` is written only by a seed command) and workflow `simulate` is a stub that reports every node a success | Question for the owner: is an engine planned? The screens say what is stored, not what runs | — |
| Q-19 | Playlist sharing is a record only: nothing reads `share_settings` (no public link, passcode check, expiry or client approval exists), and `expires_at` is stored as free text | Question for the owner: is a public review page planned? The share dialog says the flags are only recorded | — |
| CR-17 | The delivery lists (`/deliveries/` and the project route) ignore every filter but `search` and `ordering`: `status`, `client`, `project_id`, `delivery_method`, `destination_id` all answer the same rows | **APPLIED** (`DeliveryFilterSet`, API-DLV-20): the list and the project route filter by status (read or stored words), client, project, destination, method; the list offers the filters | Medium — missing feature |
| CR-18 | `DELETE /deliveries/{id}/` succeeds in any state, including Submitted and Completed (the contract says Draft or Cancelled only) | **APPLIED** (API-DLV-21): only a Draft or a Cancelled delivery can be deleted (409 `delivery_not_editable`) | Medium — bug |
| CR-19 | A destination's `type` accepts any text (the model has seven choices and the serializer does not check them) | **APPLIED** (API-DLV-22): `type` must be one of the seven; a saved row keeps its old value when sent back unchanged | Low |
| CR-20 | `remove-version` after the delivery was validated or prepared is a generic 409 `conflict`: the append-only QC rows protect the item | **APPLIED** (API-DLV-23, migration `0003_qc_item_set_null`): a checked item can be removed; its check rows stay as history | Medium — bug |
| CR-21 | Delivery history, QC rows, `signed_off_by` and `client_answered_by` name people by user id only (production status histories carry `actor_name`) | **APPLIED** (API-DLV-24): `actor_name`, `checked_by_name`, `signed_off_by_name`, `client_answered_by_name` beside the ids | Low |
| CR-22 | The export-job list ignores every filter but `search` and `ordering`, its rows carry no project id, the detail has no `version_id`, and there is no project route for jobs | **APPLIED** (`PublishFilterSet`, API-PUB-15): the list filters by status, tool, entity type, project and version; rows carry `project_id`, the detail `version_id` | Medium — missing feature, blocks the project jobs tab |
| CR-23 | `DELETE /publishing/{id}/` succeeds in any status and for a job that has registered files (the contract says it is refused for those) | **APPLIED** (API-PUB-16): only Pending and Cancelled jobs, and never one with registered files (409) | Medium — bug |
| CR-24 | A publish destination's `type` accepts any text (the model has seven choices), as in CR-19 | **APPLIED** (API-PUB-17): `type` must be one of the seven; a saved row keeps its old value when sent back unchanged | Low |
| CR-25 | The scheduling lists ignore nearly every filter (resources: type, status, department, calendar; bookings: resource, status; leave: status, resource, type; events: project, type, status and any date window; milestones: status, kind, project by code); event rows carry no project id; two error bodies are not objects | **APPLIED** (API-SCH-15..18): the lists filter, event rows carry `project_id`, the two error bodies are objects with plain text | Medium — missing feature |
| CR-26 | All six settings lists ignore their filters (`is_active`, `status`, `feature_type`, `data_type`, `category`, `code__icontains`, …) and show archived rows: the viewsets read `FilterSet.queryset` (the input) instead of `.qs` (the result) | **APPLIED** (branch `sync/backend-cr-26-31`): `.queryset` → `.qs` in the six viewsets | Medium — bug |
| CR-27 | A `select` setting definition accepts `choices` as plain strings, then creating its value is a **500** (the validator reads `c["value"]`) | **APPLIED**: the definition serializer checks `choices` (objects with `value` and `label`; a select needs at least one) | Medium — bug (500) |
| CR-28 | Tags (`/core/tags/`) have no permission model: any signed-in user, even one with no role, creates, renames and deletes any tag, including `is_system` tags, and can set `is_system`; colours are not checked; a create answers without an `id` | **APPLIED**: reads for anyone signed in, writes need `settings.manage`, system tags are a platform administrator's, hex colour, ids in the answers | High — security gap |
| CR-29 | Missing validation in settings: a feature flag's `percentage` is unbounded (150 accepted); `schedule` accepts no dates, an end before the start, and naive date-times (and answers 200); a localization's `week_start` is unbounded (9 accepted); theme colours are length-checked only; the active theme can be deleted | **APPLIED**: percentage, schedule, `week_start`, hex colours, the last active theme; `is_enabled` follows `status` (Q-21) | Low-Medium |
| CR-30 | The project dashboard's `schedule.milestones` are five invented phases (fixed names, dates at fractions of the project's span, statuses from the overall progress %), not the project's milestones; Scheduling's provider already serves the real ones to `/organizations/projects/{id}/schedule` | **APPLIED** (branch `sync/backend-cr-26-31`): `schedule.milestones` are the project's own, read through the scheduling provider | Medium — bug |
| CR-31 | Dashboard counts disagree with the rules: the per-task `is_overdue` flags Approved tasks past their date while `overdue` does not; a Cancelled delivery past its date counts as late, a Completed one is not "delivered" (its word is `completed`, the list has `complete`), and everything else not delivered is "upcoming" | **APPLIED**: one overdue rule for the flag and the count; a Cancelled delivery is neither late nor upcoming; `completed` and `signed off` count as delivered | Medium — bug |
| Q-01 | Contacts list 403 for users without directory roles despite an empty `permission_map` entry | Question | — |
| Q-02 | Attachments accept an empty body | Open question for the owner | — |
| Q-03 | `change-password` ignores `confirm_password` | **APPLIED** (`553b481`): validated when present, still optional | Low |
| Q-04 | `/auth/me/` does not say what the session still owes | Deferred (client handles it) | Low |
| Q-05 | A user with no roles is labelled "Artist" | **APPLIED** (`ad874da`): empty role; Header/Sidebar show "No role" | Low |
| Q-06 | Invalid filter values: 400 on departments, empty 200 on tasks | Noted | Low |

---

## CR-01 — Stale deprecation registry for the flat directory/RBAC routes

**Problem.** `apps/core/api/deprecations.py:28-45` marks `/api/v1/(departments|teams|offices|people|positions|work-calendars|work-hours|calendars|holidays|roles|groups|permissions|api-keys|pats|clients|vendors)` and `/api/v1/organization/.+` as deprecated, with replacement `/api/organizations/{organization_id}/<resource>/`. That replacement tree no longer exists: organizations were removed (ADR-0034, `apps/organization` gone). The flat routes are the **only** routes for these resources, and `CONTRACTS.md` API-GEN-01 names `/api/v1/{roles,groups,permissions}/` as canonical.

**Evidence.** `DELETE /api/v1/departments/{id}/` and `GET /api/v1/departments/{id}/` respond with `Deprecation: true`, `Sunset: Mon, 01 Mar 2027 00:00:00 GMT` ([samples/_misc/conflicts_and_pagination.json](samples/_misc/conflicts_and_pagination.json), keys `department_delete_referenced`, `department_detail_after_delete`). The schema marks these paths `deprecated: true`, so generated frontend types flag them as deprecated too.

**Proposed diff.**
```diff
--- a/backend/apps/core/api/deprecations.py
+++ b/backend/apps/core/api/deprecations.py
@@ DEPRECATED_API_PATHS: tuple[tuple[re.Pattern[str], str], ...] = (
-    # Flat frontend-contract aliases -> nested /api/organizations/<org>/<resource>/
-    (
-        re.compile(
-            r"^/api/v1/"
-            r"(departments|teams|offices|people|positions"
-            r"|work-calendars|work-hours|calendars|holidays"
-            r"|roles|groups|permissions|api-keys|pats|clients|vendors)"
-            r"(/|$)"
-        ),
-        "/api/organizations/{organization_id}/<resource>/",
-    ),
-    # Namespaced organization tree -> nested /api/organizations/<org>/<resource>/
-    (
-        re.compile(r"^/api/v1/organization/.+"),
-        "/api/organizations/{organization_id}/<resource>/",
-    ),
     # Identity auth namespace -> /api/v1/auth/*
```
plus the matching assertions in the deprecation tests, and a note in `docs/api/API_MIGRATION_MATRIX.md`.

**Frontend workaround.** Yes: keep using the flat routes and ignore the headers. The change is needed only to stop the backend advertising a sunset date for routes with no successor.

## CR-02 — 18 enforced permission codes are never seeded

**Problem.** Viewsets enforce these codes via `permission_map`, but `init_platform` (`apps/core/management/commands/init_platform.py`, `PERMISSION_SPECS`) never creates them, and no migration does. They are defined only as constants (`apps/identity/constants/permissions.py`, `apps/settings/constants/permissions.py`). No role can carry them, so **only superusers** can pass these checks:

`settings.view`; `identity.user.activate`, `identity.user.archive`, `identity.user.deactivate`, `identity.user.restore`, `identity.user.reset_password`, `identity.user.change_password`; `identity.ip_blacklist.{view,create,update,delete}`; `identity.login_attempt.{view,create}`; `identity.login_history.view`; `identity.security_event.{view,create}`; `identity.profile.delete`; `identity.trusted_device.delete`.

**Evidence.** [`tools/perm_catalog.py`](tools/perm_catalog.py) (catalog: 127 codes; enforced: 126; enforced-but-unseeded: the 18 above). Samples: `GET /api/v1/settings/{categories,definitions,localizations,system-settings,themes}/` → 403 for the `artist` and no-role users ([samples/settings/](samples/settings/)); `GET /api/v1/identity/{security-events,login-history,login-attempts,ip-blacklist}/` → 403 for every non-superuser.

**Proposed diff (sketch — the role assignment is a product decision).**
```diff
--- a/backend/apps/core/management/commands/init_platform.py
+++ b/backend/apps/core/management/commands/init_platform.py
 PERMISSION_SPECS: list[tuple[str, str, str]] = [
+    ("settings.view", "View settings", "settings"),
+    ("identity.user.activate", "Activate users", "identity"),
+    ("identity.user.deactivate", "Deactivate users", "identity"),
+    ("identity.user.archive", "Archive users", "identity"),
+    ("identity.user.restore", "Restore users", "identity"),
+    ("identity.user.reset_password", "Reset user passwords", "identity"),
+    ("identity.user.change_password", "Change user passwords", "identity"),
+    ("identity.security_event.view", "View security events", "identity"),
+    ("identity.login_history.view", "View login history", "identity"),
+    ("identity.login_attempt.view", "View login attempts", "identity"),
+    ("identity.ip_blacklist.view", "View IP blacklist", "identity"),
+    # …remaining codes from the list above
     …
 ]
```
and add them to the `org-admin` / `platform-admin` role specs (decision needed: which roles). `init_platform` is idempotent, so existing databases pick them up on the next run. Tuple shape must follow the existing `PERMISSION_SPECS` entries.

**Frontend workaround.** Partial and fragile: an admin could create the rows through `POST /api/v1/permissions/` and grant them with `POST /api/v1/roles/{id}/permissions/`. That works only if the admin already has `identity.permission.create`, and it would diverge between environments. Until this is resolved the frontend will show these screens to superusers only and degrade to a "no permission" state for everyone else.

**Questions for you.** Which roles should hold `settings.view` and the identity lifecycle/security codes? Is superuser-only intended for some of them?

## CR-03 — `AuditLog` has no `target_id` filter

**Problem.** `AuditLogFilter` (`apps/audit/filters/audit_log.py:12-30`) filters by `severity`, `target_type`, `actor`, `action`, `created_at` only. Deliveries, publishing, scheduling, masterdata and attachments write **AuditLog** rows (business actions such as approve/reject/sign-off), so a detail page cannot fetch "this object's audit entries". `ChangeLog` already supports `target_id`.

**Evidence.** Filter fields from [`tools/audit_filters.py`](tools/audit_filters.py): `AuditLogViewSet ['action', 'actor', 'created_at', 'created_at__gte', 'created_at__lte', 'severity', 'target_type']`; `ChangeLogViewSet [... 'target_id', 'target_type', 'user']`.

**Proposed diff.**
```diff
--- a/backend/apps/audit/filters/audit_log.py
+++ b/backend/apps/audit/filters/audit_log.py
         fields = {
             "severity": ["exact"],
             "target_type": ["exact"],
+            "target_id": ["exact"],
             "actor": ["exact"],
             "created_at": ["exact", "gte", "lte"],
         }
```
(`/api/v1/audit/` (`AuditCompatViewSet`) reuses the same filter class, so both endpoints gain it.) Plus one filterset test.

**Frontend workaround.** Only by downloading every AuditLog row of a `target_type` and filtering client-side, which is unbounded. The History panel can ship with ChangeLog + status-history only and add AuditLog rows once this lands.

## CR-04 — ChangeLog does not track several editable models

**Problem.** `apps/audit/signals/change_tracking.py:223-257` (`_TRACKED_MODEL_PATHS`) omits models that have full CRUD in the API: production `Show`, `Media`, `Playlist`, `EditorialTrack`, `Workflow`, `TaskTemplate`; masterdata `Position`, `ClientContact`, `VendorContact`, `ClientContract`, `VendorContract`, all catalog types/statuses/software; settings (all six models); publishing `PublishedFile`, `PublishDestination`, `StorageRoot`; deliveries `DeliveryDestination`. Edits to these leave no field-level history, so their detail-page History tabs would be empty.

**Evidence.** The tracked list itself; to be confirmed with a write-then-read check per module during its phase (Part C verification). Some omissions may be deliberate (settings may be audited elsewhere; RBAC rows emit `SecurityEvent`).

**Proposed diff.** Add the confirmed models to `_TRACKED_MODEL_PATHS` (one line each), with `audit_exclude_fields` where values are sensitive. Exact list to be fixed per module phase.

**Frontend workaround.** None for field-level history; the UI will show "no history recorded" for those entities.

## CR-05 — Dev seed commands are broken

**Problem.**
1. `seed_dev` fails at import: `apps/core/management/commands/seed_dev.py:1281` imports `approve_delivery`, `reject_delivery` from `apps.deliveries.services.delivery`; they no longer exist (the viewset now calls `DeliveryService.record_client_answer`, `apps/deliveries/api/viewsets/delivery.py:268-300`).
2. `seed_studiohub` / `seed_demo_data` require the frontend mock dataset at `frontend/src/mocks/db` (`seed_studiohub.py:350-362`), which was removed with MSW.

**Evidence.** Phase 0 run: `ImportError: cannot import name 'approve_delivery' from 'apps.deliveries.services.delivery'`; `CommandError: No mock dataset found. Set STUDIOHUB_REACT_MOCKS to .../src/mocks/db.`

**Proposed diff.** (1) Replace the two imports and their call sites (`seed_dev.py:1362-1380`) with `DeliveryService.record_client_answer(...)` as the viewset does. (2) Either vendor the mock dataset as backend seed fixtures or make `seed_demo_data` skip the overlay when the dataset is missing (it already has `--skip-base`; add a `--no-mock-overlay` path).

**Frontend workaround.** Not a frontend problem, but without a working seed there is no realistic dev database for end-to-end verification. Phase 0 used factories inside a rolled-back test transaction instead.

## CR-06 — Unmapped methods return 403 instead of 405

**Problem.** `MethodPermissionMixin` views (`apps/scheduling/api/views/capacity.py:35-42`) deny any method missing from `permission_map` with 403 before dispatch, e.g. `GET /api/v1/scheduling/resolve-overbooking/` → 403 for a superuser ([samples/scheduling/scheduling__resolve-overbooking.json](samples/scheduling/scheduling__resolve-overbooking.json)).

**Proposed diff.** In `MethodPermissionMixin.get_required_permissions`, return no requirement for methods the view does not implement so DRF answers 405. **Frontend workaround:** yes (never call unmapped methods).

## CR-07 — Superuser fallback permission list contains non-catalog codes

**Problem.** `serialize_frontend_user` (`apps/identity/api/serializers/frontend_user.py`) returns a hard-coded 23-code list for superusers without grants, including codes that are not in the catalog (`user.manage`, `settings.update`) and omitting most real codes. The backend itself lets superusers do everything.

**Proposed change.** Return `[]` plus `is_superuser: true` (already present) or the full catalog. **Frontend workaround:** yes — treat `is_superuser === true` as all permissions (planned for Phase 1).

## CR-08 — Views missing from the OpenAPI schema

**Problem.** spectacular cannot introspect 19 APIViews (no `serializer_class`): the 17 project-scoped views (`apps/production/api/views/project_scoped.py`), `AttachmentDownloadView`, `VersionInfoView`. 35 endpoints declare `responses=OpenApiTypes.OBJECT` (auth, MFA, capacity, several actions).

**Proposed change.** Add `@extend_schema(responses=...)` with response serializers. **Frontend workaround:** yes — hand-written types validated against [samples/](samples/).

## CR-09 — `CONTRACTS.md` page-size drift

`docs/identity/CONTRACTS.md` API-GEN-04 says the default page size is 20 (`drf.py:13`), but `BasePagination.page_size = 25` (`apps/core/api/pagination/base.py`) wins; verified 25 rows on a 34-row list. Doc fix only (either the doc or the class attribute).

## CR-10 — Server-side export (optional)

**Problem.** Q4 requires exporting every row matching the current filters. Client-side this means one request per 500 rows (a 20,000-row task list = 40 requests) and holding everything in memory. `apps/core/api/renderers/{csv,excel}.py` exist but no view enables them.

**Proposed change.** Add the CSV renderer to the list views that need export (or a `?format=csv` with `pagination_class=None` for that format), streaming the response. **Frontend workaround:** yes, the Phase 1 `exportAll()` utility; switch to the server endpoint per resource if this lands.

## CR-11 — httpOnly refresh cookie (optional)

**Problem.** The refresh token must live in JavaScript-readable storage today, so an XSS bug can steal a 7-day credential. **Proposed change.** `/auth/login/` and `/auth/refresh/` also set the rotated refresh token as an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth/`, and `/auth/refresh/` accepts it when the body is empty (needs CSRF consideration). This would alter the trust model, so it needs an ADR. **Frontend workaround:** yes (Q6 recommendation).

## Q-01 — Contacts list enforcement

`ClientContactViewSet` / `VendorContactViewSet` have `permission_map['list'] = []` (authenticated is enough), yet `GET /api/v1/client-contacts/` returns 403 for the no-role and `artist` users while `/clients/` returns 200 ([samples/masterdata/](samples/masterdata/)). Something else (a PII guard?) enforces it. Intended? Which code grants it? Resolved during the masterdata phase.

## Q-02 — File-less attachment records

`POST /api/v1/core/attachments/` (and the `/api/v1/attachments/` alias) with an empty JSON body answers `201` and stores a blank record (`{"file": null, "name": "", "file_type": "document", "mime_type": "", ...}`), for any authenticated user. Evidence: [samples/core/core__attachments.json](samples/core/core__attachments.json) `create_empty_400` / `create_norole_403` (both 201; the sample keys were named for the expected 400/403 before the capture). Cause: `AttachmentCreateSerializer.file = FileField(required=False, allow_null=True)` (`apps/core/api/serializers/attachment.py:97`). Access control itself is by design (`IsAuthenticated`, rows scoped to the uploader).

**Question for the owner:** are metadata-only attachments (no file) intended, e.g. for externally stored files addressed by `storage_key`? If not, `file` should be `required=True` on create. **Frontend impact:** none — the upload primitive always sends a file and validates size/type client-side. Not blocking; no change proposed until answered.

## Q-03 — `change-password` does not compare `confirm_password`

`POST /api/v1/auth/change-password/` with `confirm_password` different from `new_password` answers `200 "Password changed. All sessions have been signed out."` and changes the password. Evidence: [samples/identity/_restricted_sessions_flow.json](samples/identity/_restricted_sessions_flow.json) `change_password_confirm_mismatch`. `reset-password` does compare them (`400 {"confirm_password": ["Passwords do not match."]}`, [samples/identity/_auth_password_reset_flow.json](samples/identity/_auth_password_reset_flow.json) `reset_mismatch`).

**Impact / workaround:** none needed for correctness — the frontend compares them before sending (`ChangePasswordPage`). Any other client (or a script) can still mistype a new password and lock itself out. **Proposed change if wanted:** validate the pair in the change-password serializer, as reset-password does. Awaiting a decision; no change made.

## Q-04 — `/auth/me/` does not say what the session still owes

A restricted session (see [restricted sessions](samples/identity/_restricted_sessions_flow.json)) learns it owes MFA enrollment only from the login response (`mfa_enrollment_required`) or from the first `403 {code: mfa_enrollment_required}`. After a page reload there is no flag in `/auth/me/` (`restricted_me` has none), so the client discovers the restriction through one failing request. Handled on the frontend (any restricted 403 routes to the right screen), so nothing is blocked; one wasted request per reload. **Optional improvement:** add `pending_actions: ["mfa_enrollment_required", ...]` to the `/auth/me/` payload.

## Q-05 — a user with no roles is labelled `role: "Artist"`

`serialize_frontend_user` falls back to the display name `"Artist"` when the user has no role (`frontend_user.py`, `role_name = "Artist"`), so a user with **no** roles is shown as an Artist. Display only (authorization uses `permissions[]`), but it is misleading in people/admin lists. Related to CR-07. Proposed: return `""`/`null` and let the UI show "No role".

## Q-06 — inconsistent handling of invalid filter values

`GET /api/v1/departments/?department_type=wizard` → `400 {"department_type": ["Select a valid choice. wizard is not one of the available choices."]}` ([samples/masterdata/_departments_flow.json](samples/masterdata/_departments_flow.json) `list_invalid_type_filter`), while `GET /api/v1/tasks/?project=not-a-uuid` → `200` with an empty list ([samples/_misc/conflicts_and_pagination.json](samples/_misc/conflicts_and_pagination.json) `invalid_filter_value`). The frontend only sends values from controlled selects, so it is not affected; noted for contract consistency.

## Note — `/health/` is liveness only

`GET /health/` returns `{"status": "ok"}` without touching the database (`config/urls.py`). It proves the process is up, not that the database is reachable. If a readiness probe is wanted (the frontend server's `isDjangoRunning` and any load balancer), it needs a separate route. Not requested.

---

## Phase 2 findings (identity administration)

Evidence for all of these: [samples/identity/_identity_admin_flow.json](samples/identity/_identity_admin_flow.json), captured through the real MFA-enrolled JWT flow by [tools/test_capture_identity_admin.py](tools/test_capture_identity_admin.py).

### CR-12 — Creating a user whose e-mail differs only by case is a 500 (**bug**) — **APPLIED**
Fixed in `UserCreateSerializer.validate_email` (case-insensitive check, same 400 message as the exact duplicate); regression test `test_create_user_duplicate_email_differing_only_by_case_is_400` fails without the fix.

`POST /api/v1/identity/users/` with `new@example.test` then `NEW@example.test` → the second answers `500 {"detail": "Internal server error."}` (`users_create_duplicate_case`). The exact duplicate is a clean `400 {"email": ["user with this email already exists."]}` (`users_create_duplicate_exact`). The uniqueness check is case-sensitive but a case-insensitive unique index (or `User.objects.get(email__iexact=…)` in the service) rejects it later as an unhandled `IntegrityError`. **Proposed fix:** compare case-insensitively in the serializer/`UserService.create` and return the same 400 as the exact duplicate. **Frontend workaround:** none that is reliable (a pre-check `GET /identity/users/?email=` is exact-match); the form shows the generic server error with its request id. *Needs your approval; not applied.*

### Q-07 — `POST /roles/` and `POST /groups/` return no `id`
Both answer `201` with only the submitted fields (`{"name", "code", "description", "parent", "scope", "priority"}`); `id`, `uuid`, `is_system`, … are missing (`roles_create_has_id`, `groups_create_has_id`: false). `POST /identity/users/`, credentials and IP-blacklist entries do return the full object. The frontend works around it by re-reading the row by `code` (`?search=<code>`), which costs a request and is unambiguous only because `code` is unique. **Proposed fix:** return the serialized instance (the service result is evidently not the instance that is serialized).

### Q-08 — nothing stops an administrator from deactivating or deleting their own account — **DECIDED: leave as designed**
Decision (project owner, Phase 3 review): self-action stays allowed, as `services/user_admin_guard.py` documents. No backend change. The UI keeps blocking it on the signed-in user's own row.

`POST /identity/users/{self}/deactivate/` → `200`; the very next call is `401 {"code": "user_inactive"}` (`self_deactivate`, `self_after_deactivate_me`). `DELETE /identity/users/{self}/` → `204`, then `401 user_not_found` (`self_delete`). The sole administrator can lock everyone out. **Not applied:** `services/user_admin_guard.py` documents that acting on yourself is allowed on purpose (the last-administrator guard covers *delete* only), so rejecting it reverses a stated decision and needs your call (and an ADR if it changes the trust model). **Frontend:** the lifecycle controls are disabled on the signed-in user's own row. **Proposed:** reject self-deactivate/archive/delete (and ideally "last active superuser") with a 400.

### Q-09 — the MFA "devices" tree under `/identity/auth/mfa/` is unusable; revoking your own trusted device needs an admin permission
`GET /identity/auth/mfa/devices/` and `POST /identity/auth/mfa/devices/revoke/` answer `401 "You do not have permission…"` for a valid, MFA-enrolled session (`mfa_devices`, `mfa_devices_revoke_unknown`). The working list is `GET /identity/trusted-devices/` (bare array), but its `DELETE` needs `identity.trusted_device.delete`, which only `platform-admin` holds after CR-02. So an ordinary user can see but not revoke their trusted devices. **Frontend:** lists via `trusted-devices`, shows revoke only to holders of the code. **Proposed:** let a user delete their own trusted devices (ownership, not a permission), and fix or remove the `auth/mfa/devices` views.

### Q-10 — security ledgers are not paginated
`GET /identity/{security-events,login-history,login-attempts,ip-blacklist}/` return bare arrays of everything (44 security events after a short test session). They filter by `start_date`/`end_date`/`status`/`ip_address`/…, so the frontend always sends a date window and slices client-side, but a busy installation will return very large bodies. **Proposed:** `StandardPagination` on these four viewsets.

### Note — MFA re-authentication fields
`POST /identity/mfa/recovery-codes/regenerate/` and `/identity/mfa/totp/disable/` require `{password, code | recovery_code}` (password **and** a verification code). A request with the right password but no code is answered `400 "Invalid verification code."` Regenerate returns `{"codes": [...]}`.

### Q-11 — profile fields that are writable but never returned
`PATCH /auth/me/` accepts `timezone`, `language`, `phone`, `bio`, `display_name` (the capture sent `timezone`/`language` and got `200`), but `GET /auth/me/` and the PATCH response contain only `first_name`, `last_name`, `avatar_url` (`me_patch_ok`). The frontend cannot show the current value, so My account edits first/last name only. **Proposal (not requested):** return the profile fields from `/auth/me/`, or document them as write-only.

### Q-12 — what a user's state and roles look like to the UI
- `GET /identity/users/{id}/` returns `is_active`, `is_email_verified`, `last_seen` and nothing about suspended / archived / locked / must-change-password / MFA, so the Account section cannot show those states; it offers every lifecycle action the caller is permitted and reports the server's answer.
- There is no user → roles route. The Account section reads each role's members (`GET /roles/{id}/users/`, a handful of requests) to list a user's roles.
- `GET /identity/users/` answers **403 without `identity.user.view`** (verified live, delegate without it). It is *not* "scoped to self" for such users; the artist sample, which holds the permission, sees only itself. The user pickers show a note instead of an empty list.

### Note — RBAC read/write rules (corrects an earlier reading, verified live)
`get_permission_required` in `viewsets/rbac.py` overrides the per-action `permission_map` for GET: `roles/{id}/permissions|groups` and `groups/{id}/roles` are open reference data; `roles/{id}/users` and `groups/{id}/members` need `identity.role.view` / `identity.group.view`; every write needs `.update`. The first Phase 2 UI gated all tabs on `.update` (wrong, from reading `permission_map` only) and was corrected in `a630a836`.

### Note — guards the UI relies on (all verified live, no change requested)
- Assigning a role that grants permissions the actor lacks: `403 "Actor does not hold every permission granted by this role: shot.view"`.
- Changing your own role assignments: `400 {"non_field_errors": ["You cannot modify your own role assignments."]}`. Combined with Q-08, the role guard exists while the lifecycle guard does not.
- The harness seeds MFA with a code from its start-up TOTP step; the server then rejects the first code from that same step as a replay (test helper now skips that step).

---

## Phase 3 findings (masterdata) — all verified against a running backend; none applied

### Q-13 — the catalog answers in three different envelopes
`/platform/master-data/*`: create, update and reorder return the bare row(s); **archive and restore return `{"success": true, "data": {row}}`**; **delete is a soft delete answering `200 {"success": true, "message": "Task type soft-deleted. It can be restored."}`** and the row then appears in no list (not even `?status=archived`), so "restore" cannot reach it from the UI. System rows answer `409 "System records cannot be changed this way."`. The detail route is slash-less (`…/task-types/{id}`); with a slash it is a 404, so the Phase 0 `detail_admin` captures are 404 bodies. The frontend unwraps the envelopes. **Proposal (not requested):** one envelope; make soft-deleted rows listable (`?status=deleted`) or return 204.

### Q-14 — a contract created without `status` is born Active
`POST /client-contracts/` without `status` → `status: "Active"` and `activated_at` set, and then requires `effective_date` ("An Active contract needs a start date."). Sending `status: "Draft"` creates a Draft. `PATCH` with `status` → `400 {"status": ["Read-only. Use POST …/activate or …/terminate to change it."]}`; editing a Terminated contract → `409 "A Terminated contract is read-only. Use adjust-end-date to correct its end date."`; terminating clears `activated_at`. The create form asks for Draft or Active explicitly. The OpenAPI schema lists `status` as `"Draft" | "Active"` only, although `Terminated` (and derived `Expired`) occur.

### Q-01 — confirmed
`GET /client-contacts/?client=…` answers 403 to a signed-in user without directory roles even though the viewset's `list` map entry is empty. The contacts tab shows the API's refusal.

### Note — observations the UI relies on
- Sensitive fields are omitted (not nulled) for callers without the grant: person `email`, `phone`, `date_of_birth`, `nationality`, `security_clearance`; client `total_billed_usd` (captures + live). Forms render those inputs only for holders of `masterdata.person.view_sensitive` / `masterdata.client.view_financial`.
- Deleting a department that teams/positions still reference: `409 "Still referenced by: masterdata.Position.department (2), masterdata.Team.department (1)."`.
- Person `status` ∈ draft/active/inactive/archived; lifecycle through `POST people/{id}/deactivate|reactivate|restore/`.


---

## Phase 4 findings (audit) — verified against a running backend; none applied

### Q-15 — what History can and cannot show (CR-04 confirmed)
Live (`audit.live.test.tsx`): a department, team or client edit writes a ChangeLog row; **position, contract and catalog-row edits write none**; and a client update that only touches `contact_name` writes none either (the tracked client fields are `active_projects, code, contract_tier, headquarters, logo_url, name, portal_access, status, studio_type`). History is therefore silent for those edits. **Correction (Phase 6):** a real server DOES write `AuditLog` lines for plain masterdata writes ("update by <user>: masterdata.Department updated"); the in-process captures showed none because those rows are written on commit and a test transaction never commits. EntityHistory lists them under "Audit events", one per write, beside the change log. **Proposal (not requested):** add the missing models/fields to the ChangeLog tracking list.

### Note — audit routes behave like this
- ChangeLog: filters `change_type`, `target_type` (the model CLASS NAME, e.g. `Department`), `target_id`, `user`, `created_at__gte|lte`; newest first; `before_values` is `{}` on create; values are strings. An unknown `ordering` is ignored (200).
- Cancelling an already-cancelled job and retrying a job that is not failed both answer 200 without error (nothing happens), so the UI offers Cancel only on queued/running jobs and Retry only on failed ones. Resolve answers `{"status": "resolved"}`.
- Every audit read and action answers 403 to a signed-in user without `audit.view` / `audit.update`.
- The old Logins tab of the system-logs page called a path that does not exist; login history is the identity ledger (`/identity/login-history/`, Phase 2).


---

## Phase 5 findings (production structure) — verified against a running backend

### CR-13 — project/show `archive` and `check-existence` answer 403 to everyone (**bug**, **APPLIED for `archive` only**)
**Applied (with the Phase 6b backend commit):** `archive` is mapped to `project.delete` / `show.delete`. **Amendment:** the proposal also mapped `check-existence`/`existence-check`; running it showed those viewsets do not implement `_existence_items_from_request`, so a mapped call answers **500**. They stay unmapped (403) and the frontend keeps checking codes with `GET /projects/?code=`; implementing them is a separate, optional change. The frontend keeps using `DELETE` to archive, which now has the same effect as `POST …/archive/`. Original text follows.

`POST /projects/{id}/archive/`, `POST /projects/check-existence/` (and `existence-check/`), `POST /shows/{id}/archive/`, `POST /shows/check-existence/` return `403 "You do not have permission to perform this action."` for an MFA-enrolled **superuser** (`_structure_flow.json`: `projects_archive`, `projects_check_existence`, `shows_archive`, `shows_check_existence`). Cause: `ProjectViewSet.permission_map` (and the show viewset's) has no entry for `archive`, `check_existence`, `existence_check`; `HasPermission` denies an unmapped action, logging `authorization_deny_no_map_entry`, even for superusers. The inventory shows these as `archive: —`. Episodes and sequences do map them and work. **Minimal diff:** add `"archive": (ProjectPermissions.DELETE,), "check_existence": (ProjectPermissions.CREATE,), "existence_check": (ProjectPermissions.CREATE,)` to `ProjectViewSet.permission_map` and the show equivalents (`ShowPermissions`). **Frontend workaround (in use):** `DELETE /projects/{id}/` soft-archives (204; the project then lists under `/projects/archived/` and `POST …/restore/` brings it back; its detail answers 404 meanwhile); codes are checked with `GET /projects/?code=`.

### Note — behaviours the project screens rely on
- Project `type` ∈ Feature Film, Episodic Series, Commercial, Game Cinematic; `status` ∈ In Progress, Pending Review, Approved, Archived, On Hold; `workflow_type` ∈ standard, episodic. An **episodic** project creates its first episode itself (`EP101`), and sequences on an episodic project need `episode_id` ("An episode is required for sequences on episodic projects."). Editorial track `track_type` ∈ Video, Audio, VFX Plates, Reference, Subtitles, Markers.
- Members are added at `POST /api/organizations/projects/{id}/members/` with `user_id` or `email` and a `role`; 201 when new, 200 when already a member, 404 `User not found.` for an unknown e-mail; only holders of `project.update` may add. A non-member gets 403 on the project list/detail; a member sees only their projects.
- Bulk routes answer 200 with per-item results (`processed`, `failed`, `partial_success`, `results[].actionTaken`), including when every item failed.
- Project notes need `subject` (the sample note came back with an empty `body`; the body field name is not `content`).

### CR-14 — an ordinary timelog accepts negative hours (**bug**, **APPLIED**)
**Applied (Phase 6b backend commit):** create rejects zero, negative or omitted hours unless `adjustment_of` is set; update applies the same rule per entry (an adjustment may be negative, never zero). Tests: `apps/production/tests/test_timelog_rules.py::TestOrdinaryHours`. The proposal text follows.

`POST /api/v1/timelogs/` with `{"task_id": …, "duration_hours": "-1", "date": "2030-01-15"}` and no `adjustment_of` answers **201** and stores `duration_hours: "-1.00"`, status Submitted (`_work_flow.json`: `timelogs_create_future_or_bad`). `docs/production/DECISIONS.md` (line 40) and `CONTRACTS.md` C-18b allow negative hours only on an *adjustment* entry (`adjustment_of` set; "non-zero, possibly negative"), and `logged_hours` sums approved entries, so an approved negative ordinary entry silently lowers a task's logged time with no link to what it corrects. `TimelogViewSet.validate_references` checks non-zero only when `adjustment_of` is present; nothing checks the sign otherwise. **Minimal diff:** in `TimelogViewSet.validate_references` (or `TimelogCreateSerializer.validate`) add: when `adjustment_of` is absent and `duration_hours <= 0`, raise `ValidationError({"duration_hours": ["Hours must be greater than zero. Correct an approved entry with an adjustment."]})`; the same check for PATCH of `duration_hours`. **Frontend workaround (in use):** the time form requires hours > 0 unless it is an adjustment, so the UI never sends it; a script still can.

### Note — behaviours the Phase 6 screens rely on (`samples/production/_work_flow.json`)
- **Writes ignore unknown keys silently.** A task created with `shot_id` is stored as a *General* task with no link and answers 201. The link is `entity_type` (`Shot`|`Asset`|`Sequence`|`General`) + `entity_id`; `shot_id`/`asset_id`/`sequence_id` exist only on reads and as list filters. `entity_type: "Asset"` with a shot's id is a 400 `Unknown asset.`.
- **Write responses are not read-shaped.** `POST/PATCH` on tasks, timelogs and shots answer with the write serializer (`assignee`, `project`, and no task-type keys at all even when `task_type_id` was saved); `GET` has `assignee_id`, `task_type_id`/`code`/`name`. After a write, re-read the record instead of trusting the response.
- **Hours change type by endpoint.** Timelog `duration_hours`/`hourly_rate_usd` are JSON *numbers* in list/detail/approve and *strings* in create/patch responses; task `estimated_hours`/`logged_hours`/`pending_hours` are strings. The client normalises with `Number()`.
- **Status machine** (`apps/production/constants/workflow.py`, enforced by the server): shot/task move freely among Not Started, In Progress, Pending Review, Retake (shots also On Hold); **Approved is entered only from Pending Review** and left only to Archived; a bad move is 400 `invalid_transition` (`"A shot cannot move from 'In Progress' to 'Approved'."`). Entering Approved on a shot needs `shot.approve`; timelogs go Draft → Submitted → Approved/Rejected, entering Approved/Rejected needs `timelog.approve` **and** the approver may not be the person who logged it. An unknown status is a plain 400 choice error. `production.status.override` plus a reason crosses a fence (shot, task, version, review).
- **Seeded roles:** `artist` holds `shot.view`, `asset.view`, `task.view/update`, `timelog.view/create/update` (own only), no create on shots/assets/tasks; `lead-artist` adds `shot.update/approve`, `asset.create/update`, `task.create`, `timelog.view_all/approve`; neither creates shots, deletes tasks or renames codes; `tasktemplate.view` only (template writes 403). An artist may update *any* project task, not only their own.
- **Visibility:** a stranger gets 200 with an empty list on `/shots/?project=` and 404 on a record; an artist sees only their own timelogs, a holder of `timelog.view_all` sees all; logging for someone else needs `timelog.manage` (403 with that message).
- **Time rules:** an approved timelog is final (PATCH 409 `An approved timelog is final. Add an adjustment entry to correct it.`); a rejected one may be edited and resubmitted; `reject` needs `rejection_reason`; an adjustment is a new entry with `adjustment_of`, same person, non-zero hours, possibly negative.
- **Filters that do something** (each probed alone, `fp_*` keys): shots `status code search sequence sequence_code sequence_id episode_id` (`sequence` takes a sequence *code*); assets `status category search`; tasks `status priority entity_type entity_id shot_id asset_id sequence_id assignee assignee_id team team_id department is_archived search` (`status`/`priority`/`entity_type`/`department` accept `ALL`); timelogs `status task person billable date start_date end_date`; templates `entity_type is_active project_id studio`. **Ignored without error:** shots `assigned_artist`; assets `code`; tasks `code`, `reviewer`, `show_id` (the method returns the queryset unchanged); every `nonsense` param.
- **Bulk shapes differ.** shots/assets/tasks `bulk-create|update|archive|restore` answer 200 `{processed, failed, successful, partial_success, results[], summary}`; tasks `bulk-assign` answers `{success, updated_count, results[{id,status}]}`; `bulk-status` answers 200, or **207** when any item failed, `results[{id, ok, error}]` (`error`: `not_found`/`invalid_transition`).
- **Templates:** `apply` answers 201 with `{created[], existing[]}` the first time and 200 with the same tasks under `existing` the second (task codes `<ENTITY>_<TYPE>`, e.g. `SH0020_COMP`); `copy-to-project` answers 201 with the new project template; an empty task-type catalog means templates have no items to apply (a fresh database has none).

### CR-15 — `archive` on media and reviews answers 403 to everyone (**bug**, **APPLIED**)
**Applied** (owner approved the suggestion): `"archive": (MediaPermissions.UPDATE,)` and `"archive": (ReviewPermissions.DELETE,)`, tests in `apps/production/tests/test_review_media_validation.py`, contract C-47. The Phase 7 text below is the original finding; the screens no longer use `DELETE`.

Same class as CR-13. `POST /media/{id}/archive/` and `POST /reviews/{id}/archive/` return 403 for every caller (`_review_flow.json`: `media_archive`, `reviews_two_archive`) because `archive` is missing from `MediaViewSet.permission_map` and `ReviewViewSet.permission_map` (the inventory lists `archive: —`; playlists, workflows, versions and tasks map it). `DELETE` does archive (reviews: the supervisor holds `review.delete`, 204), but a lead holds `media.update` and not `media.delete`, so only a supervisor or administrator can archive media. **Minimal diff:** `"archive": (MediaPermissions.DELETE,)` and `"archive": (ReviewPermissions.DELETE,)`, matching DELETE (or `media.update`/`review.update` to let leads archive, as playlists do; the owner's choice). **Frontend workaround (in use):** `DELETE`.

### CR-16 — missing validation on reviews, media and workflows (**low**, **APPLIED in part**)
**Applied:** (1) review `status` on create must be `Pending Review`, (2) a comment needs text, (3) a verdict must be one of the known values (C-48..C-50, same test file). **Not applied, by decision:** (4) `media_type` stays free text, (5) workflow `code` uniqueness. The finding as it was captured follows; `_review_flow.json` was captured again after the fix (`reviews_create_bad_status` now 400, `reviews_create_second` added).

(1) `POST /reviews/` with `"status": "Bogus"` answers 201 and stores it (`reviews_create_bad_status`); the status workflow table then treats an unknown status as "may move anywhere". (2) `POST /reviews/{id}/comments/` with an empty body answers 201 and stores an empty comment; comments are also accepted on a Closed review (documented in DECISIONS D-30 as not asked for). (3) `media_type` is free text (default `image`) and accepts any value. (4) Verdicts are free text: `participant-verdict` with `"Banana"` is stored as typed, and `verdict: "Banana"` on a review sets `supervisor_verdict` without moving its status (only `Approved`, `Rejected`, `Changes Requested` and `Retake` mean anything). (5) Workflow `code` is not unique per project: `cf1` next to `CF1` is accepted and a second `clone` repeats `CF1-COPY` (every other production entity is unique per project, any case). **Minimal diff:** a choice check on review `status` at create (only `Pending Review`) and on verdict values; `text` required on comments; `code` uniqueness for workflows (and a numbered clone code). **Frontend workaround:** the forms never send a status, require comment text, offer only the real verdicts, and show the clone for renaming.

### Q-19 — playlist sharing records flags and nothing more (question)
`POST /playlists/{id}/share/` merges `is_public`, `require_passcode`, `allow_client_approval`, `client_id` and `expires_at` into `share_settings` and returns the playlist (`playlists_share`). A search of `backend/apps` finds no reader of `share_settings`: no unauthenticated route, no passcode check, no expiry, no client approval; no link or passcode is returned. `expires_at` is a free string. **Frontend:** the share dialog sends only the three booleans, labels them "Mark as …", shows "Marked shared" on the playlist and says in the dialog that the server does not yet create a link, enforce an expiry or let anyone outside open it. The expiry field was left out for that reason. If a public review page is planned, the contract (token, passcode, expiry) is needed before the screen can promise anything.

### Note — behaviours the Phase 7 screens rely on (`samples/production/_review_flow.json`)
- **Version caches are not data (D-18).** `reviews`, `playlists`, `notes_list`, `media_items`, `activity`, `attachments` on a version are caches; the screens read reviews, playlists and media from their own routes.
- **Versions** are numbered by the server (`v001`, a number sent on create is ignored) and about a shot **or** an asset (both is 400). Only `entity_type` + `entity_id` (plus `status`, `department`, `is_published`) filter the list: `shot_id`, `task_id`, `asset_id`, `artist` and `is_hero` are silently ignored. `search` matched nothing on a note's text. Publishing needs an Approved version (400 otherwise), cannot repeat, freezes everything but notes and tags and blocks archiving; `unpublish` undoes it; `promote` approves and makes the hero.
- **Separation of duties** (D-04) is 403 with `error.code = separation_of_duties` for status Approved and promote on a version you produced, and for a review you moved to Submitted, on every path including `verdict`/`participant-verdict`. A version's artist, creator and its task's assignee are producers.
- **Reviews:** statuses `Pending Review, Submitted, In Review, Approved, Rejected, Changes Requested, Retake, Closed`; `submit`/`start-review`/`close` need `review.update`, `approve`/`reject`/`request-changes`/`verdict` need `review.approve` (a lead holds neither approve nor decisions; the vfx-supervisor does). `verdict` with `Retake` is the only way to the Retake decision. `participant-verdict` needs `review.update` **and** the participant's own account, does not move the review, and an approving one is subject to separation of duties. Adding a version or participant, and `resolve`/`reopen`, answer the whole review; a new comment/note/annotation answers the part. Participants must be project members ("Unknown user." otherwise), once each; a version once per review.
- **Playlists:** entries are rows; `PATCH` of `entries` is 400 (use add-entry/remove-entry/reorder); an empty `add-entry` makes a placeholder; `reorder` with an unknown id is 400, `remove-entry` with an unknown id is 200 and changes nothing; `share` validates its keys (`is_public: "maybe"` is 400) and an empty share is a 200 no-op. Artists read playlists but cannot create; leads build them.
- **Media** is a bare-array list; an artist creates but cannot edit (`media.update`), a lead edits but cannot delete.
- **Workflows:** `activate`/`deactivate` flip `is_active`; `clone` makes an inactive "<name> (Copy)" with code "<code>-COPY"; `simulate` returns `overall_status: success` and every node `success` whatever the graph (a stub); a lead can read and simulate but not create (`workflow.view` only).
- **Automations:** rules are definitions (nothing fires them, `execution_count` 0, audit log empty); `trigger` must be an object `{event, entity_type, filters}`; only a platform administrator can create a studio-wide rule, anyone else must pass `project_id`; an artist gets 403 even to list.
- **Phase 7 screens read around two server limits:** shots' and assets' versions and reviews cannot be listed by entity (only by project and type), and media cannot be listed by entity at all, so those tabs read the narrower list in full (`fetchAllRows`) and keep the entity's rows; workflow `PATCH` accepts `nodes`, `transitions` and `automation_rules` (serializer `WorkflowUpdateSerializer`), though the captures only exercised `description`.

## Phase 8 findings (deliveries) — verified against a running backend (`samples/deliveries/_flow.json`); CR-17 to CR-21 applied

### CR-17 — the delivery lists cannot be filtered (**missing feature**, **APPLIED**)
**Applied** (owner approved the suggestion; backend commit `68e846fc`, tests `apps/deliveries/tests/test_list_delete_names.py`, contract `docs/deliveries/CONTRACTS.md` §11). The text below is the original finding; `samples/deliveries/_flow.json` was captured again after the fix.
`GET /deliveries/?status=Completed`, `?client=…`, `?project_id=…`, `?delivery_method=…`, `?destination_id=…` all answer the unfiltered rows (`fp_deliveries_*`: the count never changes; for an administrator `?project_id=<other>` answers every project). Only `search` (name, code, client name) narrows and `ordering` (name, created_at, status) is declared. The project route `/api/organizations/projects/{id}/deliveries/` is scoped to the project and paginated but filters nothing either. **Minimal diff:** `filterset_fields = ("status", "client", "project", "delivery_method", "destination")` (and `client_status`) on `DeliveryViewSet`, passed through `ProjectDeliveriesView._entity_list(filterset_fields=…)` like media. **Frontend workaround:** the list offers search and sorting only; the project tab reads the project route.

### CR-18 — a sent or completed delivery can be deleted (**bug**, **APPLIED**)
**Applied** (owner approved the suggestion; backend commit `68e846fc`, tests `apps/deliveries/tests/test_list_delete_names.py`, contract `docs/deliveries/CONTRACTS.md` §11). The text below is the original finding; `samples/deliveries/_flow.json` was captured again after the fix.
`DELETE /deliveries/{id}/` by a holder of `delivery.delete` answers 204 for Submitted and Completed deliveries (`delete_submitted`, `delete_complete`), and the delivery then reads 404. `docs/deliveries/CONTRACTS.md` §4 says "delete (soft, Draft or Cancelled only)" and SEC-DLV-04 says sent deliveries are immutable: a delivery is the record of what was sent to the client. **Minimal diff:** refuse `destroy` unless the status is Draft or Cancelled (409 `invalid_transition` or `delivery_not_editable`). **Frontend workaround:** Delete is offered for Draft and Cancelled only.

### CR-19 — destination `type` is not validated (**low**, **APPLIED**)
**Applied** (owner approved the suggestion; backend commit `68e846fc`, tests `apps/deliveries/tests/test_list_delete_names.py`, contract `docs/deliveries/CONTRACTS.md` §11). The text below is the original finding; `samples/deliveries/_flow.json` was captured again after the fix.
`POST /deliveries/destinations/` with `type: "S3"` answers 201; the stored choices are "Aspera Connect", "Signiant Media Shuttle", "AWS S3 Bucket", "Frame.io Enterprise", "LTO Tape Archive", "Client SFTP" and "Hard Drive Ingest" (`models/__init__.py`). **Minimal diff:** `serializers.ChoiceField(source="destination_type", choices=…)`. **Frontend workaround:** the form offers the seven values.

### CR-20 — an item cannot be removed once the delivery was checked (**bug**, **APPLIED**)
**Applied** (owner approved the suggestion; backend commit `68e846fc`, tests `apps/deliveries/tests/test_list_delete_names.py`, contract `docs/deliveries/CONTRACTS.md` §11). The text below is the original finding; `samples/deliveries/_flow.json` was captured again after the fix.
`remove-version` works on a Draft that was never validated, but after `validate` or `prepare` it answers `409 {"error": {"code": "conflict"}}` "Resource conflict: the request conflicts with existing data." (`qcremove_remove`; the item has `DeliveryQCCheck` rows and `DeliveryQCCheck.item` is `PROTECT`, the rows being append-only). CONTRACTS §3 API-DLV-05 says items can be removed in Draft, Validating and Prepared. A mistaken item therefore forces cancelling the delivery. **Minimal diff:** let the item go with its checks marked superseded (or `on_delete=SET_NULL` on the check's item and keep the row), or say in the contract that checked items stay. **Frontend workaround:** Remove is hidden for an item that has check rows, with the reason.

### CR-21 — deliveries name people by id only (**low**, **APPLIED**)
**Applied** (owner approved the suggestion; backend commit `68e846fc`, tests `apps/deliveries/tests/test_list_delete_names.py`, contract `docs/deliveries/CONTRACTS.md` §11). The text below is the original finding; `samples/deliveries/_flow.json` was captured again after the fix.
`GET /deliveries/{id}/history/` (`actor`), `GET /deliveries/{id}/qc/` (`checked_by`) and the detail (`signed_off_by`, `client_answered_by`) carry user ids; the production histories (`/shots/{id}/status-history/` and the others) carry `actor_name`. A reader without `identity.user.view` cannot tell who signed off or sent a delivery, which is the point of the record. **Minimal diff:** add `actor_name`, `checked_by_name`, `signed_off_by_name`, `client_answered_by_name` (the user's display name or email). **Frontend workaround:** `UserName` looks the id up for callers who hold `identity.user.view` and says "A teammate" otherwise.

### Note — behaviours the Phase 8 screens rely on
- **Status words:** reads say `Ready` and `Completed` for the backend's Prepared and Complete; history rows use the backend words. `client_status` is Pending, Approved or Rejected. `client_name` is absent (not empty) when there is no client.
- **Who may do what (seeded roles):** a vfx-supervisor creates, edits, validates, prepares, **signs off and reopens** (`delivery.approve`) but cannot send or record the client's answer (`delivery.send`) or read the passcode; a production-admin does all of it except the two override codes; a lead-artist and an artist only read. A superuser is not exempt from separation of duties (the override code is held by no role).
- **Separation of duties:** whoever created the delivery, added an item or moved it to Ready cannot sign it off (403 `separation_of_duties`), whatever reason they give.
- **Create:** project required (`project_id`, an id or a code), client must exist, a blank code is numbered `DLV-<PROJECT>-<0001>`, a free destination text is refused once `destination_id` is set. `client_id`, `project_id` and `code` cannot be edited after creation.
- **Edit:** only Draft, Validating and Ready (409 `delivery_not_editable` otherwise); `status` is read-only.
- **Actions** answer the detail shape except `validate`, `prepare` and `submit`, which answer their own results (`all_valid` + per-item checks, `manifest_data`, `submission_result`), and `revise` (201, the new Draft plus `skipped_versions`). A state the action does not allow is 409 `invalid_transition` with `from` and `to`; a failed check is 409 `qc_failed` with the checks; repeating a revision is 409 `already_revised`.
- **Sending:** from Signed Off only, records `sent_at` and the optional `transfer_reference`, freezes the items (`frozen_at` on every file). Nothing is transferred by StudioHub.
- **Bulk cancel:** `ids` (1 to 100) plus an optional reason; 200 if all succeed, 207 otherwise with `error` null, `not_found` or `invalid_transition` per id.
- **Passcode:** write-only on create and edit; `has_passcode` on reads; `GET passcode/` needs `delivery.view_secret` and is audited.
- **Destinations:** names unique in any case (400 on a repeat), one default (a new default moves the old one), a supervisor can create destinations but not delete them (403), and an artist can only read them.

## Phase 9 findings (publishing) — verified against a running backend (`samples/publishing/_flow.json`)

### CR-22 — export jobs cannot be filtered or scoped to a project (**missing feature**, **APPLIED**)
`GET /publishing/?status=Exported`, `?job_status=…`, `?dcc_tool=…`, `?entity_type=…`, `?version_id=…` and `?project_id=<other>` all answer the same rows (`fp_jobs_*`: the count never changes; an administrator filtering by another project gets every project's jobs). Only `search` (name, code, shot or asset) and `ordering` work. The list row has no project id (`client_name` is the project's *name*), the detail has `project` but no `version_id`, and `/api/organizations/projects/{id}/publishing/` is a 404. So a project's jobs cannot be listed, and a job's files cannot be found from the job. **Minimal diff:** a `PublishFilterSet` (`status` in the read or the stored words as for deliveries, `job_status`, `dcc_tool`, `entity_type`, `version_id`, `project`/`project_id`), `project_id` on the list row and `version_id` on the detail, and `filterset_class` on `PublishingViewSet`. **Frontend workaround:** the list offers search and sorting; the project tab shows the project's registered files (that list filters by project); the job page has no Files tab.

### CR-23 — a job with files, or one that ran, can be deleted (**bug**, **APPLIED**)
`docs/publishing/CONTRACTS.md` §4: "delete job (soft): refused for jobs with registered files". `DELETE /publishing/{id}/` answered 204 for a job that a registered file refers to (`jobs4_delete_with_file`) and the job then reads 404. It is also accepted for Exported jobs. **Minimal diff:** refuse `destroy` when a registered file points at the job (409), and, as for deliveries, unless the job is Pending or Cancelled. **Frontend workaround:** Delete is offered for Pending and Cancelled jobs only.

### CR-24 — publish destination `type` is not validated (**low**, **APPLIED**)
`POST /publishing/destinations/` with `type: "S3"` answers 201; the choices are "Storage Cluster", "Client Delivery Ingest", "Render Farm Cache", "Cloud S3 Bucket", "Vendor Ingest", "Daily Review Repo" and "USD Asset Cache". **Minimal diff:** as CR-19. **Frontend workaround:** the form offers the seven.

**Applied** (one backend commit, tests in `apps/publishing/tests/api/test_job_list_delete_type.py`, 18 tests, every source change mutation-checked): `PublishFilterSet` (`status` takes the stored words and the read words, any case; `Published` is Validated and Exported, `Unpublished` also takes archived jobs; `job_status`, `dcc_tool`, `entity_type` any case; `version`/`version_id`, `project`/`project_id` by id, a non-id is a 400); `project_id` on the list row, `version_id` on the detail; `DELETE` is 409 `job_not_editable` outside Pending/Cancelled and 409 `job_has_files` when a registered file was produced by the job; destination `type` is validated. Contract: `docs/publishing/CONTRACTS.md` §8.

### Note — behaviours the Phase 9 screens rely on
- **Job status words:** `status` reads Queued, Publishing, Published, Failed or Unpublished and calls both Validated and Exported "Published"; `job_status` (Pending, Validating, Validated, Exporting, Exported, Failed, Cancelled) is the real one. The contract (API-PUB-08, Q15 = A) left the label change to a frontend release: the screens use `job_status`.
- **Job actions** all need `publishing.update`: `validate` (Pending or Validated), `start-export` (Validated), `complete-export` and `fail` with a required `reason` (Exporting), `retry` (Failed → Pending), `unpublish` (Pending, Validating, Validated, Failed → Cancelled, reason optional), `republish` (any status → a new Pending job, 201). Anything else is 409 `invalid_transition` with `from` and `to`. Details are editable in Pending and Failed only (409 `job_not_editable`).
- **Validating with no rules** configured passes: `all_passed: true`, every count zero, `validation_results: []`. The screen says nothing was checked.
- **Seeded roles:** a production-admin does everything but manage storage roots; a vfx-supervisor creates and updates jobs, registers files and **revokes** them (`publishing.revoke`), but cannot delete jobs or destinations; a lead-artist and an artist only read. Storage roots (`publishing.storage.manage`) are the platform administrator's. Nobody holds `publishing.status.override`, a superuser included.
- **Registering a file:** one registration per `(storage root, path)` ever (an identical retry is 200, different content under the path is 409 `path_already_registered`); only a published version of the caller's project; a root must be active; unknown keys are 400; unsafe paths (`..`, `.`, `//`, `\\`, a drive letter, a leading `/` or `~`, a trailing `/`, NUL) each answer 400 naming the rule; a frame range needs both frames, a `%04d` or `####` path and an end after the start. Uppercase hex is accepted. The registry has no PUT, PATCH or DELETE (405).
- **File lifecycle:** Registered ⇄ Deprecated (`publishing.deprecate`), Registered or Deprecated → Revoked (`publishing.revoke`, reason required, final). Leaving Revoked is 400 without an `override_reason` and 403 with one (no role holds `publishing.status.override`). `revoke_reason` is returned only to holders of `publishing.revoke`.
- **Bulk register:** 1 to 100 items, 200 when all succeed and 207 otherwise, `results[{index, ok, id, error, fields}]`.
- **Lists:** files filter by `project_id`, `version_id`, `status`, `role` and `latest=true` (the newest Registered file of each version and role); they have no search. Storage roots have no search or filter. Deleting a root that holds files is a 400 "Retire it instead.", not a 409. Destinations search by name, path and region.

## Phase 10 findings (scheduling) — verified against a running backend (`samples/scheduling/_flow.json`, 250 calls)

### CR-25 — the scheduling lists cannot be filtered (**missing feature**, **APPLIED**)
Every scheduling list is a bare array (decision D-bare, frontend contract) and each filter probe (`_by_*`, compared with a `_baseline` taken just before) answered the same rows: resources `resource_type`, `status`, `department`, `department_id`, `calendar_id`; bookings `resource`, `resource_id`, `status`, `event`; leave `status`, `resource`, `resource_id`, `leave_type`, `start_date`; events `project`, `project_id`, `event_type`, `status`, `start`, `end`; milestones `status`, `kind`, `project`, and `project_id=<code>` (answers nothing; the contract says id or code). Only `search`, `ordering`, bookings `start`/`end`, holidays `calendar_id` and milestones `project_id=<uuid>` work. Event rows have `project_name` but **no project id** (the detail has `project`), so a project's calendar cannot be told apart from another project of the same name. **Minimal diff:** one `FilterSet` per list as for deliveries (CR-17) and publishing (CR-22): `status` (any case), `resource_type`, `department_id`, `calendar_id`; `resource_id`; `leave_type`, `status`, `resource_id`, `start`/`end` window; `project_id`, `event_type`, `status`, `start`/`end` window for events; `status`, `kind`, `project_id` (id or code) for milestones; `project_id` on event rows. **Frontend workaround (in use):** the screens read the narrower bare array and filter in the browser; a calendar loads every event (fine for a studio, not for years of events).
Also seen, smaller: `POST /resolve-overbooking/` with an unknown alert answers 400 `{"detail": "['Unknown overbooking alert.']"}` (a Python list printed into the text), and a bad `start`/`end` on `GET /schedules/` answers 400 with a **bare list** body instead of an object (the error normalizer reads it, the field name is lost).

**Applied** (one backend commit, 619 scheduling tests pass, `apps/scheduling/tests/api/test_list_filters.py` has 10, every source change mutation-checked): one filter set per list (`api/filtersets.py`), `project_id` on event rows, keyed window errors, a plain `resolve-overbooking` error. Contract: `docs/scheduling/CONTRACTS.md` §12. Two reading notes: a resource's `status` filter follows the status the list shows (derived), and a leave `start`/`end` window uses plain days.

### Note — behaviours the Phase 10 screens rely on
- **Seeded roles:** a production-admin holds `schedule.manage`, `schedule.approve`, `schedule.update`, `schedule.delete`, `schedule.view_rates`; a vfx-supervisor also manages (creates calendars, resources, bookings) but cannot approve their own leave (403 "You cannot decide your own leave"); a lead-artist and an artist hold `schedule.view` and `schedule.create` only: they file leave for **their own resource** and create events, but cannot edit, change the status of or delete an event (not even their own: `schedule.update` / `schedule.delete`), and cannot decide leave. A user with no role gets 403 everywhere.
- **Rates:** `hourly_rate_usd` is `null` for a caller without `schedule.view_rates` unless the resource is their own; `?ordering=-hourly_rate_usd` is then ignored.
- **Leave:** created Pending; `status`, `total_days` and the decision fields cannot be sent; working days of the resource's calendar are counted; overlapping pending or approved leave is a 400 naming the other dates; "Unknown resource." for someone else's resource without `schedule.manage`; only Pending leave can be edited; reasons are hidden (empty) from everyone but the person and approvers; approve/reject need `schedule.approve`, `reject` needs `rejection_reason`.
- **Bookings:** `end_time` must be after `start_time` and carry a zone (naive is 400); overlapping Booked/Blocked/Overbooked bookings of one resource are 409 with the other booking's id and times in `detail`; an Available slot never conflicts; `bulk-delete` answers 200 or 207 with `results[{id, ok, error}]` and `succeeded_count`/`failed_count`; notes and titles are masked for bookings outside the caller's projects.
- **Resource status** is derived: "On Leave" while an approved leave covers today, and cannot be written; "Unavailable" is stored. Deleting a resource with bookings succeeds (soft delete).
- **Milestones:** `status` on create is ignored (always Pending); Completed is reached only through `complete`, left only through `reopen` (to In Progress); `project_id` cannot change; names are unique per project in any case; a `delivery` milestone needs a `delivery_package_id`.
- **Calendars:** one default; deleting the default or a calendar in use is 409 `calendar_in_use`. Holidays belong to a calendar (default when none is sent), unique per calendar and day.
- **Capacity and overbooking** describe the **current week** only (Monday in the resource's calendar zone). `capacity/` is one row per department (`department`, `total_resources`, `total_capacity_hours`, `allocated_hours`, `free_hours`, `utilization_pct`, `overbooked_count`); `overbooking/` lists alerts with `conflicting_events` (booking ids, hours, anonymous titles outside the caller's projects). `resolve-overbooking/` only flags the week's bookings **Overbooked** (needs `schedule.update`); the alert stays until the hours are fixed.
- **Events:** the event body takes `start_time`/`end_time` with a zone; the old frontend form's `start_date`/`end_date` is a 400; visibility Private/Team/Organization/Public narrows the list (a stranger sees only Organization/Public events); `GET /organizations/projects/{id}/schedule` returns the milestones.

## Phase 11 findings (settings) — verified against a running backend (`samples/settings/_flow.json`, ~190 calls)

### CR-26 — settings lists ignore their filters (**bug**, APPLIED)
Each of the six settings viewsets (`categories`, `definitions`, `system-settings`, `feature-flags`, `themes`, `localizations`) builds its queryset as `self.filter_class(queryset, data=params).queryset`. In django-filter `.queryset` is the queryset that was passed in; the filtered one is `.qs`. Every probe (`*_by_*` against `*_baseline`) answered the baseline: `categories?is_active=false` (one archived category) still lists both, `definitions?category=<other>`, `data_type=integer`, `flags?status=scheduled`, `themes?theme_type=light`, `locales?language=fr`, `values?setting=<id>` and `?code__icontains=` all return every row. Archiving (`is_active=false`) therefore never hides a row. No list has search or ordering. **Minimal diff:** `.queryset` → `.qs` in the six `get_queryset` methods (and a test per viewset). **Frontend workaround (in use):** the lists are small (tens of rows); the screens narrow them in the browser.

### CR-27 — a select definition with plain-string choices makes value creation a 500 (**bug**, APPLIED)
`POST /settings/definitions/` with `{"data_type": "select", "choices": ["Deadline", "Tractor"]}` answers 201 (`definitions_create_select_strings`); `POST /settings/system-settings/` for that definition then answers **500** (`values_create_select_with_string_choices`) because the validator reads `c["value"]`. With `choices: [{"value": "Deadline", "label": "Deadline"}]` the same value is accepted and `Banana` is a clean 400 "Invalid choice: Banana". **Minimal diff:** validate `choices` on the definition serializer (a list of `{value, label}` objects, required for the two select types, 400 otherwise). **Frontend workaround:** the definition form edits choices as JSON objects and says so.

### CR-28 — tags have no permission model (**security**, APPLIED)
`/api/v1/core/tags/` is `IsAuthenticatedPermission` only. An artist created a tag with `is_system: true`, renamed a system tag created by an administrator (`tags_patch_system_by_artist` 200), set `is_system` on their own tag, and **deleted the administrator's system tag** (`tags_delete_system_by_artist` 204); a user with no role created a tag. `color: "red"` is accepted, and the create answers `{name, description, color, is_system}` without `id` (the id has to be read from the list). **Minimal diff:** a permission map (`tag.view` for reads, `tag.manage`, or `settings.manage`, for writes), `is_system` read-only for everyone but a platform administrator and system tags immutable, a hex-colour check, and the create serializer returning `id`. **Frontend workaround:** the Tags screen is offered to holders of `settings.manage` only, which hides it but protects nothing; nobody in the UI creates tags yet.

### CR-29 — missing validation in settings (**low-medium**, APPLIED)
`POST /feature-flags/` with `feature_type: percentage, percentage: 150` answers 201; `POST /feature-flags/{id}/schedule/` answers 200 `{"status": "scheduled"}` with **no dates**, with an end before the start, and with naive date-times (a `RuntimeWarning` in the log); an unparseable date is a 400 whose `non_field_errors` carries Django's raw sentence. `week_start: 9` is accepted on a localization. Theme colours are checked for length (7) but not for hex. `DELETE` of the active theme is 204. **A flag has two independent booleans:** `status` (what `enable`, `disable` and `schedule` move, and what `PATCH status` writes) and `is_enabled` (what a create or a `PATCH` writes and nothing else touches): `enable` leaves `is_enabled` false, and a flag created with `is_enabled: true` is still `status: disabled` (`flags_detail_enabled`, `flags_create_is_enabled_true`, `flags_patch_status`). Which one means "on" is a question for the owner (Q-21); the client reads `status`. **Minimal diff:** `percentage` 0 to 100; `schedule` requires both dates with a zone and `end > start`; `week_start` 0 or 1; hex colours; refuse deleting the active theme; one source of truth for "on" (drop `is_enabled`, or derive it from `status`). **Frontend workaround:** the forms check all of these before sending.

### Applied: CR-26 to CR-29 (branch `sync/backend-cr-26-31`, approved with "go" after the Phase 12 report)
- **CR-26:** the six settings lists answer their filters (`.qs`); an unknown filter value is a plain 200/400, never a 500. The browser-side narrowing in the screens stays for now (it is harmless) and can go in the consistency pass.
- **CR-27:** `choices` on a definition must be a list of `{value, label}` objects (unique values), and a `select` or `multiple_select` definition needs at least one; otherwise a 400 under `choices`. A value is then checked against them (`Banana` is a clean 400), so the 500 cannot be reached.
- **CR-28:** `GET` on `/core/tags/` is open to anyone signed in (a scoped API key is still refused, as before); `POST`, `PUT`, `PATCH` and `DELETE` need `settings.manage` (the code already exists; no new code to seed). `is_system` can be set only by a platform administrator (anyone else's value is ignored), and a system tag can be changed or deleted only by one (403 "System tags cannot be changed."). `color` is empty or `#rgb` / `#rrggbb`. Create and update answer `id` and `uuid`.
- **CR-29:** a flag's `percentage` is 0 to 100 and its end must follow its start; `schedule` needs both dates, parseable and with a zone, and `end > start` (400 keyed by field, no raw Python text); a localization's `week_start` is 0 or 1; theme colours are `#rrggbb`; the **last active** theme cannot be deleted (400).
- **Q-21 answered:** `status` is "on". `is_enabled` is read-only and follows it (`enable` sets it, `disable` and `schedule` clear it, a create or patch derives it from the status that results); an enabled boolean flag is now on for a user (before, `enable` left it off); a scheduled flag without a start is off instead of a `TypeError`. No migration (the column stays).
- **Q-22 not applied, and why:** `is_active` on a theme or a localization defaults to **true** and is the same field as an archived/available flag (light and dark themes, several languages are meant to be active together), so making activation exclusive would silently deactivate rows when a new one is created. The model has no "default" or "current" marker to build "the active theme" on. If the studio wants one, it needs a new field (`is_default`) and a migration; that is a separate request. The CR-29 guard (the last active theme stays) is the part that follows from the idea without that field.
- **Q-22 applied afterwards** (branch `sync/q22-default-theme-locale`, on the owner's "yes"), as described above: a new `is_default` field, not a change to `is_active`.

### Applied: Q-22, one default theme and one default localization (branch `sync/q22-default-theme-locale`)
`is_active` keeps meaning "available" (several rows may be active). The new `is_default` (migration `settings/0002_theme_localization_default`) marks **the one the app uses**:
- At most one row of each kind is the default: a partial unique constraint (`is_default` and not deleted) holds it in the database. The default is always active.
- `is_default` is read-only on every write. `POST /themes/{id}/set-default/` and `/localizations/{id}/set-default/` (`settings.manage`) move it in one transaction: the previous default is cleared first, and it stays active. An inactive row cannot be made the default (400).
- The first active row made through the API becomes the default, so there is one whenever there is anything to choose from; the migration chose the earliest active existing row of each kind. An inactive first row does not.
- The default cannot be deactivated (the action or a `PATCH`), nor deleted (400, "Make another one the default first."). This replaces CR-29's "the last active theme cannot be deleted".
- `GET /themes/default/` and `GET /localizations/default/` answer the one the app uses (404 until one exists). They are open to anyone signed in (like the feature flags) and reachable with a scoped key; the lists, details and every write keep `settings.view` / `settings.manage`. The lists also filter on `is_default`.
- Tests: `apps/settings/tests/api/viewsets/test_q22_default.py` (33), 20 source and migration changes reverted in turn and caught. Frontend: both list screens show a Default badge and a "Make default" action, hide Deactivate and Delete on the default; applying the theme or locale to the app is still not done.

### Note — behaviours the Phase 11 screens rely on
- **Who may:** `settings.view` is held by the platform administrator and the production-admin; `settings.manage` (every write, lock, enable, activate, archive) by the platform administrator only. A vfx-supervisor, a lead, an artist and a user with no role get 403 on every settings list except the **feature flags**, which any signed-in user reads (the flags decide what the app shows).
- **ids** are uuids (`id` equals `uuid`). Category `code` is one of 14 fixed words (general, project, media, workflow, review, delivery, notification, billing, branding, analytics, ai, localization, theme, security); anything else is a 400 "is not a valid choice". A definition's `data_type` is one of 14 types and its `scope` is `system`.
- **Values:** one value per definition (a second is 400 "The fields setting must make a unique set"), always a string; checked against the definition (type, `validation_rules` min/max/min_length/max_length, `choices`, `is_required`). `lock` and `unlock` answer `{"status": "locked"}` and are idempotent; a locked value cannot be edited (400) or deleted (403 "Setting '…' is locked.").
- **Archive** (categories, definitions) sets `is_active=false` and answers `{"status": "archived"}`; the row stays in the list (CR-26). A definition's `code` can be changed after values exist (the value rows then show the new code).
- **Activation is not exclusive:** activating a theme or a localization leaves the others active (two themes and three localizations were active at once), and `deactivate` on an inactive one is 200. There is no "the active theme" to read.
- **Feature flags:** `status` is `enabled`, `disabled`, `scheduled` or `expired` and follows the actions; `enable`/`disable` answer `{"status": …}`; the flag types are boolean, percentage, scheduled and rollout; the server does no rollout bucketing (the client would have to).

## Phase 12 findings (dashboards) — verified against a running backend (`samples/dashboards/_flow.json`, ~75 calls)

### CR-30 — the dashboard's milestones are invented (**bug**, APPLIED)
`GET /projects/{id}/dashboard/` returns `schedule.milestones` of exactly five entries, ids `m1` to `m5`, with the names "Plate Turnover & Ingest", "Rough Layout & Asset Conform", "Mid-Point Client Temp Screening", and two more, dated at 0, 25, 50, 80 and 100 % of the span between the project's start and delivery date, and statuses derived from `overall_progress_pct` (the first is always "completed"). A project with two real milestones (Turnover, Previs lock) gets none of them; an empty project gets the five, the first "completed" on its first day. `GET /organizations/projects/{id}/schedule` already reads the real ones through provider `scheduling.project_milestones` (API-SCH-11). **Minimal diff:** build `schedule.milestones` from the same provider (`id`, `name`, `date`, and a status among `completed`, `in_progress`, `upcoming`, `overdue`), empty when there are none, and drop the fixed names. **Frontend workaround (in use):** the widget ignores the payload's milestones and lists the project's own from `/scheduling/milestones/?project_id=` (needs `schedule.view`).

### CR-31 — dashboard counts and flags disagree with the rules (**bug**, APPLIED)
- `tasks.recent_tasks[].is_overdue` is computed with `completed_only=True`, so only status "Completed" is finished: two **Approved** tasks past their dates were flagged overdue while `tasks.overdue` (and `summary.overdue_tasks`) counted one, the unfinished task (`dashboard`: T006, T007 flagged; T002 counted). **Frontend workaround:** a flagged task is overdue only while unfinished (`taskIsOverdue`).
- `deliveries.late` counts any delivery past its date whose status is not in `delivered, approved, sent, complete`: a **Cancelled** delivery is late; a **Completed** one (the read word is `completed`) is neither delivered nor on time; `upcoming` is everything else (`total - delivered - late`), so a Draft, a Cancelled and a Rejected delivery are all "upcoming". With one Draft due later, one Draft overdue and one Cancelled overdue the server says late 2, upcoming 1, delivered 0. **Frontend workaround:** the delivery figures are counted from the listed deliveries (Cancelled left out, finished words recognised) whenever the list holds every delivery; otherwise the server's numbers are shown. **Minimal diff:** treat `cancelled` as neither late nor upcoming, add `completed` and `signed off` to the delivered words, and use the same overdue rule for the flag and the count.

### Applied: CR-30 and CR-31 (branch `sync/backend-cr-26-31`)
- **CR-30:** `schedule.milestones` are the project's own milestones, read through the same provider as the schedule route (`id`, `name`, `date`, and a `status` of `completed`, `in_progress`, `overdue` (not completed and past its date) or `upcoming`); an empty project gets `[]`. The fixed names and the dates at fractions of the span are gone, and `overall` no longer feeds the schedule. The section is built for anyone who may read the dashboard (`project.view`), not only holders of `schedule.view`; the milestone names and dates are project information a member already sees on the project.
- **CR-31:** the task flag `is_overdue` and the `overdue` count use one rule (past its date and not Completed, Approved or Done). A delivery is **delivered** when its status is one of delivered, approved, sent, accepted, complete, completed, signed off (whatever its date), **late** when it is not delivered and past its date, and a **Cancelled** one is neither late nor upcoming; `delivered + late + upcoming + cancelled = total`. `total_deliveries` still counts the cancelled ones. A Rejected delivery past its date remains late (the client said no; it is still owed).
- **Frontend:** the workarounds that recomputed these figures (`getDeliveryFigures`, `taskIsOverdue`, the HUD's `deliveries` prop) are removed in their own commit; the screens show the server's figures as they are. The milestones card still reads Scheduling directly (it links to adding one and follows edits); the payload carries the same rows.

### Note — behaviours the Phase 12 screens rely on
- **Who may:** `GET /projects/{id}/dashboard/`, `statistics/` and the project summary need project membership with `project.view`: a member (artist, supervisor) and a platform administrator read them; someone in no project gets **404** (not 403, nothing is revealed), a user with no role 403, and an external (client) member 404 on the whole-project figures.
- **The dashboard** has ten sections (`project`, `summary`, `production`, `shots`, `tasks`, `reviews`, `schedule`, `workload`, `deliveries`, `activity`); every count is a real aggregate of the project's rows (shots 10, tasks 8, assets 4, reviews 5 in the capture). `production.overall_progress_pct` is `60 % approved shots + 40 % completed tasks` (it says so in `methodology_note`); `summary.shots_at_risk` is the number of **On Hold** shots; `tasks.critical` is **overdue or blocked**, not priority Critical; `schedule.is_delayed` is a rule (a late delivery or more than two overdue tasks), not a comparison with a plan. A project without dates gets today and +180 days.
- **`recent_*` lists** are the latest rows (tasks, shots, reviews, deliveries, activity); a `workload` row names the person by e-mail when there is no display name, and its `id` is prefixed `user-`.
- **Analytics:** `GET /analytics/kpis/` and `/analytics/departments/` need only a signed-in user and are narrowed to the caller's projects (a platform administrator sees every project, a user in none gets zeros and `[]`). `render_nodes_busy`, `render_nodes_total` and `average_render_time_mins` are `null` (no source); `storage_usage_tb` and `storage_quota_tb` are `0` (no telemetry, not "empty"). `active_artists` counts people with at least one assigned task. Departments with no name on their tasks are left out. Both routes are read-only (POST is 405).
- **The statistics route and the summary's `counts`** are the same twelve counts (`shots`, `tasks`, `assets`, `reviews`, `deliveries`, `sequences`, `versions`, `notes`, `editorial`, `approved_shots`, `in_progress_shots`, `completed_tasks`).

## Phase 14 findings (workspaces): owner requirement, 2026-10-31

### CR-32: a person can be in only one team (**missing feature**, **OPEN, needs approval**)
**Requirement (owner, in answer to the Phase 14 question):** "multiple team can have same person", a person may belong to several teams at once.

**Evidence (code):** `Person.team` is a single nullable `ForeignKey("masterdata.Team")` (`apps/masterdata/models/person.py`); `Team` has `lead` and no member list; `PersonSerializer` exposes `team` and `team_name`; `GET /people/?team=<id>` filters on that one column; and `PersonService` enforces DOM-MD-PER-06 ("a team belongs to one department, so the pair must agree"). Phase 14 therefore implements membership as `PATCH /people/{id}/ {team}`: adding a person to a second team **moves** them out of the first (the dialog says so). Nothing in the API can express two teams.

**Why a frontend workaround is not possible:** the only stored relation is the one column. A client-side list of extra teams would live in the browser and be wrong for everyone else.

**Minimal proposed change (backend, not made):**
1. New model `masterdata.TeamMembership(team FK PROTECT, person FK CASCADE, joined_at date null, role CharField blank, + the platform base fields)` with a partial unique constraint on `(team, person)` among non-deleted rows; one migration (`0002`), whose data step creates a membership for every existing `Person.team`.
2. New viewset `GET/POST /api/v1/team-memberships/`, `GET/PATCH/DELETE …/{id}/` with filters `team` and `person`, permission `masterdata.directory.manage` for writes (as the other directory routes); contract and sample added.
3. `Person.team` stays as the person's **primary team** so no existing client breaks; the DOM-MD-PER-06 department rule applies to the primary team only (extra teams may belong to other departments, which is the point). Setting `Person.team` also ensures a membership row exists.
4. Deleting a team with memberships is refused as `has_dependants` (like departments with teams); deleting a person removes their memberships.

**Open design questions for the owner:** (a) should a member carry a role or join date, or is membership a plain link? (b) must every membership's team match the person's department, or may a person sit in teams of other departments? (c) should `Person.team` remain as the primary team, or be removed?

**Frontend after approval:** the Team Members tab and the Person Teams tab read and write `team-memberships`; the people-with-`?team=` list is replaced. Until then both use `Person.team` (one team).
