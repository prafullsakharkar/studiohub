"""
Error handling mixin.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class ErrorMixin:
    """
    Central error logging.
    """

    def log_exception(
        self,
        exception: Exception,
    ):
        logger.exception(exception)
