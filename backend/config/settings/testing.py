"""
Testing settings.
"""

import os

from .base import *

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

# Override database for testing to use a pre-created test database
# This allows tests to run without requiring CREATEDB privilege
TEST_DB_NAME = os.environ.get(
    "TEST_DB_NAME", f"test_{os.environ.get('DB_NAME', 'cricket_iq')}"
)

DATABASES["default"] = {
    "ENGINE": "django.db.backends.postgresql",
    "NAME": os.environ.get("DB_NAME", "cricketiq"),
    "USER": os.environ.get("DB_USER", "user_iq"),
    "PASSWORD": os.environ.get("DB_PASSWORD", "cricket1234"),
    "HOST": os.environ.get("DB_HOST", "192.168.1.109"),
    "PORT": os.environ.get("DB_PORT", "5439"),
}

# Use a custom test database that must be pre-created
# The test runner will run tests against this database directly
# without trying to create/drop the test database
TEST_RUNNER = "config.test_runner.PreserveDatabaseTestRunner"
