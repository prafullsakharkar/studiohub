# Backend change requests

Rule (HARD RULE 1): no backend file is changed without explicit approval. Each entry states the problem, evidence, the minimal proposed diff, and whether a frontend workaround exists. **Status of every entry: PROPOSED — awaiting approval.** Nothing below has been applied.

| ID | Title | Blocks frontend work? | Severity |
|---|---|---|---|
| CR-01 | Stale deprecation registry marks the only directory/RBAC routes as deprecated | No (frontend ignores the headers) | Medium |
| CR-02 | 18 enforced permission codes are never seeded | **Yes** for non-superuser admins (settings, user lifecycle, security logs) | High |
| CR-03 | `AuditLog` list has no `target_id` filter | Partly (per-object audit panel for deliveries/publishing/scheduling/masterdata) | Medium |
| CR-04 | ChangeLog does not track several editable models | Partly (empty History tabs) | Medium — confirm per module phase |
| CR-05 | Dev seed commands are broken | No (tests use factories) — but blocks a seeded dev backend for e2e/manual verification | Medium |
| CR-06 | Unmapped methods return 403 instead of 405 on `MethodPermissionMixin` views | No | Low |
| CR-07 | Superuser fallback permission list contains non-catalog codes | No (frontend treats `is_superuser` as all) | Low |
| CR-08 | 19 views missing from the OpenAPI schema; 35 untyped `OBJECT` responses | No (hand-written types from samples) | Low |
| CR-09 | `CONTRACTS.md` states default page size 20; actual 25 | No (doc only) | Low |
| CR-10 | Server-side CSV/Excel export (`?format=csv` on list views; renderers already exist in `apps/core/api/renderers/`) | No (client-side export works up to ~10k rows) | Low — optional |
| CR-11 | httpOnly refresh-token cookie for the SPA | No (refresh token in `localStorage` with XSS hygiene) | Low — optional, security hardening |
| Q-01 | Contacts list 403 for users without directory roles despite an empty `permission_map` entry | Question | — |

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
