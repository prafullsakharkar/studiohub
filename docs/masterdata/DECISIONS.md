# Masterdata Module — Decisions (Phase 2)

Date: 2026-10-23 · Branch: `feature/masterdata-hardening`
Companions: [`AUDIT.md`](AUDIT.md) (evidence, finding IDs), [`PLAN.md`](PLAN.md) (work packages), [`CONTRACTS.md`](CONTRACTS.md) (specifications that cite these decisions).

Status of each decision:
- **APPROVED**: you decided it in writing (date and source given).
- **PROPOSED**: my recommendation. It needs your written approval before the dependent work package starts.
- **IMPLEMENTED (Phase 3)**: a PROPOSED decision that Phase 3 built on. You answered Phase 2 with "Start Phase 3" and no objection, so I proceeded on the recommendation; say so if you want any of these changed.
- **OPEN**: your answer is needed; no recommendation can stand in for it.

## Summary

| ID | Topic | Status | Outcome or recommendation |
|---|---|---|---|
| D1 | Ownership; per-organization overrides | **APPROVED** (global) + PROPOSED (reference rule) | All masterdata is platform-global. No per-org overrides until an Organization module exists, which would then reference masterdata. |
| D2 | Shared catalog base | IMPLEMENTED (Phase 3) | Extend the abstract `CatalogModel` (option a). Built as `LookupCatalogModel(CatalogModel)` for the 6 type catalogs; Software and versions move onto it in Phase 4 (see Phase 3 notes). |
| D3 | Overlapping pairs | PROPOSED | Keep the current single models; nothing to merge |
| D4 | Person ↔ Identity User; PII | PROPOSED (link) + PII restriction **APPROVED to be fixed in Phase 5** (2026-10-23; replaces the earlier "defer") | Link only through a service; Identity owns email and name for linked people. H1 must be closed by the end of Phase 5, or accepted in writing with scope, owner and deadline. |
| D5 | Status model | IMPLEMENTED (Phase 3) | Unique `(entity_type, code)`; enums; one default per entity type; transitions later |
| D6 | Deletion and system rows | **APPROVED** (soft + hard delete) + IMPLEMENTED for catalogs (Phase 3) | DELETE = soft delete everywhere; separate, guarded hard delete. Directory models follow in Phase 6, software in Phase 4. |
| D7 | Caching | PROPOSED | Later (Phase 8); version-key invalidation on commit |
| D8 | Contract overlap; money | **APPROVED (user, 2026-10-23): hybrid** + PROPOSED (money) | Service-level check (friendly errors) **and** a PostgreSQL exclusion constraint, skipped on SQLite. Active contracts only; different types may overlap. Scope, end-date semantics: see D8. |
| D9 | Permission codes | IMPLEMENTED for catalogs (Phase 3) + role grants **APPROVED (user, 2026-10-23): Option B** | New `masterdata.*` codes. `org-admin` holds `directory.manage` and `catalog.manage` explicitly and nothing more (transitional, FU-1). The old code stays a deprecated alias until Phase 8. |
| D10 | Seed, import, export | IMPLEMENTED for statuses (Phase 3) | One canonical seed through services; import/export later |
| D11 | Stored statistics | **APPROVED** (compute) + client/vendor counts and `total_billed_usd` **APPROVED (user, 2026-10-23)** | Compute what has a reliable FK source. Project/task counts are omitted until the Projects module exposes a UUID selector. `total_billed_usd` becomes a nullable, manually entered field. |
| D12 | `scope` column | OPEN (your "Yes" fits both options). Phase 3 only rejects `ORGANIZATION` on input. | Recommendation: drop the DB column, keep `"scope": "GLOBAL"` as a read-only constant in responses |
| D13 | Changes outside masterdata | **APPROVED** (limited) | May change `apps/audit` and `apps/core` only to redact PII |
| D14 | Test runtime per phase | OPEN | Choose A, B, C or D (Phase 0 report) |
| D15 / FU-1 | Who holds `catalog.manage` and `hard_delete` long term | **OPEN (follow-up opened 2026-10-23)** | Today `org-admin` holds `catalog.manage` explicitly (Option B, transitional). Decide a platform-level role for global catalog administration. |

---

## D1 — Ownership and per-organization overrides

**APPROVED 2026-10-23 (Phase 1 answer 1: "Global").** Department, office, team, person, position, client, vendor and all catalogs are platform-global masterdata.

**PROPOSED (reference rule):** no masterdata model ever gets an FK to an organization. If an Organization module is added later, its rows reference masterdata in that direction: an FK from the org table to the masterdata row's UUID, with `code` as the stable key for import and export. Per-org overrides (enable/disable, rename) live in that module, never in masterdata. Today there is no Organization module (`CLAUDE.md`, "Repository state"), so no override mechanism is built now.

Trade-off: referencing by UUID keeps integrity (`PROTECT` is possible); referencing by `code` survives re-seeding but has no DB integrity. Recommendation: UUID FK plus `code` for exchange formats.

## D2 — Shared catalog base

Options:
- **(a) Extend the abstract `CatalogModel`** (`apps/masterdata/models/base.py:22-68`): additive migrations, no data movement, every catalog benefits at once. **Recommended.**
- **(b) A mixin per model:** the same result, scattered across models; the abstract base already exists.
- **(c) One generic table with a `type` column:** loses per-type fields and typed FKs and needs a data migration. Rejected.

**Standard field set (PROPOSED):**

| Field | Rule |
|---|---|
| `code` | Required. Trimmed; case preserved as given. Unique **case-insensitively among non-deleted rows**. Immutable once the row is `is_system`. |
| `name` | Required, trimmed. Unique case-insensitively per table among non-deleted rows. For statuses, unique per `entity_type`. |
| `description` | Optional |
| `status` | Enum `active` / `archived`. The values `active` and `archived` are kept because the frontend reads `"archived"` (`apps/masterdata/tests/api/test_platform_catalog.py:215`). |
| `sort_order` | New, integer, default 0. Statuses keep their existing `order` field as their sort order (no rename, to preserve the contract). |
| `is_system` | New, default False. Moved up from `Software` (`apps/masterdata/models/catalog.py:19`) to the base. |
| `metadata` | Unchanged (JSON object) |
| `scope` | See D12 |
| inherited | UUID, `created_at`/`updated_at`, `created_by`/`updated_by`/`deleted_by`, `is_deleted`/`deleted_at` |

The directory models (department, team, office, position) hand-roll `code`/`name`/`description`. PROPOSED: they get the same `code` and `name` rules through a small abstract `CodedModel` in masterdata. No new tables.

## D3 — Overlapping pairs

PROPOSED, per `AUDIT.md` §6.1:

| Pair | Recommendation |
|---|---|
| department vs platform_department | Keep `Department` only. `PlatformDepartment` was already dropped. |
| position vs platform_position | Keep `Position` only. It is already merged. |
| team vs platform_group | Keep `Team` and `identity.Group` separate: a staffing unit vs an RBAC grant container. |
| platform_role vs Identity roles | Identity owns roles. `Person.role` (an FK to Position) keeps its contract name, and its meaning is documented. |
| person vs User/Profile | Keep `Person` as the directory/HR record; see D4. |

## D4 — Person ↔ Identity User, and PII

