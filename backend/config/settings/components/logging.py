"""
Logging configuration.

``LOGGING_CONFIG = None`` stops Django from configuring logging itself. Logging is set up by
``apps/core/logging/structlog_config.py`` (JSON or console to stderr; key-name redaction of secrets;
level and format from LOG_LEVEL and LOG_FORMAT). There are no log files: the container's stderr is
collected by the platform (see docs/10-security/audit-logging.md).
"""

LOGGING_CONFIG = None
