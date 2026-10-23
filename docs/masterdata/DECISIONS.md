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
| D4 | Person ↔ Identity User; PII | PROPOSED (link) + **APPROVED: defer** (PII restriction) | Link only through a service; Identity owns email and name for linked people. PII read restriction deferred. |
| D5 | Status model | IMPLEMENTED (Phase 3) | Unique `(entity_type, code)`; enums; one default per entity type; transitions later |
| D6 | Deletion and system rows | **APPROVED** (soft + hard delete) + IMPLEMENTED for catalogs (Phase 3) | DELETE = soft delete everywhere; separate, guarded hard delete. Directory models follow in Phase 6, software in Phase 4. |
| D7 | Caching | PROPOSED | Later (Phase 8); version-key invalidation on commit |
| D8 | Contract overlap; money | PROPOSED + OPEN (overlap) | Portable service check recommended; keep whole-unit integers and add `currency` |
| D9 | Permission codes | IMPLEMENTED for catalogs (Phase 3) + OPEN (role grants) | New `masterdata.*` codes, keeping the old code as an alias. `org-admin` keeps catalog writes through the alias until Phase 8. |
| D10 | Seed, import, export | IMPLEMENTED for statuses (Phase 3) | One canonical seed through services; import/export later |
| D11 | Stored statistics | **APPROVED** (compute) + PROPOSED (per-field mapping) + OPEN (fields with no source) | Compute what has a reliable source; see table |
| D12 | `scope` column | OPEN (your "Yes" fits both options). Phase 3 only rejects `ORGANIZATION` on input. | Recommendation: drop the DB column, keep `"scope": "GLOBAL"` as a read-only constant in responses |
| D13 | Changes outside masterdata | **APPROVED** (limited) | May change `apps/audit` and `apps/core` only to redact PII |
| D14 | Test runtime per phase | OPEN | Choose A, B, C or D (Phase 0 report) |

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

> **Consequence:** finding **H1 (High)** stays open. The brief's definition of done requires your written acceptance of any open High finding. Please confirm: "H1 accepted as open until <phase or date>."

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

**Overlap: OPEN.** Options:
- **(a) Portable service check (Recommended).** In `ContractService.activate`, lock the parent (`select_for_update`) and refuse an `active` contract whose `[effective_date, expiry_date]` overlaps another `active` contract of the same parent and `type`. It works on SQLite and PostgreSQL. The race is closed by the parent row lock.
- **(b) PostgreSQL exclusion constraint** (`btree_gist`, `DateRangeField`). Enforced by the DB even against raw writes, but database-specific, which `AGENTS.md` §14 discourages, and SQLite dev/test cannot enforce it.
- Also open: should two active contracts of **different** `type` (for example `MSA` + `SOW`) be allowed to overlap? Recommendation: yes. A SOW normally runs under an MSA.

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

**Role grants: OPEN.** Recommendation:
- `platform-admin` (full catalog) gets all four codes automatically.
- `org-admin` gets `masterdata.directory.manage` only. It loses catalog writes and hard delete, because it is an organization-era role (`init_platform.py:157-166`).
- Nobody else gets masterdata writes.

Approve or adjust.

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
| `Client.active_projects` | projects whose `client_id` equals the client's `code` or UUID string | **Unreliable**: `production.Project.client_id` is free text (`apps/production/models/project.py:87`) holding a code in `seed_dev.py:791` and mock ids in `seed_studiohub.py:500` |
| `Vendor.active_projects` | projects whose `vendor_ids` contains the vendor's code or UUID | **Unreliable** (same reason, `apps/production/models/project.py:92`) |
| `Vendor.active_tasks_count` | open tasks whose `vendor_id` matches | **Unreliable** (`apps/production/models/task.py:67`) |

**OPEN: fields with no source.** Choose per field:

| Field | Options | Recommendation |
|---|---|---|
| `Client.total_billed_usd` | (a) keep as an input; (b) compute as the sum of contract values (semantics change from "billed" to "contracted"); (c) drop | (a): no billing model exists |
| `Office.workstations_count`, `render_nodes_count` | keep as input (asset inventory) or drop | keep as input |
| `Team.capacity` | keep as input, or compute as a member count | keep as input (planned capacity, not headcount) |
| `Team.current_project_code` | keep as input, or compute from the team's open tasks (most frequent project) | keep as input |
| Client/vendor project and task counts | compute by matching `code` and UUID now, accepting that mock-seeded rows show 0; or keep stored until production references masterdata by a stable key | compute by `code` + UUID (approved direction), documented as best-effort |

## D12 — `scope` column

**OPEN.** Your Phase 1 answer to question 5 was "Yes", and the question offered two options:
- **(A)** Drop the DB column **and** the `scope` field from API responses and filters: a contract break, because the frontend reads and sends `scope`.
- **(B) (Recommended)** Drop the DB column, and keep `"scope": "GLOBAL"` as a constant read-only value in responses. Input `scope=GLOBAL` is accepted and ignored; any other value returns 400. The frontend keeps working and the org dimension disappears from the data.

Until you choose, Phase 3 only rejects `scope=ORGANIZATION` on input (both options agree on that).

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
