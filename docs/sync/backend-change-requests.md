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
