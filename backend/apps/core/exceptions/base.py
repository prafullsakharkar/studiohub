"""
Base exception classes for domain-specific errors.

Provides base exception classes and domain-specific error types.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Optional

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)

if TYPE_CHECKING:
    from django.http import HttpRequest

logger = logging.getLogger(__name__)


class BaseDomainException(Exception):
    """
    Base exception for domain-specific errors.

    All domain-specific exceptions should inherit from this class.
    """

    default_message = "An error occurred."
    default_code = "domain_error"
    default_status_code = status.HTTP_400_BAD_REQUEST

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the domain exception.

        Args:
            message: Error message (uses default if None)
            code: Error code (uses default if None)
            status_code: HTTP status code (uses default if None)
            details: Additional error details
        """
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.status_code = status_code or self.default_status_code
        self.details = details or {}

        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """
        Convert exception to dictionary.

        Returns:
            Dictionary representation of the exception
        """
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            },
        }

    def __str__(self) -> str:
        """Return string representation."""
        return f"{self.code}: {self.message}"

    def log(self, level: int = logging.ERROR) -> None:
        """
        Log the exception.

        Args:
            level: Logging level
        """
        logger.log(level, str(self), extra={"details": self.details})


class BaseBusinessException(BaseDomainException):
    """
    Base exception for business logic errors.

    Used for errors related to business rules and domain invariants.
    """

    default_message = "Business rule violation."
    default_code = "business_error"
    default_status_code = status.HTTP_409_CONFLICT


class BaseValidationException(BaseDomainException):
    """
    Base exception for validation errors.

    Used for errors related to input validation.
    """

    default_message = "Validation failed."
    default_code = "validation_error"
    default_status_code = status.HTTP_400_BAD_REQUEST


