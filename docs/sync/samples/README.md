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
- [`identity/_auth_mfa_flow.json`](identity/_auth_mfa_flow.json) — MFA login: `mfa_required` response (no tokens), challenge success with TOTP and with a recovery code, wrong code (`401 mfa_code_invalid`), missing code (400), missing/garbage challenge (`401 mfa_challenge_invalid`), reused recovery code, `remember_device`. Captured by [`../tools/test_capture_auth_flows.py`](../tools/test_capture_auth_flows.py) (Phase 1).
- [`identity/_auth_password_reset_flow.json`](identity/_auth_password_reset_flow.json) — forgot-password (200 / invalid e-mail 400), reset-password with invalid token, mismatched confirmation, missing fields.
- [`masterdata/_departments_flow.json`](masterdata/_departments_flow.json) — the departments list/create flow: create 201, duplicate code (400 on `code` **and** `name`), duplicate name ignoring case (`uq_name_ci`), missing fields, invalid type, code too long, create/delete as a user without `masterdata.directory.manage` (403), list as that user (200, reads are open), search, ordering, filter, `page_size`, page 2, page out of range (404), invalid filter value (400), delete 204. Captured by [`../tools/test_capture_departments_flow.py`](../tools/test_capture_departments_flow.py).
- [`_misc/conflicts_and_pagination.json`](_misc/conflicts_and_pagination.json) — duplicate code (400), PUT with partial payload (400), 405, delete of a referenced department (409 `has_dependants`), page size default/limit alias/max/out-of-range, unknown ordering, invalid filter value.
- [`INDEX.json`](INDEX.json) — status matrix (admin/anon/norole/artist) per list route.

Frontend tests must build their mocks from these shapes, not from hand-written guesses.

## Known limitation of the Phase 0 captures

The Phase 0 harness redacted any string under a key named like a secret (`password`, `token`, `challenge`, …), which also replaced **validation messages** such as `"password": ["This field is required."]` with `"<redacted>"` in `identity/_auth_flow.json` (`login_missing_fields`), `identity/identity__users.json` and a few `error.code` values. The harness rule is fixed (secrets never contain spaces, messages always do) but those files were not recaptured, to avoid churning every id. The Phase 1 captures (`_auth_mfa_flow.json`, `_auth_password_reset_flow.json`) use the fixed rule. For the standard DRF text see the Phase 1 captures.
