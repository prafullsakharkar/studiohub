# CR-43: the project list reads supervisor and coordinator profiles with the projects: verification

Branch `sync/cr-43-project-profiles` (from `ui/entity-multi-picker`, which holds the CR text), **not pushed,
not merged**. This changes the backend (CR-43, approved by the owner: "approved CR-43"). The change request and
its evidence are in `backend-change-requests.md`.

## 1. What changed

One line, `apps/production/selectors/project.py`:

```python
return Project.objects.select_related("supervisor__profile", "coordinator__profile").all()
```

The response is identical. Before, each project cost two extra queries (the supervisor's and the coordinator's
`profile`, a reverse one-to-one that `select_related("supervisor", "coordinator")` does not join): `3 + 2n`
queries for a page of n. Now it is 3 for any n. The detail, create and update responses read the same selector.

## 2. Evidence

| Check | Result |
|---|---|
| Queries for 1, 3 and 6 projects (measured before the change) | 5, 9, 15 (12 of them on `identity_profiles`); after: 3, 3, 3 and none on `identity_profiles` |
| New tests (`test_cr43_project_list_queries.py`) | **4 pass**: one project and six cost the same number of queries; no query on `identity_profiles` during the list; names unchanged (display name, then e-mail when the profile has no display name, then empty when there is no user); a user without a profile shows the e-mail. Before the change the two query tests fail, the two name tests pass |
| Mutations | **5 run, 5 caught**: `__profile` dropped from both relations, from the coordinator only, from the supervisor only (each fails both query tests); the supervisor's e-mail fallback and the coordinator's e-mail fallback each replaced by an empty string (each fails the name test) |
| Regression | `uv run pytest --no-cov apps/production apps/masterdata`: **2,656 passed**, 0 failed (5 min 16 s). The full backend suite was not run locally; CI runs it |
| `ruff check`, `manage.py check`, `makemigrations --check` | clean, no changes |
| `ruff format`, `basedpyright` | My lines are formatted. `selector/project.py` was already unformatted at HEAD (one other hunk, left alone) and has one basedpyright error at HEAD (`dict` without type arguments, line 85); no new errors (the new test file adds warnings only) |

## 3. Not done

- Other list endpoints may read a profile the same way; this CR covers the project list only and nothing else was checked.
