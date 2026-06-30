"""
Cross Origin Resource Sharing.
"""

from config.env import settings

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_ALL_ORIGINS = settings.debug

CORS_ALLOWED_ORIGINS = settings.cors_allowed_origins

CSRF_TRUSTED_ORIGINS = settings.csrf_trusted_origins
