"""
API exception exports.
"""

from .api import (
    BadRequestException,
    BaseAPIException,
    ConflictException,
    ResourceLockedException,
    ServiceUnavailableException,
)
from .authentication import (
    EmailNotVerified,
    InvalidCredentials,
    PasswordExpired,
    UserInactive,
)
from .handlers import custom_exception_handler
from .permissions import PermissionDeniedException
from .validation import (
    DuplicateNameException,
    InvalidStateException,
    ValidationException,
)

__all__ = [
    "BadRequestException",
    "BaseAPIException",
    "ConflictException",
    "DuplicateNameException",
    "InvalidStateException",
    "PermissionDeniedException",
    "ResourceLockedException",
    "ServiceUnavailableException",
    "ValidationException",
    "custom_exception_handler",
    "EmailNotVerified",
    "InvalidCredentials",
    "PasswordExpired",
    "UserInactive",
]
