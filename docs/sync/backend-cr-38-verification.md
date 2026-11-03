# CR-38: adding a person who is already a member changes only what the request names: verification

Branch `sync/backend-cr-38` (from `develop` at `02eb9107`), **not pushed, not merged**. This branch **changes the backend** (CR-38, approved by the owner: "Approved CR-38"). The change request and its evidence are in `backend-change-requests.md`.

## 1. What changed (3 source files, +19 / -13)

- `apps/production/api/serializers/membership.py`: `ProjectMembershipCreateSerializer` no longer defaults `status`, `role` and `scope`; an omitted one is absent from the validated data.
- `apps/production/api/views/project_scoped.py` (`ProjectMembersView.post`): passes `None` for what was not sent; `roles` is the sent `roles`, else `[role]` only when a role was sent, else `None`. This view also carried defaults of its own (`or "Artist"`, `or "PROJECT"`, `or "active"`), which is why removing only the serializer's would not have been enough.
- `apps/production/services/project_scoped.py` (`add_member`): `role`, `roles`, `scope` and `status` default to `None`. The existing-member branch already read `x or membership.x`; the create and restore branches already applied the defaults.

Other callers are unaffected: the project creator (`role="Production Admin"`) and the seed command pass their own values. No migration. No frontend change: the add form sends `role`, which still replaces the role.

## 2. Before and after (the same capture script, `tools/test_capture_readd.py`)

A Lead with `roles ["Lead","Artist"]`, added with an explicit status, then added again with only `{"user_id": …}`:

| Status | Before | After | Can open the project |
|---|---|---|---|
| `suspended` | `active`, `Artist`, `["Artist"]` | `suspended`, `Lead`, `["Lead","Artist"]` | `404` before and after the re-add |
| `on_leave` | `active`, `Artist` | `on_leave`, `Lead` | `404` |
| `terminated` | `active`, `Artist` | `terminated`, `Lead` | `404` |
| `active` | `Artist`, `["Artist"]` | `Lead`, `["Lead","Artist"]` | `200` |
| `active`, re-added with `role: "Artist"` (the frontend form) | `Artist` | `Artist` (a named role still applies) | `200` |

(`samples/production/_readd_flow.json` is the capture before the change, `_readd_after_cr38_flow.json` after it. `_membership_show_flow.json` (`other_readd_naive`) and `_member_detail_flow.json` (`readd_plain`) record the older behaviour as well.)

## 3. Evidence

| Check | Result |
|---|---|
| New tests (`apps/production/tests/test_cr38_readd.py`) | **18 pass**: a re-add naming only the person changes nothing for suspended, on-leave and terminated members (and they still cannot open the project) and keeps a Lead's role and roles; a sent role replaces role and roles; sent roles replace roles; a sent status is set, including an explicit `active` reinstating; a show binding leaves status and role alone; a stored scope is kept and a sent one applied; a stored department is kept; a new member still gets `active` / `Artist` / `["Artist"]` / `PROJECT` and a sent role or status is kept; blank role or status count as not named; a removed member added again is restored fresh |
| Mutations | **11 run, 10 caught at once, 1 survivor** (the view's `scope` default: nothing stored a scope other than `PROJECT`), fixed by a test with a stored `EXTERNAL` scope and then caught |
| Regression | production, masterdata, audit and identity API tests: **3,130 pass** (CR-34, 36 and 37 tests among them). The full backend suite was not run locally; CI runs it |
| `ruff` / `basedpyright` | clean; no new violations (services file 73 → 68 warnings, the other two unchanged). I did not run `ruff format` on the three files, which were not formatted at HEAD |

## 4. Not done, on purpose

- **The members panel says "added" for someone who was already on the project.** It could say so and show their status (a suspended person is added but still suspended). A frontend follow-up, not part of this change.
- **No `409` for an add of an existing member.** The add stays idempotent (`200` for an existing member, `201` for a new one), as it was.

## 5. Questions for the owner

1. **Merge** `sync/backend-cr-38` into `develop` and push, then `main`?
2. The panel follow-up above: want it?