**PROPOSED (link):**
- Keep the current nullable FK with `UniqueConstraint(user)` (`apps/masterdata/models/person.py:22-30,114-119`). It already behaves as a nullable one-to-one, and switching to `OneToOneField` would only rename the reverse accessor.
- `user` becomes read-only in the person serializer. It is set or cleared only through `PersonService.link_user` / `unlink_user`, which require the directory write permission and reject a user already linked to another person.
- When `user` is set, Identity owns `email` and the display name. They are copied on link and on every `User`/`Profile` change (on-commit handler), and are read-only through the person API. Unlinked persons keep their own `email`/`name`.
- No authentication data (passwords, MFA, sessions) is ever stored on `Person`.

**APPROVED 2026-10-23 (Phase 1 answer 2: "We can wire up later"):** the PII read restriction is **deferred**. The contracts define the target (`SEC-MD-02`) so the later wiring is mechanical, but no Phase 3–6 work package enforces it.

> **Update 2026-10-23 (supersedes the deferral above).** The user will not leave finding **H1 (High)** open through Phase 5. It is fixed in Phase 5 (restricted access to contact data, no PII in logs, a log-capture test), **or** the user accepts it in writing with scope, owner and deadline. The Phase 5 plan is under "Phase 5 prerequisites" at the end of this file.

## D5 — Status model

PROPOSED:
- **Uniqueness:** `UniqueConstraint(entity_type, Lower(code), condition=Q(is_deleted=False))` replaces the global `code` uniqueness for statuses only. This ends the seed renaming (`apps/core/management/commands/seed_demo_data.py:298-305`).
- **`entity_type`:** a `TextChoices` enum: `Project, Sequence, Shot, Asset, Task, Version, Review, Delivery`. The capitalization matches the current seed values (`apps/core/management/commands/init_platform.py:209-219`).
- **`category`:** an enum `not_started, in_progress, review, done, cancelled`, blank allowed for existing rows. Existing rows are mapped by name where unambiguous; otherwise they stay blank (reported, not guessed).
- **Defaults and finals:** at most one `is_default=True` per `entity_type` among active, non-deleted rows (partial unique constraint). `is_final` is unrestricted.
- **Transitions:** **Later.** No consumer validates statuses against masterdata yet (`AUDIT.md` L6), so a transition table has no effect until production uses it.

## D6 — Deletion, deactivation and system rows

**APPROVED 2026-10-23 (Phase 1 answer 7): "DELETE is soft delete and also have option for hard delete."**

PROPOSED mechanics:

| Operation | Endpoint | Effect | Guard |
|---|---|---|---|
| Archive | `POST <detail>/archive` (catalog; unchanged contract) | `status = archived` | write permission; not for `is_system` rows |
| Restore | `POST <detail>/restore` (catalog; added to the directory) | If soft-deleted, undelete. If archived, `status = active`. | write permission; the restored `code`/`name` must not clash with a live row (409) |
| Soft delete | `DELETE <detail>` | `is_deleted = True`, `deleted_at`, `deleted_by` | write permission; refused (409) for `is_system` rows; refused (409) if live dependants exist, unless the type defines a cascade (D6 table below) |
| Hard delete | `DELETE <detail>?hard=true` | Row removed from the DB | **separate** permission `masterdata.hard_delete` (D9); only for rows that are already soft-deleted; refused (409) if any FK still references the row (DB `PROTECT` plus a service check); never for `is_system` rows; always audited |

Response shapes:
- Catalog DELETE keeps `200 {"success": true, "message": …}`, the current frontend contract (`apps/masterdata/tests/api/test_platform_catalog.py:236`); only the semantics change, from archive to soft delete.
- Directory DELETE keeps `204`.
- A hard delete returns `204` on success and `409 {"detail": …, "error": {"code": "conflict"}}` when references exist.

Dependants checked before a soft delete:

| Row | Blocking live dependants | Cascade instead of block |
|---|---|---|
| Department | teams, positions, persons, child departments; `production.Asset/Task`, `scheduling.Resource` | none (refuse) |
| Team | persons; `production.Asset/Task`, `scheduling.Resource` | none |
| Office, Position | persons | none |
| Client, Vendor | live contracts with status `active`; `deliveries.DeliveryPackage` | contacts are soft-deleted with the parent |
| Software | none | versions are soft-deleted with the parent |
| Person | none (incoming references are `SET_NULL`) | n/a |

**System rows:** `is_system=True` rows (set by the canonical seed, D10) cannot be archived, deleted or hard-deleted, and their `code` is immutable. Their `name`, `description`, `sort_order`, `color` and `icon` stay editable.

Why soft delete first and hard delete second: a hard delete of a row that was never soft-deleted would skip the reversible step and the dependency check.

## D7 — Caching

PROPOSED: **Later (Phase 8, WP 8.4).**
- Cache each catalog list per type under a version key `masterdata:<type>:v<n>`.
- Every service write bumps the version in `transaction.on_commit`, the same pattern as `apps/identity/services/permission_cache.py`. TTL 1 h.
- No caching of directory lists: they are paginated, filtered and contain people.

Trade-off: the catalogs are tiny and the main cost is the N+1 (fixed in WP 4.1), so caching is optional.

## D8 — Contract overlap and money

**Overlap: APPROVED 2026-10-23 — hybrid.** Two layers, both required:
1. **Service check** in `ContractService` (friendly error naming the conflicting contract number). It locks the parent row (`select_for_update`) before checking, so two simultaneous requests are serialized and the loser gets a clean `409 contract_overlap`, never a 500.
2. **PostgreSQL exclusion constraint** as the backstop, so a raw write or a bug cannot create an overlap. It needs the `btree_gist` extension (installed by the migration). On SQLite the constraint is skipped and only the service check applies; the PostgreSQL-only tests are skipped there.

**The rule (exact):**
- **Applies to** MSAs that are not soft-deleted and whose stored status is `Active`, **or** `Terminated` after having been Active (they keep the range they covered, see the note below). `Draft` contracts, and contracts terminated straight from `Draft`, are ignored.
- **Scope: APPROVED 2026-10-23 — `MSA` only, per client; mirrored for vendors (per vendor).** The rule looks only at stored-`Active` MSAs of the same parent. `Draft` and soft-deleted contracts are ignored; a `Terminated` MSA keeps occupying the range it actually covered (see the note below). **Concurrent SOWs (and every other type) are never restricted**, and an MSA may overlap a SOW. *Expired is not simply "ignored"; see the note below, which needs your decision.*
- **Range:** `[effective_date, expiry_date]`, **both ends inclusive**. A contract valid through 31 Jan and another starting 31 Jan overlap; the next one may start 1 Feb.
- **Null `expiry_date` = open-ended** (valid until terminated). An open-ended Active MSA therefore blocks every later Active MSA for that parent until it is terminated.
- **`effective_date` is required** to be Active, so the range always has a start.
- Derived expiry does not change this: a stored-Active contract whose end date has passed still occupies its historic range, which is correct (see contract statuses below).

