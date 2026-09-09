"""
Security settings.
"""

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
