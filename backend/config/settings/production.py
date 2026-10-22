"""
Production settings.
"""

from .base import *

DEBUG = False  # pyright: ignore[reportConstantRedefinition]

# DEBUG is forced off above, but CORS_ALLOW_ALL_ORIGINS was already derived from
# the env DEBUG flag in base.py; with credentials enabled that would let any
# origin make credentialed requests. Production uses the explicit allow-list.
CORS_ALLOW_ALL_ORIGINS = False  # pyright: ignore[reportConstantRedefinition]

SECURE_SSL_REDIRECT = True

SESSION_COOKIE_SECURE = True

CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 31536000

SECURE_HSTS_INCLUDE_SUBDOMAINS = True

SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True  # pyright: ignore[reportConstantRedefinition]
SECURE_CONTENT_TYPE_NOSNIFF = True  # pyright: ignore[reportConstantRedefinition]
SECURE_REFERRER_POLICY = "strict-origin"  # pyright: ignore[reportConstantRedefinition]
ALLOWED_HOSTS = settings.allowed_hosts  # pyright: ignore[reportConstantRedefinition]

REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
    "apps.core.api.renderers.StandardJSONRenderer",
]
LOGGING["handlers"]["console"]["formatter"] = "json"