> **Expired and the overlap rule — DECIDED 2026-10-23.** `Expired` stays **derived** (never stored). The exclusion constraint applies to MSAs whose **stored** status is `Active` and uses their date range (a null `expiry_date` is open-ended, i.e. infinity). Consequences, all intended:
>
> - **A backdated MSA that overlaps an elapsed Active MSA is blocked, on purpose.** That range was legitimately occupied; an expired MSA never blocks a *new* MSA that starts after its end date, so ordinary renewals are unaffected.
> - **Legitimate corrections go through an audited end-date adjustment**, never through a stored `Expired` status. Phase 5 adds `POST …/adjust-end-date` (needs `masterdata.directory.manage`): it changes only `expiry_date`, is allowed on Active, derived-Expired and Terminated contracts, must stay on or after `effective_date`, may not move an elapsed or terminated contract's end into the future (an elapsed contract is never revived), is re-checked against the overlap rule, and emits an audit event carrying the old and new dates (dates are not personal data). This is the one exception to "Expired and Terminated are read-only".
> - **Terminated MSAs:** terminating an Active contract **sets its end date to the termination date** (when its end is open or later), so the range it actually covered is recorded exactly. A terminated contract that **had been Active keeps occupying that range** in the overlap rule; a contract terminated straight from `Draft` never covered anything and occupies nothing. To tell the two apart a nullable `activated_at` timestamp is added (set on activation or when created Active; backfilled for existing Active and Terminated rows that have an `effective_date`). The exclusion condition is therefore: type is MSA, not soft-deleted, and (stored `Active`, or stored `Terminated` with `activated_at` set). This refines your earlier "terminated ignored" in line with your latest recommendation.

**Hybrid concurrency proof (required test, PostgreSQL):** two simultaneous requests that would create overlapping Active contracts for the same client → **exactly one succeeds**, the other returns 409, and the table holds exactly one. A second test goes around the service (direct ORM insert) and shows the database constraint refuses it.

**Feasibility checked 2026-10-23 on the test database:** PostgreSQL 18.6; `btree_gist` 1.8 is available and marked *trusted*, not yet installed; the application role is not a superuser and not the database owner but has `CREATE` on the database, which is enough to install a trusted extension. CI's PostgreSQL 17 role is a superuser. **UNVERIFIED:** the dev database's role (not queried). **Open risk, to verify first thing in Phase 5:** Django's handling of an `ExclusionConstraint` migration on SQLite. If it cannot skip cleanly, the constraint is added with `SeparateDatabaseAndState` (model state has it; the database operation runs only on PostgreSQL).

**Money: PROPOSED.**
- Keep `value_usd` / `total_value_usd` as whole-unit integers: the frontend declares them as numbers (`apps/masterdata/models/client_contract.py:27-29`).
- Add `currency` `CharField(3)`, ISO 4217, default `"USD"`, validated against an allow-list (additive and non-breaking).
- Values are amounts in that currency despite the `_usd` field names. The names are contract-frozen; this is documented in `docs/api`.
- `Vendor.rating` gets a check constraint `0 ≤ rating ≤ 5`.

## D9 — Authorization codes

PROPOSED codes:

| Code | Guards |
|---|---|
| `masterdata.catalog.manage` | create, update, archive, restore and soft delete on the 6 catalogs + software + versions |
| `masterdata.directory.manage` | the same writes on department, team, office, position, person, client, vendor, contacts, contracts; plus `link_user` / `unlink_user` |
| `masterdata.hard_delete` | `DELETE ?hard=true` on any masterdata row (in addition to the matching `manage` code) |
| `masterdata.person.view_sensitive` | the sensitive person and contact fields (`SEC-MD-02`): **defined now, wired later (D4)** |

- Reads stay open to every authenticated user.
- `platform.master_data.configure` stays accepted as an alias for both `manage` codes for one release, so existing grants keep working. It is removed in Phase 8 after the seed grants move.
- `platform.master_data.create` (seeded at `apps/core/management/commands/init_platform.py:84`, never enforced) is removed.

**Rules for the Phase 8 removal (user instruction, 2026-10-23).** The removal of `platform.master_data.configure`, `platform.master_data.create` and the alias is deferred to Phase 8 and must satisfy all of these:
1. **One commit.** The removal and the update of the existing `org-admin` contract test (`apps/core/tests/test_contract_regression.py::TestContractPermissionMatrix::test_matrix_grants_match_contract`) land together. The test is **updated** to the new grant model, never deleted or skipped.
2. **No double grants.** After the removal the old and the new permission must not both grant writes: the alias class goes, the old codes disappear from the seed catalog and from role grants, and a test proves a holder of only an old code is refused.
3. Until then the alias stays: **today a holder of either code can write** (that is the D9 alias, introduced in Phase 3 and kept deliberately). If you want that interim state ended sooner, say so; it would remove write access from any role that only holds the old code.

**Role grants: APPROVED 2026-10-23.**
- `platform-admin` (full catalog) holds all four codes (the seed grants every code in the catalog).
- `org-admin` gets **no more access than today**. Its legacy grant `platform.master_data.configure` stays as a **time-boxed, deprecated alias that maps to `masterdata.directory.manage` only**, and is removed in Phase 8 (rules above).
- Nobody else gets masterdata writes.

**Dropping the catalog mapping — conditions checked 2026-10-23: NOT met, so the alias stays unchanged until Phase 8** (your rule: if any other consumer of the old code exists, keep the alias until Phase 8).
- (a) Catalog endpoints already use the new code (`masterdata.catalog.manage`): **met.** Org-admin "equivalent access via explicit new grants": **not yet done** (and ambiguous, see the question below).
- (b) Repo-wide search for the old code (`platform.master_data.*`, `PlatformMasterDataPermissions`, `LEGACY_ALIASES`): **other consumers exist.**
  - **Enforced directly by the 11 directory viewsets** (`GlobalDirectoryGuard`, `apps/masterdata/api/viewsets/directory.py:60-63`), not through the alias.
  - Seeded and granted: `init_platform.py:83-84,116-117` (`org-admin` holds `configure` and `create`).
  - The existing contract test (`apps/core/tests/test_contract_regression.py:317-318`).
  - Tests I wrote that grant the legacy code (alias tests, catalog and software API tests).
  - Docs: ADR-0033 D4, `docs/02-architecture/authorization.md:536,797`, this folder.
  - **Outside this repo, the sibling frontend** (`studiohub-react`): its UI shows the "create" buttons of the platform admin pages only if the user holds **`platform.master_data.create`** (`PlatformAdminPage.tsx:174`, `PlatformOverviewTab.tsx:47-49`, `masterDataEntities.tsx:25-139`). That code is seeded by the backend and granted to `org-admin` but **never enforced by the backend**, so removing it in Phase 8 would hide those buttons for org-admins while the API would still accept their writes. The frontend must switch its gating before the backend stops granting it. Its generated OpenAPI files only mention `platform.master_data.configure` in docstrings (regenerate). Its own permission catalog defines `platform.master_data.view/create/update/archive/restore/delete`, a naming scheme the backend does not use.
- (c) The existing contract test is updated, not deleted or skipped, **when the alias is removed (Phase 8)**.

Consequence: in Phase 5 the directory viewsets move to `masterdata.directory.manage`, and the alias keeps mapping the legacy code to **both** manage codes exactly as today, so `org-admin` gets **no more and no less** than it has now. The "drop the catalog mapping now" idea is separable (the catalog path has no consumer besides my own tests); it stays available if you decide the directory consumers should not block it.

