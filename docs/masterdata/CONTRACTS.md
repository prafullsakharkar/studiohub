# Masterdata Module — Domain, API and Security Contracts (Phase 2)

Date: 2026-10-23 · Branch: `feature/masterdata-hardening`
Status: **Draft for approval.** Rows marked DECIDED rest on an APPROVED decision. Rows marked PROPOSED/OPEN wait on [`DECISIONS.md`](DECISIONS.md).
Companions: [`AUDIT.md`](AUDIT.md) (evidence, finding IDs) · [`PLAN.md`](PLAN.md) (work packages, `WP 3.1` …).
Change control: any change to an `API-MD-*` contract needs this document updated in the same commit; any change to a `SEC-MD-*` or `DOM-MD-*` invariant that alters the trust model needs an ADR (same rule as `docs/identity/CONTRACTS.md`).

---

## 0. Reading conventions

| Label | Meaning |
|---|---|
| **CURRENT** | Verified behaviour at the cited `path:line` or probe (`AUDIT.md` Appendix A) |
| **TARGET** | Required behaviour. Not implemented until its WP lands. |
| **DECIDED** | Target rests on an APPROVED decision (`D#`) |
| **PROPOSED** / **OPEN** | Target rests on a decision that still needs your approval or answer |
| **U** | Unverified |

Paths are relative to `backend/` unless they start with `docs/`. Each contract has a stable ID (`DOM-MD-CAT-03`, `API-MD-04`, …) for tests and PRs to reference.

---

## 1. Scope and ownership

**Masterdata owns** (DECIDED D1: all platform-global):
- Catalogs: `MasterStatus`, `MasterTaskType`, `MasterAssetType`, `MasterShotType`, `MasterReviewType`, `MasterFileType`, `Software`, `SoftwareVersion`.
- Directory: `Department`, `Team`, `Office`, `Position`, `Person`.
- Business partners: `Client`, `ClientContact`, `ClientContract`, `Vendor`, `VendorContact`, `VendorContract`.

**Masterdata does not own:**
- Users, credentials, roles, permissions: owned by `apps.identity`. Masterdata only reads `User` for the person link (D4).
- Organizations: there is no Organization module. No masterdata model has an organization FK, now or later (D1).
- Audit storage: owned by `apps.audit`. Masterdata publishes events, and a handler writes the audit rows (§7).
- Production data that references masterdata (`production.Asset/Task`, `scheduling.Resource`, `deliveries.DeliveryPackage`): owned by those apps, all `SET_NULL` (`AUDIT.md` §2).

**Dependency direction:** `core ← identity ← masterdata ← {production, scheduling, deliveries}`. Masterdata must not import from production, scheduling or deliveries, with one exception: computed statistics (D11) read them **through those apps' selectors**. PROPOSED: these reads live in `apps/masterdata/selectors/stats.py` and import lazily inside functions, to avoid import cycles.

---

## 2. Contracts common to every masterdata model

### 2.1 Domain (DOM-MD-COM)

| ID | Contract | Status | Enforced by (WP) |
|---|---|---|---|
| DOM-MD-COM-01 | No masterdata model has an organization FK or an org-specific column | **IMPLEMENTED (Phase 7)**: no organization FK and no `scope` column (migration 0009); proven by `TestNoOrganizationLeftovers` | model test (WP 7.3) |
| DOM-MD-COM-02 | Every write goes through a service in `apps/masterdata/services/`. Views and serializers never mutate state. | TARGET (CURRENT: none, `AUDIT.md` H2) | WP 3.3, 4.2, 5.3, 6.1 |
| DOM-MD-COM-03 | Every multi-row write runs in one `transaction.atomic()` at the service boundary. Events dispatch after commit. | TARGET | services (`apps/core/events/bus.py:23-37` already defers inside atomic blocks) |
| DOM-MD-COM-04 | `code` is required, trimmed and unique **case-insensitively among non-deleted rows** of its table. Statuses are unique per `entity_type` (DOM-MD-STS-01). | TARGET, PROPOSED D2 (CURRENT: case-sensitive, includes deleted rows; P02, P07) | `UniqueConstraint(Lower("code"), condition=Q(is_deleted=False))` + service normalization (WP 3.1) |
| DOM-MD-COM-05 | `name` is required, trimmed, and unique case-insensitively per table among non-deleted rows. Statuses: per `entity_type`. Persons: names **not** unique. | TARGET, PROPOSED D2 | same (WP 3.1, 6.1) |
| DOM-MD-COM-06 | DELETE soft-deletes. A soft-deleted row is hidden from list and detail, keeps its references, and can be restored. | DECIDED D6 (CURRENT: catalog DELETE archives instead, P12) | service (WP 3.2) |
| DOM-MD-COM-07 | Hard delete exists only for an already soft-deleted row with no remaining references, and needs `masterdata.hard_delete` | DECIDED D6 (mechanics PROPOSED) | service + `on_delete=PROTECT` (WP 3.2, 4.1, 5.1, 6.3) |
| DOM-MD-COM-08 | A soft delete is refused (409 `has_dependants`) while live dependants exist, unless the type defines a cascade (`DECISIONS.md` D6 table) | DECIDED D6 / PROPOSED table | service (WP 3.2, 6.3) |
| DOM-MD-COM-09 | Restoring a soft-deleted row fails (409 `conflict`) if a live row now holds the same `code` or `name` | TARGET | service |
| DOM-MD-COM-10 | Rows with `is_system=True` cannot be archived, deleted or hard-deleted, and their `code` is immutable. `name`, `description`, `sort_order`, `color` and `icon` stay editable. | PROPOSED D6 (CURRENT: `Software.is_system` exists but is unenforced) | service (WP 3.2) |
| DOM-MD-COM-11 | `created_by`/`updated_by`/`deleted_by` are set from the authenticated actor, never from the request body | TARGET (fields exist, `apps/core/models/bases/audit.py`; not populated by the API today, U) | service |

### 2.2 API (API-MD)

