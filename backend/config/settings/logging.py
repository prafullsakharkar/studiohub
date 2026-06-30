from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
        "standard": {
            "format": (
                "[{asctime}] " "[{levelname}] " "[{request_id}] " "{name}: " "{message}"
            ),
            "style": "{",
        },
        "verbose": {
            "format": (
                "[{asctime}] "
                "[{levelname}] "
                "[{request_id}] "
                "{process:d} "
                "{thread:d} "
                "{filename}:{lineno} "
                "{message}"
            ),
            "style": "{",
        },
        "json": {
            "()": "apps.core.logging.formatters.JSONFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
        "django_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "django.log",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 10,
            "formatter": "verbose",
        },
        "api_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "api.log",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 10,
            "formatter": "verbose",
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "errors.log",
            "level": "ERROR",
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 10,
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": [
                "console",
                "django_file",
            ],
            "level": "INFO",
            "propagate": True,
        },
        "django.request": {
            "handlers": [
                "console",
                "api_file",
            ],
            "level": "INFO",
            "propagate": False,
        },
        "apps": {
            "handlers": [
                "console",
                "django_file",
            ],
            "level": "DEBUG",
            "propagate": False,
        },
        "errors": {
            "handlers": [
                "console",
                "error_file",
            ],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