**`org-admin` after the catalog mapping is dropped — DECIDED 2026-10-23: Option B (transitional).** `org-admin` holds `masterdata.directory.manage` **and** `masterdata.catalog.manage` explicitly, **nothing more** (no `hard_delete`), so dropping the alias later changes no effective access. A test asserts `org-admin`'s **exact** permission set (Phase 5), so any drift fails.

*Are the catalogs global or per-organization?* **Global.** There is no organization column on any masterdata table (verified in `AUDIT.md` §6.8; D1; ADR-0034), and the runtime has no Organization module. A catalog write therefore affects the whole platform, not one organization. That is why handing `catalog.manage` to an organization-era role is a stop-gap, not a design.

**Follow-up decision FU-1 (OPEN, recorded now):** move `masterdata.catalog.manage` from `org-admin` to a platform-level role (for example a dedicated catalog-administrator role), and decide who holds `masterdata.hard_delete`. Until that is decided and applied, B stands.

**Roles and what they see — contract values, billed total and personal data (D11, H1).** Read endpoints have been open to every authenticated user, so *today every role, and every user with no role, sees all of it*. After this phase only holders of the new permissions do:

| Role | Sees financial values today | Holds `masterdata.client.view_financial` after | Holds `masterdata.person.view_sensitive` after |
|---|---|---|---|
| `platform-admin` | yes | **yes** (full catalog) | **yes** (full catalog) |
| `org-admin` | yes | **yes, granted** | **yes, granted** (it manages contacts, and writing them needs it) |
| `production-admin` | yes | **yes, granted** (producers track contract and budget figures) | no |
| `vfx-supervisor`, `lead-artist`, `artist`, `org-member` | yes | **no (intentional loss)** | no (intentional loss) |
| user with no role | yes | no (intentional loss) | no (intentional loss) |

The grants are my judgement of who legitimately needs the access; they are in `init_platform` and therefore visible in review. Tell me if `production-admin` should also hold `view_sensitive` (vendor and client contact details), or if any role should not hold `view_financial`.

**Required tests (Phase 5):**
1. The alias grants exactly `masterdata.directory.manage` and nothing else (parametrized over every masterdata code, including `catalog.manage`, `hard_delete`, `person.view_sensitive`).
2. **No double grant:** holding the legacy code and the new code together behaves exactly like holding the new code alone; the alias is a mapping evaluated once, never a second, additive path (also: it cannot widen a *scoped* credential).
3. A holder of only the legacy code is refused on every catalog write and on hard delete.
4. When the alias is removed (Phase 8), the existing `org-admin` contract test is **updated**, never deleted or skipped.

## D10 — Seed, import and export

PROPOSED:
- `init_platform` is the **canonical** seed for system rows. It is idempotent by natural key (`code`, or `(entity_type, code)` for statuses), marks rows `is_system=True`, and writes through the services, so validation and audit apply.
- `seed_demo_data` / `seed_studiohub` keep the demo rows (`is_system=False`) and stop renaming codes once D5 lands.
- No data migrations for seed rows: commands are re-runnable and environment-specific.
- Import and export (bulk CSV/JSON through services, `AGENTS.md` §21): **Later**, not in Phases 3–8 unless you add it.

## D11 — Stored statistics

**APPROVED 2026-10-23 (Phase 1 answer 8): "Compute them."** Computed fields become read-only in the API and are calculated by selectors (annotations), not stored. The columns are dropped in the phase that owns the model, by reversible migration.

PROPOSED source per field:

| Field | Computed as | Source reliability |
|---|---|---|
| `Office.headcount` | count of live, active `Person` with `office=` | Reliable (FK) |
| `Department.utilization_percentage` | scheduled hours this ISO week ÷ capacity hours, over `scheduling.Resource` with `department=`, from `ResourceSchedule.start_time`/`end_time` | Reliable (FK). The definition of "week" and which schedule statuses count need sign-off. |
| `Team.utilization_percentage` | the same, over `Resource.team` | Reliable (FK) |
| `Department.capacity_hours_weekly` | sum of `Resource.capacity_hours_per_week` for the department | Reliable (FK). **Today it is an input with default 160**: computing it changes meaning. |
| `Client.active_projects` | **omitted** (see the decision below) | `production.Project.client_id` is free text (`apps/production/models/project.py:87`) holding a code in `seed_dev.py:791` and mock ids in `seed_studiohub.py:500`, so no reliable match exists |
| `Vendor.active_projects` | **omitted** | same reason, `apps/production/models/project.py:92` |
| `Vendor.active_tasks_count` | **omitted** | same reason, `apps/production/models/task.py:67` |

**Client / vendor counts and `total_billed_usd` — APPROVED 2026-10-23.**
- **No matching by code, ever.** `Client.active_projects`, `Vendor.active_projects` and `Vendor.active_tasks_count` are **omitted from the API** now. They return only if the Projects module exposes a selector keyed by the masterdata **UUID**; masterdata then calls that selector. **Masterdata does not import Projects** (dependency direction, CONTRACTS §1; the same applies to scheduling for the utilization figures above, which already rely on real foreign keys). The stored columns are kept (hand-entered values; dropping them loses data) and are dropped in Phase 8 only with your approval.
- **`Client.total_billed_usd`** becomes a **nullable `DecimalField`** (`max_digits=12`, `decimal_places=2`, `null=True`, default `NULL`): **manually entered, not computed, not reconciled with any billing system**, and documented that way in the API docs. Existing values are not rewritten (a stored `0` may mean "unknown"; the Phase 5 report states how many rows hold `0`). **Access (APPROVED 2026-10-23):** reading **and** writing need the separate financial permission **`masterdata.client.view_financial`**, in addition to `masterdata.directory.manage` for writes. It is deliberately not `masterdata.person.view_sensitive`: finance staff and people-data staff are different audiences, and combining them would force an HR-data grant on whoever needs billing figures (and the reverse). Without it the field is **omitted** from responses; a write that includes it is refused with **403** (never ignored). A write is audited as the field **name only** (`total_billed_usd changed`), never with the old or new amount, and the field is excluded from `ChangeLog` snapshots. *Open:* contract values (`value_usd`, `total_value_usd`) are financial too and are readable by every authenticated user today; say whether they join this permission.

Fields kept as plain inputs (unchanged, no source exists): `Office.workstations_count`, `Office.render_nodes_count`, `Team.capacity`, `Team.current_project_code`. (Still unconfirmed by you; tell me if any should be dropped.)

## D12 — `scope` column

**APPROVED 2026-10-23 (Phase 7 answer): option B.** Drop the DB column (and its index) by a reversible migration and remove `MasterDataScope.ORGANIZATION`. Responses keep `"scope": "GLOBAL"` as a constant read-only value. Input `scope=GLOBAL` is accepted and ignored; any other value returns 400. `?scope=GLOBAL` still lists every row; any other `scope` filter value lists nothing. The frontend keeps working and the org dimension disappears from the data. (Option A, dropping the field from the API too, was rejected as a contract break.)

**Overview key, APPROVED 2026-10-23 (Phase 7 answer, against my recommendation to keep it at 0):** `total_custom_records_across_orgs` is **removed** from `GET platform/overview`. The frontend `PlatformOverviewTab` renders it (comment in `services/resolution.py` before the change), so that tab must stop reading it. Listed under "Frontend-facing contract changes in Phase 7".

