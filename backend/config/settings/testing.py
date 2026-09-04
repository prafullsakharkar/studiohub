"""
Testing settings.
"""

from .base import *

# Test settings must never run with DEBUG on: ``debug_toolbar`` is only
# registered in ``local.py``, so a stray ``DEBUG=True`` in ``.env.test``
# would make ``config.urls``'s debug_toolbar include blow up on import.
DEBUG = False

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Use an in-memory cache for tests so permission/authorization caches do not
# require a running Redis instance.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "identity-test-cache",
    }
}

CELERY_TASK_ALWAYS_EAGER = True

CELERY_TASK_EAGER_PROPAGATES = True

# Database configuration is inherited from base settings
# (components/database.py), which resolves DB_* via config.env.
# Real environment variables take precedence over .env files, so CI
# can override the database without changing code.

# Use a custom test database that must be pre-created
# The test runner will run tests against this database directly
# without trying to create/drop the test database
TEST_RUNNER = "config.test_runner.PreserveDatabaseTestRunner"
