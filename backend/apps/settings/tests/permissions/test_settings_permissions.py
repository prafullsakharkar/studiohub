# tests/permissions/test_settings_permissions.py
"""
Permission tests for Settings application.

Settings APIs are protected by the Core ``IsAuthenticatedPermission`` and
``IsStaff`` classes (viewsets for Category, Definition and System settings
require staff; the remaining viewsets require an authenticated user). These
tests verify that access control behaves as configured.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from rest_framework.views import APIView

from apps.core.api.permissions.staff import IsStaff
from apps.core.permissions.base import IsAuthenticatedPermission


def _make_request(user=None, method="get"):
    """Build a request carrying the given user (None = anonymous)."""
    request: Any = getattr(RequestFactory(), method)("/api/v1/settings/")
    request.user = user if user is not None else AnonymousUser()
    return request


def _make_view():
    """Build a bare view for direct permission checks."""
    return APIView()


class TestIsAuthenticatedPermission:
    """Tests for IsAuthenticatedPermission as used by settings viewsets."""

    def test_anonymous_user_cannot_access(self) -> None:
        """Anonymous requests are denied."""
        permission = IsAuthenticatedPermission()
        assert permission.has_permission(_make_request(user=None), _make_view()) is False

    def test_authenticated_user_can_access(self, user) -> None:
        """Authenticated users are allowed."""
        permission = IsAuthenticatedPermission()
        assert permission.has_permission(_make_request(user=user), _make_view()) is True

    def test_staff_user_can_access(self, staff_user) -> None:
        """Staff users are allowed."""
        permission = IsAuthenticatedPermission()
        assert permission.has_permission(_make_request(user=staff_user), _make_view()) is True


class TestIsStaff:
    """Tests for IsStaff as used by the staff-gated settings viewsets."""

    def test_anonymous_user_cannot_access(self) -> None:
        """Anonymous requests are denied."""
        permission = IsStaff()
        assert permission.has_permission(_make_request(user=None), _make_view()) is False

    def test_regular_user_cannot_access(self, user) -> None:
        """Regular authenticated users are denied staff-gated endpoints."""
        permission = IsStaff()
        assert permission.has_permission(_make_request(user=user), _make_view()) is False

    def test_staff_user_can_access(self, staff_user) -> None:
        """Staff users are allowed."""
        permission = IsStaff()
        assert permission.has_permission(_make_request(user=staff_user), _make_view()) is True

    def test_superuser_can_access(self, admin_user) -> None:
        """Superusers are allowed."""
        permission = IsStaff()
        assert permission.has_permission(_make_request(user=admin_user), _make_view()) is True
