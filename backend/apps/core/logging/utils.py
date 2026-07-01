"""
Logging helpers.
"""

from .logger import get_logger


def log_exception(
    exception,
):

    logger = get_logger("exceptions")

    logger.exception(str(exception))
