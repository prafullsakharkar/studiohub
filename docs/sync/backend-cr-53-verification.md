# CR-53: verification

Branch `sync/cr-53-partner-reads`, off `sync/phase-29-workflow-board` at `d00a62a7`, **not** `develop`: the CR text sits on top of CR-51 and CR-52, which are only on that branch. Merging this branch into `develop` therefore also brings frontend phases 29 to 33 (`7930d0ff`, `d00a62a7`). Change request: `docs/sync/backend-change-requests.md` CR-53, approved by the owner ("approve CR-53", 2026-11-12).

Contracts and decisions:
- masterdata SEC-MD-01 and D-CR53 (`docs/masterdata/`);
- production C-67 and D-07 (`docs/production/`);
- deliveries PLAN §6;
- pre-deploy checklist: run `init_platform` after deploying.

## What changed

| Where | What |
|---|---|
| `masterdata/constants/permissions.py` | `PARTNER_VIEW = "masterdata.partner.view"`. |
| `masterdata/api/viewsets/partners.py` | `read_permissions = (P.PARTNER_VIEW,)` on `ClientViewSet`, `VendorViewSet` and `_ContractViewSet` (client and vendor contracts). Writes, contacts and the field gates are unchanged. |
| `core/management/commands/init_platform.py` | The code is in the catalog. org-admin (`DIRECTORY_CRUD_PERMISSIONS`), production-admin and vfx-supervisor hold it. `delivery.view` is removed from `PRODUCTION_ARTIST_PERMISSIONS`. `WITHDRAWN_GRANTS["artist"] = ("delivery.view",)`. |
| `production/selectors/dashboard.py` | `build(project, *, include_deliveries)` is required. Without it, the counts, the cards, the next delivery deadline and the delivery rows in the activity all read from the empty provider. |
| `production/selectors/delivery_figures.py` | `NO_DELIVERIES`: the empty provider, now shared. |
| `production/api/viewsets/project.py`, `api/views/project_scoped.py` | Both dashboard routes pass `has_permission_code(request, delivery_figures().view_permission)`. |
| `frontend/src/core/api/generated/` | Schema and types regenerated: eight GET operations now document 403. That is the only difference from the committed schema. |

## Evidence after the change

Same capture as the CR (`tools/test_capture_partner_reads_cr53.py`, pytest test database, rolled back), run again on this branch:

| Request | Artist | Lead |
|---|---|---|
| `clients/` list and detail, `vendors/`, `client-contracts/` list and detail, `vendor-contracts/` | 403 | 403 |
| `client-contacts/` | 403 | 403 |
| `deliveries/?project=CRT` | 403 | 200, `client_name: "Acme Pictures"` |
| `projects/{CRT}/dashboard/` `deliveries` | `{total: 0, upcoming: 0, delivered: 0, late: 0, items: []}` | 1 card, `recipient: "Acme Pictures"` |

The committed sample `samples/masterdata/_partner_reads_cr53.json` keeps the responses from *before* the change, as the CR's evidence.

## Tests

**New: `masterdata/tests/api/test_cr53_partner_roles.py` (33)**, against the real seeded roles:
- The four reading roles list and open all four routes.
- Lead, artist and org member get 403 on list, detail and a missing id.
- A supervisor reads contracts without `value_usd` / `total_value_usd` / `total_billed_usd`, and a producer reads the values.
- An artist still reads the client name of their project.
- A producer still creates a delivery for a client, and a lead reads its `client_name` but gets 403 on the client itself.
- An artist gets 403 on deliveries.

**New: `production/tests/test_cr53_dashboard_deliveries.py` (8)**, both dashboard routes:
- An artist gets empty figures: no cards, zero summary counts, no delivery deadline, no `DeliveryPackage` activity, and the delivery's name nowhere in the response.
- A lead gets all of them.
- The artist still sees `project.client_name`.
- Every other section is the same for both.

**`core/tests/test_init_platform_withdrawn.py` (+2):**
- An artist role seeded before CR-53 loses `delivery.view` on the next run, and the holder's cached permission goes with it.
- The lead keeps it, and a second run withdraws nothing.

**Updated to the new rule.** No test was deleted or skipped.
- `test_partner_api.py`, `test_contract_api.py`: the reader holds `partner.view`, and each file has a new "a plain user reads nothing" test (list, detail, missing id).
- `test_legacy_codes_retired.py`: reads answer as for any user, 403 for clients and vendors.
- `test_role_grants.py`: org-admin's and production-admin's sets, plus two new tests (supervisor holds `partner.view` only; lead, artist and member do not).
- `deliveries/test_permission_matrix.py`, `production/test_permission_matrix.py`: the artist row.
- `test_provider.py`: passes `include_deliveries=True`.
- `test_contract_regression.py`: the client list shape, read with the code.
- The masterdata schema snapshot.

## Results

- **Targeted run** (no full suite, per the project rule): `apps/core`, `apps/masterdata`, `apps/deliveries`, `apps/production`, and the permission-matrix and calendar-scope tests of publishing and scheduling, plus identity `test_login_history.py`.
  - **3887 passed, 1 failed** (`test_client_list_shape`, a plain staff user reading clients). It was fixed as listed above and passes (17 in its file).
  - The new and changed files pass: 33 + 8 + 10 + 74.
- **Mutation checks (11 of 11 killed).** For each mutant, the named tests fail and the file was restored after:
  - client reads open, vendor reads open, contract reads open;
  - each dashboard route always passing `include_deliveries=True`;
  - the next deadline, the activity or the cards reading the real provider;
  - no artist withdrawal;
  - the supervisor without `partner.view`;
  - the lead with `partner.view`.
- **Static checks:**
  - `ruff check .` and `manage.py check` are clean, and `pnpm typecheck` (frontend, after the types were regenerated) is clean.
  - `ruff format --check`: no new violations. The four files that would be reformatted were already unformatted at HEAD; `test_partner_api.py` was formatted.
  - `basedpyright` on the changed source files: 8 errors, all pre-existing bare `dict` / `list` / `set` annotations in `dashboard.py`, none on a changed line.

## Not done here

- **The browser role smoke** (`tools/run_role_smoke.sh`) was not run. Its spec expects `/deliveries` to be shown to the artist, and the frontend still offers Clients and Vendors to every role (`permissionMap.ts` maps them to `open`). Both change in the frontend follow-up, and the smoke is that phase's gate.
- **The frontend follow-up itself (CR-53, "Then, frontend"):**
  - `page.clients`, `page.vendors`, `client.view` and `vendor.view` map to `masterdata.partner.view`;
  - the deliveries list's Client filter shows only to holders of that code;
  - the dashboard's delivery widgets show only with `delivery.view`;
  - the role smoke spec is updated.

  Until then, leads and artists see an error state on the Clients and Vendors pages.
- **Not changed, noted while building it:**
  - `GET /projects/{id}/statistics/` still returns a delivery count (a number, no names) to anyone with `project.view`.
  - The dashboard's `project.budget_usd` is returned to every internal member who can read the project.
  - Neither is part of CR-53; say if either should be a CR of its own.
