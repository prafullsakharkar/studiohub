"""
Middleware configuration.
"""

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.RequestIDMiddleware",
    "apps.core.logging.middleware.LoggingContextMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "apps.core.middleware.TrailingSlashMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.LocaleMiddleware",
    "apps.core.middleware.TimezoneMiddleware",
    "apps.core.middleware.AuthenticationMiddleware",
    "apps.core.middleware.OrganizationMiddleware",
    "apps.organization.middleware.organization_context.OrganizationContextMiddleware",
    "apps.core.middleware.AuditMiddleware",
    "apps.core.middleware.MaintenanceMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # NOTE: RateLimitMiddleware removed (P2.5) — it could never limit
    # (global_limit unset) and DRF's ResilientScopedRateThrottle (P1.1)
    # is the live rate-limiting mechanism.
]