## D13 — Changes outside masterdata

**APPROVED 2026-10-23 (Phase 1 answer 4: "Yes").** Limited to:
- `apps/audit/signals/change_tracking.py`: redact PII fields from `ChangeLog` snapshots for masterdata models, and keep the generic tracker for the other apps unchanged.
- `apps/core/api/exceptions/handlers.py`: stop logging the DB `DETAIL` (row contents) of integrity errors (`AUDIT.md` M11). This affects every app's logs, not their responses.

Each change gets its own tests and is called out in its phase report. Anything broader, such as `ChangeLog` retention or append-only enforcement, still needs separate approval.

## D14 — Test runtime per phase

**OPEN.** Options from the Phase 0 report:
- **A:** full suite only at Phase 8; masterdata + settings + core (~1.5 min) per phase.
- **B:** add `pytest-xdist`, a new dependency.
- **C:** delete `apps/intelligence/tests`, which saves about 6%.
- **D:** full suite every phase (~16 min).

This plan assumes D until you choose.

---

## Phase 3 implementation notes (2026-10-23)

What was built, and where it differs from or defers part of the text above.

1. **D2 — staged, not in place.** The brief said to extend `CatalogModel`. Phase 3 adds an abstract `LookupCatalogModel(CatalogModel)` for the six type catalogs and leaves `Software` / `SoftwareVersion` on `CatalogModel`. Reason: `CatalogModel.code` is globally unique and Software's API still runs on the legacy guard and mixin, so changing the shared base would have pulled Phase 4's work into Phase 3. Phase 4 moves both onto the new base; the end state is the one in D2. The legacy `MasterDataCatalogGuard`, `ArchiveRestoreMixin` and `PlatformMasterDataPermissions` stay until then and are removed in Phase 8.
2. **D2 — fields.** Every lookup catalog gains `is_system` and `sort_order`. `MasterStatus` keeps its existing `order` column and has no `sort_order` (D2 table). `status` becomes the enum `active` / `archived` with a DB check constraint; a migration step maps legacy free-text words (`inactive`, `deprecated`, `disabled`, `retired` → `archived`; anything else → `active`).
3. **D2 — constraints.** `code` and `name` are unique case-insensitively among non-deleted rows (partial functional unique indexes). Existing duplicates **stop the migration with a list** (migration `0005`); nothing is merged or renamed for you.
4. **D5 — implemented as written**, with two refinements. Setting a new default clears the flag on every other status of that entity type, archived ones included, so an archived default that is later restored comes back as a non-default instead of clashing. `entity_type` and `category` are validated by the service (enums), not by a DB check, so legacy rows with other values still load and only fail when edited to a new bad value.
5. **D6 — catalogs.** Archive, restore, soft delete and `DELETE ?hard=true` exist for the six types. The catalog types have no inbound foreign keys today, so the dependants check is generic (`services/lifecycle.py`) and is exercised through Department → Team in tests until Phase 6.
6. **D9 — codes.** `masterdata.catalog.manage` and `masterdata.hard_delete` are seeded and enforced. `masterdata.directory.manage` and `masterdata.person.view_sensitive` are defined but not yet used. The legacy `platform.master_data.configure` still satisfies the `manage` codes (never `hard_delete`) through `AliasAwareHasPermission`. `platform.master_data.create` is **not removed yet**: an existing contract test asserts `org-admin` holds it, so its removal moves to Phase 8 with the rest of the alias cleanup (plan WP 3.5 amended).
7. **D10 — seeds.** `init_platform` creates the system statuses through `MasterStatusService` with `is_system=True`; existing rows are flagged, never overwritten. `seed_demo_data` now keys statuses by `(entity_type, code)` (no more code renaming), keeps one default per entity type (last mock row wins), maps legacy status words, and reports instead of crashing when a mock row clashes with the new code/name rules.
8. **API-MD-04 — error codes.** The core handler reads `exc.code`, which DRF only keeps on the detail object, so a plain `ConflictException(code=…)` always reported `conflict`. Masterdata adds `MasterdataConflict`, which also sets `.code`, so `system_row_protected`, `has_dependants`, `not_soft_deleted` and `conflict` reach the client. No core change.
9. **Audit target type (needs your call).** Audit rows are written with `target_type="masterdata"`. `AuditLog.TARGET_CHOICES` has no such entry; choices are not enforced at the database, so it works, but the audit admin and filters will not list it. Adding the choice means a migration in `apps/audit`, which D13 does not cover. Say the word and I will do it in a later phase.
10. **Serializers.** DRF turns the partial single-field unique constraint into a field validator on `entity_type` and ignores its `condition`; the status serializer clears that validator and the service owns uniqueness.
11. **Not done in Phase 3 (still open):** D8 contract overlap, D11 stored statistics and their open fields, D12, the full-suite run (see D14), and the `ChangeLog` / error-log PII redaction in D13, which belongs to the directory phases.

---

## Phase 4 implementation notes (2026-10-23)

Phase 4 was approved in writing ("approve Phase 4"). It implements `CONTRACTS.md` §3.4 and closes the staging deviation from Phase 3.

1. **D2 completed.** `Software` and `SoftwareVersion` now extend `LookupCatalogModel`. Migration `0006` is reversible. It maps legacy status words, fills **blank** version names and codes (name `<software name> <version>`; code the existing `version_code`, else `<software code>-<version>`), computes the sort key, and then **stops with a listing** if live rows would still violate the new rules: software code or name equal ignoring case; versions with the same code, name or version under one software; an end of support before its release. Nothing is merged or renamed for you.
2. **Legacy code removed.** `MasterDataCatalogGuard`, `ArchiveRestoreMixin` and the hand-written software viewsets are gone; software and versions run on `LookupCatalogViewSet`. `PlatformMasterDataPermissions` stays for the directory viewsets (Phase 6) and as the alias source; its removal is still Phase 8.
3. **Behaviour you will notice.**
   - `DELETE` on software or a version is now a soft delete (previously an archive). Archive is its own action. This is the D6 decision you approved; the existing test was updated to say so.
   - Archiving a software also archives its active versions unless the caller sends `?cascade=false`.
   - Creating a version through the API works; before this phase every call returned 409 (AUDIT H5, P01).
   - A software list no longer issues a query per row (AUDIT M6, P09); a test pins the query count to be the same for 3 and 30 rows.
4. **Concurrency fix found by the new tests.** A version created while its software was being deleted could land after the delete's cascade and stay live under a deleted software. Creating a version now locks the software row, so the two serialize. A regression test covers it; it failed once before the fix, and 15 manual repeats after the fix all passed (a race cannot be proven absent by a test, only made unlikely to hide).
5. **Natural version order.** The key is stored in `version_key` and set in `SoftwareVersion.save()`, so ORM writes, seeds and the API all keep it consistent. Letters sort after digits, so `2025` sorts before `2025sp1`.
6. **Seeds.** `seed_demo_data` now keys versions by `(software, version)`, derives their names and codes, accepts versions without a `version_code`, and reports (does not crash on) a mock row whose end of support precedes its release.
7. **Not done (still open).** D8, D11 and D12 are unchanged. Versions have no reorder endpoint. Hard-deleting a software means hard-deleting its soft-deleted versions first (PROTECT); a cascading hard delete was not requested. The full test suite has not been run (D14: targeted runs only, by instruction).

