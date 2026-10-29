# Phase 3 — Masterdata (directory + catalog): verification

Branch `sync/phase-3-masterdata` (from the Phase 2 tip; `git log sync/phase-2-identity..HEAD` lists the 12 commits), **not pushed**. Backend files changed this phase: none. (CR-12, approved with "go", was committed on the Phase 2 branch before this one started.)

## 1. Exit criteria

| Criterion | Result | Evidence |
|---|---|---|
| Every directory screen paginates, filters and orders with the backend's parameter names | ✅ unit + live | `DirectoryListPage` on teams, offices, positions, people, clients, vendors: `page`, `page_size`, `search`, `ordering`, backend filters (`is_active`, `is_headquarters`, `is_managerial`, `status`, `department`, `team`, `office`); the old pages fetched page 1 and filtered it in the browser. Live: search finds the new team on the server |
| Every catalog screen filters and orders with the backend's names | ✅ unit + live | `/platform/catalog/*`: `status`, `search`; slash-less routes; reorder sends the whole visible order |
| Pickers reusable by Phase 5+ | ✅ | `components/forms/EntityPicker` (server search, Load more, saved value resolved with `fetchOne`) + `modules/directory/pickers` for department, team, office, position, person, client, vendor; used live by the team form |
| Sensitive-field visibility | ✅ captured + live | people: email/phone/date of birth/nationality/clearance; clients: total billed. Forms render them only for holders; mutation-checked |
| 409 `has_dependants` UX | ✅ unit + live | list delete shows the server's reason; live: a department referenced by a team answers 409 "Still referenced by …" |
| Contracts: activate / terminate / adjust-end-date; people: deactivate / reactivate / restore | ✅ live | contract Draft → Active → end date corrected → Terminated, `status` refused on PATCH; person deactivate then reactivate through the list |
| Catalog: archive / restore / reorder / software versions | ✅ live | create → archive (`status`, not `is_archived`) → restore → reorder → delete; version create on the nested route |
| Quality gates | ✅ | below |

Live (`masterdata.live`, 6 tests) plus the earlier files re-run on fresh seeds: `identityAdmin` 4/4. `departments.live` expects exactly the rows it creates, so it fails (33 ≠ 32) if it shares a server with `masterdata.live`; run each file on a fresh seed.

## 2. Quality gates

| Gate | Phase 2 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 67 files / 412 | **70 files / 498** (+ 5 live files / 42 tests) |
| `pnpm build` | OK | **OK** |
| Biome | 2 errors / 3691 warnings | **2 errors (the same two) / 3612 warnings** |
| Net size (frontend) | | 59 files, +3,085 / −3,865 |

Mutation checks that fail as intended: removing the field-permission filter (2 tests), dropping the picker's server search, restoring the "reset on every refetch" behaviour.

## 3. What was built

| Area | Where |
|---|---|
| Typed API | `api/masterdata/{resource,directory,catalog}.ts`; contract tests against 17 captured schemas incl. the sensitive-field subsets |
| Directory pages | `modules/directory/{DirectoryListPage,DirectoryFormPage,FieldInputs,formModel,types}` + `entities/{teams,offices,positions,people,clients,vendors}` |
| Related records | `modules/directory/RelatedRecords.tsx` + `entities/partners.tsx`: client/vendor contacts and contracts inside the existing workspace tabs |
| Catalog admin | `modules/catalog/{CatalogAdminPage,CatalogTable}.tsx`, `/platform/catalog[/:kind]`; `/platform/master-data/*` and the master-data tabs of `/platform/admin/*` redirect to it |
| Positions | new list/create/edit routes, registry entries, sidebar item |
| Admin security (deferred from Phase 2) | superuser-only card on the person Account section: the login's sessions and MFA reset |

## 4. Removed (no silent deletions)

| What | Why |
|---|---|
| Hand-written list/create/edit pages for teams, offices, people, clients, vendors (~1,900 lines, replaced in place) | fetched one page and filtered in the browser, used the legacy `masterDataApi`, mock-only fields; replaced by the config-driven pages |
| The four client/vendor contacts/contracts tabs' bodies (~860 lines) and `vendors/hooks/useVendorRegistryData.ts` | mock-backed hooks with client-side activity shims; replaced by `RelatedRecords` |
| `clients/__tests__/ClientCreatePage.test.tsx`, `vendors/__tests__/VendorCreatePage.test.tsx` | tested the removed pages through a mocked hook; behaviours are covered in `directory/__tests__` |
| `modules/access/components/ProductionRoleSelect.tsx` | the last file of the old access module; only the removed person pages used it |

Separate commits: `b02e87e2`, `52cb102c`.

## 5. Findings (details in backend-change-requests.md)

- Q-13 catalog envelopes (archive/restore wrapped, delete soft with 200, soft-deleted rows unreachable); Q-14 contracts are born Active unless `status: 'Draft'` is sent; Q-01 confirmed.
- **Bugs of mine found by the live run and fixed:** the edit form reset on every background refetch and discarded typing (the live team edit silently kept the old value); the catalog API typed archive/restore as bare rows; assumed 400 where the backend answers 409 (system rows, edits to a Terminated contract).
- **Pre-existing:** the old catalog shell read `is_archived`, a field the API never sends, so archived rows looked Active.

## 6. Deferred / not done

- The team/office/client/vendor/person **workspace** pages (detail views and their overview/activity tabs) still read through the legacy `masterDataApi` hooks; they are retired page by page with Phases 4-5.
- Person `skills` (a JSON list) is not editable in the new form.
- The rest of `PlatformAdminPage` (roles/org structure, pipeline, theme, layout, DB schema) is Phase 11.
- `core/masterData/useMasterData.ts` (821 lines) still has consumers; remove with Phase 11.
- Q-08 (admins can deactivate themselves) is **not applied**: `user_admin_guard.py` documents self-action as intended. Needs a decision.
