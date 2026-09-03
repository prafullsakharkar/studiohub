"""
Security tests for organization application.

These tests verify security-related functionality including
authorization, authentication, and data protection.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError
from django.test import TestCase

from apps.organization.models.organization import Organization
from apps.organization.tests.factories import OrganizationFactory, UserFactory


class OrganizationAuthorizationTests(TestCase):
    """Authorization tests for Organization model."""

    def setUp(self) -> None:
        """Set up test data."""
        self.user = UserFactory.create()
        self.organization = OrganizationFactory.create()

    def test_organization_uuid_is_unique(self) -> None:
        """Test that each organization has a unique UUID."""
        org1 = OrganizationFactory.create()
        org2 = OrganizationFactory.create()

        assert org1.uuid != org2.uuid
        assert len(str(org1.uuid)) == 36

    def test_organization_code_is_unique(self) -> None:
        """Test that organization codes are unique."""
        OrganizationFactory.create(code="ORG001")

        with pytest.raises(IntegrityError):
            Organization.objects.create(
                code="ORG001",
                name="Duplicate",
                slug="duplicate",
            )

    def test_organization_slug_is_auto_generated(self) -> None:
        """Test that organization slug is derived from the code."""
        organization = OrganizationFactory.create(code="TEST_ORG")

        assert organization.slug == "test_org"

    def test_organization_display_name(self) -> None:
        """Test organization display name."""
        organization = OrganizationFactory.create(name="Test Organization")

        assert "Test Organization" in organization.display_name

    def test_organization_natural_key(self) -> None:
        """Test organization natural key."""
        organization = OrganizationFactory.create(code="ORG001")

        assert organization.natural_key() == ("ORG001",)

    def test_organization_str_method(self) -> None:
        """Test organization string representation."""
        organization = OrganizationFactory.create(name="Test Organization")

        assert "Test Organization" in str(organization)


class OrganizationDataProtectionTests(TestCase):
    """Data protection tests for Organization model."""

    def setUp(self) -> None:
        """Set up test data."""
        self.organization = OrganizationFactory.create()

    def test_organization_soft_delete(self) -> None:
        """Test organization soft delete."""
        organization = OrganizationFactory.create()

        organization.soft_delete()

        organization.refresh_from_db()
        assert organization.is_deleted is True
        assert organization.deleted_at is not None

    def test_organization_archive(self) -> None:
        """Test organization archive."""
        organization = OrganizationFactory.create(status="active")

        organization.status = "archived"
        organization.save()

        organization.refresh_from_db()
        assert organization.status == "archived"

    def test_organization_status_choices(self) -> None:
        """Test organization status choices."""
        valid_statuses = ["active", "inactive", "archived", "draft"]

        for status in valid_statuses:
            organization = OrganizationFactory.create(status=status)
            assert organization.status == status
            organization.soft_delete()

    def test_organization_timestamps(self) -> None:
        """Test organization timestamps."""
        organization = OrganizationFactory.create()

        assert organization.created_at is not None
        assert organization.updated_at is not None
        assert organization.updated_at >= organization.created_at

    def test_organization_soft_delete_sets_flags(self) -> None:
        """Test soft-deleted organizations carry is_deleted and deleted_at."""
        organization = OrganizationFactory.create()

        organization.soft_delete()
        organization.refresh_from_db()

        assert organization.is_deleted is True
        assert organization.deleted_at is not None


class OrganizationAuthenticationTests(TestCase):
    """Authentication-related security tests."""

    def setUp(self) -> None:
        """Set up test data."""
        self.user = UserFactory.create()
        self.organization = OrganizationFactory.create()

    def test_organization_email_is_valid(self) -> None:
        """Test organization email validation."""
        organization = OrganizationFactory.create(email="test@example.com")

        assert "@" in organization.email
        assert "." in organization.email

    def test_organization_website_url(self) -> None:
        """Test organization website URL."""
        organization = OrganizationFactory.create(website="https://example.com")

        website = organization.website
        assert website.startswith("https://") or website.startswith("http://")

    def test_regular_user_cannot_manage_organization(self) -> None:
        """Test a regular user without membership cannot manage."""
        from django.test import RequestFactory

        from apps.organization.permissions import CanManageOrganization

        request = RequestFactory().post("/api/organizations/")
        request.user = self.user

        permission = CanManageOrganization()

        assert not permission.has_object_permission(
            request, None, self.organization
        )
