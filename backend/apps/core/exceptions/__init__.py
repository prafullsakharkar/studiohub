"""
Core exception classes for domain-specific errors.

Provides base exception classes and domain-specific error types.
"""

from __future__ import annotations

from apps.core.exceptions.base import (
    BaseAPIException,
    BaseBusinessException,
    BaseDomainException,
    BaseValidationException,
)

__all__ = [
    "BaseAPIException",
    "BaseBusinessException",
    "BaseDomainException",
    "BaseValidationException",
]
