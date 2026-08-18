"""
Compatibility shim for the logging factory.

Historically callers used apps.core.utils.logger.get_logger. Delegate to
apps.core.logging.logger.get_logger to centralize behavior while keeping
backwards compatibility.
"""

from __future__ import annotations

from typing import Any

# Delegate to the centralized logging factory implemented in
# apps.core.logging.logger so the behavior is consistent across the project.
from apps.core.logging.logger import get_logger as _get_core_logger


def get_logger(name: str) -> Any:
    return _get_core_logger(name)
