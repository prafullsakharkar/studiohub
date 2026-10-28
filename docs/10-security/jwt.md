# Tokens and sessions

How a signed-in browser or client is identified. Source: `backend/config/settings/components/jwt.py`,
`apps/identity/authentication/`, ADR-0036, ADR-0038.

## Access and refresh tokens

| Setting | Value |
| ------- | ----- |
| Access token lifetime | 30 minutes |
| Refresh token lifetime | 7 days |
| Refresh rotation | on; the previous refresh token is blacklisted after use |
| Idle timeout (`SESSION_IDLE_TIMEOUT_MINUTES`) | 120 by default; a session with no authenticated request for that long cannot be refreshed. `0` turns it off |
| Absolute lifetime | 30 days from login, however often it is refreshed |

Tokens are bound to a server-side session (`SessionBoundJWTAuthentication`): once the session has ended
or been revoked, its tokens stop working without waiting for them to expire.

## Restricted sessions

While a user owes a password change or an MFA enrollment, every endpoint except the ones that settle it
(`auth/me`, `logout`) answers `403` with a `code` (`password_change_required` or `mfa_enrollment_required`).
The check is in the authenticator, so no view can forget it (ADR-0038).

## Other credentials

API keys and personal access tokens are separate credentials: stored only as HMAC-SHA256 digests keyed by
`API_KEY_PEPPER`, limited to the scopes they were created with, and not sessions (ADR-0036). The
authentication order is session JWT, personal access token, API key.

## Not in this repository

Token signing key management and rotation are part of `DJANGO_SECRET_KEY` handling
(see `secrets-management.md`).