| ID | Contract | Status |
|---|---|---|
| API-MD-01 | Routes stay exactly as CURRENT (`apps/masterdata/api/urls.py:39-156`): catalog paths have no trailing slash and return bare arrays; directory paths have a trailing slash and use `StandardPagination` (`{count, next, previous, results}`). New routes are additive. | CURRENT, frozen |
| API-MD-02 | Responses have no envelope (`apps/core/api/mixins/response.py:19-43`). Errors keep the core format: validation errors are `{<field>: [msg], "error": {"code": "validation_error", "request_id"}}`; other errors are `{"detail", "error": {"code", "request_id"}}` (CURRENT, P01/P02). | CURRENT, frozen |
| API-MD-03 | Status codes. `200` read/update/action. `201` create. `204` directory DELETE and any hard delete. `200 {"success": true, "message"}` catalog DELETE (frontend contract, `apps/masterdata/tests/api/test_platform_catalog.py:236`). `400` validation, **including a duplicate `code`/`name` detected before the write**. `401` no credentials. `403` missing permission. `404` unknown or soft-deleted id, or a malformed UUID. `409` a conflict found at write time: a concurrent duplicate (IntegrityError), a system row, live dependants, an illegal transition, a restore clash. | TARGET (CURRENT: P01 returns 409 where the correct result is 201) |
| API-MD-04 | 409 bodies carry a specific `error.code`: `conflict` (duplicate race), `system_row_protected`, `has_dependants`, `invalid_transition`, `contract_overlap`, `not_soft_deleted` (hard delete of a live row). Built with `MasterdataConflict(detail, code=…)` (`apps/masterdata/exceptions/conflict.py`), a `ConflictException` that also sets `.code`, because the core handler ignores the per-instance DRF code. | **IMPLEMENTED (Phase 3)** for catalogs (`invalid_transition` arrives with contracts, Phase 5) |
| API-MD-05 | Hard delete: `DELETE <detail>?hard=true`. `204` on success; `403` without `masterdata.hard_delete`; `409 not_soft_deleted` or `has_dependants`. The detail lookup for `hard=true` and for `restore` includes soft-deleted rows; every other detail lookup excludes them. | DECIDED D6 / mechanics PROPOSED |
| API-MD-06 | `POST <detail>/restore` exists for every masterdata resource. It undeletes a soft-deleted row, or un-archives an archived catalog row, and returns `200`: catalog `{"success": true, "data": <row>}` (CURRENT shape), directory `<row>`. | TARGET (CURRENT: catalog only, un-archive only) |
| API-MD-07 | Writes accept only the documented writable fields. Read-only fields sent by the client (`id`, timestamps, `created_by`, computed fields, `user` on person, the parent FK on contact/contract updates) are ignored on create and rejected with 400 on update **only** where the field is a parent FK (DOM-MD-CON-02). Otherwise they are ignored, as DRF does by default. | TARGET |
| API-MD-08 | OpenAPI documents the real responses for DELETE, archive, restore, overview and hard delete, plus 400/401/403/404/409 for every masterdata path | TARGET (CURRENT: wrong, `AUDIT.md` M7) |

### 2.3 Security (SEC-MD)

| ID | Contract | Status |
|---|---|---|
| SEC-MD-01 | Reads need authentication only. Writes need the `manage` code for their area. Hard delete additionally needs `masterdata.hard_delete`. The checks are `IsAuthenticatedPermission` + Identity's `HasPermission` with a full `permission_map`: an unmapped action is denied (`apps/core/api/viewsets/base.py:86-118`). | **IMPLEMENTED** (codes per D9; the legacy `platform.master_data.*` codes were removed in Phase 8) |
| SEC-MD-02 | **Sensitive fields:** person `date_of_birth`, `nationality`, `security_clearance`, `phone`, `email`; position `salary_range`; client/vendor contact `email`, `phone`; client/vendor `email`, `phone`, `contact_name`. These are returned only to holders of `masterdata.person.view_sensitive`; everyone else gets the field omitted. | **To be implemented in Phase 5** (user, 2026-10-23: H1 must not stay open through Phase 5; the earlier deferral is withdrawn). Also covers `Client.total_billed_usd`. Writing these fields needs the same permission. CURRENT: returned to every authenticated user (P06). |
| SEC-MD-03 | Sensitive fields (SEC-MD-02 list) never appear in log lines, `ChangeLog` snapshots or audit event payloads. Audit records keep field **names** only. | TARGET, DECIDED D13 (CURRENT: in `ChangeLog`, P10b; DB error logs, P01) |
| SEC-MD-04 | Client-supplied ownership is never trusted: `created_by` and the `Person.user` link are set server-side only (D4). A contact or contract parent cannot be changed after create. | TARGET (CURRENT: both writable, P10, `apps/masterdata/api/serializers/directory.py:134`) |
| SEC-MD-05 | Credential scopes apply as they do in Identity: a scoped API key or PAT gets masterdata writes only when its scopes list the needed code (`apps/identity/permissions/permission.py`) | CURRENT (inherited) |

---

## 3. Catalogs

### 3.1 Generic catalog contract (all 8 catalog models)

**Responsibilities:** a controlled vocabulary that the UI and later the production domain use for types, statuses and tools. No business workflow.

> **Status:** this generic contract is implemented for the six type catalogs (Phase 3) and for software and its versions (Phase 4, §3.4), all through `LookupCatalogModel`.

**Fields** (PROPOSED D2; own fields per type in §3.2–3.4):

