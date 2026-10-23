# ADR-0035: Identity Owns the Only Login History

- **Status:** Accepted
- **Date:** 2026-10-22
- **Decision Makers:** Product owner (explicit instruction), Architecture Team
- **Supersedes:** Decision A4 in `docs/identity/CONTRACTS.md` (previously: delete the identity model, keep `apps.audit.LoginHistory`)
- **Superseded By:** None

---

# Context

Two models recorded the same thing. `apps.audit.LoginHistory` was written on
every session creation and served at `/api/v1/audit/login-history/`;
`apps.identity.LoginHistory` had a table and an admin but no writer
(AUDIT.md row 19). Decision A4 resolved this by deleting the identity model.

The product owner reversed that choice: identity is the authentication domain
and should own its own history, and the audit copy, its URL and its stored
rows should be removed.

# Decision

1. `apps.identity.LoginHistory` is the only login history. Its service
   (`LoginHistoryService`) writes one `success` row per created session and is
   the read source for `AuthenticationSelector.get_login_history` / the
   dashboard.
2. `apps.audit.LoginHistory` is removed with its service, selectors,
   serializers, filters, validators, choices, admin and tests.
3. The `/api/v1/audit/login-history/` route is removed (no replacement route
   is added; no consumer of it exists in the backend).
4. Migration `audit.0006_delete_loginhistory` drops the `login_history` table.
   **Existing rows are not copied** — this is deliberate and was requested.
5. Identity's history is append-only (model-level `save`/`delete` guards,
   view-only admin) with a retention window,
   `IDENTITY_LOGIN_HISTORY_RETENTION_DAYS` (default 365), enforced by the
   `identity.cleanup` job. Failed attempts remain in the `LoginAttempt` ledger
   (username, IP, user agent, precise reason, its own retention) and are not
   duplicated into history.

# Consequences

- The audit app no longer owns authentication events; audit remains the home
  of audit logs, change logs, activity, API requests, error logs and tracking.
- Historical login rows held in the audit table are gone after the migration is
  applied to a database. Reversing the migration recreates an empty table.
- Anything that needs to *read* history over HTTP must add an identity-owned
  endpoint; none exists yet.
- Append-only is enforced at the model level for single rows; bulk queryset
  mutation is not guarded for this model (unlike `SecurityEvent`), because the
  retention job deletes by queryset.
