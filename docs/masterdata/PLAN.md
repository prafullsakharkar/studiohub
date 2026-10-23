# Masterdata Module — Hardening Plan

Date: 2026-10-23 · Branch: `feature/masterdata-hardening` · Status: **Draft for approval**
Inputs: [`AUDIT.md`](AUDIT.md) (finding IDs H*, M*, L*). Decisions, once approved, go to `DECISIONS.md` (Phase 2).

Each work package (WP) lists the findings it closes, its dependencies and whether it is **MVP** (needed for "production quality") or **Later**. WPs inside a phase run in the order given. Nothing here is approved yet. Several WPs depend on Phase 2 decisions, marked **[D#]** (the numbers follow the brief's Phase 2 list).

## Ground rules for every implementation phase

- Writes go through services. Views and serializers stay thin (`backend/.ai/PROJECT_RULES.md` §6–9). Reuse `apps/core` services, selectors and the event bus; reuse Identity's `HasPermission` + `permission_map`.
- Migrations are additive and reversible. Applied migrations (`0001`–`0004`) are never edited. Uniqueness and check constraints are added only after a data check shows no current rows violate them.
- The frontend API contract is preserved unless a WP says otherwise and `docs/api` records the change.
- Gate before each commit:
  - `manage.py check` and `makemigrations --check`.
  - Masterdata tests.
  - Full suite (or the agreed reduced set, see open question 9).
  - `ruff check`.
  - `ruff format` and `basedpyright` on changed files, with no new violations.
- The test DB is checked for leftover rows before the full run.

---

## Phase 3 — Foundation and lookup catalogs

**Status: implemented 2026-10-23** (commit pending approval of the Phase 3 report). Deviations from the table below are listed in `DECISIONS.md` → "Phase 3 implementation notes": the base is `LookupCatalogModel` and Software moves onto it in Phase 4 (3.1); the `platform.master_data.create` removal is deferred to Phase 8 (3.5); the audit `target_type` choice is not added (3.6).

| WP | Work | Closes | Depends on | MVP |
|---|---|---|---|---|
| 3.1 | **Catalog base.** Extend the abstract `CatalogModel` with `is_system` and `sort_order` [D2]. Normalize `code` (strip, case per [D2]). Case-insensitive `UniqueConstraint(Lower("code"))` that ignores soft-deleted rows (`condition=Q(is_deleted=False)`). Statuses get unique `(entity_type, Lower(code))` plus a partial unique for one `is_default` per entity type [D5]. `scope`: reject `ORGANIZATION` in validation now; column fate decided in [D1]. Data pre-check and dedupe report before adding constraints. | M1, M2 (part), P08 | D1, D2, D5 | MVP |
| 3.2 | **Lifecycle policy.** One `status` enum (`active` / `inactive`) replacing free text, plus soft delete for removal [D6]. Archive and restore become service operations. System rows (`is_system=True`) cannot be edited (except `sort_order`/description, per [D6]) or deleted. Restore path for a soft-deleted code (re-create offers or performs a restore, `AGENTS.md` §22). | M5, H3 (catalog part) | 3.1, D6 | MVP |
| 3.3 | **Catalog services.** `CatalogService` per type (generic over the model): `create`, `update`, `deactivate`, `reactivate`, `reorder`, `restore`. `transaction.atomic()` at the use-case boundary; validators in `apps/masterdata/validators/`; events after commit. Fix the file-type `code` contract (P13). | H2 (catalog), H5 (file types) | 3.2 | MVP |
| 3.4 | **Catalog API.** One generic catalog viewset parameterized by type (replaces seven copies), wired to the services. Keep the URLs and response shapes: bare arrays and `{success, data}` for archive/restore. DELETE semantics per [D-Q7]. | M13 (part) | 3.3 | MVP |
| 3.5 | **Permissions.** Introduce the permission codes chosen in [D9] (for example `masterdata.catalog.manage`), keep `platform.master_data.configure` as a compatible alias during migration, update `init_platform` role grants, and remove the unused `platform.master_data.create`. | M8 (catalog) | D9 | MVP |
| 3.6 | **Audit events.** Domain events `CatalogItemCreated`, `CatalogItemUpdated`, `CatalogItemDeactivated` and `CatalogItemRestored` in `apps/masterdata/events/`, recorded to the audit app through its existing service. No PII in catalogs. | 6.1 (catalog) | 3.3 | MVP |
| 3.7 | **Selectors.** Filtering, search and ordering via selectors; deterministic default ordering (`sort_order`, `name`). | — | 3.1 | MVP |
| 3.8 | **Seed.** One canonical, idempotent catalog seed. `init_platform` owns platform defaults; `seed_demo_data` must not rename codes (it no longer needs to once [D5] lands). Seeded rows marked `is_system`. | M13 (seed) | 3.1, D10 | MVP |
| 3.9 | **Tests.** Constraints; case-insensitive duplicates; seed run twice; service success, failure and rollback; deactivate instead of delete; system-row protection; API matrix (anonymous, authenticated, privileged); ordering; concurrent create of the same code on PostgreSQL (exactly one 201, the other 409, no 500); one flow with real JWT authentication; migration from an empty DB. | M14 (catalog) | 3.1–3.8 | MVP |

Commit: `masterdata(phase-3): foundation and lookup catalogs`.

## Phase 4 — Software (platform-structure scope dropped, see AUDIT §1)

**Status: implemented 2026-10-23** (commit pending approval of the Phase 4 report). See `DECISIONS.md` → "Phase 4 implementation notes".

| WP | Work | Closes | Depends on | MVP |
|---|---|---|---|---|
| 4.0 | **Move onto the lookup base.** Switch `Software` / `SoftwareVersion` from `CatalogModel` to `LookupCatalogModel` (migration with the same duplicate pre-check as `0005`), retire the legacy `MasterDataCatalogGuard` and `ArchiveRestoreMixin`, and run the two viewsets on `LookupCatalogViewSet` + services. | — | Phase 3 | MVP |
| 4.1 | **Software and versions.** Fix nested version create (`software` from the URL, P01). Fix the N+1 with `annotate_version_count` (P09). `on_delete=PROTECT` for Software→Version, with service-level cascade deactivation. Drop the inherited global `code` requirement on versions or derive it [D2]. Version sort key and deprecation flag. Deactivating a software with active versions requires an explicit choice (cascade or refuse) [D6]. | H5 (versions), M6, M12 (software) | Phase 3 | MVP |
| 4.2 | **Services, API, permissions, audit** for software and versions, reusing the Phase 3 generic pieces. | H2 (software) | 4.1 | MVP |
| 4.3 | **Tests.** Duplicate version rejected; deprecation; referential protection; N+1 regression (fixed query count); API matrix; concurrency; migration. | M14 | 4.1–4.2 | MVP |

Commit: `masterdata(phase-4): software` (renamed from the brief's "platform structure and software"; no platform tables remain).

## Phase 5 — Clients and vendors (**IMPLEMENTED, awaiting approval**; see DECISIONS "Phase 5 implementation notes")

Decisions recorded 2026-10-23 in `DECISIONS.md` (D8 hybrid overlap, D9 alias, D11 counts and billed total, contract lifecycle, H1). The user does not accept H1 staying open through Phase 5.

| WP | Work | Closes | Depends on | MVP |
|---|---|---|---|---|
| 5.0 | **First, verify the two risks:** (a) Django's `ExclusionConstraint` migration on SQLite (fallback `SeparateDatabaseAndState`); (b) `CREATE EXTENSION btree_gist` with the dev role. | — | user go-ahead | MVP |
| 5.1 | **Shared contact and contract patterns.** Abstract `ContactBase` / `ContractBase`. Contacts: email lower-cased; phone normalized (no new dependency without asking); partial unique for one primary contact per parent; parent immutable. Contracts: `expiry_date ≥ effective_date` check; stored status enum `Draft/Active/Terminated`; `type`; `currency` and money per D8; parent immutable; `PROTECT` from client/vendor. `Client.total_billed_usd` → nullable, manual (DOM-MD-BIZ-07). Counts omitted from the API. The migration stops with a listing on stored statuses outside the three values. | M4, M12 | Phase 3 base | MVP |
| 5.2 | **Contract lifecycle + overlap.** `activate` / `terminate`; **derived `Expired`** with read-only-after-expiry; **hybrid overlap**: service check under a parent lock (`409 contract_overlap`) **and** the PostgreSQL exclusion constraint (`btree_gist`, skipped on SQLite), MSA-only scope pending confirmation. | M4 | 5.0, 5.1 | MVP |
| 5.3 | **Services, selectors, API.** Remove the unused prefetches (`apps/masterdata/selectors/directory.py:74,82`); thin views; the directory viewsets move to `masterdata.directory.manage`. **The legacy alias is NOT dropped** (the conditions failed: other consumers of the old code exist, DECISIONS D9); it keeps mapping to both manage codes until Phase 8, so `org-admin` is unchanged. Tests: the alias grants only the manage codes, never `hard_delete` or the sensitive codes; no double grant. | H2 (business) | 5.1 | MVP |
| 5.4 | **H1: PII** (rules in DECISIONS "H1"). Mixed endpoints omit sensitive fields; contact endpoints 403; writes 403/400, never ignored; search/filter/ordering on sensitive fields blocked; hidden fields never nulled by PATCH/PUT; **`masterdata.client.view_financial`** for `total_billed_usd` (omit / 403 / name-only audit); `ChangeLog` redaction and no `DETAIL` in DB-error logs (D13); applies to Person and Position too (pulled forward from Phase 6). **Request-log redaction is already done** (`0df7264`). | **H1**, H4 | 5.3 | MVP |
| 5.5 | **Tests.** One-primary constraint; dates; transitions and derived expiry; overlap incl. boundary day and open-ended; **PostgreSQL race: exactly one of two overlapping creates succeeds**; direct-insert refused by the constraint; PII not logged; API matrix; cross-parent access; concurrency on primary contact change; migration forward/backward with data. | M14 | 5.1–5.4 | MVP |

Commit: `masterdata(phase-5): clients and vendors`.

## Phase 6 — Organizational structure and people (**IMPLEMENTED, awaiting approval**; scope global per D1; see DECISIONS "Phase 6 decisions" and "Phase 6 implementation notes")

| WP | Work | Closes | Depends on | MVP |
|---|---|---|---|---|
| 6.1 | **Hierarchy rules** for Department and Position: no self-parent (check constraint), no cycles and a depth limit (service). Code and name uniqueness from Phase 3. | M3 | Phase 3, D-Q1 | MVP |
| 6.2 | **Person ↔ Identity link** [D4]. Link and unlink only through a service action. Email and name come from Identity when linked, so they cannot diverge. No authentication data in Person. Reduced default serializer plus a sensitive-field serializer behind `masterdata.person.view_sensitive` [D9]. | H1, M9, M10 | D4, D9 | MVP |
| 6.3 | **Deactivation instead of deletion** with dependency checks: a department with active teams, persons, positions or external references (production, scheduling) cannot be deactivated without explicit handling. Restore path. | H3 | 6.1 | MVP |
| 6.4 | **Audit.** Service-emitted events; PII fields redacted from snapshots. Replacing the swallowing signal in `apps/audit/signals/change_tracking.py` for masterdata models needs approval [Q4]. | H4 | 6.2, Q4 | MVP |
| 6.5 | **Stored stats** (`utilization_percentage`, `headcount`, …) per [D-Q8]: keep editable, or compute through selectors. | L4 | D-Q8 | Later |
| 6.6 | **Tests.** Link integrity (one person per user, no email divergence); hierarchy cycle rejection; uniqueness; deactivating a person or department with active references; API matrix; IDOR (cannot read sensitive fields without the grant; cannot link someone else's user); migration. | M14 | 6.1–6.4 | MVP |

Commit: `masterdata(phase-6): organizational structure and people`.

## Phase 7 — Organization leftovers cleanup (re-scoped: no table drops)

| WP | Work | Closes | Depends on | MVP |
|---|---|---|---|---|
| 7.1 | Remove leftover references: `seed_demo_data.py:383-398` (org config notes), `test_seed_studiohub.py:298-299` fixture strings, the `PlatformPosition` docstring (`models/position.py:4-7`), the stale comment in `tests/test_global_directory.py:30-35`, the `total_custom_records_across_orgs` computation (keep the key at `0` if the contract needs it [D1]). Rewrite or retire `docs/architecture/ORGANIZATION_MASTER_DATA.md`. | L2 | Phases 3–6 | MVP |
| 7.2 | `scope` column per [D1]: drop it with a reversible migration, or freeze it read-only at `GLOBAL`. Remove `MasterDataScope.ORGANIZATION` and its test usage (`tests/api/test_platform_catalog.py:177-181`). | M2 | 7.1, D1 | MVP |
| 7.3 | Confirm no remaining consumers (grep for org terms in masterdata, seeds, tests, docs); forward and backward migration test on a populated test DB. | — | 7.2 | MVP |

Commit: `masterdata(phase-7): remove organization leftovers`.

## Phase 8 — Integration, hardening, final verification

| WP | Work | Closes | Depends on | MVP |
|---|---|---|---|---|
| 8.1 | Cross-module tests: Identity permissions guard every masterdata write; production and scheduling still read departments, teams and clients; `deliveries.DeliveryPackage.client` still works. | — | Phases 3–7 | MVP |
| 8.2 | Admin: read-mostly registrations; system rows read-only; delete disabled or routed through services. | L1 | Phases 3–6 | MVP |
| 8.3 | OpenAPI: `extend_schema` for archive, restore, DELETE and overview; 4xx error components; schema snapshot test for masterdata paths. | M7 | Phases 3–6 | MVP |
| 8.4 | Catalog caching with version-key invalidation on every write [D7], plus invalidation tests. | — | Phase 3 | Later |
| 8.4b | **Permission cleanup (one commit).** Remove `platform.master_data.configure` / `create`, the alias class and the legacy role grants; update (not delete or skip) the `org-admin` contract test in the same commit; add a test that a holder of only an old code is refused. See DECISIONS D9 rules. | L2 | D9 | MVP |
| 8.5 | Docs: `docs/apps/masterdata.md` (from `docs/APP_ARCHITECTURE_TEMPLATE.md`), `docs/api` updates, an ADR if [D9] or [D4] changes the trust model. | L2 | All | MVP |
| 8.6 | Final verification: migrations forward from an empty DB and forward/backward on a populated test DB; full suite; lint; format and types on changed files; `pip-audit`/`bandit` only if approved (new tools); re-run the AUDIT checklist with evidence. | — | All | MVP |

Commit: `masterdata(phase-8): integration, hardening, final verification`.

## Out of masterdata scope (flag only, need separate approval)

- M11: DB error `DETAIL` (row contents) logged by the core exception handler. Affects every app.
- H4 (part): `ChangeLog` retention and append-only enforcement live in `apps/audit`.
- L6: production statuses and types are free text, not validated against the catalogs.
- L7: `apps/identity/permissions/department.py` always returns `True` and has no callers.
- Test infrastructure: `infrastructure/compose/compose.test.yml` is broken, and pytest ignores `.env.test` (Phase 0 report).

## Dependency summary

```text
Phase 2 decisions (D1–D10, Q1–Q8)
        │
Phase 3 ── 3.1 base ─▶ 3.2 lifecycle ─▶ 3.3 services ─▶ 3.4 API ─▶ 3.9 tests
             │                              ├─▶ 3.6 audit events
             └─▶ 3.7 selectors, 3.8 seed    └─▶ 3.5 permissions
        │
Phase 4 (software) ── reuses 3.x generics
Phase 5 (clients/vendors) ── reuses base + services pattern
Phase 6 (org/people) ── needs D4, D9, Q1
        │
Phase 7 (cleanup) ── after 3–6, so nothing is removed from under live code
        │
Phase 8 (integration, docs, verification)
```

## Open questions affecting this plan

1–8: see `AUDIT.md` §9.
9. **Test runtime:** you haven't yet chosen between the options in my Phase 0 report. A: full suite only at Phase 8, targeted suites per phase. B: `pytest-xdist` (new dependency). C: delete `apps/intelligence/tests`. D: full suite every phase (~16 min). This plan assumes D until you choose.
