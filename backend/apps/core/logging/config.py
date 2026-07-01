"""
Logging configuration.
"""

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request": {"()": ("apps.core.logging.filters." "RequestContextFilter")}},
    "formatters": {
        "standard": {"()": ("apps.core.logging." "formatters.StandardFormatter")},
        "json": {"()": ("apps.core.logging." "formatters.JSONFormatter")},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "filters": ["request"],
        }
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