---

## Review follow-ups after Phase 4 (2026-10-23)

Your five answers to the Phase 3 questions, and what was done.

1. **Audit target type — done, own commit `1b25b4e`.** `masterdata` was added to `AuditLog.TARGET_CHOICES` and to the two parallel lists (`AuditTarget`, `AuditTargetCodes`). Migration `audit/0007` is **choices-only**: the only field kwarg that differs is `choices` (one entry added, none removed) and Django emits **no SQL in either direction**; `apps/audit/tests/test_masterdata_target.py` pins this and keeps the three lists in sync. This is the one approved exception to D13's scope. The masterdata audit handler now uses `AuditLog.TARGET_MASTERDATA`.
2. **Permission removal — deferred to Phase 8** with the rules added under D9 above.
3. **`status` on PUT/PATCH — now a 400** for all eight catalogs (statuses, task/asset/shot/review/file types, software, versions), pending your frontend check. It is refused even when the value equals the stored one, so a client that does GET→PUT of the whole object must drop `status` first. A create (POST) still ignores `status`; say if that should be refused too. If your check shows the frontend echoes `status`, the alternative is to refuse only a *changed* value.
4. **DELETE — a soft delete,** message `"<Type> soft-deleted. It can be restored."` (see CONTRACTS §3.1 for the exact behaviour). Before Phase 3 it archived the row.
5. **Color rule — tightened to CSS-valid hex** (3, 4, 6 or 8 digits) plus plain keywords; `rgb()`, `rgba()`, `hsl()`, `var()` and 5/7-digit hex are rejected. If the picker emits functional notation the rule must widen; that is a one-line change, so tell me what it emits. Existing rows: nothing in this repo's seeds sets a color (`init_platform` leaves it blank) and the mock dataset is no longer in the frontend checkout, so the only possible offenders are rows written through the API before Phase 3 or loaded from mock data in an earlier run. They can only be listed from a database. This read-only query (PostgreSQL) lists every row, soft-deleted ones flagged, whose color the new rule would refuse; it was checked against the validator on 22 sample values and agrees on all of them:

```sql
SELECT t.table_name, t.id, t.code, t.color, t.is_deleted
FROM (
    SELECT 'masterdata_status'     AS table_name, id, code, color, is_deleted FROM masterdata_status
    UNION ALL
    SELECT 'masterdata_task_type'  AS table_name, id, code, color, is_deleted FROM masterdata_task_type
    UNION ALL
    SELECT 'masterdata_asset_type' AS table_name, id, code, color, is_deleted FROM masterdata_asset_type
) AS t
WHERE btrim(t.color) <> ''
  AND btrim(t.color) !~ '^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|[A-Za-z][A-Za-z0-9-]{0,30})$'
ORDER BY t.table_name, t.code;
```

---

## Phase 5 prerequisites (decisions of 2026-10-23, before Phase 5 starts)

**Phase 5 does not start until you confirm the frontend checks.**

### Contract lifecycle (APPROVED statuses; Expired is **derived**)

Wire values: `Draft`, `Active`, `Expired`, `Terminated`.

| From | To | How | Notes |
|---|---|---|---|
| `Draft` | `Active` | `POST …/activate` | needs `effective_date`; runs the overlap check |
| `Draft` | `Terminated` | `POST …/terminate` | |
| `Active` | `Terminated` | `POST …/terminate` | |
| `Active` | `Expired` | **automatic** when `expiry_date` is in the past | **no write, no job** (derived) |
| `Expired`, `Terminated` | anything | — | final: `409 invalid_transition` |

**Stored or derived? Derived** (your recommendation, adopted). The database stores only `Draft`, `Active` and `Terminated`. The API's `status` is computed: a stored-`Active` contract with a non-null `expiry_date` before today is reported as `Expired`. "Today" is the server's local date (`timezone.localdate()`); an `expiry_date` equal to today is still `Active` (the end date is inclusive). Consequences, all part of the contract:
- `?status=Expired` and `?status=Active` filter on the stored status **and** the date, so they are exact complements; there is no expiry job and no stale state.
- **"Expired is final" has to be enforced, because a date edit could otherwise revive it.** Once the effective status is `Expired` or `Terminated`, the contract is read-only (409 `invalid_transition`, except soft delete and restore). While `Active`, `expiry_date` may be changed (extended or shortened) but not to a date before today; use `terminate` to end a contract early.
- The overlap constraint is unaffected: it uses stored status and dates only (no "today"), and an expired contract keeps occupying its historic range.
- Reports that read the table directly must apply the same rule; the API exposes it as a selector annotation, and a database view can be added if reports need it.
- **Existing rows:** a stored status outside `Draft/Active/Terminated` (for example a stored `Expired`, or any free text) is a data decision, so the migration **stops with a listing** instead of guessing.
- **Create:** a contract may be created `Draft` or `Active`; the default stays `Active` (current behaviour). Creating `Active` runs the activation rules, which is what makes "two simultaneous overlapping creates" a real race. `Terminated` cannot be created.

### H1 (PII) — rules approved 2026-10-23, to be built in Phase 5

1. **Mixed endpoints (return sensitive and ordinary fields): omit the sensitive fields** for callers without `masterdata.person.view_sensitive`. Proposed classification: `people`, `positions`, `clients`, `vendors` are mixed.
2. **Purely sensitive endpoints: 403** without the permission — **confirmed 2026-10-23** for `client-contacts` and `vendor-contacts`. The check runs **before any object lookup** (it is a permission-class check, not a queryset filter), so a missing id and a forbidden id answer identically with 403 and nothing about existence leaks. Contacts are **never embedded** in a parent (client / vendor) response, and if a future change embeds them the same permission applies. A **contact count** on the parent (`contact_count`, live contacts) is allowed and is added. **Writes need `masterdata.directory.manage` plus `masterdata.person.view_sensitive`.**
3. **Sensitive fields:** SEC-MD-02 list; `Client.total_billed_usd` is separate and needs `masterdata.client.view_financial` instead (D11).
4. **Writes to sensitive fields need the same permission and return 403 (or 400 for a malformed value); they are never silently ignored.**
5. **Search, filter and ordering on sensitive fields are blocked without the permission:** a filter or `ordering` parameter naming a sensitive field returns 403; `search` without the permission runs only over the non-sensitive search fields (people: `name`, not `email`), so a search cannot be used to probe for an email address. With the permission, behaviour is unchanged.
6. **No leaks through side channels:** validation and error messages never echo a hidden value or confirm that one exists; no export endpoint exists (and any future one must apply the same rules); audit entries carry field names only; `ChangeLog` snapshots redact the fields (D13); no response cache exists for these endpoints (`APIResponseCache` has no users) and the one cache that exists holds permission codes only, never rows. A future catalog cache (D7) must never cover directory endpoints.
7. **A PATCH or PUT by a caller who cannot see a field must not change it:** hidden fields are not part of that caller's serializer, an update touches only the keys sent, and a test proves a partial and a full update leave hidden values unchanged (never nulled or blanked).
8. **Logs:** done in commit `0df7264` (see "Logging" below).

### Logging — DONE (commit `0df7264`, approved 2026-10-23)

