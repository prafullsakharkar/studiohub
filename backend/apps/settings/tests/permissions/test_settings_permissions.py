# tests/permissions/test_settings_permissions.py
"""
Permission tests for Settings application.

ADR-0033 D4: settings viewsets are gated by the canonical permission gate
(``HasPermission`` + ``permission_map`` codes like ``settings.view`` /
``settings.manage``), not by the Django ``is_staff`` attribute. These tests
verify authentication-gating plus the code-based deny/allow behavior.
"""

from __future__ import annotations

from typing import Any

import pytest
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission


def _make_request(user=None, method="get"):
    """Build a request carrying the given user (None = anonymous)."""
    request: Any = getattr(RequestFactory(), method)("/api/v1/settings/")
    request.user = user if user is not None else AnonymousUser()
    request.organization = None
    return request


class _SettingsView:
    """Stub mimicking the settings viewsets' permission_map contract."""

    def __init__(self, action: str):
        self.action = action
        self.permission_map = {
            "list": ("settings.view",),
            "retrieve": ("settings.view",),
            "create": ("settings.manage",),
        }

    def get_permission_required(self):
        if self.action not in self.permission_map:
            return None
        return self.permission_map[self.action]


class TestIsAuthenticatedPermission:
    """Tests for IsAuthenticatedPermission as used by settings viewsets."""

    def test_anonymous_user_cannot_access(self) -> None:
        """Anonymous requests are denied."""
        permission = IsAuthenticatedPermission()
        assert permission.has_permission(_make_request(user=None), _SettingsView("list")) is False

    def test_authenticated_user_can_access(self, user) -> None:
        """Authenticated users pass the authentication gate."""
        permission = IsAuthenticatedPermission()
        assert permission.has_permission(_make_request(user=user), _SettingsView("list")) is True


@pytest.mark.django_db
class TestSettingsPermissionGate:
    """has_permission resolves explicit codes; is_staff is not a tier."""

    def test_undeclared_action_denied(self, user) -> None:
        gate = HasPermission()
        assert gate.has_permission(_make_request(user=user), _SettingsView("nope")) is False

    def test_user_without_grant_denied_read(self, user) -> None:
        gate = HasPermission()
        assert gate.has_permission(_make_request(user=user), _SettingsView("list")) is False

    def test_staff_without_grant_denied(self, staff_user) -> None:
        """is_staff alone must not authorize settings access."""
        gate = HasPermission()
        assert gate.has_permission(_make_request(user=staff_user), _SettingsView("list")) is False

    def test_user_with_grant_allowed(self, user) -> None:
        from apps.organization.tests.factories import (
            PermissionFactory,
            RoleFactory,
            RolePermissionFactory,
            UserRoleFactory,
        )

        perm = PermissionFactory.create(code="settings.view")
        role = RoleFactory.create(organization=None, is_active=True)
        RolePermissionFactory.create(role=role, permission=perm, granted=True)
        UserRoleFactory.create(user=user, role=role)

        gate = HasPermission()
        assert gate.has_permission(_make_request(user=user), _SettingsView("list")) is True
        # Grant covers view only; manage is still denied.
        assert gate.has_permission(_make_request(user=user), _SettingsView("create")) is False

    def test_superuser_break_glass_allowed(self, admin_user) -> None:
        gate = HasPermission()
        assert gate.has_permission(_make_request(user=admin_user), _SettingsView("create")) is True
