"""
Middleware configuration.
"""

MIDDLEWARE = [
    # Outermost: exactly-one completion record per request plus traceback
    # logging for exceptions escaping the view layer (ADR-0031). Assigns
    # request.request_id; RequestIDMiddleware below reuses it.
    "apps.core.middleware.RequestLoggingMiddleware",
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
    # Thread-local request for signal attribution (audit change tracking).
    "apps.core.middleware.request_context.RequestContextMiddleware",
    # API ingress telemetry writer (observability pages). After org
    # resolution; best-effort and never raises into the request.
    "apps.audit.middleware.telemetry.APITelemetryMiddleware",
    "apps.core.middleware.MaintenanceMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Response-side deprecation headers (Deprecation/Sunset) for routes in
    # apps.core.api.deprecations.DEPRECATED_API_PATHS (ADR-0032).
    "apps.core.middleware.DeprecationHeaderMiddleware",
    # NOTE: RateLimitMiddleware removed (P2.5) — it could never limit
    # (global_limit unset) and DRF's ResilientScopedRateThrottle (P1.1)
    # is the live rate-limiting mechanism.
]