Values of `search`, `email`, `phone`, `contact_name`, `date_of_birth`, `nationality`, `security_clearance` and `salary_range` are replaced with `***REDACTED***` for every masterdata directory route, in the structured request/exception logs and in the `audit.APIRequest.full_path` column. Other paths log as before. The inventory of every place that records URLs or query strings is in `docs/observability.md` §11.2. **Outside the Django code, for you to handle:** the uvicorn access log and the nginx access log (both configured by files in this repo but not changed), any proxy, load balancer or CDN in front of nginx, the PostgreSQL server log, any error tracker or APM you add later, and browser or frontend-side recording. **H1 stays open only for those**, to be accepted in writing with owner and deadline.

### Frontend checks you are doing (one list)

1. `status` sent on PATCH/PUT (now 400, including an unchanged value).
2. DELETE message text `"<Type> soft-deleted. It can be restored."`.
3. Color picker output (hex 3/4/6/8 digits or keyword only).
4. Contract status strings (`Draft/Active/Expired/Terminated`) **and** contract `type` strings (I assume `MSA`, `SOW`, others free).
5. `active_projects` (client, vendor) and `active_tasks_count` (vendor) disappear from responses.
6. `total_billed_usd` can be `null` and is omitted without `masterdata.client.view_financial`.
7. Sensitive fields are omitted (not blank) without `masterdata.person.view_sensitive`; **contact endpoints return 403** without it.
8. Contract `status` is derived, so `Expired` appears without any write.
9. **New:** the UI gates the platform-admin "create" buttons on `platform.master_data.create` (see D9).

### Decisions of 2026-10-23 (round 4), answering the previous open questions

1. **Expired / overlap:** keep `Expired` derived; backdating over an elapsed Active MSA is blocked on purpose; corrections via the audited `adjust-end-date`; Terminated-after-Active MSAs keep the range they covered (see D8).
2. **`org-admin`:** Option B, explicit and transitional; catalogs are global; FU-1 opened (see D9).
3. **Contract values are financial.** `value_usd` (client contracts) and `total_value_usd` (vendor contracts) follow the **same rules as `total_billed_usd`**: they need `masterdata.client.view_financial` to be read or written; **omitted** from responses without it; **search, filter and ordering on them are blocked** (403) without it; a write that includes them is **refused with 403**, never ignored; they are **excluded from exports, caches and aggregates** (none of the three exists in the code today: no export endpoint, `APIResponseCache` has no users, and nothing sums these columns; any future one must respect this rule); audit entries record the field name only; `ChangeLog` does not snapshot them. Roles: see the table under D9. A contract the caller may see but whose values are hidden still appears, with those two keys absent.
4. **Contacts:** purely sensitive, confirmed (see H1 rule 2).

**Frontend-facing contract changes in Phase 5 (all of them, for your checks):**
- `status` on a contract is **derived**: `Expired` appears with no write; `status` is refused on PUT/PATCH and accepted on create only as `Draft` or `Active`.
- New actions: `POST …/activate`, `…/terminate`, `…/adjust-end-date` on client and vendor contracts; new 409 codes `invalid_transition`, `contract_overlap`.
- **Contract `value_usd` / `total_value_usd` keys disappear** without `view_financial`; **`total_billed_usd` disappears** without it and may be `null`.
- **Sensitive fields disappear** (client/vendor `contact_name`, `email`, `phone`; person `date_of_birth`, `nationality`, `security_clearance`, `phone`, `email`; position `salary_range`) without `view_sensitive`; **contact endpoints answer 403**.
- `active_projects` (client, vendor) and `active_tasks_count` (vendor) are gone.
- New additive fields: contract `currency`, `activated_at`; client and vendor `contact_count`.
- Writes of a sensitive or financial field without the permission return **403** (before they were accepted); search/filter/ordering on them return 403; `search` on people/clients/vendors without `view_sensitive` no longer matches e-mail.
- Dates: `expiry_date` on an Active contract cannot be set in the past (use terminate); an `Expired` or `Terminated` contract is read-only except `adjust-end-date`.
- The earlier items still stand: `status` refused on PUT/PATCH of catalogs, the soft-delete message, the colour rule, and the UI's use of `platform.master_data.create`.

## Phase 5 implementation notes (2026-10-23)

