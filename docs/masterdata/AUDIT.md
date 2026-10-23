# Masterdata Module — Audit (Phase 1)

Date: 2026-10-23 · Branch: `feature/masterdata-hardening` · Base commit: `cfc8422`
Status: **Draft for approval** · Companion: [`PLAN.md`](PLAN.md)

This is a read-only audit of `backend/apps/masterdata`. No code was changed. Every claim cites `path:line` (paths are relative to `backend/` unless they start with `docs/`) or a behaviour probe (`P01`–`P12`, see [Appendix A](#appendix-a--behaviour-probes)). Anything not verified is marked **UNVERIFIED**.

Status legend: **COMPLETE** works and is protected · **PARTIAL** works with gaps · **MISSING** not implemented · **DEFECTIVE** implemented but wrong or broken.
Checklist legend: **Y** yes · **N** no · **NA** not applicable · **U** unverified.

---

## 1. Scope correction (read first)

The task brief lists 23 tables plus 7 tables to remove. The database and the code hold **19** masterdata tables.

| Brief group | Tables | Actual state |
|---|---|---|
| A. Lookup catalogs | asset_type, file_type, review_type, shot_type, status, task_type | Present (6) |
| B. Platform structure | platform_department, platform_group, platform_position, platform_role | **Already dropped** by `apps/masterdata/migrations/0004_remove_organizationassettypeconfig_uq_org_assettype_config_and_more.py:253-263` (commit `0b85370`, 2026-10-17) |
| C. Software | software, software_version | Present (2) |
| D. Business entities | client, client_contact, client_contract, vendor, vendor_contact, vendor_contract | Present (6) |
| E. Org structure and people | department, office, person, position, team | Present (5) |
| Removal list | org_assettype/reviewtype/shottype/status/tasktype/software/filetype_config | **Already dropped** by the same migration (`0004…:265-285`) |

Evidence: migration `0004` is applied in the dev DB (`django_migrations` holds `0001`–`0004`), and that DB has exactly 19 `masterdata_*` tables (checked by introspection, table names only). Migration `0004` uses `DeleteModel`, so **the rows in those 11 tables are gone**. Reversing `0004` would recreate empty tables only. Per your Phase 0 decision, Phase 7 becomes cleanup of leftover references (see §9).

Because of this, group B is not audited table by table. Its overlap questions are answered in §6.

---

## 2. Module inventory

**Layout** (`apps/masterdata/`): `api/{urls.py, viewsets/{catalog,directory}.py, serializers/{catalog,directory}.py}`, `models/` (14 files), `selectors/{catalog,directory}.py`, `services/resolution.py`, `events/__init__.py`, `constants/permissions.py`, `migrations/0001–0004`, `tests/` (2 files, 12 tests).

**Absent compared with the `identity` layout:** `admin/`, `validators/`, `managers/`, `querysets/`, `permissions/`, `signals/`, `choices/`, `filters/`. There are also no write services: `services/resolution.py` holds one read-only function.

**Base classes**
- `CatalogModel(EntityModel)` `apps/masterdata/models/base.py:22-68` adds `code` (`unique=True`, `:25-30`), `name`, `description`, `status` (free text, default `"active"`, `:41-46`), `scope` (`GLOBAL`/`ORGANIZATION`, `:47-53`) and `metadata`, with `ordering=("name",)` and an index on `(scope, status)` (`:60-65`).
- `PlatformScopedModel(EntityModel)` `apps/core/models/bases/scopes.py:36-40` adds nothing.
- `EntityModel` `apps/core/models/bases/entity.py:14-26` = UUID pk + `created_at`/`updated_at` + `created_by`/`updated_by`/`deleted_by` + soft delete (`is_deleted`, `deleted_at`; `objects` hides deleted rows; `delete()` soft-deletes, `apps/core/models/bases/soft_delete.py:116-134`).

**Routes** (mounted at `/api/v1/` by `config/v1_urls.py:53`; resolution checked with `django.urls.resolve`)
- Catalog (bare arrays, no pagination, no trailing slash): `platform/master-data/{statuses,task-types,asset-types,shot-types,review-types,file-types,software}` + `/<uuid>` + `/<uuid>/archive` + `/<uuid>/restore`. Nested software versions live at `software/<uuid>/versions[/<uuid>[/archive|/restore]]` (`apps/masterdata/api/urls.py:62-156`).
- Overview: `GET platform/overview` (`apps/masterdata/api/urls.py:63-67`).
- Directory (router, paginated, trailing slash): `departments, teams, offices, positions, people, clients, vendors, client-contacts, vendor-contacts, client-contracts, vendor-contracts` (`apps/masterdata/api/urls.py:39-51`).

**Authorization** uses Identity's `HasPermission` + `permission_map` (`apps/identity/permissions/permission.py`). Catalog: `MasterDataCatalogGuard` `apps/masterdata/api/viewsets/catalog.py:51-74`. Directory: `GlobalDirectoryGuard` `apps/masterdata/api/viewsets/directory.py:49-64`. Both allow reads for any authenticated user (`()`) and require `platform.master_data.configure` for every write.

**Inbound references from other apps** (FK introspection; all `on_delete=SET_NULL`):
`production.Asset.department`, `production.Asset.team`, `production.Task.team`, `scheduling.Resource.department`, `scheduling.Resource.team` and `deliveries.DeliveryPackage.client`. **No app references any catalog table by FK.** Production stores `status`, `software` and type values as free-text `CharField`s (for example `apps/production/models/task.py:77-80`, `apps/production/models/asset.py:36-48`), and nothing outside masterdata reads `MasterStatus` or the type catalogs.

**Other consumers:** seeders `apps/core/management/commands/{init_platform,seed_demo_data,seed_dev,seed_studiohub}.py`; audit change tracking `apps/audit/signals/change_tracking.py:195-200`; tests in `apps/core/tests/{test_init_platform,test_contract_regression,test_seed_studiohub}.py`, `apps/production/tests/*`, `apps/scheduling/tests/*`.

---

## 3. Per-table inventory and classification

Each table inherits all `EntityModel` fields. The columns below list only the table's own fields and rules.

### 3.1 Lookup catalogs (group A)

All six use the same code path. Model: `CatalogModel`. Serializer: one `ModelSerializer` per model for read and write (`apps/masterdata/api/serializers/catalog.py:64-176`). Viewset: `Master*ViewSet` (`apps/masterdata/api/viewsets/catalog.py:151-244`), DRF mixins with no service, filtered to `scope=GLOBAL`. Selector: `.objects.all()` (`apps/masterdata/selectors/catalog.py:50-99`). Admin: none. Tests: none per model (only `Software` has API tests).

| Table | Model | Own fields | Constraints / indexes | Migration | Status |
|---|---|---|---|---|---|
| `masterdata_status` | `MasterStatus` `models/catalog.py:56-70` | `entity_type` (free text), `category`, `color`, `order`, `is_default`, `is_final` | `code` unique **globally**; index `(entity_type, order)`. No rule of one default per entity. | `0001` | **DEFECTIVE**: the same code cannot exist for two entity types (P08), so seeding renames codes (`apps/core/management/commands/seed_demo_data.py:298-305`). Several defaults per entity are allowed (P08). |
| `masterdata_task_type` | `MasterTaskType` `models/catalog.py:73-83` | `category`, `department_code`, `department_name` (denormalized text, no FK), `color`, `icon` | `code` unique | `0001` | **PARTIAL** |
| `masterdata_asset_type` | `MasterAssetType` `models/catalog.py:86-93` | `color`, `icon` | `code` unique | `0001` | **PARTIAL** |
| `masterdata_shot_type` | `MasterShotType` `models/catalog.py:96-104` | `default_handle_frames` | `code` unique | `0001` | **PARTIAL** |
| `masterdata_review_type` | `MasterReviewType` `models/catalog.py:107-114` | `allow_verdicts`, `require_notes` | `code` unique | `0001` | **PARTIAL** |
| `masterdata_file_type` | `MasterFileType` `models/catalog.py:117-126` | `extension`, `mime_type`, `category`, `dcc_affinity` | `code` unique. `extension` is not unique even though the seeder derives `code` from it (`apps/core/management/commands/seed_demo_data.py:326-327`). | `0001`, `0002` | **DEFECTIVE**: the serializer omits `code` (`apps/masterdata/api/serializers/catalog.py:160-176`), so the first file type created through the API gets `code=""` and every later create fails with 409 (P13). The API can create exactly one file type. |

### 3.2 Software (group C)

| Table | Model | Own fields | Relationships / constraints | API | Status |
|---|---|---|---|---|---|
| `masterdata_software` | `Software` `models/catalog.py:13-26` | `publisher`, `category`, `website`, `is_system` | `code` unique. Hard delete of Software **CASCADEs** to its versions (`models/catalog.py:34`). `version_count` is a property that runs one query per row (`:25-26`, P09). | Full CRUD + archive/restore; tests in `apps/masterdata/tests/api/test_platform_catalog.py:174-258` | **PARTIAL**: N+1 on list (P09); `is_system` is never enforced; DELETE archives the row instead of soft-deleting it (P12). |
| `masterdata_software_version` | `SoftwareVersion` `models/catalog.py:29-53` | `software` FK, `version`, `version_code`, `release_date`, `end_of_support` | `UniqueConstraint(software, version)` (`:46-50`); index `(software, status)`. Also inherits a **global** unique `code`. | Nested CRUD (`apps/masterdata/api/urls.py:95-121`) | **DEFECTIVE**: `POST …/software/<id>/versions` fails with 409 because `software_id` is read-only in the serializer (`apps/masterdata/api/serializers/catalog.py:50`) and the view never sets it (`apps/masterdata/api/viewsets/catalog.py:131-148`). The DB rejects the null FK (P01). Versions cannot be created through the API at all. |

### 3.3 Business entities (group D)

All six share `DirectoryModelViewSet` (`apps/masterdata/api/viewsets/directory.py:67-78`) with DRF mixins, no services, `StandardPagination` and soft delete through `Model.delete()`. Each has one `ModelSerializer` for read and write (`apps/masterdata/api/serializers/directory.py:157-283`), and a selector in `apps/masterdata/selectors/directory.py:69-114`. Admin: none. Tests: only `apps/core/tests/test_contract_regression.py:143-144,259` (contract shapes).

| Table | Model | Notable fields | Constraints / relationships | Status |
|---|---|---|---|---|
| `masterdata_client` | `Client` `models/client.py:14-38` | `contact_name`, `email`, `phone` (PII); `active_projects` JSON (denormalized); `total_billed_usd` Decimal; `status` free text, default `"Active"` | `code` unique, max 20, case-sensitive | **PARTIAL**: no validation or normalization; the selector prefetches contacts and contracts that the serializer never uses (`apps/masterdata/selectors/directory.py:74`). |
| `masterdata_client_contact` | `ClientContact` `models/client_contact.py:14-37` | `name`, `email`, `phone`, `timezone` (PII); `is_primary` | FK `client` CASCADE. **No** one-primary-per-client rule. | **DEFECTIVE**: two primary contacts are accepted (P05), and a PATCH can move a contact to another client (P10). |
| `masterdata_client_contract` | `ClientContract` `models/client_contract.py:15-49` | `effective_date`, `expiry_date`, `value_usd` whole-USD integer, `status` and `type` free text | FK `client` CASCADE; `UniqueConstraint(client, contract_number)` (`:42-45`) | **DEFECTIVE**: an expiry date before the effective date is accepted (P05), status accepts any text (P05), and there are no transition or overlap rules. |
| `masterdata_vendor` | `Vendor` `models/vendor.py:14-41` | `email` (PII); `rating` Decimal(3,2) with no range check; `active_tasks_count`, `active_projects` (denormalized); `bandwidth_*` | `code` unique, max 20 | **PARTIAL** |
| `masterdata_vendor_contact` | `VendorContact` `models/vendor_contact.py:14-36` | Same pattern as client contact, without `portal_access` | FK `vendor` CASCADE | **DEFECTIVE**: same gaps as client contact (code path shared; probed only for clients). |
| `masterdata_vendor_contract` | `VendorContract` `models/vendor_contract.py:15-49` | `total_value_usd` whole-USD integer (named differently from client's `value_usd`), `security_tier` | `UniqueConstraint(vendor, contract_number)` | **DEFECTIVE**: same as client contract (shared code path). |

### 3.4 Organizational structure and people (group E)

These use the same viewset and serializer pattern as group D (`apps/masterdata/api/viewsets/directory.py:81-118`, `apps/masterdata/api/serializers/directory.py:27-154`). Admin: none. Tests: `apps/masterdata/tests/test_global_directory.py:52-127` (5 smoke tests).

| Table | Model | Notable fields | Constraints / relationships | Status |
|---|---|---|---|---|
| `masterdata_department` | `Department` `models/department.py:25-72` | `parent` self-FK; `department_type` choices; `manager` → Person; `software_stack` JSON; `utilization_percentage` (stored, not computed) | `code` unique; `parent` PROTECT; `manager` SET_NULL. Referenced by production and scheduling (SET_NULL). | **DEFECTIVE**: parent cycles and self-parenting are accepted (P04). Soft delete ignores dependent teams and external references; the team list keeps showing the deleted department; the deleted code cannot be re-created and there is no restore (P07). |
| `masterdata_team` | `Team` `models/team.py:15-59` | `department` (required), `lead` → Person, `current_project_code` (text, not an FK) | `code` unique; `department` PROTECT (hard delete only) | **PARTIAL**: same soft-delete gaps as Department. |
| `masterdata_office` | `Office` `models/office.py:15-70` | `is_active` **plus** soft delete; `headcount` and similar counts stored by hand | `code` unique | **PARTIAL**: two lifecycle flags; `timezone` and `country` not validated. |
| `masterdata_position` | `Position` `models/position.py:18-56` | `parent` self-FK (SET_NULL), `level`, `salary_range` (sensitive) | `code` unique | **DEFECTIVE**: same cycle risk as Department (shared code path, not probed). |
| `masterdata_person` | `Person` `models/person.py:19-122`. Inherits `PlatformScopedModel` + `LifecycleModel` + `NamedEntityModel` (adds `status` choices and slug helpers). | `user` FK to User (SET_NULL); `role` → **Position**; `department`, `team`, `office`; PII: `email`, `phone`, `date_of_birth`, `nationality`, `security_clearance`, `skills` | `UniqueConstraint(user)` (`:114-119`) makes the link effectively one-to-one. No email uniqueness, and no sync with `User.email`. | **DEFECTIVE**: every authenticated user can read date of birth, nationality, security clearance, email and phone (P06). Every save copies that PII into `audit.ChangeLog` (P10b). A configure-holder can attach any `user` id to any person through the API (`apps/masterdata/api/serializers/directory.py:134`). |

---

## 4. Checklist matrix

Columns: **CAT** = the 6 lookup catalogs · **SW** = software · **SV** = software_version · **BIZ** = client, vendor · **CON** = client/vendor contacts · **CTR** = client/vendor contracts · **DEP** = department · **TEAM** · **OFF** = office · **POS** = position · **PER** = person.
Where tables in a column share a code path, the cell applies to all of them. Numbers in brackets refer to findings in §5.

### 4.1 Model design

| # | Item | CAT | SW | SV | BIZ | CON | CTR | DEP | TEAM | OFF | POS | PER |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Single responsibility | Y | Y | Y | N (stores derived stats) [L4] | Y | Y | N (stores utilization) [L4] | N [L4] | N [L4] | Y | N (HR + identity data mixed) [M10] |
| 1.2 | Uses project base model | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| 1.3 | Types, lengths, null and defaults correct | N (status free text) [M5] | N [M5] | N | N (money Decimal, rating unbounded) [L5] | Y | N (status/type free text) [M4] | Y | Y | N (`is_active` + soft delete) [M5] | Y | N (phone max 20, no format) |
| 1.4 | Deliberate `on_delete` (PROTECT for referenced masterdata) | NA (no FKs) | N (CASCADE to versions) [M12] | Y | NA | N (CASCADE) | N (CASCADE) | Y (parent PROTECT) | Y (department PROTECT) | NA | N (SET_NULL) | Y (SET_NULL suits optional links) |
| 1.5 | Unique constraints | Y (`code`) | Y | Y (`software, version`) | Y (`code`) | N | Y (`parent, number`) | Y | Y | Y | Y | Y (`user`) |
| 1.6 | Case-insensitive unique `code`/`name` | N (P02) [M1] | N (P02) | N | N | NA | N | N | N | N | N | NA |
| 1.7 | Check constraints for invariants | N | N | N (`end_of_support ≥ release_date`) | N (rating 0–5) | N (one primary) | N (`expiry ≥ effective`) [M4] | N (no self-parent) | N | N | N | N |
| 1.8 | Indexes | Y | Y | Y | Y (code indexed twice, `unique` + explicit index) | Y | Y | Y | Y | Y | N (none) | Y |
| 1.9 | Choices/enums for controlled values | N | N | N | N | NA | N | Y (`department_type`) | NA | N (`office_type`) | N (`employment_type`) | Y (`status`) |
| 1.10 | `__str__` safe | Y | Y | Y | Y | N (`str(client)` lazy-loads) | N (same) | Y | Y | Y | Y | Y |
| 1.11 | Migrations additive and clean on an empty DB | Y (CI on `cfc8422` migrates a fresh Postgres 17 and passes) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |

### 4.2 Architecture

| # | Item | All tables |
|---|---|---|
| 2.1 | Rules live in application/domain services, not views, serializers or signals | **N**. There are no write services. Catalog archive, restore and destroy mutate `status` inside the view (`apps/masterdata/api/viewsets/catalog.py:90-111`); every other write is `ModelSerializer.save()`. [H2] |
| 2.2 | Multi-step operations are atomic | **N**. No `transaction.atomic()` anywhere in the module (grep). |
| 2.3 | Reads through selectors, no N+1 | **PARTIAL**. Selectors exist and use `select_related`. Software list issues one query per row (P09: 6 queries for 3 rows, 12 for 9); `annotate_version_count` exists but nothing calls it (`apps/masterdata/selectors/catalog.py:33-35`). [M6] |
| 2.4 | No duplicated logic | **N**. Seven near-identical catalog viewsets (`apps/masterdata/api/viewsets/catalog.py:151-244`); separate client and vendor contact/contract stacks; two seed sources for the same rows (`init_platform` and `seed_demo_data`). [M13] |

### 4.3 API

| # | Item | Catalog (CAT, SW, SV) | Directory (rest) |
|---|---|---|---|
| 3.1 | Versioned routes | Y (`/api/v1/`) | Y |
| 3.2 | Separate read/write serializers, no `__all__` | N / Y (explicit field tuples) | N / Y |
| 3.3 | Thin views with the project response convention | N (business logic in the view [H2]). The response convention itself is followed: raw bodies, `apps/core/api/mixins/response.py:19-43`. | Y (thin, but only because no rules exist) |
| 3.4 | Pagination, filtering, search, ordering | Filtering, search and ordering Y. No pagination, by frontend contract (`apps/masterdata/api/viewsets/catalog.py:10-11`). | Y (`StandardPagination`) |
| 3.5 | Status codes 400/401/403/404/409 | 400 Y (P02), 401 Y (P11), 403 Y (`test_global_directory.py:120-127`), 404 Y. 409 is returned for a client bug in P01, where 201 was the correct result. | Same; 409 on a duplicate soft-deleted code (P07) |
| 3.6 | Accurate OpenAPI | N. DELETE is documented as 204 but returns 200 with a body (P12). `archive`/`restore` are documented as returning `Software` but return `{success, data}`. `overview` has no schema and raises a spectacular error (`apps/masterdata/api/viewsets/catalog.py:247`). No 4xx responses are documented. [M7] | N (no 4xx documented) |

### 4.4 Authorization

| # | Item | Catalog | Directory |
|---|---|---|---|
| 4.1 | Reads for authenticated users | Y | Y, but too broad for PII (P06) [H1] |
| 4.2 | Writes restricted to an approved privileged role | Y (`platform.master_data.configure`), but `org-admin` holds it (`apps/core/management/commands/init_platform.py:111-115,157-166`) [M8] | Same, and one grant covers both global catalogs and people PII [M8] |
| 4.3 | No anonymous writes | Y (P11: 401) | Y |
| 4.4 | Ownership / permission checks | NA | N. A contact can be re-parented (P10), and `Person.user` can be set to any user [M9]. |

### 4.5 Integrity and safety

| # | Item | Catalog | Directory |
|---|---|---|---|
| 5.1 | Referenced records cannot be hard-deleted; deactivate instead | NA (no inbound FKs). DELETE archives (P12). | N. Soft delete ignores references (P07). The API cannot hard-delete. ORM hard delete is blocked only by `PROTECT` on Team→Department and Department.parent. [H3] |
| 5.2 | System/seed rows protected from edit and delete | N (`Software.is_system` exists but is not enforced; other catalogs have no flag) [M5] | N (no flag) |
| 5.3 | No PII in logs | U for request logs (query params are logged by `apps/core/middleware/request_logging.py`; a search such as `?search=<name>` would be logged). **N** for DB errors: the logged `exception_message` contains the failing row's values (P01 log: `Failing row contains (…)`). [M11] | Same |
| 5.4 | Input validation and normalization | N (code case, whitespace, `status` values) [M1][M5] | N (emails not lower-cased, phones not normalized, dates not checked) [M4] |

### 4.6 Audit

| # | Item | Catalog | BIZ, DEP, TEAM, OFF, PER | CON, CTR, POS |
|---|---|---|---|---|
| 6.1 | Create, update and deactivate emit an audit event or history record | N | **PARTIAL**. Signal-based `ChangeLog` rows (`apps/audit/signals/change_tracking.py:195-200`), but failures are swallowed with `except Exception: pass` (`:153-181`). | N |
| 6.2 | Append-only history | NA | N. `ChangeLog` is a soft-deletable `EntityModel` with no immutability guard (`apps/audit/models/change_log.py:16`). | NA |
| 6.3 | Retention policy | NA | N. None found in `apps/audit` (grep `retention`). PII is copied in (P10b). [H4] | NA |

### 4.7 Admin

| # | Item | All tables |
|---|---|---|
| 7.1 | Sensible list, search and filter | **N**. No masterdata model is registered (`admin.site._registry` introspection). [L1] |
| 7.2 | System rows read-only | N |
| 7.3 | Deletes blocked or routed through services | NA (no admin) |

### 4.8 Tests

| # | Item | CAT | SW | SV | BIZ, CON, CTR | DEP, TEAM, OFF, POS, PER |
|---|---|---|---|---|---|---|
| 8.1 | Model tests | N | N | N | N | N (one field-absence test) |
| 8.2 | Service tests (success, failure, rollback) | NA (no services) | NA | NA | NA | NA |
| 8.3 | API matrix (anonymous, authenticated, privileged) | N | PARTIAL (authenticated + privileged) | N | N | PARTIAL (authenticated read, one 403 write) |
| 8.4 | Constraint and uniqueness | N | N | N | N | N |
| 8.5 | Referential protection | N | N | N | N | N |
| 8.6 | Seed idempotency | Y for `init_platform` statuses (`apps/core/tests/test_init_platform.py:35-37`); `seed_demo_data` covered by `apps/core/tests/test_seed_studiohub.py:278-311` | Y | N | Y (`seed_dev`) U | Y (`init_platform`) |
| 8.7 | Concurrent unique creation (PostgreSQL) | N | N | N | N | N |
| 8.8 | Real authentication in core flows | N (`force_authenticate` everywhere) | N | N | N | N |
| 8.9 | Migrations on an empty DB | Y (CI) | Y | Y | Y | Y |
| 8.10 | Factories | N (models built inline) | N | N | N | N |
| 8.11 | Deterministic | Y | Y | NA | NA | N. `test_directory_endpoints_are_flat` accepts 200 **or** 403 (`apps/masterdata/tests/test_global_directory.py:56`). |

### 4.9 Quality gates

| # | Item | Result |
|---|---|---|
| 9.1 | `manage.py check` | Y (one warning, `identity.W003`, unrelated) |
| 9.2 | `ruff check` | Y (repo clean) |
| 9.3 | `ruff format --check apps/masterdata` | N. Four files would be reformatted: `api/__init__.py`, `api/viewsets/catalog.py`, `selectors/catalog.py`, `services/resolution.py`. |
| 9.4 | `basedpyright apps/masterdata` | N. One error: `models/catalog.py:26` (`versions` reverse accessor is untyped). |
| 9.5 | Coverage | Lines are covered (93–100% per file in the Phase 0 baseline), but mostly by tests in other apps. The number is not a quality signal. |
| 9.6 | Documented contract | N. `docs/architecture/ORGANIZATION_MASTER_DATA.md` describes deleted endpoints. There is no `docs/apps/masterdata` doc. [L2] |

---

## 5. Findings

Severity: **Critical** = exploitable now or data loss · **High** = security, privacy or integrity gap, or a broken endpoint · **Medium** = correctness or robustness gap · **Low** = hygiene.
No Critical findings.

| ID | Sev | Area | Status | Evidence | Problem | Fix (work package) |
|---|---|---|---|---|---|---|
| H1 | High | Authorization / PII | DEFECTIVE | P06; `apps/masterdata/api/viewsets/directory.py:57-59`; `apps/masterdata/api/serializers/directory.py:147-150` | Every authenticated user, and any API key or PAT without scopes, can list everyone's date of birth, nationality, security clearance, email and phone, plus client and vendor contact details. | Split public and restricted serializers; gate PII fields behind a read permission; remove `date_of_birth`/`nationality` from list views (WP 6.2, 5.4) |
| H2 | High | Architecture | MISSING | `apps/masterdata/api/viewsets/catalog.py:90-111`; no `services/` for writes | No service layer, transactions, validators or domain events for any write. Business rules cannot be enforced in one place, and this breaks `backend/.ai/PROJECT_RULES.md` §6. | Add services per aggregate and route all writes through them (WP 3.3, 4.2, 5.2, 6.1) |
| H3 | High | Integrity | DEFECTIVE | P07; `apps/core/models/bases/soft_delete.py:116-134` | Soft-deleting a Department leaves Teams, Persons, Positions, `production.Asset/Task` and `scheduling.Resource` pointing at a hidden row. A soft-deleted code blocks re-creation (409) and there is no restore, against `AGENTS.md` §22. | Deactivate-instead-of-delete with dependency checks; restore endpoint; uniqueness that respects soft delete (WP 3.2, 6.3) |
| H4 | High | Audit / PII | DEFECTIVE | P10b; `apps/audit/signals/change_tracking.py:23-31,195-200` | `ChangeLog` stores full before/after snapshots including date of birth and email, with no retention and no append-only guard. Signal failures are silently dropped. | Redact PII fields from snapshots; replace the signal with service-emitted audit events; propose a retention policy (WP 3.6, 6.4; retention needs an audit-app decision) |
| H5 | High | API | DEFECTIVE | P01, P13; `apps/masterdata/api/serializers/catalog.py:50,160-176`; `apps/masterdata/api/viewsets/catalog.py:131-148` | Two create endpoints are broken. Software versions can never be created through the API (always 409). File types can be created once; every later create fails with 409 because `code` is missing from the serializer and defaults to `""`. | Set `software` from the URL in the service (WP 4.1); add `code` to the file-type contract or derive it from `extension` in the service (WP 3.3) |
| M1 | Med | Uniqueness | DEFECTIVE | P02; `apps/masterdata/models/base.py:25-30` | `MAYA` and `maya` both succeed; codes are not trimmed or normalized. | Normalize codes; `UniqueConstraint(Lower("code"))` with soft-delete awareness (WP 3.1) |
| M2 | Med | Org removal | DEFECTIVE | P03; `apps/masterdata/models/base.py:17-19,47-53`; `apps/masterdata/services/resolution.py:26,42-46` | `scope=ORGANIZATION` is still accepted. Such rows are invisible to list and detail (404) but count in the overview. The org dimension survives as a column. | Reject `ORGANIZATION` now, then drop `scope` with a migration (WP 3.1, 7.2) |
| M3 | Med | Hierarchy | DEFECTIVE | P04; `apps/masterdata/models/department.py:32-38`; `apps/masterdata/models/position.py:33-39` | Parent cycles and self-parenting are accepted. | Cycle and depth validation in the service; check constraint `parent_id <> id` (WP 6.1) |
| M4 | Med | Contracts / contacts | DEFECTIVE | P05, P10 | Expiry before effective date accepted; status and type free text with no transitions; overlaps unchecked; several primary contacts allowed; contacts re-parented through PATCH. | Check constraint on dates; enums and a transition service; partial unique for primary; `client`/`vendor` read-only after create (WP 5.1–5.3) |
| M5 | Med | Lifecycle | DEFECTIVE | P08, P12; `apps/masterdata/models/base.py:41-46`; `apps/masterdata/models/office.py:56`; `apps/masterdata/models/catalog.py:19` | Three lifecycle mechanisms (`status` free text, `is_deleted`, `Office.is_active`). Catalog DELETE never soft-deletes. `status="banana"` is accepted. `is_system` is not enforced. | One policy: enum `status` (active, inactive) + soft delete for removal; system-row guard (WP 3.2) |
| M6 | Med | Performance | DEFECTIVE | P09; `apps/masterdata/models/catalog.py:25-26` | N+1 on the software list. | Use the existing `annotate_version_count` (WP 4.1) |
| M7 | Med | OpenAPI | DEFECTIVE | `manage.py spectacular` output; `apps/masterdata/api/viewsets/catalog.py:247` | Schema contradicts actual responses; no 4xx responses documented. | `extend_schema` on custom actions and overview; error components (WP 8.3) |
| M8 | Med | Authorization model | PARTIAL | `apps/core/management/commands/init_platform.py:84,111-115,157-166` | `org-admin` (an organization-era role) can write global catalogs and people PII. `platform.master_data.create` is seeded but never enforced. One code guards both reference data and PII. | Separate permission codes for catalog writes, directory writes and PII reads; review role grants (decision in Phase 2, WP 3.5) |
| M9 | Med | Identity link | DEFECTIVE | `apps/masterdata/api/serializers/directory.py:134`; `apps/masterdata/models/person.py:22-30,78-91` | Any `user` id can be attached to any Person; `Person.email` can diverge from `User.email`. | Link only through a dedicated service action; derive email and name from Identity when linked (Phase 2 decision 4, WP 6.2) |
| M10 | Med | Model design | PARTIAL | `apps/masterdata/models/person.py:68-104`; `apps/identity/models/profile.py` | Person duplicates Profile fields (`phone`, `timezone`, name) and mixes HR data with identity data. | Phase 2 decision 4 |
| M11 | Med | Logging / PII | DEFECTIVE | P01 log line (`exception_message` contains `Failing row contains (…)`) | DB integrity errors log full row contents. For Person or contact inserts that means PII in logs. This sits in the core exception handler, so it affects every app. | Strip `DETAIL` from logged DB errors in the core handler (cross-cutting; needs your approval because it is outside masterdata) |
| M12 | Med | Integrity | PARTIAL | `apps/masterdata/models/catalog.py:34`; `apps/masterdata/models/client_contact.py:15-20`; `apps/masterdata/models/client_contract.py:16-21` | CASCADE on Software→Version and on Client/Vendor→Contact/Contract means an ORM or admin hard delete silently removes children. | PROTECT plus service-level deactivate (WP 4.1, 5.1) |
| M13 | Med | Duplication | PARTIAL | `apps/masterdata/api/viewsets/catalog.py:151-244`; `apps/core/management/commands/init_platform.py:209-219` vs `seed_demo_data.py:292-321` | Repeated viewsets; two seeders produce different status codes for the same concepts (`in-progress` vs mock `in_progress`). | Generic catalog viewset/service; one canonical seed (WP 3.4, 3.8) |
| M14 | Med | Tests | MISSING | §4.8 | 12 tests for 19 tables; no constraint, service, concurrency or authorization-matrix tests. | Tests per work package (all WPs) |
| L1 | Low | Admin | MISSING | admin registry introspection | No admin for masterdata. | Read-mostly admin with system rows read-only (WP 8.2) |
| L2 | Low | Docs / dead code | PARTIAL | `docs/architecture/ORGANIZATION_MASTER_DATA.md`; `apps/masterdata/tests/test_global_directory.py:30-35`; `apps/core/management/commands/seed_demo_data.py:383-398`; `apps/core/tests/test_seed_studiohub.py:298-299`; `apps/masterdata/models/position.py:4-7` | Stale references to org config models, `PlatformPosition` and legacy routes. | Phase 7 cleanup (WP 7.1) |
| L3 | Low | Quality gates | DEFECTIVE | §4.9 | Four unformatted files; one type error. | Format and fix in the phase that touches each file |
| L4 | Low | Model design | PARTIAL | `models/department.py:58-60`; `models/team.py:40-48`; `models/office.py:50-54`; `models/vendor.py:22-23`; `models/client.py:21` | Stored stats (`utilization_percentage`, `headcount`, `active_projects`, `active_tasks_count`) are hand-maintained copies of data owned by production and scheduling. | Decide: keep as editable display fields (frontend contract) or compute through selectors (Phase 2) |
| L5 | Low | Money | PARTIAL | `models/client.py:27`; `models/client_contract.py:29`; `models/vendor_contract.py:29`; `models/vendor.py:24` | Mixed money types (Decimal vs whole-USD integer), implicit USD, unbounded `rating`. | Phase 2 decision 8 |
| L6 | Low | Domain integration | NA (design) | §2 inbound references | Lookup catalogs are not used by the backend domain: production statuses and types are free text, not validated against the catalogs. | Out of masterdata scope; flag for the production roadmap |
| L7 | Low | Cross-module dead code | DEFECTIVE | `apps/identity/permissions/department.py` (`IsDepartmentManager` always returns `True`, no callers) | A misleading permission class sits in Identity. | Out of scope; flag only |

---

## 6. Audit questions

**6.1 Duplicates and overlaps**

| Pair | Current state | Recommendation |
|---|---|---|
| department vs platform_department | `PlatformDepartment` was dropped (`0004…:253-254`). One `Department` remains. | Keep the single model. Nothing to merge. |
| position vs platform_position | Already merged into `Position` (`apps/masterdata/models/position.py:4-7`). | Keep. Remove the stale docstring reference (WP 7.1). |
| team vs platform_group | `PlatformGroup` was dropped. `identity.Group` is an RBAC grant container (it holds roles). `Team` is a staffing unit referenced by `production.Task.team` and `scheduling.Resource.team`. | Keep separate: different purposes and different consumers. |
| platform_role vs Identity roles | `PlatformRole` was dropped. `identity.Role` is the canonical role model. `Person.role` is an FK to **Position**, not to a role (`apps/masterdata/models/person.py:32-39`). | Keep Identity as the owner of roles. The `role` field name is part of the frontend contract, so keep it and document that it means position. |
| person vs Identity User/Profile | `Person.user` is a nullable unique FK. `Person` duplicates name, email, phone and timezone from `User`/`Profile` (M9, M10). | Keep `Person` as the directory/HR record. Make Identity the owner of email and name for linked people (Phase 2 decision 4). |

**6.2 Do the lookup catalogs repeat the same columns?** They already share `CatalogModel` (`apps/masterdata/models/base.py:22-68`): code, name, description, status, scope, metadata, plus `EntityModel` timestamps, audit fields and soft delete. Missing from the requested standard set: `is_system` (only `Software` has it), `sort_order` (only `MasterStatus.order`), a real `is_active`/enum status, and case-insensitive uniqueness.
Options:
- **(a)** Extend the abstract `CatalogModel`: one additive migration per table and no data movement. **Recommended.**
- **(b)** A mixin applied per model: the same effect with more scattering. It adds nothing because the abstract base already exists.
- **(c)** A single generic `catalog_item` table with a `type` column: fewer tables, but it loses per-type fields and typed FKs and needs a risky data migration. Not recommended.

The directory models hand-roll `code`/`name`/`description` on `PlatformScopedModel`. A small `CodedEntityModel` abstract inside masterdata could share them; this is optional.

**6.3 Should statuses have an entity scope, a category and transitions?**
- `entity_type` already exists as free text (`models/catalog.py:59`) and `category` as free text (`:60`).
- Problems: the global `code` uniqueness blocks per-entity codes (P08); `entity_type` and `category` are not enums; nothing limits defaults to one per entity (P08); there is no transition model.
- Recommendation: unique `(entity_type, Lower(code))`, enums for `entity_type` (asset, shot, task, review, version, …) and `category` (not_started, in_progress, review, done, cancelled), and a partial unique for one default per entity.
- Transitions are optional and later: an allowed-transition table makes no difference until production validates its statuses against masterdata (L6).

**6.4 Software versions**

| Requirement | State |
|---|---|
| Unique `(software, version)` | Y (`models/catalog.py:46-50`) |
| Ordering | API ordering `-release_date` (`apps/masterdata/api/viewsets/catalog.py:137`). Versions are strings, so they sort lexically: `10` sorts before `9`. |
| Deprecation | `end_of_support` exists, but nothing enforces or exposes a "deprecated" state. |
| Parseable version scheme | N |
| Global unique `code` | `SoftwareVersion` inherits a global unique `code`, which is unnecessary given `(software, version)`. |

Recommendation: store an optional numeric sort key, add `is_deprecated` (or derive it from `end_of_support`), and drop the inherited global `code` requirement (Phase 2).

**6.5 Clients and vendors**
- Contacts and contracts are two parallel copies of one pattern, with small drift: client contacts have `portal_access`, vendor contacts don't; the money field is `value_usd` vs `total_value_usd`.
- Contract dates are not validated (P05). Amounts are whole-USD integers with no currency field. Overlapping active contracts are not prevented.
- A PostgreSQL exclusion constraint for overlap needs `btree_gist`. Either way it is **database-specific**, which `AGENTS.md` §14 discourages, so it needs your approval. Alternative: a service-level overlap check under `select_for_update`, which stays portable.

**6.6 Seed data**
- `init_platform` uses `get_or_create` by code; it is idempotent and tested (`apps/core/tests/test_init_platform.py:35-37`).
- `seed_demo_data` uses `_update_or_create`, which is restore-aware; it is covered by `apps/core/tests/test_seed_studiohub.py:278-311`.
- Neither is versioned, neither runs as a data migration, and they disagree on status codes (M13). A clean deployment has no catalogs until someone runs a command.

**6.7 Caching** — none today. The catalogs are small, read-heavy and change rarely, so they suit a per-type cache with a version key bumped on every write; the identity permission cache already uses this pattern (`apps/identity/services/permission_cache.py`). This is not MVP: the reads are cheap once the N+1 is fixed.

**6.8 Tables with organization foreign keys or org-specific columns**
- **No organization FK exists in any masterdata table** (model introspection; `apps/masterdata/tests/test_global_directory.py:59-62` also asserts this for seven models).
- Org-specific columns and values that remain:
  - `scope` with value `ORGANIZATION` on all 8 catalog tables (`apps/masterdata/models/base.py:17-19,47-53`)
  - `total_custom_records_across_orgs` in the overview (`apps/masterdata/services/resolution.py:42-46`)
  - the role `org-admin` holding masterdata writes (`apps/core/management/commands/init_platform.py:157-166`).
- **Flagged for your decision: global masterdata or organization-owned?** department, office, team, person, position, client, vendor. All seven are global today. Note that the runtime has no Organization module (`CLAUDE.md`, "Repository state"), so "organization-owned" currently has no home.

---

## 7. Cross-cutting findings

1. **There is no write path through services anywhere in masterdata** (H2). Fixing this first unlocks validation, audit events, transactions and system-row protection for every table.
2. **Two different deletion semantics:** catalog DELETE sets `status="archived"`; directory DELETE soft-deletes. Neither checks references (H3, M5).
3. **PII is exposed in three places:** API reads (H1), the audit snapshots (H4) and DB error logs (M11).
4. **The org dimension has a long tail** (`scope`, `org-admin`, overview key, stale docs), while the tables themselves are gone (M2, L2).
5. **Thin tests:** most of the behaviour above is untested, which is how P01 (a broken create endpoint) went unnoticed (M14).

---

## 8. Removal impact analysis (the 7 `org_*_config` tables)

| Step from the brief | Result |
|---|---|
| (1) Inventory consumers | **Models:** none (deleted). **FKs:** none (the tables are gone). **Code:** `seed_demo_data.py:383-398` only reads mock arrays and reports "skipped"; no model access. **Serializers, routes, admin:** none (`apps/masterdata/api/urls.py:1-7` says the org routes 404 by absence; `apps/masterdata/tests/api/test_platform_catalog.py:253-258` asserts it). **Tests:** `apps/core/tests/test_seed_studiohub.py:298-299` (fixture strings), `apps/masterdata/tests/api/test_platform_catalog.py:177-181` (creates a `scope=ORGANIZATION` row). **Docs:** `docs/architecture/ORGANIZATION_MASTER_DATA.md`. |
| (2) Data-preserving path | **No longer possible from the database.** `0004` dropped the tables on 2026-10-17. Only an external backup taken before that date could recover the rows (**U**: I don't know whether one exists). |
| (3) Deprecate | NA (already removed) |
| (4) Separate reversible migration | `0004` is already applied. Reversing it recreates empty tables. **Do not edit it** (applied migration). |

Remaining work is cleanup only (Phase 7, per your Phase 0 decision): leftover code and test references, the `scope=ORGANIZATION` value and column, and stale docs. The four `platform_*` tables have the same status, and their only leftover is a docstring.

---

## 9. Open questions

1. **Global or org-owned** for department, office, team, person, position, client, vendor? With no Organization module, the practical choice is "global now", plus a documented way to attach an organization later by code reference, never by an FK from masterdata. Do you agree?
2. **PII policy (H1):** who may read `date_of_birth`, `nationality`, `security_clearance`, `salary_range` and contact details? Proposal: a new `masterdata.person.view_sensitive` code; everyone else gets a reduced serializer. Does removing those fields from the default people payload break the frontend contract? (The frontend is the separate `studiohub-react` repo, which I can't see: **U**.)
3. **Permission codes (M8):** replace the single `platform.master_data.configure` with `masterdata.catalog.manage`, `masterdata.directory.manage` and `masterdata.person.view_sensitive`? And should `org-admin` keep any of them?
4. **Audit retention and redaction (H4, M11):** redacting PII from `ChangeLog` and from DB error logs means changes in `apps/audit` and `apps/core` (outside masterdata). May I touch those modules, limited to these two fixes?
5. **`scope` column (M2):** drop it in Phase 7, or keep it frozen at `GLOBAL`? The frontend sends and reads `scope` (`apps/masterdata/api/serializers/catalog.py:35`), so dropping the column means dropping a response field. Keep it as a read-only constant?
6. **Contract overlap (§6.5):** PostgreSQL exclusion constraint (database-specific, needs `btree_gist`) or a portable service check?
7. **Catalog DELETE semantics:** keep "DELETE = archive" (the current frontend contract), or make DELETE a real soft delete and keep archive as a separate action?
8. **Stored stats (L4):** keep `utilization_percentage`, `headcount`, `active_projects` and similar as editable fields, or compute them from production and scheduling?

---

## Appendix A — Behaviour probes

Ad-hoc pytest probes, run on 2026-10-23 against the pytest test database (each test inside a rolled-back transaction) through the real URLconf, with `force_authenticate`. The probe file lives in the session scratchpad and **is not committed**; it only printed observations, without asserting. A user "with grant" means `grant_permissions(user, "platform.master_data.configure")`.

| ID | Action | Observed |
|---|---|---|
| P01 | `POST platform/master-data/software/<id>/versions` with `{version, name, code}` | **409**; log: `null value in column "software_id" … Failing row contains (…)` |
| P02 | Create software `MAYA`, then `maya`, then `MAYA` again | 201, **201**, 400 |
| P03 | Create software with `scope=ORGANIZATION` | 201; not in list; detail **404**; row exists |
| P04 | PATCH department A.parent=B where B.parent=A; PATCH B.parent=B | **200**, **200** |
| P05 | Client contract with expiry < effective; two `is_primary` contacts; `status="banana"` | **201**; 201+201 (2 primaries); **201** |
| P06 | User without grants: `GET /people/`, `GET /client-contacts/` | 200 with `date_of_birth, email, nationality, phone, security_clearance`; 200 |
| P07 | DELETE department that has a team; list teams; re-create same code | 204 (soft delete); team still references it and is listed with it; re-create **409** |
| P08 | Status `status="banana"`; code `in_progress` for Task, then for Shot; two `is_default` statuses for one entity type | **201**; 201 then **400**; 201+201 (2 defaults) |
| P09 | `GET platform/master-data/software` with 3 and 9 rows | 6 and 12 queries (one per row) |
| P10 | PATCH contact `client=<other client>`; create Person with email and date of birth, then read `ChangeLog` | **200**, moved; ChangeLog contains the date of birth and the email |
| P11 | Anonymous list and write on catalog and directory | 401 / 401 / 401 |
| P12 | DELETE software that has versions | 200; `is_deleted=False`, `status="archived"`, versions untouched |
| P13 | Create two file types (`EXR`, `DPX`) without `code` | 201 with `code=""`, then **409** |

The probes ran while the full regression suite was also using the test database. Their transactions roll back, so they leave no rows behind.