class BaseAPIException(APIException):
    """
    Base exception for API errors.

    Extends DRF's APIException with additional functionality.
    """

    default_message = "An API error occurred."
    default_code = "api_error"
    default_status_code = status.HTTP_400_BAD_REQUEST

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the API exception.

        Args:
            message: Error message (uses default if None)
            code: Error code (uses default if None)
            status_code: HTTP status code (uses default if None)
            details: Additional error details
        """
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.status_code = status_code or self.default_status_code
        self.details = details or {}

        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """
        Convert exception to dictionary.

        Returns:
            Dictionary representation of the exception
        """
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            },
        }

    def __str__(self) -> str:
        """Return string representation."""
        return f"{self.code}: {self.message}"

    def log(self, level: int = logging.ERROR) -> None:
        """
        Log the exception.

        Args:
            level: Logging level
        """
        logger.log(level, str(self), extra={"details": self.details})


class ObjectNotFoundException(BaseDomainException):
    """
    Exception raised when an object is not found.

    Inherits from BaseDomainException for domain-level errors.
    """

    default_message = "Object not found."
    default_code = "object_not_found"
    default_status_code = status.HTTP_404_NOT_FOUND

    def __init__(
        self,
        model_name: str = "object",
        identifier: Optional[Any] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the object not found exception.

        Args:
            model_name: Name of the model (e.g., "User", "Organization")
            identifier: Identifier of the object (e.g., UUID, ID)
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        if identifier:
            self.message = message or f"{model_name} with identifier '{identifier}' not found."
        else:
            self.message = message or f"{model_name} not found."

        super().__init__(self.message, code, status_code, details)


class PermissionDeniedException(BaseDomainException):
    """
    Exception raised when permission is denied.

    Inherits from BaseDomainException for domain-level errors.
    """

    default_message = "Permission denied."
    default_code = "permission_denied"
    default_status_code = status.HTTP_403_FORBIDDEN

    def __init__(
        self,
        permission: Optional[str] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the permission denied exception.

        Args:
            permission: Name of the permission that was denied
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        if permission:
            self.message = message or f"Permission '{permission}' denied."
        else:
            self.message = message or "Permission denied."

        super().__init__(self.message, code, status_code, details)


class InvalidStateException(BaseBusinessException):
    """
    Exception raised when an operation is not allowed in the current state.

    Inherits from BaseBusinessException for business logic errors.
    """

    default_message = "Invalid state for operation."
    default_code = "invalid_state"
    default_status_code = status.HTTP_409_CONFLICT

    def __init__(
        self,
        current_state: str = "unknown",
        expected_states: Optional[list[str]] = None,
        operation: Optional[str] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the invalid state exception.

        Args:
            current_state: Current state of the object
            expected_states: List of expected states
            operation: Operation that was attempted
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        if expected_states:
            self.message = (
                message
                or f"Current state '{current_state}' is not valid for operation '{operation}'. "
                f"Expected states: {', '.join(expected_states)}."
            )
        else:
            self.message = message or f"Current state '{current_state}' is not valid."

        super().__init__(self.message, code, status_code, details)


class DuplicateException(BaseBusinessException):
    """
    Exception raised when a duplicate object is created.

    Inherits from BaseBusinessException for business logic errors.
    """

    default_message = "Duplicate object."
    default_code = "duplicate"
    default_status_code = status.HTTP_409_CONFLICT

    def __init__(
        self,
        model_name: str = "object",
        field: str = "field",
        value: Optional[Any] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the duplicate exception.

        Args:
            model_name: Name of the model
            field: Field that has the duplicate value
            value: Duplicate value
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        if value:
            self.message = (
                message or f"{model_name} with {field}='{value}' already exists."
            )
        else:
            self.message = message or f"{model_name} already exists."

        super().__init__(self.message, code, status_code, details)


class RateLimitException(BaseAPIException):
    """
    Exception raised when rate limit is exceeded.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Rate limit exceeded."
    default_code = "rate_limit_exceeded"
    default_status_code = status.HTTP_429_TOO_MANY_REQUESTS

    def __init__(
        self,
        retry_after: Optional[int] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the rate limit exception.

        Args:
            retry_after: Seconds until the client can retry
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        self.retry_after = retry_after
        self.message = message or self.default_message

        super().__init__(self.message, code, status_code, details)


class AuthenticationException(BaseAPIException):
    """
    Exception raised when authentication fails.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Authentication failed."
    default_code = "authentication_failed"
    default_status_code = status.HTTP_401_UNAUTHORIZED

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the authentication exception.

        Args:
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        self.message = message or self.default_message

        super().__init__(self.message, code, status_code, details)


class AuthorizationException(BaseAPIException):
    """
    Exception raised when authorization fails.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Authorization failed."
    default_code = "authorization_failed"
    default_status_code = status.HTTP_403_FORBIDDEN

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the authorization exception.

        Args:
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        self.message = message or self.default_message

        super().__init__(self.message, code, status_code, details)


class ValidationException(BaseAPIException):
    """
    Exception raised when validation fails.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Validation failed."
    default_code = "validation_failed"
    default_status_code = status.HTTP_400_BAD_REQUEST

    def __init__(
        self,
        field: Optional[str] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the validation exception.

        Args:
            field: Field that failed validation
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        if field:
            self.message = message or f"Validation failed for field '{field}'."
        else:
            self.message = message or "Validation failed."

        super().__init__(self.message, code, status_code, details)


class NotFoundException(BaseAPIException):
    """
    Exception raised when a resource is not found.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Resource not found."
    default_code = "not_found"
    default_status_code = status.HTTP_404_NOT_FOUND

    def __init__(
        self,
        resource: str = "resource",
        identifier: Optional[Any] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the not found exception.

        Args:
            resource: Name of the resource
            identifier: Identifier of the resource
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        if identifier:
            self.message = message or f"{resource} with identifier '{identifier}' not found."
        else:
            self.message = message or f"{resource} not found."

        super().__init__(self.message, code, status_code, details)


class ConflictException(BaseAPIException):
    """
    Exception raised when there is a conflict.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Conflict occurred."
    default_code = "conflict"
    default_status_code = status.HTTP_409_CONFLICT

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the conflict exception.

        Args:
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        self.message = message or self.default_message

        super().__init__(self.message, code, status_code, details)


class ServerException(BaseAPIException):
    """
    Exception raised when a server error occurs.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Server error."
    default_code = "server_error"
    default_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the server exception.

        Args:
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        self.message = message or self.default_message

        super().__init__(self.message, code, status_code, details)


class ServiceUnavailableException(BaseAPIException):
    """
    Exception raised when a service is unavailable.

    Inherits from BaseAPIException for API errors.
    """

    default_message = "Service unavailable."
    default_code = "service_unavailable"
    default_status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    def __init__(
        self,
        service: Optional[str] = None,
        message: Optional[str] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        """
        Initialize the service unavailable exception.

        Args:
            service: Name of the unavailable service
            message: Custom error message
            code: Custom error code
            status_code: Custom HTTP status code
            details: Additional error details
        """
        if service:
            self.message = message or f"Service '{service}' is unavailable."
        else:
            self.message = message or self.default_message

        super().__init__(self.message, code, status_code, details)
