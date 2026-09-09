"""
Cross Origin Resource Sharing.
"""

from corsheaders.defaults import default_headers

from config.env import settings

CORS_ALLOW_CREDENTIALS = True

# Multi-tenancy: the frontend sends the active organization via these headers,
# so they must be permitted in CORS preflight responses.
CORS_ALLOW_HEADERS = [*default_headers, "x-organization-id", "x-organization"]

CORS_ALLOW_ALL_ORIGINS = settings.debug

CORS_ALLOWED_ORIGINS = settings.cors_allowed_origins

CSRF_TRUSTED_ORIGINS = settings.csrf_trusted_origins
