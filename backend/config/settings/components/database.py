"""
Database configuration.
"""

from config.env import settings

DATABASES = {
    "default": {
        **settings.database,
        "CONN_MAX_AGE": 600,
        "CONN_HEALTH_CHECKS": True,
    }
}
