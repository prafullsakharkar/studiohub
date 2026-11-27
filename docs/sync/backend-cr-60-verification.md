# CR-60: verification

Branch `feature/project-partners`, off `develop` at `6aa9eacd`. Change request: `docs/sync/backend-change-requests.md` CR-60, approved by the owner ("approved", 2026-11-27) with all six items, the delivery client included. A first draft gave a project several clients; the owner chose one client and several vendors.

## What changed

| Where | What |
|---|---|
| `production/validators/partners.py` (new) | The rules, shared by every write path below. `resolve_project_client` returns the UUID and name. `require_project_client` and `require_project_vendor` check a record's client or vendor. `refuse_partners_in_use` names who still uses a client or vendor. Stored values are matched by UUID or by code, ignoring case. |
| `production/api/serializers/project/client.py` (new), `create.py`, `update.py` | `client_id` must be a live client's UUID, or blank. `client_name` is read-only and written by the server. |
| `production/api/viewsets/project.py` | `check_update` refuses a client change, or a vendor dropped, while a delivery, task or member names it. |
| `production/api/viewsets/task.py` | `validate_references` (single and bulk, create and update) checks `vendor_id` against the project's vendors and fills `vendor_name` and `vendor_code`. A stored vendor that is sent back unchanged is not checked again. |
| `deliveries/services/package.py` | With a project, the delivery's client must be the project's client. |
| `production/api/serializers/membership.py` | The add checks `client_id` and `vendor_id`. The edit gains both fields; a blank clears. |
| `masterdata/selectors/directory.py` | `names_by_id` moves to the shared partner selector, so clients have it too. |
| `production/migrations/0019_cr60_project_partners.py` (new) | A data migration that brings existing projects into line (below). `core/tests/test_bootstrap.py` raises production's limit to 19. |
| `production/tests/test_cr60_project_partners.py` (new) | 34 tests. |
| Older tests | Deliveries and members that name a client or vendor now put it on the project first. `test_cr37_member_detail` no longer expects the external ids to be read-only. |
| `docs/sync/tools/test_capture_project_partners_cr60.py` (new) | Writes `samples/production/_project_partners_cr60_flow.json`. |
| frontend `modules/production/work/pickers.tsx` | `useProjectPartners`, read from the project record; `ProjectClientSelect` and `ProjectVendorSelect`. |
| frontend `modules/deliveries/deliveries.tsx` | The Client field shows only the project's client, filled in when the project is picked. |
| frontend `modules/production/work/tasks.tsx` | A Vendor field limited to the project's vendors (it had none). |
| frontend `modules/production/structure/panels.tsx` | Works for on the add form and as a table column. A field refusal shows the server's sentence. |
| frontend `modules/production/components/ProjectWorkspace.tsx` | The project header lists the vendors beside the client. |
| frontend `api/production/structure.ts` | `addMember` and `ProjectMemberPatch` take `client_id` and `vendor_id`. |
| Docs | Production contracts C-74 to C-78, deliveries API-DLV-25, `CLAUDE.md`. |

## The behaviour (captured)

**Project:**
- A client code is 400 "Unknown client.".
- A project created with a client UUID answers with the client's name (a `client_name` that was sent is ignored), and lists its vendors.
- A project with neither has a blank client and no vendors.

**Task vendor:**
- A project vendor is stored with the vendor's name and code, `{"vendor_name": "Northlight", "vendor_code": "VEN-NORTH"}`.
- Another vendor is 400 "This vendor is not on the project.".

**Delivery client:**
- The project's client is 201.
- Another client is 400 "This client is not the project's client.", and so is any client for a project that has none.

**Member:**
- Adding a member with the project's client, or one of its vendors, stores the UUID.
- Anything else is 400 on that field.
- An edit sets a vendor, then clears both, which makes the member internal again.

**Changing the project's partners while in use:**
- dropping a vendor: "Ember FX is still the vendor of 1 member.";
- changing the client: "Acme Pictures is still the client of 1 delivery and 1 member.".

## The migration

`production.0019` is data only and not reversed. For each project:
- it resolves `client_id` by UUID or code and stores the UUID with the name;
- a project with no client takes the single client its deliveries and members all name. If they name several different clients, the client is left blank and counted;
- it adds the vendors its tasks and members name, after the ones already listed.

Values that name nothing live are left as they are, and the migration prints how many. Six tests run the function on rows made after it: a code becomes a UUID, one named client is taken, two are left blank, an unknown value is left and counted, task and member vendors are added in order, and a second run changes nothing.

## Checks

- **Backend tests:**
  - everything in `apps/production`, `apps/deliveries` and `apps/masterdata`, plus `core/tests/test_contract.py`, `test_contract_regression.py` and `test_bootstrap.py`: **4,312 passed**;
  - `test_cr60_project_partners.py`: 34 passed.
  
  Not the full suite (targeted tests only).
- **Lint and types:**
  - `ruff check` is clean.
  - Only files that were formatted at the base, and new files, were formatted. `membership.py`, `task.py` and `test_cr37_member_detail.py` were unformatted at the base, so only their import order was fixed.
  - `basedpyright` shows no new error: the one left in `membership.py:125` was there before.
  - `manage.py check` and `makemigrations --check` are clean.
- **Backend mutation checks**, each caught by a test:
  1. the project's client not checked;
  2. its name not written;
  3. the in-use refusal skipped;
  4. a member naming the client by code not counted;
  5. the task vendor not checked;
  6. a vendor name sent by the client kept;
  7. an unchanged stored vendor checked again;
  8. the delivery client not checked;
  9. the member's client and vendor not checked;
  10. a vendor not limited to the project's list;
  11. the migration taking the first of several clients;
  12. the migration ignoring members' vendors.
  
  One more break was not caught, because it is equivalent: counting deleted deliveries. `DeliveryPackage.objects` already leaves deleted rows out.
- **Frontend checks:**
  - `pnpm typecheck`, `biome check src` (0 errors), `pnpm test` (194 files, 2,206 tests) and `pnpm build` all pass;
  - the unreachable check lists only tests and helpers;
  - `projectPartners.test.tsx` has 12 tests.
- **Frontend mutation checks**, each caught:
  1. no vendors offered;
  2. the client not filled in;
  3. no link to the project's form;
  4. a vendor that left the project dropped from the select;
  5. Works for not clearing the other field;
  6. the generic text for a field refusal;
  7. Works for editable by an artist;
  8. the add form not sending the vendor.

## Not done

- **No live browser run.** The behaviour is captured from the real API layers on the test database.
- **OpenAPI schema:** `frontend/src/core/api/generated/schema/django-openapi.yml` was not regenerated. The member edit's two new fields are typed by hand in `ProjectMemberPatch`, as the other member fields are.
- **The migration's output:** it prints its counts only when something is unresolved. To see beforehand which projects have records naming several clients (read-only):

  ```sql
  SELECT project_id, COUNT(DISTINCT client_id)
  FROM deliveries_package
  WHERE NOT is_deleted AND client_id IS NOT NULL
  GROUP BY project_id
  HAVING COUNT(DISTINCT client_id) > 1;
  ```
