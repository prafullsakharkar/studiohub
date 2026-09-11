"""
Django REST Framework configuration.
"""

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": ("drf_spectacular.openapi.AutoSchema"),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": ("apps.core.api.pagination.StandardPagination"),
    "PAGE_SIZE": 20,
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # JWTAuthentication is the primary (and only) contract-facing scheme.
        # Tokens are issued via JWTService using stock SimpleJWT AccessToken/RefreshToken.
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": (
        "apps.core.api.renderers.StandardJSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "EXCEPTION_HANDLER": ("apps.core.api.exceptions.custom_exception_handler"),
    # Scoped throttling only: views opt in via ``throttle_scope`` (login /
    # refresh). Views without a scope are unaffected, so the general API and
    # the test suite are not rate-limited. Account lockout after repeated
    # failures (LoginAttemptService, 5 attempts) is the primary brute-force
    # defense; these rates are defense in depth per client IP.
    "DEFAULT_THROTTLE_CLASSES": [
        "apps.core.api.throttling.ResilientScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "login": "30/min",
        "refresh": "60/min",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "StudioHub API",
    "DESCRIPTION": "StudioHub Production Management Platform",
    "VERSION": "1.0.0",
    "POSTPROCESSING_HOOKS": [
        # Flag deprecated paths (Deprecation/Sunset headers) in the schema.
        "apps.core.api.deprecations.mark_deprecated_paths",
    ],
}
