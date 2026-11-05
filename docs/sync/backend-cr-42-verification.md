# CR-42: a project's vendor ids are checked, its vendor names are read: verification

Backend on `sync/cr-42-vendor-ids`, frontend on `ui/entity-multi-picker` (which contains the backend branch by
merge `7515e8a4`). **Nothing is merged or pushed.** This changes the backend (CR-42, approved by the owner:
"Approved"). The change request and its evidence are in `backend-change-requests.md`; contract C-56 and decision
D-38 are in `docs/production/`.

## 1. What changed

| Commit | What |
|---|---|
| `7caef313` | CR-42 written |
| `b467da85` | Backend: `vendor_ids` validated, `vendor_names` read-only, 12 tests, OpenAPI snapshot and `openapi.ts` regenerated, contract and decision docs, the capture tool and its sample |
| `7515e8a4` | Merge of the backend into the picker branch |
| (picker commit) | `EntityMultiPicker` and `pickerParts`; `EntityPicker` moved onto the shared parts |
| (form commit) | `multi-entity` field kind, `VendorMultiPicker`, a Vendors field on the project form, tests, registry row |
| (fix commit) | Frontend: after saving an edit the form returns to the record opened (found by the live run, §2b) |
| (this commit) | This report |

### Backend

- **`vendor_ids`** must be live vendor UUIDs, each listed once (`400 {"vendor_ids": ["Unknown vendor: <id>"]}` or `["Vendor listed twice: <id>"]`; a malformed id gives DRF's per-index map `{"0": ["Must be a valid UUID."]}`). `[]` clears the list.
- **`vendor_names`** is read-only and computed from the vendors, so a rename shows at once and a deleted vendor drops out. One query per page, not per row.
- **No migration.** External members still have both fields hidden.
- **A deleted vendor's id stays on the project**, so re-sending the stored list gets a 400 until the id is removed. The frontend therefore sends the list only when it changed.

### Frontend

- **`EntityMultiPicker`** (`components/forms/`): chips with a remove button each, a trigger ("Add…"), the same menu as `EntityPicker` (search inside it, Load more) with a checkmark per chosen option. The menu stays open on a toggle; Backspace in an empty search removes the last chip; footer "n chosen" and "Clear all". A chosen id that is not on the loaded pages is fetched by id once the first page has arrived (most are on it and cost no request); one that no longer exists is an amber chip "Unknown vendor", marked `data-unknown`, that can only be removed.
- **`pickerParts`**: the list behind the menu, the search keys and the menu, shared with `EntityPicker`. `EntityPicker` keeps its props and markup; its 9 tests pass unchanged.
- **`multi-entity` field kind** (`modules/directory`): the form holds the ids comma-joined, `wireValue` sends the list (`[]` for none), `fromRow` reads an array. The required message is "Choose vendors.".
- **Project form**: a Vendors field after Client. External members cannot see it (the backend hides the fields).

## 2. Evidence

| Check | Result |
|---|---|
| Backend tests (`apps/production/tests/test_cr42_vendor_ids.py`) | **12 pass**; the list test counts vendor queries only (exactly 1) |
| Backend mutations | **4 run, 4 caught** |
| Backend regression | `apps/production`, `apps/masterdata`, core contract regression: **2,669 passed**. The full backend suite was not run locally; CI runs it |
| `ruff check`, `basedpyright`, `makemigrations --check` | clean; 0 basedpyright errors in changed files; no migrations |
| Capture | `docs/sync/tools/test_capture_vendor_ids_cr42.py` → `samples/production/_vendor_ids_cr42_flow.json` (create with unknown, duplicate and malformed ids; rename; delete; patch with a deleted id → 400; patch with live ids; clear) |
| Frontend gates | `pnpm typecheck` clean; Biome 0 errors; `pnpm test` **1,205 pass** (117 files); `pnpm build` ok; nothing new unreachable (only tests, `*RowKeys.ts` and helpers) |
| New frontend tests | `EntityMultiPicker.test.tsx` (4): toggle keeps the menu open and orders the chips, Enter / Backspace / Escape, an id off the page is fetched and a deleted one is "Unknown vendor", Clear all. `formModel.test.ts` (3): round trip, `[]`, required. `structure.test.tsx` (4): saved vendors shown by name with the deleted one unknown; removing it sends live ids only (`{vendor_ids: [<live>]}`); renaming alone sends `{name}` and no vendors; a new project sends the vendors in the order picked |
| Frontend mutations | **7 run, 7 caught**: a new id put first instead of last; Backspace removing the first chip; the unknown flag always off (this one **survived** until the chip was marked `data-unknown` and the test asserted it, then it was caught); per-id fetch not waiting for the first page; Clear all removing one; `wireValue` returning the text instead of the list; the field's `onChange` dropping all but one id |
| Responses used | every mock is a captured response (`masterdata/vendors.json`, `production/_vendor_ids_cr42_flow.json`); no hand-written shapes |

### 2b. Live run (producer, throwaway factory-seeded backend)

A throwaway spec (deleted, not committed) drove the real app against the real backend: **passed** (fourth attempt; the first three were my spec's setup, then the bug below).

- Created a project in the browser by picking two vendors through the search box, beta first. The POST carried `vendor_ids` in that order; the stored project has the same ids and `vendor_names` in that order.
- The menu stayed open between the two picks; both showed checkmarks.
- A vendor was then deleted behind the project's back. The project kept both ids and listed one name, as CR-42 says.
- The edit form showed "Unknown vendor" (amber, `data-unknown`) then the live vendor's name.
- A rename alone sent `{"name": …}` and no vendors, so the stored deleted id was not re-sent (it would be a 400).
- After removing the unknown chip, the save sent `{"vendor_ids": [<live id>]}`; the backend accepted it and the stored list and names matched.
- "Clear all" then Save sent `{"vendor_ids": []}`; the stored list was empty.
- **Found by the run, not caused by CR-42:** a saved project edit went to `/projects/undefined` and then `/forbidden`. The project PATCH answers without an `id` (the sample `projects_patch`, captured before CR-42, has none) and the form navigated to `saved.id`. After an edit the form now returns to the record opened. Test: serves the captured PATCH and checks which id the route receives (mutation-checked: with `saved.id` it fails). Backend unchanged.

## 3. Notes and not done

- **Seeded-user note:** the setup in the live run used the MFA superuser (`manager`): `admin` must enrol in two-factor authentication first, and the producer role may not create vendors (403).
- **A toast I did not trace:** the new-project page showed a "Request Failed: not found" toast in the live run before any vendor was deleted. The vendor picker's own requests were 200, and queries are silent by default, so it is not from the picker; the source was not identified.
- **Existing N+1, not part of this CR:** the project list runs one query per row for the supervisor and coordinator profiles (14 queries against 6 expected on a small page). Noticed while writing the list test; the test counts vendor queries only. A candidate for its own CR.
- **Seeds:** `seed_dev.py` wrote vendor codes into `vendor_ids`; it now writes vendor ids (one line; the file has 5 basedpyright errors and was unformatted before, left alone). The two seeds that load the old frontend's mocks are unchanged.
- **Review order:** the picker work is stacked on this backend branch, so merge `sync/cr-42-vendor-ids` first (or `ui/entity-multi-picker` alone, which contains it). Merge and push are separate requests and have not been asked for.
