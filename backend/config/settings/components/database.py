"""
Database configuration.
"""

from config.env import settings

DATABASES = {
    "default": {
        **settings.database,
    }
}

if DATABASES["default"].get("ENGINE") != "django.db.backends.sqlite3":
    # Persistent connections are a PostgreSQL optimization; SQLite uses
    # thread-local file connections instead.
    DATABASES["default"].update(
        {
            "CONN_MAX_AGE": 600,
            "CONN_HEALTH_CHECKS": True,
        }
    )
