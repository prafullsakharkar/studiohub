"""
Production settings.
"""

from .base import *

DEBUG = False

SECURE_SSL_REDIRECT = True

SESSION_COOKIE_SECURE = True

CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 31536000

SECURE_HSTS_INCLUDE_SUBDOMAINS = True

SECURE_HSTS_PRELOAD = True

SECURE_BROWSER_XSS_FILTER = True

SECURE_CONTENT_TYPE_NOSNIFF = True

SECURE_REFERRER_POLICY = "strict-origin"

ALLOWED_HOSTS = settings.allowed_hosts

REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (
    "apps.core.api.renderers.StandardJSONRenderer",
)
LOGGING["handlers"]["console"]["formatter"] = "json"
