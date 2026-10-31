# Phase 17: the team member count (CR-33): verification

Branch `sync/phase-17-team-member-count` (from `develop` at `b8412eec`, which holds Phases 14 to 16), **not pushed, not merged**. Backend change approved by the owner ("go ahead with CR-33").

## 1. What changed

- **Backend (CR-33, CONTRACTS DOM-MD-TEAM-05):** `GET /teams/` and `GET /teams/{id}/` carry a read-only `member_count`: the team's live memberships, counted in the same query (no extra query per row). A person in two teams counts once in each; a removed membership does not count. No migration.
- **Frontend:** `Team` gains `member_count` (pinned in `directoryRowKeys.ts`, compared with the captured responses); the teams list has a **Members** column (and in the CSV export), the team overview a **Members** value, and each team card on a person's Teams tab "N members".

## 2. Gates

| Gate | develop | Now |
|---|---|---|
| Backend: masterdata + bootstrap + audit + scheduling | n/a | **2,078 pass**, 1 fails that is not mine (the deliveries migration-count test) |
| Backend: ruff / basedpyright | | clean / 0 errors |
| `tsc --noEmit` | 0 | **0** |
| Frontend unit tests | 98 files / 1,000 | **98 files / 1,004** |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 1 error / 1301 warnings | **1 error / 1301 warnings** |
| Live vitest, fresh seed | | `workspaces.live` (3 tests) **pass**: a team reports 1 member after one is added from the screen and 0 after the removal, and the other team keeps 1 |

Mutation checks, 6 of 6 caught: backend (a removed membership counted; the count taken from `persons`; the field left out of the response) and frontend (the list showing capacity as members; the overview showing the wrong number, first missed because the sample's capacity and count were both 1, now uses a distinct count; `member_count` missing from the pinned keys).

Real responses: `samples/masterdata/_team_memberships_flow.json` (`teams_list`, `team_detail`).