- **Overlap, two layers.** `ContractService` checks under a `SELECT … FOR UPDATE` lock on the parent row (friendly `409 contract_overlap`), and the PostgreSQL `ExclusionConstraint` (`btree_gist`, `daterange(effective_date, expiry_date, '[]')`) is the backstop. On SQLite the constraint emits no SQL (`PostgresOnlyExclusionConstraint`), so the service check is the only guard there; PostgreSQL is the production database.
- **Settings change outside masterdata:** `django.contrib.postgres` was added to `DJANGO_APPS`. Without it `manage.py migrate` fails with `postgres.E005` on any database as soon as an `ExclusionConstraint` exists (`manage.py check` and pytest skip that check, which is why it had to be found by running migrate).
- **Extension.** Migration 0007 starts with `EnsureBtreeGistExtension` (a no-op in reverse: dropping an extension other objects may use is not ours to do). The role needs `CREATE` on the database; on the test database it is installed. **UNVERIFIED for the dev/production role**, which was not queried.
- **Migration 0007 is loud, not clever.** It normalizes only unambiguous data (lower-case e-mails, status words, `Expired` with a past end date → `Active`, `activated_at` backfill) and then refuses to continue, listing the rows, for: duplicate client/vendor code (case-insensitive), vendor rating outside 0 to 5, negative billed total, more than one primary contact or one e-mail used twice per owner, duplicate contract number per owner, an unknown stored status, `Active` without a start date, inverted dates, overlapping MSAs. Nothing is merged or renamed.
- **Default status.** A contract created without `status` is `Active` (as before) and therefore needs a start date; it is not silently downgraded to `Draft`.
- **Contacts are never embedded** in client/vendor responses; `contact_count` (live contacts) is returned instead. `active_projects` / `active_tasks_count` columns stay in the table but are not part of the API.
- **Phone.** Validated charset (`+`, digits, spaces, `()`, `.`, `-`), spaces collapsed; no E.164 parsing (would need a dependency).
- **Soft delete of a client/vendor** is refused (409 `has_dependants`) while a contract is in force (stored `Active` and not elapsed); otherwise contacts and contracts are soft-deleted with the same timestamp and restored with it. Hard delete needs the row to be soft-deleted already and `masterdata.hard_delete`; foreign keys are `PROTECT`.
- **D13 changes outside masterdata (the permitted PII redaction only):**
  1. `apps/audit/signals/change_tracking.py`: models list `audit_exclude_fields`; those fields are left out of the `ChangeLog` before/after snapshots **and out of the target label** (a person's name was otherwise coming back through `target_name` and the description).
  2. `apps/core/logging`: `redact_database_detail` removes the `DETAIL:` line, `Key (…)=(…)` and `Failing row contains (…)` from database error text; applied to the exception handler's diagnostics (`_safe_message`) and, through a structlog processor, to rendered tracebacks and the event text. The constraint name stays.
  3. Seeds: `seed_dev` stamps `activated_at` on Active contracts and no longer invents a billed total of 0.
- **Role grants** (`init_platform`): see D9; pinned by `tests/permissions/test_role_grants.py`.

## Phase 6 decisions (2026-10-23, answers to the four Phase 6 questions)

1. **Utilization and capacity (D11): omit from the API, keep the columns.** `Department.utilization_percentage`, `Department.capacity_hours_weekly` and `Team.utilization_percentage` are removed from responses and are not writable. The stored columns stay (hand-entered values; dropping them loses data; any drop is a Phase 8 decision with your approval). They return only through a selector that Scheduling exposes and keys by UUID; masterdata never imports Scheduling. `Office.headcount` **is** computed in masterdata (live, active persons with `office=`), also omitted as a writable field; its column stays. Inputs that stay: `Office.workstations_count`, `Office.render_nodes_count`, `Team.capacity`, `Team.current_project_code`.
2. **D4 approved as written.** `Person.user` is read-only in the API and changes only through `POST people/<id>/link-user` and `…/unlink-user` (`masterdata.directory.manage`). A user already linked to a live person → 409 `conflict`; an inactive or deleted user → 400. While linked, `name` and `email` come from Identity: copied on link and after commit on every `User`/`Profile` save; sending a different value through the person API → 400. No authentication data on Person.
3. **Hierarchy depth: 6 levels** (root = level 1) for Department and Position. Self-parent and cycles are rejected regardless. A move or create that would exceed 6, or that would push an existing subtree past 6, → 400.
4. **Deactivating or deleting a Person who manages or leads:** allowed. In the same transaction `Department.manager`, `Team.lead` and `Office.manager` pointing at them are cleared, and the response lists the affected rows in a `warnings` key. The audit event records the cleared row ids.

## Phase 6 implementation notes (2026-10-23)

- **Migration 0008** (`directory_hardening`): partial, case-insensitive unique `code` and `name` for Department, Team, Office and Position among live rows (replaces the column-level `unique=True` on `code`); `parent <> id` checks for Department and Position; `Position.level >= 1`; one live headquarters (`masterdata_office_one_headquarters`); `Person.user` unique among **live** people only (a soft-deleted person no longer holds the user; restore re-checks); `Lower(email)` unique among live people with a non-blank e-mail. It reads the data first and **stops with a list of rows** for: case-variant duplicate codes or names, a self-parent, a position level below 1, more than one headquarters, one e-mail used by two people, one user linked to two live people. Nothing is merged or renamed. No column is dropped.
- **Lock order.** Hierarchy and headquarters writes take a PostgreSQL advisory lock **before** any row lock (`DirectoryService.serialize_writes`). Taking it after the row lock deadlocked two concurrent moves (found by the race test, not by reading): each held its own row and needed the other's for the foreign-key check.
- **Services:** `DepartmentService`, `TeamService`, `OfficeService`, `PositionService` (`services/organization.py`), `PersonService` (`services/person.py`). The viewsets no longer write through serializers; the shared service-backed base is `viewsets/records.py` (`ServiceRecordViewSet`), also used by the Phase 5 partner viewsets.
- **Identity sync** (`signals/identity_sync.py`, wired in `AppConfig.ready`): after commit on `User`/`Profile` saves that touch `email` or the profile's names. A save that touches only other fields (`last_seen` on login) does nothing. The refresh is a queryset update (no ChangeLog row, no loop) and never raises into Identity.
- **After an unlink the person keeps the copied name and e-mail** and owns them again. Linking the same user to another person therefore needs the first person's e-mail changed first (the e-mail rule, 409 `conflict`).
- **ChangeLog and audit:** Person events carry no name (`event_name_field = None`); `PersonLinked`, `PersonUnlinked` and `PersonDeactivated` are new audit events (field names and row ids only).
- **Not done here, by decision:** utilization/capacity (omitted), Phase 7 leftovers, the legacy-permission removal (Phase 8).

### Frontend-facing contract changes in Phase 6 (all of them)
- **Removed from responses and not writable:** department `capacity_hours_weekly` and `utilization_percentage`; team `utilization_percentage`. (The values are still stored.)
- **`headcount` on offices** is now computed from live, active people and is read-only (was a stored, writable number).
- **`user` on a person is read-only.** Use `POST people/<id>/link-user {"user": uuid}` and `POST people/<id>/unlink-user`. While linked, `name` and `email` follow Identity and a PATCH that changes them returns 400.
- **New person actions:** `deactivate` (optional body `{"status": "inactive"|"archived"}`) and `reactivate`; `deactivate` and a PATCH of `status` to inactive/archived return a `warnings` list of manager/lead links that were cleared.
- **Uniqueness:** department/team/office/position `code` **and** `name` are unique ignoring case (409/400 on a duplicate, as before for `code`); a person's `email` is unique ignoring case; a second headquarters is not an error: the old one is demoted.
- **Hierarchy:** a department or position parent that is itself, a descendant, deleted, or deeper than 6 levels returns 400 on `parent`.
- **DELETE** of a department/team/office/position/person that is still referenced returns 409 `has_dependants` (it used to succeed and leave dangling rows); a person who manages something can be deleted: the links are cleared.
- **Stricter field validation:** office `timezone` must be an IANA name; `color` a CSS colour; person `timezone` an IANA name, `phone` digits/spaces/`+().-` and at most 20 characters, `date_of_birth` between 1900 and today, `status` one of draft/active/inactive/archived, `skills` and `software_stack` lists of strings; a person's team must belong to the person's department.

## Phase 7 implementation notes (2026-10-23)

- **Migration 0009** (`drop_catalog_scope`) drops the `scope` column from the eight catalog tables. It first reads every row, soft-deleted ones included, and **stops with a list** if any is not `GLOBAL` (nothing is rewritten or deleted). It reverses: the column comes back with the default `GLOBAL`, which is what every row held. No other column or table is dropped.
- **Code:** `MasterDataScope` has only `GLOBAL`; catalog models expose `scope` as a read-only property returning `"GLOBAL"`, and the serializers declare it as a `ChoiceField` limited to `GLOBAL`. The `scope` entry is gone from every viewset `filterset_fields`; the lookup viewset handles `?scope=` itself.
- **Seeds:** `seed_demo_data` no longer writes `scope` and no longer reads or reports the per-organization mock arrays (`mockCustomSoftware`, `mockOrganization*Configs`); `seed_studiohub --organizations` stays as a deprecated no-op flag so existing scripts do not break. The `seed_studiohub` test fixture no longer carries the unread arrays.
- **Docs:** `docs/architecture/ORGANIZATION_MASTER_DATA.md` (it described deleted clone/bulk-enable endpoints) was replaced by `docs/architecture/MASTER_DATA.md`.
- **Left alone on purpose:** the Identity roles `org-admin` / `org-member` and their `organization` role scope, the legacy permission codes `platform.master_data.configure` / `create` (Phase 8, with frontend coordination), and the stored `active_projects` / `active_tasks_count` / `headcount` / utilization columns (a Phase 8 decision, with your approval).

### Frontend-facing contract changes in Phase 7
- **`total_custom_records_across_orgs` is removed from `GET /api/v1/platform/overview`.** The frontend `PlatformOverviewTab` renders it, so that tab must stop reading it (or it will show `undefined`).
- Catalog responses keep `"scope": "GLOBAL"`. `?scope=<anything but GLOBAL>` now returns an empty list instead of filtering a column; sending `scope` other than `GLOBAL` is still a 400.
