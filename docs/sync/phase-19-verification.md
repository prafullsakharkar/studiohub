# Phase 19: the artist rule (CR-34) and the bulk-update finding (CR-35): verification

Branch `sync/phase-19-artist-rule` = `sync/backend-cr-34` (from `develop` at `598e19a5`, which holds Phase 18) + the frontend commit below. **Not pushed, not merged.** The backend change was approved by the owner ("Yes and approved").

## 1. CR-34, applied (backend)

A shot's or asset's `assigned_artist` must now be an **active member of the record's project**, as a task's assignee already had to be (contract C-51, decision D-33, `docs/sync/backend-change-requests.md`).

- `require_assignable_artist` (`apps/production/validators/references.py`) is called from the shot and asset `validate_references` hooks, so it covers create, update and the bulk-create and bulk-update items.
- Only a **new** artist is checked: a write that leaves the stored artist alone, or sends them back, still goes through, so a record whose artist has left the project stays editable. `null` unassigns. Platform administrators pass, as for tasks.
- Evidence (running backend, `samples/production/_workspaces_flow.json`): `shot_assign_non_member_400` and `asset_assign_non_member_400` answer 400 `{"assigned_artist": ["Unknown user."]}`; a member is accepted.

## 2. CR-35, found while testing CR-34, **not applied, needs your approval**

`POST /shots/bulk-update/ {"items": [{"id": X, "data": {"description": "..."}}]}` answers 200, `successful: 1`, `actionTaken: "updated"`, and **changes nothing**; the same item with the fields beside the id (`{"id": X, "description": "..."}`) applies them (`bulk_update_wrapped` and `bulk_update_flat` with a read-back of the shot). The same shared service serves assets, episodes and sequences. The earlier capture (`_work_flow.json` `shots_bulk_update`) used the wrapped shape, so its "success" proved nothing. **No screen calls bulk-update today**, so nobody is hurt yet. Proposed diff and reasoning are in the CR doc: read the fields from `data` when it is a dict, and refuse an item with no updatable field instead of reporting "updated".

## 3. Frontend (in this branch)

- The typed `bulkUpdate` now spreads the fields beside the id (the only shape the route applies); its callers keep the `{id, data}` shape.
- The assign dialog's comment and behaviour: a refusal is shown under the field and the dialog stays open (test from the real 400 body).
- `workspaceContracts.test.ts` pins the captured behaviours the shot and asset pages rely on (the artist rule, approve only from Pending Review, an archived record answering 404, DELETE being the same soft delete, notes and their search, the bulk-update finding). If CR-35 is applied, the last test is expected to fail and says what to update.

## 4. Gates

| Gate | Result |
|---|---|
| Backend: production + masterdata + bootstrap | **2,558 pass**, 1 fails that is not mine (the deliveries migration-count test) |
| Backend: new tests | 16 (`test_cr34_artist_membership.py`: shots and assets; assign and unassign, a non-member, a member of another project, an inactive member, create, an artist who left, bulk create, bulk update) |
| Backend mutations | 5 of 5 caught (artist never checked; an unchanged artist checked too; an unassign checked; shots skip the check; assets skip the check) |
| Backend ruff / basedpyright | clean / 0 errors |
| `tsc --noEmit` | **0** |
| Frontend unit tests | **102 files / 1,029** (+6) |
| `pnpm build` | **OK** |
| Biome (`src`) | **1 error (the same) / 1197 warnings** |
| Frontend mutations | 2 of 2 caught (the wrapped bulk-update shape; the refusal hidden) |
| Live vitest, fresh seed | `entityWorkspaces.live` (2 tests) **pass**, including: a user who belongs to another project only is refused (400) as the artist of a shot and of an asset, and the shot stays unassigned |
| Playwright role smoke | **not re-run**: no route and no page changed in this phase (a backend rule, a request shape that no screen sends, and one dialog's error text). Say if you want it |

## 5. Questions for the owner

1. **Merge** `sync/phase-19-artist-rule` into `develop` and push?
2. **Approve CR-35** (bulk-update reads `data`, and refuses an item with nothing to update)?

## 6. CR-35 applied (approved by the owner after this report)

Branch `sync/backend-cr-35` (from `develop` at `8afa61fa`, which holds this phase). `bulk-update` now reads the fields of a wrapped item (`{id, data: {...}}`) as well as flat ones, and an item with nothing to update is reported `invalid` instead of "updated" (contract C-52, decision D-34). 22 new tests, 4 of 5 mutations caught (the fifth is equivalent), production, masterdata and bootstrap suites 2,580 pass plus the known deliveries failure, ruff clean, basedpyright 0 errors. The frontend contract test now pins the fixed behaviour; the typed `bulkUpdate` keeps sending fields beside the id, which works before and after.

