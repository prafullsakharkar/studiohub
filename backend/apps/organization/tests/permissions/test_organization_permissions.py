"""
Tests for organization permissions.

Tests the actual membership-based permission implementation:
- View requires an active membership
- Create/Delete require staff
- Update requires membership with admin/owner role
- Manage requires membership with owner role
"""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from apps.identity.tests.factories import UserFactory
from apps.organization.models import Organization
from apps.organization.permissions import (
    CanCreateOrganization,
    CanDeleteOrganization,
    CanManageOrganization,
    CanUpdateOrganization,
    CanViewOrganization,
)
from apps.organization.tests.factories import (
    OrganizationMembershipFactory,
    RoleFactory,
)


def _make_request(user=None, method="get"):
    request = getattr(RequestFactory(), method)("/api/organizations/")
    request.user = user
    return request


def _membership_with_role(organization, user, role_code):
    role = RoleFactory.create(code=role_code)
    return OrganizationMembershipFactory.create(
        organization=organization,
        user=user,
        role=role,
    )


class TestCanViewOrganization:
    """Tests for CanViewOrganization permission."""

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view_object(self, organization):
        """Anonymous users cannot view organization objects."""
        permission = CanViewOrganization()
        request = _make_request(user=None)

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_user_without_membership_cannot_view(self, organization, user):
        """Authenticated users without membership cannot view."""
        permission = CanViewOrganization()
        request = _make_request(user=user)

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_member_can_view(self, organization, user):
        """Members can view their organization."""
        _membership_with_role(organization, user, role_code="member")
        permission = CanViewOrganization()
        request = _make_request(user=user)

        assert permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_staff_user_can_view(self, organization, staff_user):
        """Staff with membership can view."""
        _membership_with_role(organization, staff_user, role_code="member")
        permission = CanViewOrganization()
        request = _make_request(user=staff_user)

        assert permission.has_object_permission(request, None, organization)


class TestCanCreateOrganization:
    """Tests for CanCreateOrganization permission."""

    @pytest.mark.django_db
    def test_anonymous_user_cannot_create(self):
        """Anonymous users cannot create organizations."""
        permission = CanCreateOrganization()
        request = _make_request(user=None, method="post")

        assert not permission.has_permission(request, None)

    @pytest.mark.django_db
    def test_regular_user_cannot_create(self, user):
        """Regular users cannot create organizations."""
        permission = CanCreateOrganization()
        request = _make_request(user=user, method="post")

        assert not permission.has_permission(request, None)

    @pytest.mark.django_db
    def test_staff_user_can_create(self, staff_user):
        """Staff users can create organizations."""
        permission = CanCreateOrganization()
        request = _make_request(user=staff_user, method="post")

        assert permission.has_permission(request, None)

    @pytest.mark.django_db
    def test_superuser_can_create(self, admin_user):
        """Superusers can create organizations."""
        permission = CanCreateOrganization()
        request = _make_request(user=admin_user, method="post")

        assert permission.has_permission(request, None)


class TestCanUpdateOrganization:
    """Tests for CanUpdateOrganization permission."""

    @pytest.mark.django_db
    def test_anonymous_user_cannot_update(self, organization):
        """Anonymous users cannot update organizations."""
        permission = CanUpdateOrganization()
        request = _make_request(user=None, method="put")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_user_without_membership_cannot_update(self, organization, user):
        """Regular users without membership cannot update."""
        permission = CanUpdateOrganization()
        request = _make_request(user=user, method="put")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_member_without_admin_role_cannot_update(self, organization, user):
        """Members without admin role cannot update."""
        _membership_with_role(organization, user, role_code="member")
        permission = CanUpdateOrganization()
        request = _make_request(user=user, method="put")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_organization_admin_can_update(self, organization, user):
        """Organization admins can update their organization."""
        _membership_with_role(organization, user, role_code="admin")
        permission = CanUpdateOrganization()
        request = _make_request(user=user, method="put")

        assert permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_organization_owner_can_update(self, organization, user):
        """Organization owners can update their organization."""
        _membership_with_role(organization, user, role_code="owner")
        permission = CanUpdateOrganization()
        request = _make_request(user=user, method="put")

        assert permission.has_object_permission(request, None, organization)


class TestCanDeleteOrganization:
    """Tests for CanDeleteOrganization permission."""

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete(self, organization):
        """Anonymous users cannot delete organizations."""
        permission = CanDeleteOrganization()
        request = _make_request(user=None, method="delete")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_regular_user_cannot_delete(self, organization, user):
        """Regular users cannot delete organizations."""
        permission = CanDeleteOrganization()
        request = _make_request(user=user, method="delete")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_staff_user_can_delete(self, organization, staff_user):
        """Staff users can delete organizations."""
        permission = CanDeleteOrganization()
        request = _make_request(user=staff_user, method="delete")

        assert permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_superuser_can_delete(self, organization, admin_user):
        """Superusers can delete any organization."""
        permission = CanDeleteOrganization()
        request = _make_request(user=admin_user, method="delete")

        assert permission.has_object_permission(request, None, organization)


class TestCanManageOrganization:
    """Tests for CanManageOrganization permission."""

    @pytest.mark.django_db
    def test_anonymous_user_cannot_manage(self, organization):
        """Anonymous users cannot manage organizations."""
        permission = CanManageOrganization()
        request = _make_request(user=None, method="post")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_user_without_membership_cannot_manage(self, organization, user):
        """Users without membership cannot manage."""
        permission = CanManageOrganization()
        request = _make_request(user=user, method="post")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_admin_cannot_manage(self, organization, user):
        """Admins cannot manage (owner only)."""
        _membership_with_role(organization, user, role_code="admin")
        permission = CanManageOrganization()
        request = _make_request(user=user, method="post")

        assert not permission.has_object_permission(request, None, organization)

    @pytest.mark.django_db
    def test_organization_owner_can_manage(self, organization, user):
        """Organization owners can manage their organization."""
        _membership_with_role(organization, user, role_code="owner")
        permission = CanManageOrganization()
        request = _make_request(user=user, method="post")

        assert permission.has_object_permission(request, None, organization)
