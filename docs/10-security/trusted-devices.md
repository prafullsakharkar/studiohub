# Trusted devices

A device that has completed an MFA challenge can be remembered so the user is not asked again on every
login. Source: `backend/apps/identity/models/trusted_device.py`, `services/mfa/trusted_device.py`,
`services/trusted_device.py`.

- **Granting** happens only inside the MFA flow, after a verified challenge. There is no API to add a
  trusted device.
- **Cookie:** `trusted_device`, lifetime 30 days (`MFA_TRUSTED_DEVICE_MAX_AGE`).
- **Record:** user, device fingerprint, browser, platform, IP address, user agent, last login and an
  `expires_at`. A record can also be revoked (`revoked_at`).
- **Revoking** is the only client-driven write: a user can revoke a device from their account, which ends
  the exemption.
- **Cleanup:** expired devices are deleted by the daily `identity.cleanup` task.
- **Permissions:** `identity.trusted_device.view|create|update|delete`.

Trusting a device skips the MFA prompt only; the password is still required. The feature and its
lifetime are controlled by `MFA_TRUSTED_DEVICE_ENABLED` and `MFA_TRUSTED_DEVICE_DAYS`
(`services/mfa/policies.py`).
