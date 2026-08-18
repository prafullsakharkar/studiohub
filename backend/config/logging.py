"""
Enterprise logging configuration.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .secrets import get_secrets

if TYPE_CHECKING:
    from logging import LogRecord

LOG_LEVEL = "INFO"


class SecretMaskingFormatter(logging.Formatter):
    """
    Logging formatter that masks sensitive values in log messages.
    """
    
    def format(self, record: LogRecord) -> str:
        """Format the log record with secret masking."""
        if isinstance(record.msg, str):
            secrets = get_secrets()
            record.msg = self._mask_secrets(record.msg)
        elif isinstance(record.msg, dict):
            secrets = get_secrets()
            record.msg = secrets.mask_dict(record.msg)
        
        return super().format(record)
    
    def _mask_secrets(self, message: str) -> str:
        """Mask secrets in a string message."""
        secrets = get_secrets()
        
        # Check if message contains secret-like patterns
        for field_name in secrets._secret_fields:
            if field_name.lower() in message.lower():
                # This is a simplified approach - in production, use more sophisticated parsing
                return secrets.mask_dict({"message": message}).get("message", message)
        
        return message


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": ("%(asctime)s " "%(levelname)s " "%(name)s " "%(message)s"),
            "()": SecretMaskingFormatter,
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
}
