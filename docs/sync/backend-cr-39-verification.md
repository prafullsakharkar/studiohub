# CR-39: an account that owes a password change and MFA enrollment can settle them in order: verification

Branch `sync/backend-cr-39` (from `fix/restricted-session-owing-both`, which is from `develop` at `94d2b66c`), **not pushed, not merged**. This branch **changes the backend** (CR-39, approved by the owner: "Approved CR-39"). The change request and the captured evidence are in `backend-change-requests.md` and `samples/identity/_restricted_both_flow.json`.

## 1. What changed

- `apps/identity/authentication/restrictions.py`, `enforce`: an endpoint is let through when it settles the **first** debt the user owes (password, then MFA enrollment), and the refusal names that debt. Before, it had to settle every debt at once, which left an account that owes both (the superuser `manage.py bootstrap` creates) with only `me` and `logout`.
- `docs/identity/CONTRACTS.md` (SEC-AUTH-06): one sentence on what that means.
- One deliberate narrowing of the CR as written (the union of both debts' endpoints), explained in the CR: the union would have opened MFA setup while the password is owed, which `test_the_password_is_settled_before_the_enrollment` forbids and SEC-AUTH-06 already states.

## 2. Before and after (the bootstrap-style account, a real session from `POST /auth/login/`)

| Call | Before | After |
|---|---|---|
| `GET /auth/me/` | 200 | 200 |
| `POST /auth/change-password/` | **403 `mfa_enrollment_required`** | **200** ("All sessions have been signed out.") |
| `POST /identity/mfa/totp/setup/` while the password is owed | 403 `password_change_required` | 403 `password_change_required` (unchanged on purpose) |
| any other endpoint | 403 (`mfa_enrollment_required`) | 403 `password_change_required` (the first debt) |
| after the change and a new sign-in: MFA setup | (unreachable) | 200; the account then works |

An account that owes only the password or only MFA behaves exactly as before.

## 3. Evidence

| Check | Result |
|---|---|
| New tests (`TestAnAccountOwingBothCanSettleThemInOrder`, `test_restricted_sessions.py`) | **7**: the login reports both debts; the password can be changed first; while it is owed everything else, MFA setup included, answers `password_change_required`; the change ends the session and the next one owes only MFA; after enrolment the account works; an account owing only MFA still cannot change its password; an account owing only the password is unchanged. The 25 earlier tests in the file still pass |
| Mutations | **5 run, 5 caught**: the old every-debt rule, MFA settled before the password, nothing refused, the wrong code reported, and the union of both debts' endpoints (caught by the earlier test that pins "password first") |
| Regression | `apps/identity` and `apps/core`: **1,700 pass**. The full backend suite was not run locally; CI runs it |
| `ruff` / `basedpyright` | clean; `restrictions.py` 19 warnings, the same as at HEAD |
| Live (real backend, fresh seed), `bootstrapAdmin.live` | see §4 |

## 4. Live

`bootstrapAdmin.live` **1 of 1** against a fresh seed, with the new harness user `bootstrap` (a superuser who owes a password change and MFA enrollment): signing in through the real provider lands on the password screen and stays there; the password change succeeds; signing in again with the new password goes to the MFA enrollment screen with the QR code. **Live mutation caught:** with the old every-debt rule restored the password change is refused (403) and the session stays, so the test fails. Before the fix the same flow was a dead end (the screen could not be left) and, before the frontend guard fix, an endless redirect loop ending in the error page.

## 5. Questions for the owner

1. **Merge** `fix/restricted-session-owing-both` (the frontend guard fix and the harness user) and `sync/backend-cr-39` into `develop` and push, then `main`? They go together: the guard fix stops the crash, CR-39 removes the dead end.
2. The dev database's admin was unblocked by clearing its `must_change_password` flag (the owner's go-ahead). It now owes MFA only.
