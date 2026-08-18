"""
Base permission classes for domain-specific authorization.

Provides base permission classes and domain-specific permission types.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Optional

from rest_framework import permissions
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

if TYPE_CHECKING:
    from django.http import HttpRequest
    from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class BasePermission(permissions.BasePermission):
    """
    Base permission class.

    All project permissions should inherit from this class.
    """

    message = "Permission denied."
    code = "permission_denied"

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return True

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return True

    def check_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Optional[Any] = None,
    ) -> bool:
        """
        Check permission for a request.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed (optional)

        Returns:
            True if the request has permission, False otherwise
        """
        if obj is not None:
            return self.has_object_permission(request, view, obj)
        return self.has_permission(request, view)

    def log_denied(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Optional[Any] = None,
    ) -> None:
        """
        Log a denied permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed (optional)
        """
        logger.warning(
            "Permission denied",
            extra={
                "user_id": getattr(request.user, "id", None),
                "user_email": getattr(request.user, "email", None),
                "method": request.method,
                "path": request.path,
                "view": view.__class__.__name__,
                "object": str(obj) if obj else None,
                "permission": self.__class__.__name__,
            },
        )

    def raise_exception(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Optional[Any] = None,
    ) -> None:
        """
        Raise an exception when permission is denied.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed (optional)

        Raises:
            AuthenticationFailed: If the user is not authenticated
            PermissionDenied: If the user is authenticated but doesn't have permission
        """
        if obj is not None:
            raise PermissionDenied(
                detail={
                    "code": self.code,
                    "message": self.message,
                }
            )
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            raise AuthenticationFailed(
                detail={
                    "code": self.code,
                    "message": self.message,
                }
            )
        raise PermissionDenied(
            detail={
                "code": self.code,
                "message": self.message,
            }
        )


class BasePermissionChecker:
    """
    Base permission checker.

    Provides common functionality for permission checking.
    """

    permission_class: Optional[type[BasePermission]] = None

    def __init__(
        self,
        permission_class: Optional[type[BasePermission]] = None,
    ):
        """
        Initialize the permission checker.

        Args:
            permission_class: The permission class to use
        """
        self.permission_class = permission_class or self.permission_class
        self._permission_instance: Optional[BasePermission] = None

    @property
    def permission(self) -> BasePermission:
        """
        Get the permission instance.

        Returns:
            The permission instance
        """
        if self._permission_instance is None:
            if self.permission_class is None:
                raise ValueError("permission_class is not set")
            self._permission_instance = self.permission_class()
        return self._permission_instance

    def has_permission(
        self,
        request: HttpRequest,
        view: APIView,
    ) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return self.permission.has_permission(request, view)

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return self.permission.has_object_permission(request, view, obj)

    def check(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Optional[Any] = None,
    ) -> bool:
        """
        Check permission for a request.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed (optional)

        Returns:
            True if the request has permission, False otherwise
        """
        if obj is not None:
            return self.has_object_permission(request, view, obj)
        return self.has_permission(request, view)

    def raise_exception(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Optional[Any] = None,
    ) -> None:
        """
        Raise an exception for denied permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed (optional)
        """
        self.permission.log_denied(request, view, obj)
        raise permissions.PermissionDenied(self.permission.message)


class IsAuthenticatedPermission(BasePermission):
    """
    Permission class for authenticated users.

    Allows access only to authenticated users.
    """

    message = "Authentication credentials were not provided."
    code = "not_authenticated"

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return bool(request.user and request.user.is_authenticated)


class IsAdminPermission(BasePermission):
    """
    Permission class for admin users.

    Allows access only to admin users.
    """

    message = "Admin access required."
    code = "admin_required"

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
            and request.user.is_superuser,
        )

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
            and request.user.is_superuser,
        )


class IsOwnerPermission(BasePermission):
    """
    Permission class for object owners.

    Allows access only to the owner of the object.
    """

    message = "You do not have permission to access this object."
    code = "owner_required"

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        owner = getattr(obj, "owner", None)
        if owner is None:
            owner = getattr(obj, "created_by", None)
        if owner is None:
            owner = getattr(obj, "user", None)

        return bool(request.user and owner and request.user.id == owner.id)


class ReadOnlyPermission(BasePermission):
    """
    Permission class for read-only access.

    Allows read-only access (GET, HEAD, OPTIONS).
    """

    message = "Read-only access."
    code = "read_only"

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return request.method in permissions.SAFE_METHODS

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return request.method in permissions.SAFE_METHODS


class WriteOnlyPermission(BasePermission):
    """
    Permission class for write-only access.

    Allows write-only access (POST, PUT, PATCH, DELETE).
    """

    message = "Write-only access."
    code = "write_only"

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return request.method not in permissions.SAFE_METHODS

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return request.method not in permissions.SAFE_METHODS


class OrPermission(BasePermission):
    """
    Permission class for OR logic.

    Allows access if any of the provided permissions pass.
    """

    def __init__(self, *permissions: BasePermission):
        """
        Initialize the OR permission.

        Args:
            *permissions: Permissions to check
        """
        self.permissions = permissions

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return any(
            permission.has_permission(request, view) for permission in self.permissions
        )

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return any(
            permission.has_object_permission(request, view, obj)
            for permission in self.permissions
        )


class AndPermission(BasePermission):
    """
    Permission class for AND logic.

    Allows access only if all of the provided permissions pass.
    """

    def __init__(self, *permissions: BasePermission):
        """
        Initialize the AND permission.

        Args:
            *permissions: Permissions to check
        """
        self.permissions = permissions

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return all(
            permission.has_permission(request, view) for permission in self.permissions
        )

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return all(
            permission.has_object_permission(request, view, obj)
            for permission in self.permissions
        )


class NotPermission(BasePermission):
    """
    Permission class for NOT logic.

    Allows access if the provided permission fails.
    """

    def __init__(self, permission: BasePermission):
        """
        Initialize the NOT permission.

        Args:
            permission: Permission to negate
        """
        self.permission = permission

    def has_permission(self, request: HttpRequest, view: APIView) -> bool:
        """
        Check if the request has permission.

        Args:
            request: The HTTP request
            view: The view being accessed

        Returns:
            True if the request has permission, False otherwise
        """
        return not self.permission.has_permission(request, view)

    def has_object_permission(
        self,
        request: HttpRequest,
        view: APIView,
        obj: Any,
    ) -> bool:
        """
        Check if the object has permission.

        Args:
            request: The HTTP request
            view: The view being accessed
            obj: The object being accessed

        Returns:
            True if the object has permission, False otherwise
        """
        return not self.permission.has_object_permission(request, view, obj)