| Field | Type | Default | Rule |
|---|---|---|---|
| `id` | UUID pk | generated | read-only |
| `code` | char(100) | required | DOM-MD-COM-04; immutable when `is_system` |
| `name` | char(255) | required | DOM-MD-COM-05 |
| `description` | text | `""` | — |
| `status` | enum `active`/`archived` | `active` | changed only by archive/restore. **Sending `status` on PUT or PATCH is a 400** (`{"status": ["Read-only. Use POST …/archive or …/restore to change it."]}`), even when the value is unchanged, so a client that still sends it fails loudly. A create ignores it (open question). |
| `sort_order` | int ≥ 0 | 0 | new; statuses use `order` |
| `is_system` | bool | False | read-only through the API; set by the canonical seed (D10) |
| `metadata` | JSON object | `{}` | must be an object, not an array or scalar |
| `color` (where the type has one) | char(20) | `""` | CSS hex with **3, 4, 6 or 8** digits (`#fff`, `#ffff`, `#ff00aa`, `#ff00aa80`) or a plain keyword (`red`, `dark-blue`). Rejected: 5- or 7-digit hex, functional notation (`rgb()`, `rgba()`, `hsl()`, `var()`), spaces and markup. Only values *sent* are checked; stored values are never re-validated, but a PUT that sends an old non-conforming value back is refused. |
| `scope` | `"GLOBAL"` | `"GLOBAL"` | **D12 option B, IMPLEMENTED (Phase 7)**: no DB column; the response reports the constant `"GLOBAL"`; input `GLOBAL` is accepted and ignored, anything else → 400; `?scope=GLOBAL` lists every row, any other value lists nothing. |
| timestamps, actor FKs, soft-delete fields | inherited | — | read-only |

**Constraints and indexes (TARGET):** `UniqueConstraint(Lower("code"), condition=Q(is_deleted=False))`; `UniqueConstraint(Lower("name"), condition=Q(is_deleted=False))`; `CheckConstraint(status IN ('active','archived'))`; `CheckConstraint(sort_order >= 0)`; index `(status, sort_order)`. Before the constraints are added, a data pre-check reports existing duplicates, which are resolved by you, never silently.

**Invariants:**
- DOM-MD-CAT-01: archive and restore toggle `status` only; soft delete touches only the deletion fields.
- DOM-MD-CAT-02: list order is deterministic: `sort_order`, then `name`, then `id`.

**State transitions:**

```text
active ⇄ archived       (archive / restore; not for is_system rows)
{active, archived} → soft-deleted → restored to its previous status
soft-deleted → hard-deleted   (masterdata.hard_delete; no references)
```

**Service operations (TARGET, `apps/masterdata/services/catalog.py`):**

```python
class CatalogService(Generic[CatalogT]):
    model: type[CatalogT]

    @classmethod
    def create(cls, *, actor: User, data: Mapping[str, Any]) -> CatalogT: ...
    @classmethod
    def update(cls, *, actor: User, instance: CatalogT, data: Mapping[str, Any]) -> CatalogT: ...
    @classmethod
    def archive(cls, *, actor: User, instance: CatalogT) -> CatalogT: ...
    @classmethod
    def restore(cls, *, actor: User, instance: CatalogT) -> CatalogT: ...  # undelete or un-archive
    @classmethod
    def soft_delete(cls, *, actor: User, instance: CatalogT) -> None: ...
    @classmethod
    def hard_delete(cls, *, actor: User, instance: CatalogT) -> None: ...
    @classmethod
    def reorder(cls, *, actor: User, ordered_ids: Sequence[UUID]) -> list[CatalogT]: ...
```

Each operation: validate (`apps/masterdata/validators/catalog.py`) → `transaction.atomic()` → write → publish the event (§7). `reorder` accepts a full or partial list of live ids of one type, rejects unknown or deleted ids (400), and writes `sort_order` = list position × 10.

**API (per type `<t>` ∈ `statuses, task-types, asset-types, shot-types, review-types, file-types, software`):**

| Method + path | Request | Success | Errors | Permission |
|---|---|---|---|---|
| `GET platform/master-data/<t>` | filters per type; `search`; `ordering` | 200 `[row…]` (bare array, includes archived, excludes soft-deleted) | 401 | authenticated |
| `POST platform/master-data/<t>` | writable fields | 201 `row` | 400, 401, 403, 409 `conflict` (race) | `masterdata.catalog.manage` |
| `GET …/<t>/<uuid>` | — | 200 `row` | 401, 404 | authenticated |
| `PUT` / `PATCH …/<t>/<uuid>` | writable fields | 200 `row` | 400, 401, 403, 404, 409 `system_row_protected` (code change on a system row) | `manage` |
| `POST …/<t>/<uuid>/archive` | — | 200 `{"success": true, "data": row}` | 401, 403, 404, 409 `system_row_protected` | `manage` |
| `POST …/<t>/<uuid>/restore` | — | 200 `{"success": true, "data": row}` | 401, 403, 404, 409 `conflict` | `manage` |
| `DELETE …/<t>/<uuid>` | — | 200 `{"success": true, "message": "<Type> soft-deleted. It can be restored."}` (a **soft delete**: the row is flagged `is_deleted`, kept, and hidden; `status` is not changed; `POST …/restore` undoes it) | 401, 403, 404, 409 `system_row_protected` / `has_dependants` | `manage` |
| `DELETE …/<t>/<uuid>?hard=true` | — | 204 | 401, 403, 404, 409 `not_soft_deleted` / `has_dependants` / `system_row_protected` | `manage` + `masterdata.hard_delete` |
| `POST platform/master-data/<t>/reorder` **(new)** | `{"ids": [uuid…]}` | 200 `[row…]` | 400, 401, 403 | `manage` |

> **What DELETE does (exact).** `DELETE` without `?hard=true` is a **soft delete**: `is_deleted=true`, `deleted_at` and `deleted_by` are set, the row stays in the table, disappears from lists and detail (404) and stops counting for uniqueness, and `POST …/restore` brings it back. It does **not** archive (`status` is unchanged) and does **not** remove the row. A **permanent** delete is only `DELETE …?hard=true`, which needs `masterdata.hard_delete` and a row that is already soft-deleted, and returns 204 with no body. Before Phase 3 `DELETE` archived the row and said "… archived."; the message changed with the behaviour. The `success` / `message` keys are unchanged. **U:** whether the frontend shows the message text verbatim (the user is checking).

**Failure behaviour:**
- Validation errors are raised before any write, so there are no partial writes.
- A unique-constraint race at commit maps to 409 `conflict` through the core handler (`apps/core/api/exceptions/handlers.py:315-318`).
- Event-handler failures never roll back the write, because they run on commit, and they are logged without row values.
- A row deleted by a concurrent request between the lookup and the locked update returns 404 (not 500).
- Audit rows use `target_type="masterdata"` (not yet in `AuditLog.TARGET_CHOICES`; see DECISIONS Phase 3 note 9).

