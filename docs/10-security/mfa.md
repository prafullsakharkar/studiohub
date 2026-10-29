# Multi-factor authentication

Time-based one-time passwords (TOTP) with recovery codes. Source: `backend/apps/identity/services/mfa/`,
`config/settings/components/security.py`, ADR-0038.

## Who must use it

| Group | Setting | Default |
| ----- | ------- | ------- |
| Staff | `MFA_REQUIRE_STAFF` | required |
| Superusers | `MFA_REQUIRE_SUPERUSER` | required |
| Vendor and client project members | `MFA_REQUIRE_EXTERNAL` | required |
| Every account | `MFA_REQUIRE_ALL` (environment) | off; the production templates turn it on |

A required user who has not enrolled gets a restricted session (`403 mfa_enrollment_required`) until they
do; see `jwt.md`.

## Login flow

A correct password for an MFA-enabled account returns a short-lived challenge (5 minutes, no session, no
API access). A valid TOTP code or recovery code exchanges it for a session.

## Controls

- **Lockout:** 5 failed attempts lock MFA verification for 15 minutes.
- **Recovery codes:** 10 per set, stored hashed, expire after 365 days; regenerating starts a new set.
- **Secrets at rest:** TOTP secrets are encrypted with Fernet keys from `MFA_ENCRYPTION_KEY` (comma
  separated for rotation: the first encrypts, all decrypt). Without a key, secrets cannot be stored or
  read (fails closed). `MFA_ENCRYPTION_ENABLED=false` stores new secrets in plaintext; `manage.py check
  --deploy` warns (identity.W003) while it is off.
- **Reset:** a user who loses their factor needs a recovery code or a reset by another administrator.
- **Trusted devices:** see `trusted-devices.md`.
