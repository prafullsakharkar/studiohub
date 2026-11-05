# CR-44: nine list endpoints read each row's related records with the rows: verification

Branch `sync/cr-44-list-queries` (from `docs/cr-44-list-queries`, which holds the CR text), **not pushed, not
merged**. This changes the backend (CR-44, approved by the owner: "CR-44: approve"). The change request and its
evidence are in `backend-change-requests.md`.

## 1. What changed

Nine one-line `select_related` additions, each in the selector the list reads (no API change, no migration):

| Endpoint | Selector | Now joins |
|---|---|---|
| `audit/activities/`, `audit/change-logs/`, `audit/error-logs/`, `audit/tracks/`, `audit/api-requests/` | `apps/audit/selectors/` | `user__profile` |
| `audit/audit-logs/` | `apps/audit/selectors/audit_log.py` | `actor__profile` (its user field is `actor`) |
| `identity/users/` | `apps/identity/selectors/user.py` | `profile` |
| `settings/definitions/` | `apps/settings/selectors/definition.py` | `category` |
| `settings/system-settings/` | `apps/settings/selectors/system.py` | `setting` (the relation to the definition) |

Before, each row cost one to two more queries (the user, then the profile that `User.full_name` reads; the
category; the definition): 4 to 14 queries from 1 row to 6 for the audit lists, 4 to 9 for users, 3 to 8 for
definitions and system settings. Now each costs the same at 1 row and at 6.

## 2. Evidence

| Check | Result |
|---|---|
| New tests (`apps/audit/tests/test_cr44_list_queries.py`, `apps/identity/tests/test_cr44_user_list_queries.py`, `apps/settings/tests/test_cr44_list_queries.py`) | **18 pass**: for each endpoint, 1 row and 6 rows cost the same number of queries; the names in the response are unchanged (a user with a profile is named from it, one without by e-mail; the category name and code; the setting name and code) |
| Mutations | **9 run, 9 caught**: each `select_related` replaced by `all()` (or removed) fails the count test of its own endpoint, and only that one; the name tests keep passing, so a test failing means a query count, not a changed answer |
| Regression | `uv run pytest --no-cov apps/audit apps/identity apps/settings`: **1,958 passed**, 0 failed (1 min 56 s). The full backend suite was not run locally; CI runs it |
| `ruff check`, `manage.py check`, `makemigrations --check` | clean, no changes |
| `ruff format`, `basedpyright` | the three new test files are formatted. The nine selectors were already unformatted at HEAD (checked from `git show HEAD:`) and were left as they are, so only the one changed line in each is mine. basedpyright: 0 errors on the changed files |

## 3. Not done

- **The flat aliases** (`audit/`, `activity/`) were not measured; they read the same selectors, so the audit selector change should reach them, but that was not counted.
- **Still not measured** (no test factory, or another shape): deliveries, publishing and scheduling lists, automation rules and task templates, the platform master-data lists, API keys, personal access tokens, trusted devices, the admin session list, and any list with filters, search or ordering applied.
- **Concurrency:** one test run overlapped with the regression run on the same test database; both passed, and the regression run was not repeated.