**Required tests:** constraint tests (case-insensitive duplicates, deleted rows ignored); every transition and every refused transition; system-row protection; API matrix (anonymous 401 / authenticated read 200, write 403 / privileged 2xx); ordering; reorder; concurrent create of one code (one 201 and one 409, never 500, PostgreSQL); migration from an empty DB; audit event emitted per operation.

### 3.2 Statuses (`MasterStatus`, DOM-MD-STS)

| ID | Contract | Status |
|---|---|---|
| DOM-MD-STS-01 | Unique `(entity_type, Lower(code))` among non-deleted rows. **Replaces** the global code uniqueness for this table. | **IMPLEMENTED (Phase 3)** |
| DOM-MD-STS-02 | `entity_type` ∈ `Project, Sequence, Shot, Asset, Task, Version, Review, Delivery` | PROPOSED D5 (CURRENT: free text) |
| DOM-MD-STS-03 | `category` ∈ `not_started, in_progress, review, done, cancelled`, or blank | PROPOSED D5 |
| DOM-MD-STS-04 | At most one live, active `is_default=True` per `entity_type` (partial unique). Setting a new default clears the flag on every other status of that entity type, archived ones included, in the same transaction. Restoring a default while another active default exists → 409 `conflict`. | **IMPLEMENTED (Phase 3)** |
| DOM-MD-STS-05 | `order` is the status sort order (no `sort_order` column for statuses) | PROPOSED D2 |
| DOM-MD-STS-06 | Transitions between statuses: **not modelled** (Later, D5) | — |

Own fields: `entity_type`, `category`, `color` (`#RRGGBB` or blank, validated), `order`, `is_default`, `is_final`. Filters (CURRENT): `entity_type, status, is_default, is_final` (and the constant `scope`, see above).
Extra tests: the same code for two entity types (201 + 201); a second default unsets the first; a third concurrent default (exactly one wins).

### 3.3 Type catalogs

| Model | Own fields and rules | Status |
|---|---|---|
| `MasterTaskType` | `category`, `department_code`, `department_name` (denormalized, see below), `color`, `icon` | CURRENT fields. PROPOSED: `department_code` is validated to match a live `Department.code` when non-blank, and `department_name` is filled from it (no FK, to keep the contract). |
| `MasterAssetType` | `color`, `icon` | CURRENT |
| `MasterShotType` | `default_handle_frames` ≥ 0 or null | CURRENT; check constraint TARGET |
| `MasterReviewType` | `allow_verdicts`, `require_notes` | CURRENT |
| `MasterFileType` | `extension` (lower-cased, no leading dot, unique case-insensitively among live rows), `mime_type` (`type/subtype` or blank), `category`, `dcc_affinity`. **`code` is derived from `extension` by the service when absent** (`EXR` → `exr`), matching the seeder (`apps/core/management/commands/seed_demo_data.py:326-327`). | TARGET; fixes P13 (CURRENT: the second create fails with 409) |

### 3.4 Software and versions (DOM-MD-SW) — **IMPLEMENTED (Phase 4)**

| ID | Contract | Status |
|---|---|---|
| DOM-MD-SW-01 | `Software → SoftwareVersion` is `on_delete=PROTECT`, so a hard delete of a software is refused (409 `has_dependants`) while any version row, soft-deleted ones included, still exists. A soft delete soft-deletes the software's live versions in the same transaction **with the same `deleted_at`**; a restore brings back exactly the versions carrying that timestamp, so a version deleted earlier on its own stays deleted. | **IMPLEMENTED** |
| DOM-MD-SW-02 | A version is created only under its software: `software` comes from the URL (`software_pk`), never from the body (a `software` / `software_id` in the body is ignored). The software row is locked for the length of the create, so a version cannot appear under a software that a concurrent request is deleting. An unknown or soft-deleted software → 404. | **IMPLEMENTED**; fixes H5 (P01) |
| DOM-MD-SW-03 | Unique `(software, Lower(version))`, `(software, Lower(code))` and `(software, Lower(name))` among non-deleted rows; the global code uniqueness is gone. On create, a blank `code` becomes `<software.code>-<version>` and a blank `name` becomes `<software.name> <version>`. | **IMPLEMENTED** |
| DOM-MD-SW-04 | `end_of_support ≥ release_date` when both are set (DB check constraint, plus a 400 on `end_of_support`) | **IMPLEMENTED** |
| DOM-MD-SW-05 | `is_deprecated` (read-only, computed) = `status` is `archived`, or `end_of_support` is in the past | **IMPLEMENTED** |
| DOM-MD-SW-06 | Default version order: newest `release_date` first, **undated last** (a bare DESC sort would put them first), then the natural version key descending, then `version`. The key (`version_key`, derived on save) zero-pads numbers, so `10` sorts after `9`. An explicit `?ordering=` replaces the default. | **IMPLEMENTED** |
| DOM-MD-SW-07 | `version_count` = live, non-archived versions, computed in the same query as the list (no per-row query) | **IMPLEMENTED**; fixes P09 |
| DOM-MD-SW-08 | `POST …/software/<id>/archive` archives the software and its **active** versions; the response lists them in `data.versions_archived`. `?cascade=false` refuses with 409 `has_dependants` while any version is active. `?cascade=` other than true/false → 400. Restoring (un-archiving) a software does **not** un-archive its versions. | **IMPLEMENTED** |

Nested API (paths unchanged, `apps/masterdata/api/urls.py`): `GET/POST …/software/<uuid>/versions`; `GET/PUT/PATCH/DELETE …/versions/<uuid>`; `POST …/versions/<uuid>/archive|restore`. A version under a different software in the URL → 404. New: `POST …/software/reorder` (software only; versions are not reorderable).
Response changes (additive): both resources gain `is_system` and `sort_order`; versions gain `code`, `name` (both optional on create) and `is_deprecated`. `DELETE` is a soft delete (message `"Software soft-deleted. It can be restored."` / `"Software version soft-deleted. It can be restored."`).
Services: `SoftwareService`, `SoftwareVersionService` (`apps/masterdata/services/software.py`), both `CatalogService[T]`. A version is created with `create(*, actor, parent=<Software>, data)`.
Tests: `tests/models/test_software_models.py`, `tests/services/test_software_services.py`, `tests/api/test_software_api.py`, the concurrency and migration (`0006`) tests, and the software seed test in `apps/core/tests/test_seed_studiohub.py`.

