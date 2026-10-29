# Password policy

Source: `backend/config/settings/components/security.py`, `apps/identity/validators/password.py`,
`services/password.py`, ADR-0038.

| Rule | Value |
| ---- | ----- |
| Length | 12 to 128 characters |
| Reuse | not the current password or any of the last 5 (`PASSWORD_HISTORY_COUNT`); hashes kept in `PasswordHistory`, pruned to the window |
| Composition | the validators in `identity/validators/password.py` |
| Storage | Django password hashers (salted, slow hashes) |

**After an administrator's reset** or a `bootstrap`, `must_change_password` is set. The session is
restricted (`403 password_change_required`) until the user sets a new one; the password is settled before
MFA enrollment.

**Reset by email:** reset tokens are stored hashed and are single use.

**Lockout:** repeated failed logins lock the account temporarily (`LOCKOUT_TIME`, 15 minutes; `LoginAttemptService`).

**Not decided:** periodic expiry (NIST SP 800-63B advises against it) and breached-password screening
(needs an outbound call or a shipped list). See ADR-0038, "Not decided here".
