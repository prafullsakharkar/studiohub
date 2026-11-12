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

### CR-32: a person can be in only one team (**missing feature**, **APPLIED**)
**Requirement (owner, in answer to the Phase 14 question):** "multiple team can have same person", a person may belong to several teams at once.

**Evidence (code):** `Person.team` is a single nullable `ForeignKey("masterdata.Team")` (`apps/masterdata/models/person.py`); `Team` has `lead` and no member list; `PersonSerializer` exposes `team` and `team_name`; `GET /people/?team=<id>` filters on that one column; and `PersonService` enforces DOM-MD-PER-06 ("a team belongs to one department, so the pair must agree"). Phase 14 therefore implements membership as `PATCH /people/{id}/ {team}`: adding a person to a second team **moves** them out of the first (the dialog says so). Nothing in the API can express two teams.

**Why a frontend workaround is not possible:** the only stored relation is the one column. A client-side list of extra teams would live in the browser and be wrong for everyone else.

**Minimal proposed change (backend, not made):**
1. New model `masterdata.TeamMembership(team FK PROTECT, person FK CASCADE, joined_at date null, role CharField blank, + the platform base fields)` with a partial unique constraint on `(team, person)` among non-deleted rows; one migration (`0002`), whose data step creates a membership for every existing `Person.team`.
2. New viewset `GET/POST /api/v1/team-memberships/`, `GET/PATCH/DELETE …/{id}/` with filters `team` and `person`, permission `masterdata.directory.manage` for writes (as the other directory routes); contract and sample added.
3. `Person.team` stays as the person's **primary team** so no existing client breaks; the DOM-MD-PER-06 department rule applies to the primary team only (extra teams may belong to other departments, which is the point). Setting `Person.team` also ensures a membership row exists.
4. Deleting a team with memberships is refused as `has_dependants` (like departments with teams); deleting a person removes their memberships.

**Design questions, answered by the owner's approval of my recommendation (2026-10-31):** (a) a plain link, no role or join date; (b) teams of any department (the department rule applies to the primary team only); (c) `Person.team` stays as the primary team.

**Frontend after approval:** the Team Members tab and the Person Teams tab read and write `team-memberships`; the people-with-`?team=` list is replaced. Until then both use `Person.team` (one team).

### Applied: CR-32 (branch `sync/backend-cr-32`, approved 2026-10-31)
- **Model and migration:** `masterdata.TeamMembership(team PROTECT, person CASCADE)` with a partial unique constraint on live `(team, person)`; `0002_team_membership` also makes every live person with a live `team` a member of it (idempotent).
- **API:** `/api/v1/team-memberships/` (list, retrieve, create, delete, `restore`; PUT/PATCH → 405), filters `team` and `person`, rows carry `team_name, person_name, person_status, person_department_name, person_office_name`. Reads open to any signed-in user; writes need `masterdata.directory.manage`.
- **Rules:** a duplicate add is a 400 naming `person`; removing the membership of the primary team clears `Person.team` (found while building the screens: without it a person could name a team they had left); a team with members cannot be deleted (409 `has_dependants`); `Person.team` stays as the primary team and setting it creates the membership; deleting a person soft-deletes their memberships and restoring brings back the ones removed with them; a hard delete removes them.
- **Evidence:** 23 new tests (`test_team_membership_api.py`); 14 source mutations tried: 13 caught (two were first missed, by a test that ignored status codes and by one the database constraint backed up, and were strengthened) and one, dropping the `is_deleted=False` in the migration filter, is equivalent because the default manager already hides deleted rows; `apps/masterdata`, bootstrap and audit suites 1,454 pass and 1 fails that is not mine (the deliveries migration-count test); `makemigrations --check` clean; ruff clean; basedpyright 0 errors; schema snapshot gained only the three new paths. `masterdata` now has two migrations, the most the bootstrap test allows.
- **Frontend:** the Team Members tab and the Person Teams tab move to `team-memberships` (next commit series); `GET /people/?team=` is not used for membership any more.

### CR-33: a team has no member count (**low**, **APPLIED**, branch `sync/backend-cr-33`)
**Evidence:** `GET /teams/` rows (`samples/masterdata/teams.json`) have no count of members, while clients and vendors carry `contact_count`. The screens could show the number only by fetching every team's memberships. **Change (approved 2026-10-31, "go ahead with CR-33"):** `TeamSelector` annotates `member_count` (live memberships) and `TeamSerializer` exposes it read-only; no migration. A person in two teams counts once in each; removed memberships do not count; the list still costs a fixed number of queries.
**Evidence of the fix:** 5 tests (`TestMemberCount`), 3 of 3 mutations caught (a removed membership counted; the count taken from `persons` instead of `memberships`; the field left out); `apps/masterdata`, bootstrap, audit and scheduling suites 2,078 pass and 1 fails that is not mine (the deliveries migration-count test); ruff clean; basedpyright 0 errors. Real responses: `samples/masterdata/_team_memberships_flow.json` (`teams_list`, `team_detail`). **Frontend:** the Team type gains `member_count`; the teams list, the team Overview and the person's Teams tab show it.

## Phase 18 findings (shot and asset workspaces) — verified against a running backend (`samples/production/_workspaces_flow.json`)

### CR-34: a shot's or asset's artist need not be a project member (**low**, **APPLIED**, branch `sync/backend-cr-34`)
**Evidence:** `PATCH /shots/{id}/ {"assigned_artist": <user outside the project>}` answered **200** and stored it (task assignees already must be members: "Unknown user."). **Change (approved by the owner, "Yes and approved"):** `require_assignable_artist` (`apps/production/validators/references.py`), called from the shot and asset `validate_references` hooks, so it covers create, update and the bulk items; a **new** artist must be an active member of the project (platform administrators pass); an unchanged artist is not re-checked and `null` unassigns. Contract C-51. **Evidence of the fix:** 16 tests (`test_cr34_artist_membership.py`; shots and assets: assign, unassign, non-member, member of another project, inactive member, create, an artist who left, bulk create and bulk update), 5 of 5 mutations caught; production, masterdata and bootstrap suites 2,558 pass and 1 fails that is not mine (the deliveries migration-count test); ruff clean; basedpyright 0 errors. Real responses: `shot_assign_non_member_400`, `asset_assign_non_member_400`. **Frontend:** the assign dialog shows the server's reason; its comment no longer says the server does not check.

### CR-35: `bulk-update` answers "updated" and changes nothing when the item uses the documented shape (**bug**, **APPLIED**, branch `sync/backend-cr-35`)
**Evidence (running backend, `bulk_update_wrapped` / `shot_after_bulk_wrapped` / `bulk_update_flat` / `shot_after_bulk_flat`):** `POST /shots/bulk-update/ {"items": [{"id": X, "data": {"description": "Wrapped"}}]}` answers 200 with `successful: 1` and `actionTaken: "updated"`, but the shot's description is still `""`; the same call with the fields beside the id (`{"id": X, "description": "Flat"}`) applies them. The typed module's `bulkUpdate(items: [{id, data}])` and the earlier capture (`_work_flow.json` `shots_bulk_update`, whose "success" proved nothing) used the wrapped shape. `PATCH` of the same route behaves the same. The same applies to assets, episodes and sequences (one shared service). No screen calls it today, so nobody is hurt yet.
**Minimal proposed diff:** in `ProductionBulkMixin` / `bulk_update` (`apps/production/services/bulk.py`), read the fields from `item["data"]` when it is a dict (and still accept flat fields), and refuse an item that carries no updatable field as `invalid` instead of "updated". **Why a frontend workaround is not possible:** the request shape is the contract; the workaround (sending flat items) only works until the route is fixed, and the route reports success for a call that did nothing. **Frontend until then:** the typed `bulkUpdate` sends flat items (verified against the capture).

**Applied (approved by the owner, 2026-10-31):** `ProductionBulkService._item_fields` (`apps/production/services/bulk.py`) reads an update item's fields from beside the id **and** from a `data` object (the wrapped fields win; a `data` that is not an object is dropped like any unknown field); an item that carries no field the entity can change is reported `invalid` (`{"non_field_errors": ["The item has no field that can be updated."]}`) instead of "updated". The other shapes (`{items: [...]}`, a bare list, `{ids, changes}`) and every per-item rule (the project-member artist rule, the status workflow, the privileged-value guard) are unchanged. One service, so it covers shots, assets, episodes and sequences. Contract C-52.
**Evidence of the fix:** 22 tests (`test_cr35_bulk_update.py`, shots and assets: wrapped, flat, both, `ids` + `changes`, the artist rule through a wrapped item, five kinds of item with nothing to update, one empty item beside a good one), 4 of 5 mutations caught (the fifth, leaving `data` among the flat fields, is equivalent: the serializer ignores an unknown key); the production, masterdata and bootstrap suites 2,580 pass and 1 fails that is not mine (the deliveries migration-count test); ruff clean; basedpyright 0 errors. Real responses: `samples/production/_workspaces_flow.json` (`bulk_update_wrapped` then `shot_after_bulk_wrapped` is now `Wrapped`; `bulk_update_nothing_to_update`). **Frontend:** the typed `bulkUpdate` keeps spreading the fields beside the id (it works before and after the fix); the contract test now pins the fixed behaviour.


### CR-36: a project member cannot be bound to a show through the API (**feature gap**, **APPLIED**, branch `sync/backend-cr-36`)
**Problem.** A `ProjectMembership` can be bound to **one show** of its project (`ProjectMembership.show`, ADR-0033 D2: "narrows this membership to a single show within the project"; `save()` makes it `scope: "SHOW"`). The backend enforces it: a show-bound member sees only that show's records (`selectors/internal_scope.py`, `ProductionBaseSelector._internal_q`, the `Show` scope in `scope_queryset`), what they create defaults into their show (`default_show_id`), and they cannot take a record out of it (`viewsets/base.py` `_resolve_show`). Tests cover it (`tests/security/test_internal_narrowing.py`, `test_show_assignment.py`, `test_canonical_access_matrix.py`). But **no request can create or change such a membership**: only the `assign_shows` management command and the ORM can. So the feature exists, is enforced, and cannot be used.