---

## 4. Business partners

### 4.1 Client and Vendor (DOM-MD-BIZ)

| ID | Contract | Status |
|---|---|---|
| DOM-MD-BIZ-01 | `code` ≤ 20 chars, DOM-MD-COM-04 | TARGET |
| DOM-MD-BIZ-02 | `email` lower-cased and validated; `phone` validated and normalized: only `+`, digits, spaces, `()`, `.` and `-` are accepted, runs of spaces collapse, trimmed, ≤ 50; anything else → 400. No E.164 parsing (it would need a new dependency, so ask first) | **IMPLEMENTED (Phase 5)** |
| DOM-MD-BIZ-03 | `Vendor.rating` in `[0, 5]` (check constraint) | PROPOSED D8 |
| DOM-MD-BIZ-04 | `status` stays free text: these are business standing labels ("Active", "Approved Partner"), **not** lifecycle. Lifecycle is soft delete. | PROPOSED (the frontend value set is U) |
| DOM-MD-BIZ-05 | `Client.active_projects`, `Vendor.active_projects` and `Vendor.active_tasks_count` are **omitted from responses**. They come back only through a selector exposed by the Projects module and keyed by the masterdata **UUID**; **never matched by code, and masterdata never imports Projects**. The stored columns are kept until Phase 8 (dropping needs approval). | **DECIDED D11 (user, 2026-10-23)** |
| DOM-MD-BIZ-07 | `Client.total_billed_usd` is a **nullable `DecimalField(12, 2)`**, default `NULL`, **entered by hand**: not computed and not reconciled with any billing system (the API docs say so). Read **and** write need `masterdata.client.view_financial` (writes also `masterdata.directory.manage`); omitted without it, writes refused with 403; audited as the field name only. Not a SEC-MD-02 field. | **DECIDED D11 (approved 2026-10-23)** |
| DOM-MD-BIZ-06 | Soft delete is refused (409 `has_dependants`) while an `active` contract or a live `deliveries.DeliveryPackage` references the row. Contacts are soft-deleted with the parent. | PROPOSED D6 |

API: CURRENT routes `clients/`, `vendors/` (+ `restore`, `?hard=true`). Filters (CURRENT): client `status, studio_type`; vendor `status, specialization`. Selector: drop the unused contact/contract prefetch (`apps/masterdata/selectors/directory.py:74,82`).
Services: `ClientService`, `VendorService`, sharing a `PartnerService` base.

### 4.2 Contacts (`ClientContact`, `VendorContact`; DOM-MD-CON)

| ID | Contract | Status |
|---|---|---|
| DOM-MD-CON-01 | One live primary contact per parent: partial unique `(parent, is_primary) WHERE is_primary AND NOT is_deleted`. Making a contact primary clears the previous one in the same transaction, under a lock on the parent row. | TARGET (CURRENT: several, P05) |
| DOM-MD-CON-02 | The parent (`client` / `vendor`) is set on create and immutable afterwards: an update that changes it → 400 | TARGET (CURRENT: re-parenting allowed, P10) |
| DOM-MD-CON-03 | The parent must be live (not soft-deleted) at create time | TARGET |
| DOM-MD-CON-04 | `email` lower-cased; unique per parent among live rows when non-blank. `phone` normalized as in DOM-MD-BIZ-02. | TARGET |
| DOM-MD-CON-05 | `on_delete=PROTECT` from the parent (CASCADE removed) | TARGET (CURRENT: CASCADE, `apps/masterdata/models/client_contact.py:15-20`) |
| DOM-MD-CON-07 | **Contact endpoints are purely sensitive.** Every contact route needs `masterdata.person.view_sensitive`, checked before any object lookup (a missing id and a forbidden id both answer 403). Writes need `masterdata.directory.manage` **and** the sensitive permission. Contacts are never embedded in a parent response; the parent exposes only `contact_count`. | **DECIDED (2026-10-23)** |
| DOM-MD-CON-06 | Contact fields are sensitive (SEC-MD-02, Phase 5) and never logged (SEC-MD-03); proven by a log-capture test | TARGET (Phase 5) |

Shared abstract `ContactBase` (no table rename). Service: `ContactService.create(*, actor, parent, data)`, `update`, `make_primary`, `soft_delete`, `restore`, `hard_delete`.
Extra tests: a second primary is unset automatically; two concurrent "make primary" calls leave exactly one primary; a re-parent attempt returns 400; a contact of client A cannot be modified by a request that names client B; a log-capture test shows no email or phone in log records.

### 4.3 Contracts (`ClientContract`, `VendorContract`; DOM-MD-CTR)

