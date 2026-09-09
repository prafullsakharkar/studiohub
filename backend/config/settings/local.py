"""
Local development settings.
"""

from .base import *

DEBUG = True  # pyright: ignore[reportConstantRedefinition]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

INTERNAL_IPS = [
    "127.0.0.1",
]
INSTALLED_APPS += [  # pyright: ignore[reportConstantRedefinition]
    "debug_toolbar",
]

MIDDLEWARE.insert(
    0,
    "debug_toolbar.middleware.DebugToolbarMiddleware",
)
LOGGING["handlers"]["console"]["formatter"] = "verbose"