**Evidence (running backend, `docs/sync/samples/production/_membership_show_flow.json`, `docs/sync/tools/test_capture_membership_show.py`):**
- `POST /api/organizations/projects/{id}/members/ {"user_id": …, "role": "Artist", "show": <show id>}` → **201**, and the stored row has `show_id: null, scope: "PROJECT"`. The same with `show_id` → 200 (the member already exists), still unbound. The field is ignored without an error.
- `GET …/members/` rows carry `department`, `department_id`, `team_id`, `vendor_id`, `client_id`, `scope`, but **no `show_id`**, so an administrator cannot see who is bound to what.
- `PATCH` and `DELETE …/members/{id}/` → **404** (the route does not exist): a member can be added (and re-adding the same user updates them), never removed or narrowed except by adding again.
- Once a membership is bound in the database, `GET /auth/me/` returns it with `scope: "SHOW"` and the real `show_id`, and the frontend's permission engine already honours it (`core/permissions/access.ts`).

**Minimal proposed diff (backend, 4 files plus tests):**
1. `apps/production/api/serializers/membership.py`: `ProjectMembershipCreateSerializer` gets `show = UUIDField(required=False, allow_null=True)`; `validate` rejects a show that is not this project's (or is deleted) with `{"show": ["Unknown show."]}`. `ProjectMembershipSerializer` gets read-only `show_id` (and `show_code`).
2. `apps/production/services/project_scoped.py`: `add_member(..., show=_UNSET)`: **omitted leaves the binding alone, `null` clears it** (back to the whole project), a show binds it; applied on create, on update of an existing member and on restore of a soft-deleted one. `scope` stays derived by `ProjectMembership.save()`.
3. `apps/production/api/views/project_scoped.py` (`ProjectMembersView.post`): pass the validated show through. No new permission: it is already behind `_require_member_management` (superuser, global admin, or the project's creator).
4. Docs: `docs/production/CONTRACTS.md` (C-53) and `DECISIONS.md` (D-35).
5. Tests (`tests/test_cr36_member_show.py`): bind on create, rebind, clear with `null`, omitted leaves it, unknown show and another project's show → 400, a soft-deleted show → 400, the response and the list carry `show_id`, a re-add restores a deleted row with its show, a **bound member then sees only that show's shots through the API** (the end-to-end proof that the binding works), and a member manager who is bound cannot widen their own binding. Each source change mutation-checked.

**Why a frontend workaround is not possible.** The binding is a server-side fact (a column the API never writes). The frontend cannot set it, and must not fake it in the UI: a picker that appeared to restrict a member while the server did not would be worse than none.

**Frontend work after approval (not before):** the project members panel gets a "Show" picker (the project's shows from `showsApi`, "Whole project" as the default), a Show column in the list, the `ProjectMember` type and the captured sample updated, tests (unit from the captured sample, live: bind a member, sign in as them, see only that show), and the permission scope in the UI stays as it is (a bound member's own show comes from `/auth/me`).

**Not in this request, and the owner may want it:** (a) **department narrowing** has the same gap (`department` / `department_id` are readable and enforced, not writable; `add_member` already takes `department_id`, the serializer does not); (b) there is **no route to remove a member** (404 above). Both are separate requests; say if you want them folded in.

**Risk.** Low. Only a caller who can already manage members can bind; binding can only *narrow* what a member sees (it cannot grant a permission code); an omitted field changes nothing for every existing client.

**Applied (approved by the owner, 2026-11-02, "Approved CR-36"):** exactly the proposed diff, in `serializers/membership.py` (`show` on create with the project check, `show_id` and `show_code` on the rows), `services/project_scoped.py` (`add_member(show=UNSET)`: omitted leaves it, null releases it) and `views/project_scoped.py` (the show passed through, the list selects it); contract C-53 and decision D-35 in `docs/production/`.
**One planned test became a different test.** The plan said "a member manager who is bound cannot widen their own binding". I first wrote a rule for it and found it could never run: the members routes need *full* project access, so a bound member gets 404 on every one of them. The rule was removed (dead code) and a test pins the 404 instead (`TestABoundMemberCannotManageMembers`).
**Evidence of the fix:** 16 tests (`apps/production/tests/test_cr36_member_show.py`): bind on create, no show means the whole project, re-adding leaves the binding, null releases, moving, the list carries `show_id` and `show_code`, unknown / another project's / deleted / not-an-id shows refused with nothing stored, an existing binding survives a refused show, a non-manager cannot bind, a deleted membership restored with and without a show, **a member bound through the API sees only that show's shots and sees all of them again once released**, and a bound project creator is refused (404) on list and add. **11 of 11 source mutations caught** (write field, project check, validation, `show_code`, list fields, re-add clearing, re-add ignoring, restore, create, view, deleted-show filter). Production, masterdata, audit and identity API tests: **3,087 pass** (the full backend suite was not run, as agreed).
**Not in CR-36 (separate requests if wanted):** department narrowing has the same missing write path; there is no route to remove a member.

### CR-37: a project member cannot be edited or removed by id; a department cannot be set (**feature gap**, **APPLIED**, branch `sync/cr-37-member-detail`)
**Problem.** `projects/{id}/members/` has `GET` and `POST` and nothing else. So:
1. A member **cannot be changed except by adding them again**, and an add has side effects on someone who already exists: it writes `status` (the serializer default is `active`), `scope` (default `PROJECT`) and replaces `roles` with the one `role`. A plain re-add therefore **reactivates a suspended or terminated member and drops their other roles**. The frontend works around it for a show change by sending the member's own values back (CR-36), which is a workaround for a missing edit route, not a design.
2. A member **cannot be removed** at all (and cannot be suspended or terminated through the API: `status` can only be set on an add).
3. **Department narrowing** (a membership that names a department sees only that department's tasks and what they reach; enforced in `selectors/internal_scope.py`, tested in `tests/security/test_internal_narrowing.py`) cannot be set through the API: `department` and `department_id` are on the rows, not on the add serializer. Only the ORM can.

**Evidence (running backend, `docs/sync/samples/production/_member_detail_flow.json`, `docs/sync/tools/test_capture_member_detail.py`; the member holds every permission code, so only the membership decides access):**
- `PATCH` and `DELETE …/members/{id}/` → **404** (no such route).
- A member with `status: "active"` reads the project: **200**. Suspended (set in the database): **404**. Soft-deleted: **404**. So `status` and removal are real, enforced levers (`ProductionBaseSelector._active_memberships`: `status = active` and `is_deleted = False`); only the API to pull them is missing.
- A suspended member re-added with `{"role": "Artist"}` → **200, `status: "active"`, `roles: ["Artist"]`**: reactivated, and the second role is gone. The call is the only "update" there is.
- `POST … {"role": "Artist", "department": "Comp", "department_id": "d-comp"}` → 200, and the stored row still has `department: ""`, `department_id: ""`: **ignored without an error**.

**Minimal proposed diff (backend):**
1. **`PATCH projects/{project_id}/members/{member_id}/`** (new route beside `members/`; `{member_id}` is the membership `id` the rows already carry). Body, every field optional: `role`, `roles`, `role_id`, `status` (`active | on_leave | terminated | suspended`, case-insensitive as on the add), `show` (as in CR-36: `null` releases, an id binds, another project's or a deleted show is `400 Unknown show.`), `department` and `department_id` (text, as the rows already carry them; blank clears; a task's department is free text matched case-insensitively, so no masterdata link is assumed). An empty body is `400 {"non_field_errors": ["Nothing to update."]}` (the CR-35 rule). It answers `200` with the member row. `user`, `project`, `vendor_id` and `client_id` are not editable here.
2. **`DELETE projects/{project_id}/members/{member_id}/`** → `204`, a soft delete (the model's own; re-adding the user restores the row, which `add_member` already does). Records the person is assigned to are **not** touched (the rule since C-51: a record whose artist has left can still be edited).
3. **Permission:** the same as adding: `ProjectPermissions.UPDATE` plus `_require_member_management` (superuser, global admin, or the project's creator). A member bound to a show or a department already gets **404** on every members route (full project access is required), so none of this can widen anyone's reach from inside a narrowed membership.
4. **One new guard:** nobody may remove, suspend, put on leave or terminate **their own** membership through this route (`400 {"detail": "You cannot take your own membership off the project."}`). Without it a project creator can lock themselves out (the members routes need full membership) in one click. A platform administrator can still do it for someone else.
5. `POST members/` is **unchanged** (add, or re-add as before), so no existing client changes behaviour. Its side effects on an existing member are documented in the contract instead of altered.
6. Docs: `docs/production/CONTRACTS.md` (C-54), `DECISIONS.md` (D-36). Tests: each field on its own; status changes remove and restore access (the member really gets 404 and 200 again); delete then re-add; the empty body; unknown show; the self-protection rule in both directions; the narrowed-member 404; department narrowing set through the API **actually narrows** what that member lists; mutation checks on every source change.

**Why a frontend workaround is not possible.** Suspending, removing and department narrowing are server-side state with no write path. For a show change the frontend already re-adds with the member's own values (CR-36), and that is as far as a workaround goes.

**Frontend work after approval:** the members panel gets a status select, a Remove action (with a confirmation), and a Department field; the show picker switches from "re-add with the member's own values" to `PATCH` (the workaround is deleted); the `ProjectMember` samples and the pinned key lists are re-captured; unit tests from captured samples, a live test (suspend a member and see them lose the project, restore, remove, narrow by department and see only that department's tasks).

**Decisions for the owner (my recommendation first):**
- **Self-protection (item 4):** yes, as proposed. Say if you would rather allow it.
- **`POST` for an existing member:** leave it as it is (item 5). The alternative is to make an add leave `status` and `roles` alone for someone already on the project; that would take away the only way the UI reactivates a member today, so I would do it only after this route exists.
- **Delete is a soft delete** that a re-add restores. There is no "purge".

**Risk.** Low to medium: new route and one new write path, no migration, no change to the existing add. Removing or suspending is what the feature is for; it needs the same privilege as adding.

**Applied (approved by the owner, 2026-11-02, "Approved CR-37", as written, including the self-protection guard, `POST` unchanged and the soft delete):** `PATCH` and `DELETE` on `projects/{id}/members/{member_id}/`, the update serializer, `ProjectMembershipService.update_member` / `remove_member`, contract C-54 and decision D-36 (`docs/production/`). Evidence, the one addition (a restored member no longer keeps the department it had) and the frontend are in `docs/sync/backend-cr-37-verification.md`: 25 backend tests, 16 of 16 source mutations caught, production/masterdata/audit/identity API tests 3,111 pass, a live test against the real backend.

### CR-38: adding a person who is already a member reinstates them and demotes them (**bug**, **APPLIED**, branch `sync/backend-cr-38`)

Found in Phase 24 (§5 of `backend-cr-36-verification.md`), left alone in CR-36 and CR-37 ("`POST` unchanged"), and now written up with its own capture: `samples/production/_readd_flow.json`, `tools/test_capture_readd.py`.

**Problem.** `POST projects/{id}/members/` is documented as an idempotent add, but for a person who is already on the project every field the request leaves out takes the serializer's default and the default **overwrites the stored value**: `status` becomes `active`, `role` becomes `Artist`, `roles` becomes `[role]` (`ProjectMembershipCreateSerializer`: `status` default `"active"`, `role` default `"Artist"`; the view: `roles = payload.roles or [payload.role or "Artist"]`; `add_member`: `membership.status = status or membership.status`, where `status` is never empty). So a call that means only "make sure this person is on the project" can:
- **give project access back to someone an administrator suspended, put on leave or terminated**, and
- **demote a Lead or Supervisor to Artist** and drop their other roles.

Nothing in the request asks for either. Anyone who may manage members can do the same on purpose with `PATCH` (CR-37), so this is not a privilege problem: it is a side effect nobody asked for, and a quiet one (the answer is a normal `200`).

**Evidence** (real responses, pytest test database; a Lead with `roles ["Lead","Artist"]`, each added with an explicit status, then added again with **only** `{"user_id": …}`):

| Before | Request | After | Can the member open the project? |
|---|---|---|---|
| `suspended`, Lead, `["Lead","Artist"]` | `{"user_id": …}` | `200`, **`active`**, **`Artist`**, **`["Artist"]`** | `404` → **`200`** |
| `on_leave`, same | same | `200`, **`active`**, `Artist`, `["Artist"]` | `404` → **`200`** |
| `terminated`, same | same | `200`, **`active`**, `Artist`, `["Artist"]` | `404` → **`200`** |
| `active`, Lead | same | `200`, `active`, **`Artist`**, `["Artist"]` | `200` |
| `active`, Lead | `{"user_id": …, "role": "Artist"}` (what the frontend's add form sends) | `200`, `active`, `Artist`, `["Artist"]` | `200` |

(`_readd_flow.json`: `add_*`, `readd_*_user_only`, `*_sees_project_before/after`, `readd_lead_with_role`. The earlier captures `other_readd_naive` and `readd_plain` show the same with a role sent.)

**Minimal proposed diff** (backend only, no migration):
1. `ProjectMembershipCreateSerializer`: no default for `status`, `role` and `scope` (the fields stay optional, and an omitted one is absent from `validated_data`).
2. The view: `roles` is `payload["roles"]` when sent, else `[payload["role"]]` only when a role was sent, else `None`.
3. `ProjectMembershipService.add_member`: `role`, `roles`, `scope`, `status` default to `None`. For an **existing** member only what the request names changes (it already does `x or membership.x`); for a **new** member the defaults are applied where the row is made (`status or "active"`, `role or "Artist"`, `roles or [role or "Artist"]`, `scope or "PROJECT"` already read that way). A **restored** (soft-deleted) membership still starts fresh, as today.
4. Tests: a re-add naming only the person changes nothing for each of the four statuses and for a Lead; a role sent changes the role and roles (as before); a status sent changes the status; a new member still defaults to `active`/`Artist`/`["Artist"]`/`PROJECT`; a restored membership is fresh; the member's access (404/200) follows the status; the existing CR-36 and CR-37 tests stay green. Mutation-check each default.
5. `docs/production/`: contract C-55 and decision D-37.

**Why no frontend workaround.** The frontend can only avoid the side effect by reading the member list first and sending every stored value back (what `setMemberShow` did before CR-37). That is a race (the list can change between the read and the write), it is not available to any other client of the API, and the add form sends `role: "Artist"` on purpose, so the **role** half of the problem cannot be avoided by the form at all.

**Compatibility.** An add of a **new** person is unchanged. An add of an existing person that names a role still replaces the role (and roles), as today, and one that names a `status` still sets it. What changes is only the unrequested overwrite. The frontend's add form keeps working; a person already on the project who is added again from the form keeps their status, and their role becomes whatever the form says (as before).

**Risk.** Low: three small defaults and a view line, no migration, no new route. The behaviour change is the point of the request; a caller that relied on "add again reactivates them" must now send `"status": "active"` (or use `PATCH`, CR-37).

**Approved by the owner, 2026-11-03 ("Approved CR-38"), as written.** **Applied** as written on `sync/backend-cr-38` (report `backend-cr-38-verification.md`; contract C-55, decision D-37): 18 new tests, 11 of 11 mutations caught, 3,130 related tests pass. The captures before and after are `samples/production/_readd_flow.json` and `_readd_after_cr38_flow.json`.

### CR-39: an account that owes a password change AND MFA enrollment can do neither (**bug**, **APPLIED**, branch `sync/backend-cr-39`)

Found when the owner signed in as the account `manage.py bootstrap` creates and got "Something went wrong" after changing the password. Captured with `tools/test_capture_restricted_both.py` (`samples/identity/_restricted_both_flow.json`) and reproduced in a browser against the live harness (`bootstrap` user).

**Problem.** The bootstrapped superuser is created with `must_change_password` (so it owes a password change) and, being a superuser, also owes MFA enrollment. `identity/authentication/restrictions.py::enforce` lets an endpoint through only when it settles **every** debt the user has:

```python
for code in owed:
    if view_name not in _ALLOWED[code]:
        raise RestrictedSession(code)
```

`_ALLOWED[PASSWORD_CHANGE_REQUIRED]` holds the change-password endpoints and `_ALLOWED[MFA_ENROLLMENT_REQUIRED]` the MFA ones, so for an account that owes both the permitted set is only `me` and `logout`. The password change is refused for the MFA debt, and MFA setup is refused for the password debt. The first sign-in of the account the documentation tells you to create ends in a dead end. (`docs/setup/BOOTSTRAP.md` says the session "can reach only the endpoints that do those two things"; in fact it can reach neither.)

**Evidence** (real responses, pytest test database; the same password for each, a session from `POST /auth/login/`):

| Account | Login | `GET /auth/me/` | `POST /auth/change-password/` | `POST /identity/mfa/totp/setup/` |
|---|---|---|---|---|
| owes password **and** MFA (the bootstrap superuser) | `200`, `mfa_enrollment_required: true`, `must_change_password: true` | `200` | **`403 mfa_enrollment_required`** | **`403 password_change_required`** |
| owes only the password | `200` | `200` | `200` ("All sessions have been signed out.") | `401` (the sessions ended, as designed) |
| owes only MFA | `200`, `mfa_enrollment_required: true` | `200` | `403 mfa_enrollment_required` | `200` |

**Minimal proposed diff** (backend, `restrictions.py`, no migration): permit an endpoint that settles **any** debt the user owes, and name the first debt (password before MFA, the order `pending()` already returns) in the refusal:

```python
allowed = frozenset().union(*(_ALLOWED[code] for code in owed))
if view_name not in allowed:
    raise RestrictedSession(owed[0])
```

An account that owes both can then change its password (which ends its sessions), sign in again owing only MFA, and enrol; or enrol first and change the password after. Everything else stays refused with `403` and a stable code, and an account that owes one debt behaves exactly as before.

**Tests proposed:** an account owing both can call the change-password endpoint (`200`) and the MFA setup endpoint (`200`), and every other endpoint answers `403 password_change_required` (the first debt); an account owing one debt is unchanged (the three rows above); after the password change and a new sign-in the account owes only MFA. Mutation-check the union and the code reported. `docs/setup/BOOTSTRAP.md` is already worded for this and needs no change; `docs/identity/CONTRACTS.md` (SEC-AUTH-06) gets one sentence, no ADR (the control still denies everything except what settles a debt).

**Why no frontend workaround.** The frontend cannot call endpoints the server refuses. It was also sending this account back and forth between the two screens without end (fixed separately in the frontend: password first, then MFA, which is also the order the backend reports); that stops the crash but leaves the dead end. The only way out today is outside the application (clear the flag in a shell).

**Risk.** Low: it widens the permitted endpoints only for accounts that owe two debts, which today are stuck, and only to the endpoints that settle a debt.

**Approved by the owner, 2026-11-04 ("Approved CR-39"). Applied on `sync/backend-cr-39`, narrower than the diff above.** I wrote the union (any debt's endpoints open) above, and building it showed it contradicts a rule the code already states and tests: `SEC-AUTH-06` says "the password is settled first when both are owed" and `test_the_password_is_settled_before_the_enrollment` requires MFA setup to be refused with `password_change_required` while the password is owed. So `enforce` now opens only the endpoints that settle the **first** debt (the order `pending()` returns):

```python
first = owed[0]
if view_name not in _ALLOWED[first]:
    raise RestrictedSession(first)
```

That removes the dead end with fewer open endpoints than the proposal: the account changes its password (which ends its sessions), signs in again owing MFA only, and enrols. The union is kept out on purpose, and a mutation that switches to it is caught by that existing test. Report: `backend-cr-39-verification.md`; `docs/identity/CONTRACTS.md` (SEC-AUTH-06) says it in one sentence; no ADR (the control still refuses everything except what settles the first debt).

### CR-40: sign in with an OpenLDAP username, set up and switched from the application; the first sign-in makes the account and the People record (**feature**, **APPLIED**)

Requested by the owner (2026-11-04), revised the same day (MFA off by default for directory users, required per user by an administrator; the settings managed from the frontend). The design and the owner's answers are in `docs/adr/ADR-0039-ldap-authentication.md`. **Approved** by the owner on 2026-11-04 ("approved CR-40") and built on `sync/backend-cr-40-ldap`; evidence in `backend-cr-40-verification.md`.

**Need.** Staff sign in with their directory username and password. A platform administrator sets the directory up and turns it on and off from a settings screen. The first successful sign-in creates the account and its People record, and every sign-in keeps the name and e-mail current. Directory users need no MFA unless an administrator requires it for them.

**What exists today** (read from the code, 2026-11-04): accounts are found by e-mail only (`AuthenticationSelector.get_user`; `User.USERNAME_FIELD = "email"`, no username column); `AuthenticationValidator.validate_login` makes one password-hash comparison per attempt; `AuthenticationService.login` then records the attempt, applies the MFA state and starts the session. `MFAPolicy.is_required` requires MFA of superusers, staff, external project members, and everyone when `MFA_REQUIRE_ALL` is on (the production default, ADR-0038); there is no per-user requirement. A user made by `UserService` gets a People record after commit (DOM-MD-PER-10). Per-account actions are on the person's page (`identity/components/AccountSection.tsx`, `api/identity/users.ts`). There is no directory library in `pyproject.toml`.

**Proposed change** (backend and frontend; additive migrations):

| Work package | What |
|---|---|
| WP L.1 | `identity.DirectoryConfiguration` (one row; service password encrypted with `DIRECTORY_ENCRYPTION_KEY` through `FieldCipher`, write-only); `GET`/`PATCH /api/v1/identity/directory/`, `POST …/test-connection/`, `POST …/test-user/`; permission `identity.directory.manage` (platform administrator); save refuses `ldap://` without StartTLS, enabling requires a passing connection test; changes audited without the secret; `DIRECTORY_LOGIN_FORCE_OFF` environment override; `ldap3` dependency |
| WP L.2 | `identity.ExternalIdentity`; the directory client (search then bind, filter escaping, empty password refused, verified TLS, timeouts) |
| WP L.3 | Provisioning and refresh: create the `User` (unusable password, profile names), the identity row and the default role (`artist`) once; refuse an entry with no `mail` and an e-mail a local account already has; refresh name and e-mail on later sign-ins. The People record comes from DOM-MD-PER-10 |
| WP L.4 | `AuthenticationService.login` chooses the check (ADR-0039 decision 2); an outage is recorded but does not count toward the lockout; change-password and reset refuse a directory user (`password_managed_by_directory`); `auth/me` gains `auth_source` and `mfa_required` |
| WP L.5 | Per-user MFA: `User.mfa_required`; `POST /api/v1/identity/users/{id}/require-mfa/ {"required": bool}` with `identity.user.require_mfa` (platform administrator and `org-admin`); `MFAPolicy.is_required` as in ADR-0039 decision 5 (the blanket rule skips directory users unless the configuration turns it on; the external-member rule stays for everyone) |
| WP L.6 | `manage.py ldap_sync [--dry-run]` and a command to link an existing local account to a directory entry on purpose; docs (`docs/identity/CONTRACTS.md` API and SEC rows, the environment variables, the pre-deploy checklist) |
| WP L.7 (frontend) | **Settings → System → Directory (LDAP)**: on/off, server, StartTLS, CA certificate, service account (password shown only as "set"), base, filter, attribute names, timeout, default role, "require MFA for directory users"; **Test connection** and **Test a username** with their results; route and sidebar entry gated by `identity.directory.manage`. On the person's account section: a **Require MFA** switch gated by `identity.user.require_mfa`, and an "LDAP" badge for directory accounts. Change-password and reset hidden for `auth_source: "ldap"`; the login field reads "Username or e-mail" |

**Tests proposed:** with directory sign-in off or `DIRECTORY_LOGIN_FORCE_OFF` set, every existing login test is unchanged and no connection is attempted; with it on, against `ldap3`'s mock server: first sign-in creates one user, one identity, one People record and the Artist role; a second sign-in creates nothing and refreshes the name; wrong password, empty password, no entry, two entries, no `mail`, and an e-mail clash each fail with the generic error and the right ledger reason; an outage fails closed, is logged, and does not lock the account; a local account signs in while the directory is down. Configuration: the password is never returned or logged, saving `ldap://` without StartTLS is refused, enabling without a passing test is refused, someone without `identity.directory.manage` gets 403. MFA: a directory user is not asked for MFA with `MFA_REQUIRE_ALL` on; `require-mfa` makes them enrol at the next request; an org-admin may set it and an artist may not; a directory user who is a vendor or client member is still required. A filter-injection username (`*)(uid=*`) matches nothing. Frontend: unit tests from captured responses for the settings page and the switch; one live run against an OpenLDAP container on the test harness. Mutation-check the empty-password refusal, the filter escaping, the outage-not-counted rule, the e-mail-clash refusal, the write-only password and the MFA exemption.

**Why no frontend workaround.** Sign-in and the MFA policy are decided by the server; the frontend cannot check a directory password or exempt anyone from MFA.

**Risk.** Medium: a new way in, and a weaker MFA default for directory users than production has today (ADR-0039 decision 5, flagged for the owner). Kept small by sharing every step after the password check, failing closed, never linking accounts by e-mail on its own, verified TLS only, an encrypted write-only service password, and a server-side emergency off. A trust-model change, so ADR-0039 is required.

**Applied:** ADR-0039 accepted; backend `a4983c98`, schema snapshot `c3a74f43`, frontend and docs on the same branch (`backend-cr-40-verification.md`). Merged into `develop` (`bfd304d0`).

### CR-41: connect to a directory with older TLS while keeping the certificate check: allow static-RSA ciphers and name the certificate to expect (**feature**, **security**, **APPLIED**)

Asked by the owner (2026-11-04): "write CR-41 for option B". Directory sign-in cannot reach the studio's OpenLDAP server. Skipping the certificate check (option C, what the studio's other clients do with `TLS_REQCERT never`) was considered and is **not** part of this CR. **Approved** by the owner on 2026-11-04 ("approved CR-41") and built on `sync/backend-cr-41-ldap-tls`; evidence in `backend-cr-41-verification.md`.

**Evidence** (from the backend host 192.168.1.109 to `ldap://192.168.1.17` with StartTLS, 2026-11-04, no credentials sent; ldap3 2.9.1, OpenSSL 3.0.16):

| Client TLS setting | Result |
|---|---|
| The app today (certificate checked, Python's default ciphers) | `SSLV3_ALERT_HANDSHAKE_FAILURE` |
| Default ciphers, the server's certificate trusted, expected name `ldap` | `SSLV3_ALERT_HANDSHAKE_FAILURE` (the ciphers are the blocker) |
| Static-RSA ciphers allowed, the server's certificate trusted, by IP only | refused: the certificate names `ldap`, not `192.168.1.17` |
| **Static-RSA ciphers allowed, the server's certificate trusted, expected name `ldap`** | **StartTLS succeeds, certificate checked** |
| The same with expected name `x` | refused (`doesn't match any name in ['192.168.1.17', 'x']`) |
| The same with no certificate trusted | refused (`CERTIFICATE_VERIFY_FAILED: self-signed certificate`) |
| Certificate check off, default ciphers (option C alone, for the record) | `SSLV3_ALERT_HANDSHAKE_FAILURE` |

`openssl s_client -starttls ldap`: the server accepts TLS 1.2 with `AES256-GCM-SHA384` (static RSA key exchange) only; ECDHE, DHE and TLS 1.3 are refused. Python's default cipher list has no static-RSA suites. The server certificate is self-signed, `CN=ldap`, `subjectAltName DNS:ldap`, RSA 2048, SHA-256, valid to 2028-12-28.

**The problem.** `DirectoryClient.server()` builds `Tls(validate=CERT_REQUIRED, version=PROTOCOL_TLS_CLIENT, ca_certs_data=…)` with Python's default ciphers and checks the certificate against the host in the server URI. The studio's server shares no cipher with that list, and its certificate does not carry the address the app is given.

**Fix on the directory side, needing no change here** (still the cleanest): allow ECDHE in slapd (`olcTLSCipherSuite`), then use `ldap://ldap` with a hosts entry and paste the server's certificate in the CA field. This CR is for when the directory cannot be changed.

**Proposed change** (additive migration `identity/0004`; both defaults keep today's behaviour exactly):

| Part | What |
|---|---|
| 1. Older ciphers | `DirectoryConfiguration.tls_allow_legacy_ciphers` (boolean, default off). When on, Python's default cipher list plus `kRSA+AESGCM`: only `AES256-GCM-SHA384` and `AES128-GCM-SHA256` are added (built tighter than the `DEFAULT:kRSA` first proposed, which would also have added SHA-1 and CBC suites). The certificate check is unchanged |
| 2. Expected certificate name | `DirectoryConfiguration.tls_server_name` (text, default empty). When set, the certificate must name it (`Tls(valid_names=[name])`, matched as well as the URI's host). The app still connects to the address in the server URI, so no hosts entry is needed. Empty means the URI's host only, as today. Refused on save: a value with spaces, `*` or a scheme |
| 3. Connection fields | both are connection settings, so changing either clears the last successful test (turning sign-in on needs a new test), and every change is audited (`SETTINGS_UPDATED`, the fields named) |
| 4. Frontend | in the Connection card: an "Allow older RSA ciphers (no forward secrecy)" checkbox and a "Certificate name" field, with hints and the server's validation messages; tests from captured responses |
| 5. Docs | ADR-0039 decision 4 amended (the certificate is always checked; older ciphers and an expected name are options for a directory that cannot be updated); `CONTRACTS.md` API-ID-09 fields and SEC-SEC-11 |

**Not proposed:** any way to switch the certificate check off.

**Tests proposed:** with both defaults, the `Tls` arguments are exactly today's; each setting changes only its own argument; the expected name is passed alongside the URI host; a wrong expected name or an untrusted certificate is still refused (checked against a real TLS handshake in a local test server, not only the arguments); either change clears `last_tested_at` and is audited; validation of the name field. Mutation-check the defaults, the "clears the test" rule and that `validate` stays `CERT_REQUIRED`.

**Risk.** Low to medium. The certificate is still checked, so the directory's identity is proven as today. Static-RSA key exchange loses forward secrecy only: someone who records sign-in traffic today and later obtains the LDAP server's private key could read the passwords in it. The expected-name field widens nothing by itself: the certificate must still chain to the trusted CA (here, the server's own certificate).

**Why no frontend workaround.** The TLS connection is made by the backend.

**Applied:** backend `06d99f00` (migration `identity/0004`), schema snapshot `6e5ad49c`, frontend `6c8b5b13`, docs on the same branch (`backend-cr-41-verification.md`). Not merged.

### CR-42: a project's vendors are unchecked text: any id is stored, and the names are whatever the client writes (**data integrity**, **APPLIED**, branch `sync/cr-42-vendor-ids`; verification `backend-cr-42-verification.md`)

Found while planning the multi-select picker (`docs/frontend/component-migration-plan.md`, branch 2): the project form has no Vendors field, and the obvious one to give it is `vendor_ids`. Captured with `tools/test_capture_vendor_ids.py` (`samples/production/_vendor_ids_flow.json`).

**Problem.** `Project.vendor_ids` and `Project.vendor_names` are plain `JSONField(default=list)` columns that the create and update serializers accept as sent. Nothing ties either to `masterdata.Vendor`:
- an id that names no vendor, or is not even a string, is stored;
- `vendor_names` is a second list the client writes; it does not follow the ids, so it goes stale when the ids change, when a vendor is renamed and when one is deleted;
- deleting a vendor leaves its id on every project that lists it.

Nothing in the backend reads `vendor_ids` (only the serializers, the model and the two seed commands mention it), and the project serializer hides both fields from external members (`EXTERNAL_HIDDEN_FIELDS`), so this is **not an access problem**: access is the project membership, checked by the backend. It is a data problem that a UI would make worse, because a picker would write ids and leave the names to drift.

**Evidence** (real responses, pytest test database; a superuser, one vendor `NLR`):

| Request | Answer | `vendor_ids` stored | `vendor_names` stored |
|---|---|---|---|
| `POST projects/` with `vendor_ids: [NLR, "not-a-vendor", "00000000-…"]`, `vendor_names: ["Somebody Else"]` | `201` | all three | `["Somebody Else"]` |
| `PATCH` `vendor_ids: [NLR]` | `200` | `[NLR]` | still `["Somebody Else"]` |
| `PATCH` `vendor_ids: [{"id": NLR}, 42]` | `200` | `[{"id": …}, 42]` | still `["Somebody Else"]` |
| `PATCH` `vendor_ids: [NLR]`, then `DELETE vendors/NLR/` (`204`, then `404`) | `200` | still `[NLR]` | still `["Somebody Else"]` |

(`_vendor_ids_flow.json`: `project_create_bad_ids`, `project_patch_ids_only`, `project_patch_not_strings`, `project_patch_real_id`, `vendor_delete`, `project_detail_after_vendor_delete`.)

**Minimal proposed diff** (backend only, no migration):
1. Project create and update serializers: `vendor_ids` becomes a list of UUIDs (`ListField(child=UUIDField())`, empty allowed, stored as strings as today). `validate_vendor_ids` refuses duplicates and any id that is not a vendor that exists and is not deleted, with a field error naming the id (`400`, `{"vendor_ids": ["Unknown vendor: …"]}`).
2. `vendor_names` becomes read-only: computed on read from the vendors in `vendor_ids`, in that order, skipping one that no longer exists (deleted). Lists compute it for the whole page in one query (the project selector or the serializer context), not one query per project. The column stays (dropping it would be a migration; not proposed); the API no longer writes it.
3. Rows that already hold bad ids are read as they are (their names skip what is not a vendor); the next write of `vendor_ids` must be valid. No data migration.
4. `vendor_team_ids` is left alone: there is no vendor-team model for it to point at (only the seed commands write it). Not proposed here.
5. Tests: unknown, deleted, malformed and duplicate ids are refused with the field error and change nothing; valid ids are stored; names follow the ids, a rename and a delete; a list of projects computes the names in a constant number of queries; external members still see neither field (`test_external_segregation.py` stays green). Mutation-check the validator and the "skip deleted" rule.
6. Docs: `docs/production/` contract and decision entries; the OpenAPI snapshot the frontend generates from.

**Then, frontend** (after this is applied): `EntityMultiPicker` (the kit's multi-select: chips in the field, checkmarks in the menu, search inside it, Load more), a `multi-entity` field kind in `modules/directory` (the form model learns lists of ids; an edit sends the list only when it changed), and a Vendors field on the project form. Tests from captured responses, mutation-checked.

**Why no frontend workaround.** The frontend can offer only real vendors, but it cannot stop any other client from writing anything, and it cannot keep `vendor_names` right: a rename or a delete happens elsewhere, so only the server can compute the names. Building the picker on the current fields would store ids that no one checks and names that drift.

**Compatibility.** A write with valid vendor ids is unchanged. A write that sends `vendor_names` is no longer an error and no longer stores it (DRF ignores a read-only field). The frontend sends neither field today. The seed commands write through the ORM and are unaffected. The only behaviour change is the refusal of ids that are not vendors.

**Risk.** Low: one field type, one validator, one read-only computed field, no migration, no new route.

**Approved** by the owner ("Approved", 2026-11-05) and applied as written, plus one addition: `seed_dev` wrote vendor codes into `vendor_ids` and now writes the vendors' ids (otherwise its projects would show no vendor names). Contract C-56, decision D-38.

### CR-43: the project list runs two profile queries per project (**performance**, **APPLIED**, branch `sync/cr-43-project-profiles`; verification `backend-cr-43-verification.md`)

Found while writing the CR-42 list test (it expected 6 queries and counted 14); measured afterwards on a clean test database.

**Problem.** `ProjectSelector.get_queryset` (`apps/production/selectors/project.py`) joins the two users with `select_related("supervisor", "coordinator")`, but `ProjectBaseSerializer.get_supervisor_name` and `get_coordinator_name` (`api/serializers/project/base.py`) then read `user.profile.display_name`. `profile` is the reverse one-to-one of `identity.UserProfile`, which `select_related` did not name, so each name costs its own query: two per project, on every list page and on every detail, create and update response that serializes the project.

**Evidence** (real queries, pytest test database; a superuser; each project has its own supervisor and coordinator; `GET /api/v1/projects/`, queries counted with `CaptureQueriesContext`):

| Projects on the page | All queries | Queries on `identity_profiles` |
|---|---|---|
| 1 | 5 | 2 |
| 3 | 9 | 6 |
| 6 | 15 | 12 |

That is `3 + 2n`: a page of 25 (the default page size) costs about 53 queries, where 3 would do. The two profile queries are `SELECT … FROM identity_profiles WHERE user_id = …`, one for the supervisor and one for the coordinator. The answers are correct; only the number of queries is wrong.

**Minimal proposed diff** (backend only, one line, no migration, no API change):

```python
return Project.objects.select_related("supervisor__profile", "coordinator__profile").all()
```

Tried on a scratch copy of the selector, then reverted (nothing is changed): the same three page sizes then cost **3 queries each**, with 0 on `identity_profiles`. A reverse one-to-one is joined by `select_related`, and a user with no profile reads as before (`getattr(user, "profile", None)` is `None`).

1. Selector: the one line above.
2. Test: a list of projects with different supervisors and coordinators runs in a constant number of queries (compare 1 against 6 rows), and the names are unchanged (display name when the profile has one, e-mail otherwise, empty when there is no user). Mutation-check: drop `__profile` and expect the test to fail.
3. Other readers of the same selector (the detail, create and update responses) get the same saving. Whether other list endpoints have the same pattern has **not** been checked; this CR is only the project list.

**Why no frontend workaround.** The queries happen on the server before the response is built; the client cannot make them cheaper (asking for a smaller page only hides it).

**Compatibility.** None: the response is identical. **Risk.** Very low: one line; the join adds two columns' worth of rows already read today.

**Approved** by the owner ("approved CR-43") and applied as written: the one line in `ProjectSelector.get_queryset`, no other backend file changed. Tests in `apps/production/tests/test_cr43_project_list_queries.py`.

### CR-44: nine more list endpoints run one to two queries per row (**performance**, **APPLIED**, branch `sync/cr-44-list-queries`; verification `backend-cr-44-verification.md`)

The follow-up CR-43 named: "other list endpoints may read a related record the same way the project list did". Surveyed with a throwaway pytest (not committed) that, for every list route that has a test factory, counted the queries of `GET` at 1 row and again at 6 rows (real queries, pytest test database, a superuser; each row made by its factory, so each has its own related rows). **46 endpoints were measured; 37 cost the same number of queries at 1 and 6 rows. These nine grow with the row count.** Tables hit by the repeated queries were read from the captured SQL.

**Evidence** (queries at 1 row, at 6 rows, per added row; the request-log insert the API makes on every request is one of the queries and is constant):

| Endpoint | 1 row | 6 rows | Per row | Repeated queries hit |
|---|---|---|---|---|
| `audit/activities/` | 4 | 14 | 2.0 | `identity_users`, `identity_profiles` |
| `audit/audit-logs/` | 4 | 14 | 2.0 | `identity_users`, `identity_profiles` |
| `audit/change-logs/` | 5 | 15 | 2.0 | `identity_users`, `identity_profiles` |
| `audit/error-logs/` | 5 | 15 | 2.0 | `identity_users`, `identity_profiles` |
| `audit/tracks/` | 5 | 15 | 2.0 | `identity_users`, `identity_profiles` |
| `audit/api-requests/` | 5 | 17 (7 rows) | about 2.4 | `identity_users`, `identity_profiles` |
| `identity/users/` | 4 | 9 | 1.0 | `identity_profiles` |
| `settings/definitions/` | 3 | 8 | 1.0 | `settings_categories` |
| `settings/system-settings/` | 3 | 8 | 1.0 | `settings_definitions` |

At the default page size (25) the audit lists cost about 54 queries and the other three about 28, where 3 or 4 would do. The answers are correct; only the number of queries is wrong. A related record that is read without `select_related` is fetched once per row, whether or not rows share it, so this does not depend on how many distinct users the data has.

**Constant, not a problem** (9 queries at 1 row and 6, so the cost does not grow with rows): `production/reviews/`. Not part of this CR.

**Minimal proposed diff** (backend only, no migration, no API change; the same shape as the CR-43 fix, which took the project list from `3 + 2n` queries to 3). **This diff was not tried before approval**; the relation paths below follow from the tables seen in the captured SQL and were confirmed when it was applied, each by its own count test (two paths differ from this text as first written: see the note after the list):
1. The audit selectors (`apps/audit/selectors/`: activity, audit log, change log, error log, track, API request): add `select_related("user__profile")` (the user and the profile that names them) to the queryset each one returns, keeping the project scoping they apply today. **Applied as: `user__profile` for five of them and `actor__profile` for the audit log, whose user field is called `actor`.**
2. `UserViewSet` (`apps/identity/api/viewsets/user.py`, `queryset = User.objects.all()`) or its selector: add `select_related("profile")`.
3. `SettingDefinitionSelector`: add `select_related("category")`. `SystemSettingSelector`: add `select_related("definition")` (**applied as `select_related("setting")`: the relation to the definition is called `setting`**).
4. Tests: for each endpoint, one row and six rows cost the same number of queries, and the response is unchanged (compare a name or label before and after). Mutation-check: drop the `select_related` and expect the count test to fail.

**Not measured** (no test factory, or a different shape): deliveries, publishing and scheduling lists (no factories), automation rules and task templates, the platform master-data lists, API keys, personal access tokens, trusted devices, the admin session list, the flat aliases (`audit/`, `activity/`), and any list with filters, search or ordering applied (only the unfiltered first page was counted). A survey of those needs factories first; this CR does not claim they are fine.

**Why no frontend workaround.** The queries run on the server before the response is built; asking for a smaller page only hides the growth.

**Compatibility.** None: responses are identical. **Risk.** Low: `select_related` additions on the selectors, one count test per endpoint. The audit lists are the largest tables in a running studio, so the count matters most there.

**Approved** by the owner ("CR-44: approve") and applied as written, with the two relation names above. Nine one-line selector changes, no other backend file.

### CR-45: a login cannot be moved from one person to another: `link-user` refuses it, and no other call does it (**feature**, **APPLIED**, branch `feature/cr-45-move-login`)

Found while verifying the "Or link an existing login" form on a person's Account tab, against the throwaway live backend (`identityAdmin.live.test.tsx`, "offers only logins that can be linked").

**Problem.** Since DOM-MD-PER-10 (`4735c265`, `masterdata/services/user_person.ensure_person_for_user`) every user gets a person when it is created, so a login is never "free". `PersonService.link_user` (`masterdata/services/person.py`) then refuses to attach a login to a second person in two ways:

1. `Person.objects.filter(user=target).exclude(pk=locked.pk).exists()` raises `409 "This user is already linked to another person."` while the login still has its own person.
2. After `unlink-user` frees it, linking copies the login's e-mail onto the person (`identity_values`), and `Person.objects.filter(email__iexact=email).exclude(pk=locked.pk).exists()` raises `409 "Another person already uses this e-mail address."`, because the person it was unlinked from keeps that e-mail.

So the only supported move is back to the same person. An administrator who made a person first and later wants it to own an existing login (made by another route, for example directory sign-in, ADR-0039, or a login created before the person) has no way to do it.

**Evidence** (real backend, factory-seeded, `manager` superuser; live test output, 2026-11-06):

| Step | Response |
|---|---|
| `POST /identity/users/` (login A) | 201; the server also makes person PA and links it |
| `POST /people/{PB}/link-user/ {user: A}` for another person PB | 409 `This user is already linked to another person.` |
| `POST /people/{PA}/unlink-user/`, then the same link to PB | 409 `Another person already uses this e-mail address.` |
| the same link back to PA | 200 (the e-mail is PA's own) |

**What the frontend does meanwhile** (no backend change, shipped in `1ebbee6e`): the form offers only a login that belongs to no person and whose e-mail no other person uses, and says "No existing login can be linked to this person" when none qualifies. "Create login" works because the server adopts an unlinked person by e-mail (the form first gives the person the login's e-mail).

**Minimal proposed diff** (backend only, no migration; the route and its permission stay, one optional field is added):

`POST /people/{id}/link-user/` accepts `{"user": "<uuid>", "move": true}` (default `false`: today's behaviour, unchanged). With `move`, inside the one existing `transaction.atomic()`:

1. If this person already has a login: `409` as today ("unlink first").
2. If the login is linked to another person P: unlink it from P and **clear P's e-mail** (the e-mail belongs to the login and moves with it, which is what keeps the second check true). P stays a person, without a login and without an e-mail; nothing is archived or deleted.
3. Link the login to this person (copying name and e-mail from Identity, as today).
4. Publish `PersonUnlinked` for P and `PersonLinked` for this person, so both show in the history.

Without `move`, a login that has its own person still gets the same 409 (no silent merge). The permission stays `masterdata.person.update`.

Tests: moving a login from PA to PB leaves PA unlinked with no e-mail and PB linked with the login's e-mail; `move` against a person that already has a login is refused; without `move` the two 409s stay; both events are published; concurrent moves of one login serialise (the user row is already locked). Mutation-check: drop the e-mail clearing and expect the second check to fail.

Frontend after approval: the form lists every login, marks the ones that belong to another person, and asks for confirmation ("<Person> will be left without a login and without an e-mail address") before sending `move: true`.

**Why no frontend workaround.** It would take three calls (`unlink-user` on P, clear P's e-mail with a PATCH, `link-user`), not atomic and not one history entry. A failure after the first leaves a login with no person; after the second, a person whose e-mail was wiped for nothing. The frontend cannot make them atomic.

**Compatibility.** None: `move` is optional and defaults to the current behaviour. **Risk.** Low to medium: it deliberately empties another person's e-mail, so the confirmation text and the audit entries matter. **Alternatives.** (a) Do nothing: moving a login stays impossible, and the form stays as it is now. (b) Make `unlink-user` clear the e-mail, so unlink + link works without `move`: smaller, but it changes an existing action for everyone.

**Approved** by the owner ("approve CR-45") and applied as written, with the proposed diff and no alternative: `move` on `link-user` (`LinkUserSerializer`, `PersonViewSet.link_user`, `PersonService.link_user`), contract DOM-MD-PER-11, the committed OpenAPI schema and its TypeScript types (`LinkUser.move`). Tests: `test_person_services.py` (move, refusal without `move`, the e-mail clash after an unlink, a person that already has a login, a login nobody holds, audit), `test_organization_api.py` (move, permission, boolean), `test_directory_concurrency.py` (two moves leave one holder); mutation-checked (keep the e-mail, ignore `move`, `move` on by default, no unlink event: each fails a test). Masterdata app: 1,248 passed.

### CR-46: bulk routes see and write more than the single routes allow (**security**, **APPLIED**, `cd774091` on `feature/episodic-bulk`)

Found in the Phase 0 discovery of the episodic/bulk work (`docs/episodic-bulk-discovery.md` §2.4, probed on the pytest database).

**Problem.** `BulkOperationService.bulk_update`, `bulk_archive` and `bulk_restore` find rows with `_allowed_project_ids` (any active membership), not with the viewset's `get_queryset()`. A member bound to a show, one naming a department, and an external (vendor/client) member get 404 on a single PATCH of a record outside their reach, and 200 "updated" on `bulk-update` of the same record. `check-existence` returns the full `existing_entity` of an out-of-scope row. Bulk create skips `_resolve_show` / `_with_default_show` (a show-bound member's bulk-created shot has no show and drops out of their view), and bulk update skips `perform_update` (`guard_mutable`, the D-12 episode/sequence chain, `_resolve_show`): any item carrying `episode_id` or `show_id` is a 500.

**Diff.** Bulk update/archive/restore resolve each id through `get_queryset()` (the `tasks/bulk-status` pattern); out-of-scope ids report `not_found`. A `prepare_update(instance, data)` hook holds what `perform_update` checks and is called by both. Bulk create runs the show resolution per item. `check-existence` reports `EXISTS` without `existing_entity` for a row the caller cannot see. Response shapes unchanged.

**Approved** by the owner ("Approved", Phase 0 plan, 2026-11-06). Applied as written; Verification: `docs/sync/backend-cr-46-48-verification.md`.

### CR-47: episodes only on episodic projects (**feature**, **APPLIED**, `b7a4c692` on `feature/episodic-bulk`)

**Problem.** Only episode create is refused on a standard project (400); list, detail, update and archive answer 200 for episodes left on standard projects by seeds, the admin or legacy data. The D-12 rules live in the sequence and shot viewsets only.

**Diff.** The episode queryset is limited to `project__workflow_type="episodic"` (404 on detail/update/archive/bulk for a standard project's episode, an empty list for its project); create keeps its 400. The D-12 rules move into `validators/episodic.py`, called by single and bulk writes. `report_production_data` lists episodes on standard projects and standard-project sequences/shots that point at one. No migration; no data is changed.

**Approved** by the owner ("Approved", Phase 0 plan, 2026-11-06). Applied as written; Verification: `docs/sync/backend-cr-46-48-verification.md`.

### CR-48: bulk create/update with dry run, all-or-nothing, code matching and limits (**feature**, **APPLIED**, `2a18c908` on `feature/episodic-bulk`)

**Diff (additive).** `bulk-create` / `bulk-update` accept `dry_run: true` (the real path inside a transaction that is rolled back) and `atomic: true` (any failed row rolls back the batch). Bulk update matches by `id` or by `code` within the batch's `project_id`. Parents resolve by code inside the project. A per-entity whitelist of bulk-updatable fields. At most 500 items per request (400 above). Each result row keeps `error` and the response adds `errors: [{row, field, message}]`. One `AuditLog` row per committed batch. Without the new flags the routes behave as today.

**Approved** by the owner ("Approved", Phase 0 plan, 2026-11-06). Applied as written, with two additions found while building it: bulk update refuses a field outside the whitelist per row ("This field cannot be changed in bulk.") instead of ignoring it, and a row named by code that the caller cannot see answers `not_found` without an id. Verification: `docs/sync/backend-cr-46-48-verification.md`.

### CR-49: new production codes start with the project code; a new shot needs a sequence (**feature**, **APPLIED** on `sync/cr-49-code-prefix`)

Asked by the owner (2026-11-06): "while creating any production entity the code should start with project code (SQ0010 → TST_SQ0010) … for creating a shot the sequence is compulsory, and if it does not exist it should show an error". Decisions this changes: D-10 ("Nothing stricter is imposed (no pattern…): that needs a decision of its own") and D-11 / Q3 ("A shot may have no sequence").

**Done in the frontend already (no backend change).** The create forms (episode, sequence, shot, asset, task, and the project tabs' Add episode / Add sequence) show `TST_` beside the code input and send `TST_<typed>`; Bulk add (all four entities) adds it to every code at Validate; a shot form needs a sequence and says so when the project has none; Bulk add shots refuses a row whose sequence is not one of the project's. Existing records keep their codes; the prefix is only for new ones.

**Problem.** Only the UI enforces it. `POST /shots/` (or `bulk-create`, or an import script) still accepts `SH010` and a shot with no sequence, so the studio's naming and "every shot has a sequence" hold only for people who use this screen.

**Minimal diff (create only, nothing existing is touched).**
1. `NormalizedCodeMixin.validate_code` on create, and the bulk-create item check: the code must start with `<PROJECT.CODE>_` (any case; stored upper case), else 400 `code: "Codes in project TST start with TST_."`. Applies to episode, sequence, shot, asset and task. Update, `rename-code` and bulk update by code are unchanged (so every existing record can still be edited).
2. The server-made codes carry it too: an episode left blank becomes `TST_EP101`; bulk `code_prefix: "SH"` numbers `TST_SH0010`, `TST_SH0020` … (the series is counted on the full prefix).
3. `Shot` create (single and bulk) without a sequence: 400 `sequence_id: "A shot needs a sequence."`; a code or id that is not a sequence of the project keeps today's "not found" error. A shot that has none keeps working on update.
4. D-10 / D-11 are rewritten, `CONTRACTS.md` gets the rule, seeds and factories use prefixed codes, `report_production_data` lists existing codes without the prefix and shots without a sequence (read-only).

**Why no frontend workaround.** None can bind another client: the rule is the server's to enforce. The frontend part above is already shipped and keeps working whether or not this is approved.

**Compatibility.** Breaking for any API client or script that creates un-prefixed codes or sequence-less shots (they get a 400). Existing data is untouched. **Risk.** Medium: every test and fixture that creates records by code changes; the code length limits (shots 30) now include the prefix. **Alternatives.** (a) Frontend only, as now. (b) An opt-in project setting (`enforce_code_prefix`, default off), so projects choose; costs a column, a migration and a UI switch.

**Approved** by the owner ("approve CR-49", 2026-11-06) and applied as proposed, with these details settled while building it: the check sits in the shared create hook (single, bulk, dry run, atomic alike) and runs before the uniqueness check; the prefix is compared in any case and counts towards the model's code length (a longer code is a 400); a shot's missing sequence is reported together with the episode errors; clearing a sequence on an existing shot (`sequence_id: ""`) stays allowed; `report_production_data` gained two information sections. Alternative (b), an opt-in project setting, was not taken. Verification: `docs/sync/backend-cr-49-verification.md`.


### CR-50: find the shots that have no sequence (**feature**, **APPLIED** on `sync/cr-50-shot-has-sequence`)

**Problem.** Until v4.4.1 the "Bulk add shots" screen sent the sequence as `sequence_code`, which the backend treats as read-only and drops (found 2026-11-06, fixed in the frontend; evidence: `src/test/live/bulkRoutes.live.test.ts`). Every shot it made has no sequence, and the sequence it was meant for is not stored anywhere (the old text column was dropped in the contract phase, D-32), so they cannot be repaired automatically. CR-49 stops new ones, and `report_production_data` counts the old ones, but the app has **no way to list them**: the shots list has no filter for "no sequence" (`sequence_id` and `sequence_code` match a value; an empty value is no filter) and cannot be ordered by sequence (`ordering_fields` is code, name, created_at, status). A person who knows which sequence each shot belongs to has to scan every page.

**Minimal diff.** One optional filter on the shots list: `has_sequence=false` (or `true`) in `ShotFilterSet`, a boolean (`sequence__isnull`), additive; the same narrowing and permissions as the list. No migration, no change to any response, nothing is repaired or written by the server.

**Frontend after approval.** A "Sequence" filter on the Shots page and a project's Shots tab (Any / Without a sequence). With it the clean-up is: filter to the shots without one, tick them (or the page), **Edit fields**, tick Sequence, type the sequence's code; every row changes or none does (`bulk-update` is all-or-nothing there).

**Why no frontend workaround.** The list is paged on the server; without a filter the frontend would have to download every shot of the project (500 per call, with many projects) to find the ones with no sequence and could not page, sort or count them. `report_production_data` already exists for the count; it is a command line, not something a producer can use.

**Compatibility.** None: an optional query parameter. **Risk.** Very low. **Alternatives.** (a) Do nothing: the report lists the shots and someone edits them one by one through the shot form. (b) Also let `sequence_id=none` mean "no sequence": no new parameter name, but it overloads a field that already means "this sequence".

**Approved** by the owner ("approve CR-50", 2026-11-06) and applied as proposed: `has_sequence` (`true` / `false`) on the shots list (`ShotFilterSet.has_sequence`), the committed OpenAPI schema and its types carry the parameter (three list routes), and the Shots list has a "Sequences" filter (Without a sequence / In a sequence), also on a project's Shots tab. Alternative (b), `sequence_id=none`, was not taken. A value that is not `true`/`false` is no filter. Tests: `test_shot_sequence.py::TestHasSequenceFilter` (false, true, not a boolean, combined with search and status, archived and other projects stay out, and filling the sequence through `bulk-update` empties the list); frontend `shotsWithoutSequence.test.tsx`; browser: `e2e/live/bulk-add.smoke.spec.ts` "shots without a sequence" (filter, tick, Edit fields > Sequence on the seeded shots).



### CR-51: say which export job a republish was made from (**feature**, **PROPOSED**)

**Problem.** `PublishItem.republished_from` (a self reference, `PROTECT`, nullable) is written by `POST /publishing/{id}/republish/` (API-PUB-06) but no serializer returns it and no filter takes it. A republished job gets a fresh project-numbered code (`allocate_code`), so nothing in a response ties it to the job it came from. The old frontend's "Publish revision history" (`PublishHistoryModal`) showed that chain; this frontend can only show "every export job for the same shot or asset" (the job's **History** tab), which is the same list but cannot tell a republish of job A from an unrelated new export of the same shot.

**Minimal diff.** (1) Return `republished_from` (the id, or `null`) on the publishing job row and detail serializers. (2) An optional list filter `republished_from=<id>`. Additive, read-only: no migration, no change to any write, no change to permissions or narrowing (the id of a job the caller cannot see is not returned: it is null for them).

**Frontend after approval.** The job's History tab marks "republished from PUB-…-0003" and links to it, and the job page lists "Republished as" the jobs that point at it (the filter), so the chain reads in both directions.

**Why no frontend workaround.** The link is not in any response; matching codes or names would guess. The "same shot or asset" list shipped in the History tab stays correct either way.

**Compatibility.** None: one new field and one optional parameter. **Risk.** Very low. **Alternatives.** (a) Do nothing: the History tab as shipped. (b) Return the whole chain as a `revisions` list on the detail: more server work for the same information.


### CR-52: let an attachment belong to a version, review or shot (**feature**, **PROPOSED**)

**Problem.** `Attachment` (`core_attachment`, `/api/v1/core/attachments/` and the compat `/api/v1/attachments/`) has no link to anything: no entity type or id, no project. Its docstring says "attachments can be linked to any entity", but the model has `file`, `name`, `description`, `file_type`, `mime_type`, `file_size`, `storage_key`, `is_public`, `expires_at` and the audit columns only, and the viewset shows a caller their own uploads (`AttachmentSelector`) and filters on `file_type` and `is_public` only. So a file cannot be attached to a version, a review, a shot or a task: the old frontend's Attachments tab on a version has no server to talk to, and this frontend has no attachments screen at all (CR-less: the inventory lists `core/attachments` as "untouched").

**Minimal diff.** (1) Two optional fields on `Attachment`: `entity_type` (the model name: `Version`, `Review`, `Shot`, `Asset`, `Task`) and `entity_id` (uuid), both blank by default, with an index on the pair; one migration. (2) Accept and return them on create and update, and refuse an entity the caller may not see (the same "not found" as everywhere else). (3) Two optional list filters, `entity_type` and `entity_id`. (4) Visibility: an attachment of a record is listed to everyone who may see the record (through the project narrowing), not only to its uploader; one without an entity stays "mine". Delete stays the uploader's (and `file.delete` holders').

**Frontend after approval.** An "Attachments" tab on a version, a review, a shot and an asset: the files of that record (name, type, size, who, when), upload (multipart, with the 413 and 429 answers shown), the signed download link, and delete. The upload primitive (`ApiClient.upload`) already exists.

**Why no frontend workaround.** Without a link in the data, any list of "this version's files" would be a guess from file names, and visibility would still be per uploader.

**Compatibility.** Additive for the API (two nullable-by-default fields, two optional filters); existing attachments stay "mine". **Risk.** Medium: a migration, and the visibility rule in (4) widens who can see an attachment once it has an entity, which is a security decision for the owner. **Alternatives.** (a) Do nothing: no attachments on records. (b) A separate `RecordAttachment` table that links an existing attachment to a record, so `Attachment` is untouched (more tables, same result).


### CR-53: every signed-in user reads every client, vendor and contract, and an artist's dashboard shows the client's deliveries (**security**, **APPLIED**, branch `sync/cr-53-partner-reads`; verification `backend-cr-53-verification.md`)

Asked by the owner (2026-11-12): "artist has access to client vendors dashboard". The role matrix was settled with the owner before this request: artists see no client, vendor or delivery records; leads keep delivery view but not clients and vendors; supervisors see clients, vendors and contracts without their money; producers (production-admin) and org-admins see everything, money included. Contract values already follow that last rule (below), so this CR does not touch them.

**Problem.**
1. **Partner reads are open.** `ServiceRecordViewSet.read_permissions = ()` (`apps/masterdata/api/viewsets/records.py:74`), and `ClientViewSet`, `VendorViewSet`, `ClientContractViewSet` and `VendorContractViewSet` (`api/viewsets/partners.py`) keep that default. Any signed-in user lists and opens every client, vendor and contract of the studio, whatever their role or projects: client tier, headquarters and portal access; vendor rating, security tier and bandwidth; contract number, title, type, dates, NDA flag and **`document_url`** (the link to the contract document). What is gated today: contacts (`masterdata.person.view_sensitive`, 403), the contact fields on clients and vendors, `total_billed_usd` and the contract values `value_usd` / `total_value_usd` (`masterdata.client.view_financial`, omitted; `api/serializers/directory.py:368,396`).
2. **The frontend mirrors it.** `page.clients`, `page.vendors`, `client.view` and `vendor.view` are `open` in `frontend/src/core/permissions/permissionMap.ts` (`DIRECTORY_READ`), as its rule requires (no stricter gate than the backend), so Clients and Vendors are in every user's sidebar.
3. **Artists hold `delivery.view`** (`PRODUCTION_ARTIST_PERMISSIONS`, `apps/core/management/commands/init_platform.py:344`), so the deliveries list gives them every delivery of their projects with `client_name`.
4. **The project dashboard ignores `delivery.view`.** `ProjectDashboardSelector.build(project)` (`apps/production/selectors/dashboard.py`) adds the delivery figures and the six newest delivery cards, each with `recipient` = the client's name (`apps/deliveries/providers.py`, `_card`). Both routes that return it (`ProjectViewSet.dashboard`, `ProjectDashboardView`, permission `project.view`) give it to anyone who may read the project. The nested `/projects/{id}/deliveries` route checks `delivery.view` (`apps/production/selectors/delivery_figures.py`, `view_permission`); the dashboard does not. So removing `delivery.view` from artists alone would still show them the client's deliveries.
5. A role grant removed in the Access screen comes back: `init_platform` re-creates every grant of its matrix that a system role lacks (`_assign_role_permissions`, `init_platform.py:569`), and removes only what `WITHDRAWN_GRANTS` lists.

**Evidence** (real responses, pytest test database, rolled back; `init_platform` roles; an `artist` and a `lead-artist`, each an active member of project `CRT`; client `ACME` with `total_billed_usd` 1,250,000 and a contract worth 480,000; vendors `NLR`, `FXH` with a 90,000 contract; one delivery of `CRT` to `ACME`). Captured with `tools/test_capture_partner_reads_cr53.py` (`samples/masterdata/_partner_reads_cr53.json`):

| Request | Artist | Lead | What comes back |
|---|---|---|---|
| `GET clients/`, `GET clients/{ACME}/` | 200 | 200 | name, code, tier, HQ, portal access; no contact fields, no `total_billed_usd` |
| `GET vendors/` | 200 (2 rows) | 200 | name, code, rating, security tier, bandwidth, NDA |
| `GET client-contracts/`, `GET client-contracts/{id}/` | 200 | 200 | number, title, type, dates, `document_url`; no `value_usd` |
| `GET vendor-contracts/` | 200 | 200 | the same; no `total_value_usd` |
| `GET client-contacts/` | 403 | 403 | (already gated) |
| `GET deliveries/?project=CRT` | 200 | 200 | `client_name: "Acme Pictures"` |
| `GET projects/{CRT}/dashboard/` | 200 | 200 | `deliveries.items[0].recipient: "Acme Pictures"`, totals |

(`clients_list_*`, `client_detail_*`, `vendors_list_*`, `client_contracts_list_*`, `client_contract_detail_*`, `vendor_contracts_list_*`, `client_contacts_list_*`, `deliveries_list_*`, `dashboard_*`.) A member of no project and an external (client or vendor side) member pass the same empty permission check; read from the code, not captured.

**Minimal proposed diff** (backend only, no migration, no new route, no change to any response shape):
1. **A new code `masterdata.partner.view`** (`masterdata_partner`, `view`): in `PERMISSION_SPECS` and as `MasterdataPermissions.PARTNER_VIEW`.
2. **Gate the four partner viewsets' reads:** `read_permissions = (P.PARTNER_VIEW,)` on `ClientViewSet`, `VendorViewSet`, `ClientContractViewSet`, `VendorContractViewSet`. Like contacts, the check runs before any object lookup, so a missing id and a forbidden id both answer 403. Writes keep `masterdata.directory.manage`; contacts keep `view_sensitive`; the field gates for money and contact data are unchanged.
3. **Who holds it:** org-admin (`DIRECTORY_CRUD_PERMISSIONS`), production-admin (`PRODUCTION_ADMIN_PERMISSIONS`) and vfx-supervisor (added to its list); platform-admin has the full catalog. Not lead-artist, artist or org-member. These three are also the roles that pick a client or vendor (project create/update, delivery create), so every form that reads the partner lists keeps working for whoever can submit it.
4. **Artists lose `delivery.view`:** drop `delivery="view"` from `PRODUCTION_ARTIST_PERMISSIONS`, and add `"artist": ("delivery.view",)` to `WITHDRAWN_GRANTS` so the next `init_platform` run removes it from existing databases too (real delete, so the RBAC signals clear the cached permissions, as for vfx-supervisor in Q34).
5. **The dashboard follows `delivery.view`:** `ProjectDashboardSelector.build(project, *, include_deliveries: bool)`. Both dashboard routes pass whether the caller holds `delivery_figures().view_permission` for that project (the same check as the nested deliveries route). Without it the delivery figures are empty and keep their shape: `deliveries` = `{total: 0, upcoming: 0, delivered: 0, late: 0, items: []}`, the summary's `total_/upcoming_/delivered_/late_deliveries` = 0, and no delivery as the next due date. The frontend schema already defaults all of these.
6. **Unchanged on purpose:** `client_name` on projects and deliveries, and `vendor_names` on projects, are read from those records, not from the client endpoint, so an artist's project still says whose show it is. The external-member field hiding (`EXTERNAL_HIDDEN_FIELDS`) is untouched.
7. **Tests:**
   - artist, lead and a user with no role get 403 on list and detail of all four routes; supervisor, production-admin and org-admin get 200;
   - a supervisor still gets no `value_usd` / `total_value_usd` / `total_billed_usd`, and contacts are unchanged;
   - a production-admin still creates a project with a `client_id` and a delivery with a client;
   - an artist's project and delivery-free dashboard still name the client of the project;
   - the artist's dashboard has no delivery items and zero delivery counts, while the lead's has them;
   - rerunning `init_platform` removes the artist's `delivery.view`, and a second run changes nothing;
   - `apps/production/tests/test_permission_matrix.py` is updated to the new matrix.

   Mutation-check by emptying `read_permissions`, by always passing `include_deliveries=True`, and by dropping the `WITHDRAWN_GRANTS` entry: each must fail a test.
8. **Docs:**
   - `docs/masterdata/CONTRACTS.md` §4 (who reads partners) and a `DECISIONS.md` entry;
   - `docs/production/DECISIONS.md` D-07 (the artist row);
   - `docs/deliveries/PLAN.md` §6 (roles);
   - the dashboard contract (deliveries follow `delivery.view`).

**Then, frontend** (after this is applied):
- `permissionMap.ts`: `page.clients`, `page.vendors`, `client.view` and `vendor.view` become `codes(..., 'masterdata.partner.view')`, so the sidebar entries and the routes follow the backend.
- The deliveries list's **Client** filter (`modules/deliveries/deliveries.tsx`, it reads the client list) shows only to holders of the new code; a lead keeps the list without that filter.
- The dashboard's delivery widgets (`ClientDeliveryHealth` and the delivery counts) show only with `delivery.view`.
- Tests from re-captured samples, mutation-checked.

Hiding the people, departments, teams, offices and positions *pages* from artists (their reads stay open, the pickers need them) is a frontend-only question and is not part of this CR.

**Why no frontend workaround.** Hiding the pages leaves the API answering: anyone signed in, including a client's or vendor's own staff on a shared project, can list every client, vendor and contract (with its document link) by calling the route. The dashboard's delivery cards are in the response itself. Only the server can refuse them.

**Compatibility.** Breaking for anyone without the new code who calls the four partner routes: lead-artist, artist, org-member and custom roles now get 403 where they got 200. A custom role that needs them must be given `masterdata.partner.view`. The current frontend build then shows an error state on the Clients and Vendors pages for those users until the frontend step above ships; no form they can submit reads the partner lists. Artists lose the deliveries list and the dashboard's delivery cards.

**Risk.** Low to medium: four one-line permission changes, a role-matrix change with a withdrawal, and one keyword argument on the dashboard selector. The risk is in who loses access, which is the point. Run the role smoke (`tools/run_role_smoke.sh`) for artist and lead after applying.

**Alternatives.**
- (a) Frontend only: hide the pages. Cosmetic; the routes keep answering.
- (b) Narrow partners by project: a member sees only the clients and vendors of their own projects. Closer to need, but `Project.client_id` is a text column (and `vendor_ids` a list), so it needs a join through text ids or a migration first.
- (c) Keep `delivery.view` for artists and only fix the dashboard: they keep the deliveries list with client names.

**Approved** by the owner ("approve CR-53", 2026-11-12) and applied as proposed, with no alternative taken. Settled while building it:
- `include_deliveries` is a **required** keyword of `ProjectDashboardSelector.build`, so a new caller cannot get the deliveries by default. Without it the selector reads the deliveries through the same empty provider used when the deliveries app is absent (`delivery_figures.NO_DELIVERIES`), so `schedule.is_delayed` no longer counts late deliveries for that caller either.
- The OpenAPI schema now documents `403` on GET of the four partner routes (eight operations). This is the only schema change: the committed schema and its TypeScript types were regenerated, and the masterdata schema snapshot was updated.
- Tests that pinned open reads now give their reader `masterdata.partner.view`, and each such file gained a test that a plain user gets 403 on list, detail and a missing id.

Contracts: masterdata SEC-MD-01 and D-CR53, production C-67 and D-07, deliveries PLAN §6. Pre-deploy checklist: run `init_platform` after deploying.

**Frontend step, applied** on the same branch, as proposed:
- `page.clients`, `page.vendors`, `client.view` and `vendor.view` map to `masterdata.partner.view` (`permissionMap.ts`, rule `PARTNER_READ`), so the sidebar entries, the command palette, the routes and the record pages follow the backend.
- The deliveries list offers its **Client** filter only with that code and does not load the client list without it.
- The dashboard's *Client Deliveries* panel, its KPI card and the watchlist's *Upcoming Client Turnovers* show only with `delivery.view`.
- `backendCodes.ts` and the catalog sample (`samples/_misc/permissions.json`) carry the new code and the new role grants.
- The role smoke spec expects Clients and Vendors for producer and supervisor, refused for lead, artist and no-role, and Deliveries refused for the artist.
