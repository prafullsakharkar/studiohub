# CR-57: verification

Branch `feature/project-members-tab`, off `develop` at `c0f6e292`. Change request: `docs/sync/backend-change-requests.md` CR-57, approved by the owner ("Approved", 2026-11-26). The frontend part (search, sort, person and role dropdowns on the Members tab) is the branch's first commit, `0c5ccfe4`.

## What changed

| Where | What |
|---|---|
| `production/api/serializers/membership.py` | `_user_display_name(user, person_names=None)`: the profile's `display_name`, else its first and last name, else the linked live person's `name`, else the e-mail. Without `person_names` it looks the one person up. |
| `production/api/views/project_scoped.py` | The members list selects `user__profile` and passes every member's person name to the serializer, found in one query. |
| `masterdata/selectors/directory.py` | `PersonSelector.names_by_user(user_ids)`: login id → the live person's name, one query. |
| `production/api/serializers/project_note.py` | A note's mentions use the same name; the people of a page of notes are looked up once (shared in the serializer context). |
| `masterdata/api/filtersets/people.py`, `viewsets/directory.py` | `PersonFilter`: the existing `status, department, team, office` and the new `has_user`. |
| `production/tests/test_cr57_member_name.py` | New, 11 tests. |
| `docs/sync/tools/test_capture_member_name_cr57.py` | New capture: `samples/production/_member_name_cr57_flow.json`. |
| frontend `structure/panels.tsx` | The person dropdown sends `has_user=true`; the unit tests use the captured rows and check the filter. |
| frontend `test/live/production.live.test.tsx` | A person with no login is no longer offered: the search for them answers "Nothing matches". |

## The behaviour (captured)

- `GET …/members/`, four members: `Dee Display` (profile display name), `Fay Last` (profile first and last name, no display name), `Priya Person` (blank profile, linked person), and the e-mail for the one with neither.
- `POST …/members/` (201) and `PATCH …/members/{id}/` answer with `Priya Person` too.
- `GET /people/?has_user=true` lists only Priya Person; `?has_user=false` only Omar Offline (no login); without the filter, both.
- A soft-deleted person does not name a member; a person with a blank name does not either.

## Checks

- `uv run pytest` on `test_cr57_member_name.py`, `test_cr36_member_show.py`, `test_cr37_member_detail.py`, `test_project_membership_canonical.py`, `test_project_creator.py`, `test_rp2_notes.py`, `notifications/tests/test_rp6_notifications.py` and `masterdata/tests/api/`: 615 passed. Not the full suite (targeted tests only).
- `ruff check` clean on the changed files; files that were formatted at the base are formatted again (the others were left as they were). `basedpyright` reports one error on the changed files, at `membership.py` `_MemberRefsMixin` (`self.context`), which is on `develop` already.
- Mutation checks, each caught by a test: no display name; no first and last name; no person name; per-row person lookups in the list (query count); the `has_user` filter inverted; the frontend dropdown without `has_user`. Not caught, and equivalent: dropping `is_deleted=False` from `names_by_user` (the default manager already leaves soft-deleted people out).
- Frontend: `pnpm typecheck`, `biome check src` (0 errors), `pnpm test`, `pnpm build`; live `memberReadd`, `memberShow` and `production` (the members test) against the throwaway backend.

## Not changed, noted while building it

- The dashboard's names (`selectors/dashboard.py` `_user_display_name`: supervisor, coordinator, artists) still fall back from the display name to the e-mail.
- `production.live` "notes, overview counts and the project History" fails on `develop` too: it looks for a `Subject` field that is now inside the Add note dialog.