| ID | Contract | Status |
|---|---|---|
| DOM-MD-CTR-01 | `expiry_date ≥ effective_date` when both are set (check constraint) | TARGET (CURRENT: accepted, P05) |
| DOM-MD-CTR-02 | Wire statuses: `Draft`, `Active`, `Expired`, `Terminated`. **Stored** values are only `Draft`, `Active`, `Terminated`; **`Expired` is derived** (see CTR-09). A create may be `Draft` or `Active` (default `Active`, as today); `Terminated` cannot be created. | **DECIDED (user, 2026-10-23)**; the frontend strings are being confirmed |
| DOM-MD-CTR-03 | Transitions, only through service actions (`status` is read-only in PUT/PATCH): `Draft → Active` (`activate`), `Draft → Terminated`, `Active → Terminated` (`terminate`), and `Active → Expired` which is **automatic** when the end date passes (no write). `Expired` and `Terminated` are **final**: any further transition is `409 invalid_transition`. | **DECIDED** |
| DOM-MD-CTR-04 | Activating (or creating `Active`) requires `effective_date`. There is **no expiry job**: nothing writes `Expired`. | **DECIDED** |
| DOM-MD-CTR-05 | **Overlap rule.** No two **MSAs** of the same parent may overlap in `[effective_date, expiry_date]` when both are not soft-deleted and each is stored-`Active` **or** stored-`Terminated` with `activated_at` set (a contract terminated straight from `Draft` occupies nothing). Range **inclusive at both ends**; a **null `expiry_date` is open-ended**; scoped type is **`MSA` only** (approved) for clients and, mirrored, for vendors, so concurrent SOWs and every other type, and an MSA against a SOW, may overlap; Draft and Terminated contracts are ignored (an expired MSA keeps occupying its *historic* range, see DECISIONS D8). Enforced twice: the service locks the parent and answers `409 contract_overlap` naming the conflicting contract number; a PostgreSQL exclusion constraint (`btree_gist`, skipped on SQLite) is the backstop (conflict → `409 conflict`). | **DECIDED D8 (hybrid, MSA-only approved)**; the expired-MSA backdating question is open |
| DOM-MD-CTR-06 | `value_usd` / `total_value_usd` are integers ≥ 0 in `currency` units. New `currency` (ISO 4217, default `USD`). | PROPOSED D8 |
| DOM-MD-CTR-07 | `(parent, Lower(contract_number))` unique among live rows. The parent is immutable after create. | TARGET (CURRENT: unique `(parent, contract_number)`, case-sensitive) |
| DOM-MD-CTR-08 | `on_delete=PROTECT` from the parent | TARGET (CURRENT: CASCADE) |
| DOM-MD-CTR-09 | **Derived expiry.** The API `status` of a stored-`Active` contract whose `expiry_date` is before the server's local date (`timezone.localdate()`) is `Expired`; `expiry_date` equal to today is still `Active`. `?status=Expired` and `?status=Active` filter on stored status **and** date, so they never overlap. Once effective status is `Expired` or `Terminated` the contract is **read-only** (409 `invalid_transition`; soft delete, restore and `adjust-end-date` excepted), so an ordinary edit cannot revive it. While `Active`, `expiry_date` may change but not to a date before today. A stored status outside `Draft/Active/Terminated` in existing data stops the migration with a listing. | **DECIDED** |
| DOM-MD-CTR-10 | **`terminate`** from `Active` sets `expiry_date` to the termination date when the end is open or later, so the range actually covered is recorded; from `Draft` it changes no dates. A contract terminated from `Active` keeps occupying its covered range in the overlap rule. | **DECIDED (2026-10-23)** |
| DOM-MD-CTR-11 | **`activated_at`** (nullable timestamp, read-only): set by `activate` or when a contract is created `Active`; backfilled in the migration for existing `Active`/`Terminated` rows that have an `effective_date`. It is what separates "terminated after being active" from "terminated as a draft". | **DECIDED** |
| DOM-MD-CTR-12 | **`POST …/adjust-end-date {"expiry_date": date}`** (`masterdata.directory.manage`): the only way to correct an elapsed or terminated contract. Changes only `expiry_date`; allowed on Active, derived-Expired and Terminated; the new date must be on or after `effective_date`; for an elapsed or terminated contract it must stay before today (never revives it); the overlap rule is re-checked; emits an audit event with the old and new dates. | **DECIDED** |
| DOM-MD-CTR-13 | **Financial values.** `value_usd` (client contract) and `total_value_usd` (vendor contract) are omitted without `masterdata.client.view_financial`; search, filter and ordering on them → 403; a write that includes them → 403; excluded from exports, caches and aggregates; audited by field name only. | **DECIDED (2026-10-23)** |

New actions (additive): `POST client-contracts/<uuid>/activate | terminate`, and the same for vendor contracts. Responses: `200 row`, or `409 invalid_transition`.
Service: `ContractService.activate(*, actor, contract)`, `terminate(*, actor, contract)` (no `reason`: the audit event records the from/to states), `adjust_end_date(*, actor, contract, expiry_date)`. (`expire_due` from the first draft is dropped: expiry is derived, nothing to run.)
Extra tests: date check (400, plus a DB constraint test); each legal and illegal transition, including `Expired`/`Terminated` being final; derived status on the boundary (end date yesterday / today / tomorrow) and the filters being exact complements; overlap (MSA refused, SOW allowed, MSA vs SOW allowed, inclusive boundary day refused, next day allowed, open-ended refused); **PostgreSQL: two simultaneous overlapping creates → exactly one succeeds**; a direct ORM insert is refused by the database constraint; on SQLite the constraint tests are skipped and the service check still refuses.

---

## 5. Directory: organizational structure and people

### 5.1 Department (DOM-MD-DEP)

| ID | Contract | Status |
|---|---|---|
| DOM-MD-DEP-01 | `parent` is not self (check constraint `parent_id <> id`) | **IMPLEMENTED (Phase 6)** (constraint `masterdata_department_parent_not_self`) |
| DOM-MD-DEP-02 | No cycles; depth ≤ 6 levels. Checked in the service (a walk up the ancestors, and the subtree height for a move). | **IMPLEMENTED (Phase 6)**, limit 6 APPROVED. The walk runs under a PostgreSQL advisory lock taken before any row lock; a subtree move counts the subtree's height. |
| DOM-MD-DEP-03 | `parent` and `manager` must be live rows | **IMPLEMENTED (Phase 6)** (a row also cannot be restored under a deleted parent or manager) |
| DOM-MD-DEP-04 | Soft delete refused while child departments, teams, positions, persons or external references (`production.Asset.department`, `scheduling.Resource.department`) are live | **IMPLEMENTED (Phase 6)**: any live row pointing at it blocks the delete (409 `has_dependants`), including other apps' rows |
| DOM-MD-DEP-05 | Computed, read-only: `utilization_percentage` and `capacity_hours_weekly` (D11; the week definition needs sign-off) | **DECIDED (Phase 6, 2026-10-23): omitted from the API, columns kept**; they return only through a selector that Scheduling exposes (DECISIONS "Phase 6 decisions" 1) |

