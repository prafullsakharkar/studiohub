"""
Security settings.
"""

from config.env import settings

SESSION_COOKIE_HTTPONLY = True

CSRF_COOKIE_HTTPONLY = True

SECURE_CONTENT_TYPE_NOSNIFF = True

SECURE_BROWSER_XSS_FILTER = True

X_FRAME_OPTIONS = "DENY"

SECURE_REFERRER_POLICY = "strict-origin"

SECURE_PROXY_SSL_HEADER = (
    "HTTP_X_FORWARDED_PROTO",
    "https",
)

# HSTS Settings (HTTP Strict Transport Security)
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# SSL Redirect (enable in production only)
# SECURE_SSL_REDIRECT = True  # Uncomment for production

# Content Security Policy
# CSP_HEADER = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:; frame-ancestors 'none'"

# settings.py

MFA_ISSUER_NAME = "Atom VFX"

MFA_TRUSTED_DEVICE_COOKIE = "trusted_device"

MFA_TRUSTED_DEVICE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

MFA_MAX_FAILED_ATTEMPTS = 5

MFA_LOCKOUT_MINUTES = 15

MFA_RECOVERY_CODE_COUNT = 10

# Recovery codes expire; a regenerated set starts a new clock.
MFA_RECOVERY_CODE_DAYS = 365

# Lifetime of the pre-auth challenge issued after a correct password for an
# MFA-enabled account. It carries no session and grants no API access.
MFA_CHALLENGE_TTL_SECONDS = 300

# Policy: who must use MFA (see MFAPolicyService).
MFA_REQUIRE_MFA = False

MFA_REQUIRE_STAFF = True

MFA_REQUIRE_SUPERUSER = True

# Reverse proxies allowed to set X-Forwarded-For (IPs / CIDR). Empty means the
# direct peer (REMOTE_ADDR) is always the client address. Consumed only by
# apps.core.utils.client_ip.
TRUSTED_PROXY_IPS = settings.trusted_proxies

# Fernet keys protecting TOTP secrets at rest (first encrypts, all decrypt).
# Read only by apps.identity.crypto; an empty tuple fails closed.
MFA_ENCRYPTION_KEYS = settings.mfa_encryption_keys

# False stores new TOTP secrets in plaintext (default True). See apps.identity.crypto.
MFA_ENCRYPTION_ENABLED = settings.mfa_encryption_enabled

# Fernet keys protecting delivery passcodes at rest (first encrypts, all decrypt).
# Read only by apps.deliveries.passcode; an empty tuple fails closed.
DELIVERY_SECRET_KEYS = settings.delivery_secret_keys

# HMAC pepper for API key / PAT digests (see apps.identity.api_keys.hashing).
API_KEY_PEPPER = settings.api_key_pepper.get_secret_value()

# During the rehash window credentials stored with the old unpeppered digest
# still authenticate (and are upgraded on use). Set False once every row is
# on the peppered digest.
API_KEY_ACCEPT_LEGACY_HASH = True

# Active API keys / PATs one user may hold, per kind.
IDENTITY_MAX_ACTIVE_CREDENTIALS = 50

# last_used_at/ip are written at most this often per credential.
IDENTITY_CREDENTIAL_TOUCH_SECONDS = 60
