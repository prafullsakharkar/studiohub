# Phase 16: a person in several teams (CR-32): verification

Branch `sync/phase-16-team-memberships` = `sync/phase-15-person-workspace` + `sync/backend-cr-32` (merged in) + the frontend commits below. **Not pushed, not merged.** The backend change was approved by the owner on 2026-10-31 (CR-32, with my three recommended answers).

## 1. What changed

**Backend** (`sync/backend-cr-32`, CONTRACTS §5.6, DECISIONS D12, `backend-change-requests.md` "Applied: CR-32"):
- `masterdata.TeamMembership(team, person)`, unique per live pair, migration `0002_team_membership` (also makes every live person with a live `team` a member of it).
- `/api/v1/team-memberships/`: list, read, add, remove (soft delete), restore; never edited. Reads: any signed-in user. Writes: `masterdata.directory.manage`. Filters `team`, `person`. Rows carry the team, person, department and office names.
- `Person.team` stays as the **primary team**. Setting it makes the person a member; deleting a person soft-deletes their memberships and restoring brings back the ones removed with them; a team with members cannot be deleted (409 `has_dependants`).
- **One rule I added while building the screens (inside CR-32, flagging it here):** removing the membership of a person's primary team clears `Person.team` (DOM-MD-TM-07). Without it, a person could name a team they had left, and `GET /people/?team=` and the team's member list would disagree.

**Frontend:**
- `teamMembershipsApi`, a hand-written row type with its keys pinned (`directoryRowKeys.ts`) and a contract test on the captured flow (`samples/masterdata/_team_memberships_flow.json`).
- Team workspace, Members tab: `GET /team-memberships/?team=`; Add member is a `POST` (nobody is moved); Remove is a `DELETE`; the server's reason for a refusal (already a member) is shown in the dialog.
- Person workspace, Teams tab: every team, the ones the person is in marked; **Join**, **Leave**, **Make primary**, **Clear primary team**. Leaving the primary team warns that the person will have none.
- `PeopleTab` is now a read-only list for departments and offices (`GET /people/?department=|office=`); the "add/remove by changing the person's team" code from Phase 14 is gone.
- The person Overview calls the field "Primary team".

## 2. Gates

| Gate | Phase 15 | Now |
|---|---|---|
| Backend: `apps/masterdata` + bootstrap + audit | n/a | **1,454 pass**, 1 fails that is not mine (deliveries has 3 migrations; masterdata now has 2, the most that test allows) |
| Backend: ruff / basedpyright | n/a | clean / 0 errors |
| `tsc --noEmit` | 0 | **0** |
| Frontend unit tests | 97 files / 983 | **98 files / 1,000** (+17: 12 contract, 5 screens) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 1 error / 1297 warnings | **1 error / 1301 warnings** |
| Playwright role smoke | 7 of 7 (24 min) | **6 role tests pass in the full run; the phone-width test failed there and passes on its own re-run** (3.0 min). The failure was the harness, not the app: the throwaway backend stops after `SYNC_LIVE_MINUTES` (default 45) and the full run took 48 minutes, so the last routes of the phone-width test were redirected to the sign-in page (its password-reveal button has no name, which the test then reported on 18 routes; the final screenshot is the sign-in page and `backend.log` ends at 45:08). `run_role_smoke.sh` now defaults to 90 minutes |
| Live vitest, fresh seed each | 1 file | `workspaces.live` (3 tests) and `personWorkspace.live` (1): **all pass** |

Mutation checks: backend, 14 tried, 13 caught, 1 equivalent (see the CR note). Frontend, 9 of 9 caught: no leave warning, join sending the wrong person, memberships not narrowed to the person, leave and remove deleting nothing, add changing `person.team` instead, the server's reason hidden, members of every team listed, a typed field missing from the key list.

Live (real backend): a person added to a team from the screen is in both teams and their own `team` is untouched; `?team=` on people is the primary team only; removing the primary team's membership clears the person's team; on the person page Join twice, Make primary (the API reports `team` and `team_name`), Leave the primary (team cleared), then deactivate and reactivate.

## 3. Not done

- Team lists and cards show no member count: the API does not return one for a team. A `member_count` on `Team` (like `contact_count` on clients) would be a small backend request if wanted.
- The Office and Department "People" tabs still follow the person's single department and office, as the API defines them.

## 4. Merge order

`sync/backend-cr-32` is contained in this branch. To land everything: `sync/phase-15-person-workspace`, then this branch (which includes `sync/backend-cr-32`); or merge this branch alone, which brings both. The migration changes the real database when run; the data step is idempotent.
