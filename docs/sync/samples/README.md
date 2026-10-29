# Real backend response samples

Captured 2026-10-29 by [`../tools/test_capture_samples.py`](../tools/test_capture_samples.py) against the pytest test database (rolled-back transaction, seeded with `init_platform` + the backend's test factories). Synthetic data only; tokens, secrets, passwords and e-mail addresses are redacted, long strings truncated, lists trimmed to two rows (`_results_total_in_page` / `_len` record the original size).

Layout: `<app>/<path-with-__-separators>.json`, one file per list route. Each file holds these keys when applicable:

| Key | Principal | Request |
|---|---|---|
| `list_admin` | superuser | `GET <list>` |
| `list_anon` | anonymous | `GET <list>` (expect 401) |
| `list_norole` | user with no roles | `GET <list>` |
| `list_artist` | user with the seeded `artist` role | `GET <list>` |
| `detail_admin` | superuser | `GET <list><first id>/` |
| `detail_404` | superuser | `GET <list><random uuid>/` |
| `create_empty_400` | superuser | `POST <list>` with `{}` (shows required fields) |
| `create_norole_403` | no-role user | `POST <list>` with `{}` |

Bare-array responses are wrapped as `{"_bare_list": true, "_len": N, "items": [...]}` so they can be told apart from DRF pages (`{count, next, previous, results}`).

Special files:
- [`identity/_auth_flow.json`](identity/_auth_flow.json) — login, bad password, missing fields, `me` via real JWT, invalid PATCH, refresh, refresh-token reuse (session revoked), garbage tokens, `me` for superuser/artist.
- [`identity/_auth_logout_flow.json`](identity/_auth_logout_flow.json) — clean logout, `me`/refresh after logout, forgot-password anti-enumeration.
- [`_misc/conflicts_and_pagination.json`](_misc/conflicts_and_pagination.json) — duplicate code (400), PUT with partial payload (400), 405, delete of a referenced department (409 `has_dependants`), page size default/limit alias/max/out-of-range, unknown ordering, invalid filter value.
- [`INDEX.json`](INDEX.json) — status matrix (admin/anon/norole/artist) per list route.

Frontend tests must build their mocks from these shapes, not from hand-written guesses.