API: CURRENT `departments/` (+ `restore`, `?hard=true`). Filters `department_type, parent`. Service: `DepartmentService.create/update/move(*, actor, department, new_parent)/soft_delete/restore/hard_delete`.

### 5.2 Team (DOM-MD-TEAM)

- **DOM-MD-TEAM-01:** `department` is required and must be live. **IMPLEMENTED (Phase 6)**, as are TEAM-02 and TEAM-03.
- **DOM-MD-TEAM-02:** `lead` must be a live Person.
- **DOM-MD-TEAM-03:** soft delete is refused while persons, memberships (§5.6), `production.Asset/Task.team` or `scheduling.Resource.team` reference the team (409 `has_dependants`).
- **DOM-MD-TEAM-05 (CR-33):** a team carries a read-only `member_count`: its live memberships (§5.6), counted in the same query as the list (a person in two teams counts once in each; a removed membership does not count).
- **DOM-MD-TEAM-04:** `utilization_percentage` is **omitted from the API** (same decision as DEP-05). `capacity` and `current_project_code` stay inputs unless D11-OPEN decides otherwise.

API: CURRENT `teams/`.

### 5.3 Office (DOM-MD-OFF)

- **IMPLEMENTED (Phase 6)**: OFF-01 to OFF-05.
- **DOM-MD-OFF-01:** `is_active` means "office operating" and is **not** deletion; deletion is soft delete (D6).
- **DOM-MD-OFF-02:** at most one live `is_headquarters=True` (partial unique; setting a new HQ clears the old one).
- **DOM-MD-OFF-03:** `timezone` must be an IANA name (`zoneinfo.available_timezones()`).
- **DOM-MD-OFF-04:** `headcount` is computed from live, active people (read-only; the stored column is unused). `workstations_count` and `render_nodes_count` stay inputs unless D11-OPEN decides otherwise.
- **DOM-MD-OFF-05:** soft delete is refused while live persons reference the office.

API: CURRENT `offices/`.

### 5.4 Position (DOM-MD-POS)

- **IMPLEMENTED (Phase 6)**: POS-01 to POS-03 and POS-05; POS-04 was done in Phase 5.
- **DOM-MD-POS-01:** no self-parent, no cycles, depth ≤ 6.
- **DOM-MD-POS-02:** `level` ≥ 1.
- **DOM-MD-POS-03:** `department` is optional and must be live when set.
- **DOM-MD-POS-04:** `salary_range` is sensitive (SEC-MD-02, deferred).
- **DOM-MD-POS-05:** soft delete is refused while live persons hold the position (`Person.role`) or child positions exist.

API: CURRENT `positions/`.

### 5.5 Person (DOM-MD-PER)

| ID | Contract | Status |
|---|---|---|
| DOM-MD-PER-01 | At most one Person per User (CURRENT `UniqueConstraint(user)`, `apps/masterdata/models/person.py:114-119`) | CURRENT |
| DOM-MD-PER-02 | `user` is read-only in the API. It is changed only by `POST people/<uuid>/link-user {"user": uuid}` and `POST people/<uuid>/unlink-user`, which require `masterdata.directory.manage`. Linking a user already linked elsewhere → 409 `conflict`; an inactive or deleted user → 400. | **IMPLEMENTED (Phase 6), D4 APPROVED.** Linking an inactive/unknown user → 400; a person already linked, or a user already linked to a live person → 409 `conflict`; an e-mail already used by another person → 409 `conflict`. |
| DOM-MD-PER-03 | When linked, `email` and `name` are owned by Identity (`User.email`; `Profile.display_name`, else first + last name). They are copied on link and refreshed after commit on every `User`/`Profile` save; they are read-only through the person API (400 if sent with a different value). | **IMPLEMENTED (Phase 6).** A queryset update, so no ChangeLog row and no signal loop; a refresh that would duplicate another person's e-mail is skipped and logged. |
| DOM-MD-PER-04 | No authentication data on Person (passwords, MFA, sessions, tokens) | CURRENT (none present) |
| DOM-MD-PER-05 | `status` uses core `LifecycleStatus` (`draft, active, inactive, archived`; `apps/core/choices/lifecycle.py:9-20`). Deactivation is `status=inactive`; deletion is soft delete. | **IMPLEMENTED (Phase 6)**: `deactivate` / `reactivate` actions, or `status` through PATCH |
| DOM-MD-PER-06 | `department`, `team`, `office`, `role` (a Position) must be live rows. If both are set, `team.department` must equal `department`. | **IMPLEMENTED (Phase 6)** |
| DOM-MD-PER-07 | `email` lower-cased; unique case-insensitively among live persons when non-blank | **IMPLEMENTED (Phase 6)** (partial unique `masterdata_person_uq_email_ci`) |
| DOM-MD-PER-08 | Sensitive fields (SEC-MD-02) are deferred. **Never logged or snapshotted** (SEC-MD-03) | **IMPLEMENTED (Phases 5 and 6)** |
| DOM-MD-PER-09 | A Person is deactivated or soft-deleted even when departments, teams or offices name them as manager or lead; the manager/lead links naming them are cleared in the same transaction and listed in a `warnings` key of the `deactivate` / PATCH-status response (`{model, id, field}`); a DELETE answers 204 with no body, so for it the cleared ids are only in the audit event | **IMPLEMENTED (Phase 6), APPROVED 2026-10-23** |

API: `people/` (+ `link-user`, `unlink-user`, `deactivate`, `reactivate`, `restore`, `?hard=true`). Filters `status, department, team, office`. Service: `PersonService.create/update/link_user/unlink_user/deactivate/reactivate/soft_delete/restore/hard_delete`.
Extra tests: link integrity (one person per user; a second link gets 409); email follows the User; a client cannot set `user` through PATCH; deactivating a person who is a department manager; IDOR (a write without the grant gets 403; reads open per the D4 deferral).

### 5.6 Team membership (`TeamMembership`; DOM-MD-TM, CR-32, 2026-10-31)

A person can be in several teams. Membership is a plain link between a team and a person (no role, no dates).

