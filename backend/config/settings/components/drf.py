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
    "DEFAULT_PAGINATION_CLASS": ("apps.core.api.pagination.PageNumberPagination"),
    "PAGE_SIZE": 20,
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": ("apps.core.api.renderers.JSONRenderer",),
    "EXCEPTION_HANDLER": ("apps.core.api.exceptions.exception_handler"),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "StudioHub API",
    "DESCRIPTION": "StudioHub Production Management Platform",
    "VERSION": "1.0.0",
}
