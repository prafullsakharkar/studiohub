"""
Logging handlers.
"""

import logging.handlers
from pathlib import Path

from django.conf import settings

LOG_DIR = Path(settings.BASE_DIR) / "logs"

LOG_DIR.mkdir(
    exist_ok=True,
)


def rotating_file_handler(filename):

    return logging.handlers.RotatingFileHandler(
        LOG_DIR / filename,
        maxBytes=10 * 1024 * 1024,
        backupCount=10,
    )