| ID | Contract | Status |
|---|---|---|
| DOM-MD-TM-01 | One live membership per `(team, person)` (partial unique `masterdata_teammembership_uq_team_person`). Adding a person who is already a member → 400 `{"person": ["This person is already a member of the team."]}`; two simultaneous adds are serialized by a lock on the team. | **IMPLEMENTED** |
| DOM-MD-TM-02 | `team` and `person` must be live rows. A membership is created and removed, never edited (`PUT`/`PATCH` → 405). `DELETE` is a soft delete (204); the person can join again (a new row). `POST …/restore/` is refused (409 `conflict`) while a live membership of the same pair exists or the team or person is deleted. | **IMPLEMENTED** |
| DOM-MD-TM-03 | Teams of any department may hold the same person. `Person.team` is the person's **primary team**; DOM-MD-PER-06 (team and department agree) applies to it only. | **IMPLEMENTED** |
| DOM-MD-TM-04 | Setting `Person.team` (create or update) makes the person a member of that team if they are not. Changing or clearing it removes no membership. | **IMPLEMENTED** |
| DOM-MD-TM-07 | Removing the membership of a person's primary team clears `Person.team` in the same transaction (through `PersonService.update`), so `Person.team` never names a team the person is not a member of. Removing any other membership leaves it. | **IMPLEMENTED** |
| DOM-MD-TM-05 | A team with live memberships cannot be soft-deleted (409 `has_dependants`, as TEAM-03). Soft-deleting a person soft-deletes their memberships with the same timestamp; restoring the person restores only those. A hard delete of a person removes their memberships. | **IMPLEMENTED** |
| DOM-MD-TM-06 | The migration `0002_team_membership` makes every live person with a live `team` a member of it. | **IMPLEMENTED** |

API: `team-memberships/` (`GET`/`POST`, `GET`/`DELETE …/{id}/`, `POST …/{id}/restore/`, `?hard=true`). Filters `team`, `person`; search `person__name`, `team__name`; ordering `created_at`. Reads: any signed-in user. Writes: `masterdata.directory.manage` (`masterdata.hard_delete` for `?hard=true`). A row carries `id, team, team_name, person, person_name, person_status, person_department_name, person_office_name, created_at, updated_at`; the names are read-only. `GET /people/?team=<id>` still filters on the **primary** team only: list a team's members with `team-memberships/?team=<id>`. Service: `TeamMembershipService.create/ensure/soft_delete/restore/hard_delete`.

---

## 6. Platform overview

`GET platform/overview` (CURRENT, `apps/masterdata/services/resolution.py:24-50`).

| ID | Contract | Status |
|---|---|---|
| API-MD-OV-01 | The counts cover live (non-deleted) rows. Keys: `global_software_count`, `global_version_count`, `global_status_count`, `global_task_type_count`, `global_asset_type_count`, `global_shot_type_count`, `global_review_type_count`, `global_file_type_count`, `system_health`, `last_definition_update`. **`total_custom_records_across_orgs` was removed in Phase 7** (APPROVED 2026-10-23). | **IMPLEMENTED (Phase 7)** |
| API-MD-OV-02 | Documented response schema in OpenAPI | TARGET (CURRENT: missing, spectacular error at `apps/masterdata/api/viewsets/catalog.py:247`) |

---

## 7. Audit events

Masterdata publishes `DomainEvent` subclasses (`apps/core/events/base.py:11-40`) from its services. The bus defers them to after commit (`apps/core/events/bus.py:23-37`).

| Event | Published by | Payload |
|---|---|---|
| `MasterdataRecordCreated` | every `create` | `model` (label), `id`, `code` (or `null`), `actor_id`, `fields` (names only) |
| `MasterdataRecordUpdated` | `update`, `move`, `make_primary`, `link_user`/`unlink_user` | same, plus `changed` (field **names**) |
| `MasterdataRecordArchived` / `…Restored` | archive, restore | `model`, `id`, `code`, `actor_id` |
| `MasterdataRecordDeleted` | soft delete | same, plus `cascade` (ids soft-deleted with it) |
| `MasterdataRecordHardDeleted` | hard delete | same; also logged at WARNING |
| `ContractTransitioned` | activate, terminate, expire | `id`, `from`, `to`, `actor_id` (or `null` for the expiry job) |

The handler `apps/masterdata/events/handlers.py` writes one `audit.AuditLog` row per event (actions `create/update/delete`, `apps/audit/models/audit_log.py:24-26`). Old and new **values** are recorded for non-sensitive fields only (SEC-MD-03). The generic `ChangeLog` signal stays for the six tracked models, with sensitive fields redacted (D13).
Required tests: one event per operation; no sensitive value in any `AuditLog` or `ChangeLog` row; nothing is emitted when the transaction rolls back.

---

## 8. Test matrix (minimum per implementation phase)

| Area | Phase 3 (catalogs) | Phase 4 (software) | Phase 5 (partners) | Phase 6 (directory) |
|---|---|---|---|---|
| Constraints (DB-level, with `IntegrityError` asserted) | code/name case-insensitive, status per entity, one default | version per software, dates | one primary, contract dates, rating | self-parent, one HQ, one person per user |
| Service success, failure, rollback | ✓ | ✓ | ✓ | ✓ |
| Transitions | archive/restore/delete/hard delete | + cascade | contract lifecycle | person lifecycle |
| API matrix: anonymous / authenticated / privileged / hard-delete holder | ✓ | ✓ | ✓ | ✓ |
| Referential protection (`has_dependants`) | — | versions | contracts, deliveries | teams, persons, production, scheduling |
| Concurrency (PostgreSQL, `transaction=True`) | same code twice | same version twice | make-primary, overlapping activation | link the same user twice |
| Real authentication (JWT through the auth chain) | one flow | — | — | one flow |
| PII never logged or audited | — | — | log-capture test | log-capture + audit test |
| Migration from an empty DB / backward on populated data | ✓ | ✓ | ✓ | ✓ |
| Seed idempotency (twice, no duplicates) | ✓ | ✓ | — | ✓ |
| Factories (`apps/masterdata/tests/factories.py`) | created | extended | extended | extended |

Concurrency tests use `transaction=True` and must leave the test DB clean (`AUDIT.md`, Phase 0 notes).
