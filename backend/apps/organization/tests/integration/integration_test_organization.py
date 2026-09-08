"""
Integration tests for organization application.

These tests verify the integration between different components of the
organization app and with external services.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from django.test import TestCase

from apps.organization.models.organization import Organization
from apps.organization.services.organization import OrganizationService
from apps.organization.tests.factories import OrganizationFactory


class OrganizationIntegrationTests(TestCase):
    """Integration tests for Organization model and services."""

    def test_organization_creation_with_service(self) -> None:
        """Test organization creation through service layer."""
        # Arrange
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "email": "test@example.com",
            "country": "IN",
            "language": "en",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
        }

        # Act
        organization = OrganizationService.create(**data)

        # Assert
        assert organization is not None
        assert organization.code == "ORG001"
        assert organization.name == "Test Organization"
        assert organization.organization_type == "STUDIO"
        assert Organization.objects.filter(pk=organization.pk).exists()

    def test_organization_update_with_service(self) -> None:
        """Test organization update through service layer."""
        # Arrange
        organization = OrganizationFactory.create(code="ORG001", name="Old Name")

        # Act
        updated_org = OrganizationService.update(
            organization,
            name="New Name",
        )

        # Assert
        assert updated_org.name == "New Name"
        organization.refresh_from_db()
        assert organization.name == "New Name"

    def test_organization_delete_with_service(self) -> None:
        """Test organization soft delete through service layer."""
        # Arrange
        organization = OrganizationFactory.create(status="active")

        # Act
        OrganizationService.delete(organization)

        # Assert (canonical soft-delete behavior: flagged, status untouched)
        organization.refresh_from_db()
        assert organization.is_deleted is True
        assert organization.deleted_at is not None

    def test_organization_with_memberships(self) -> None:
        """Test organization with related memberships."""
        # Arrange
        organization = OrganizationFactory.create()

        # Act
        organization_with_memberships = Organization.objects.with_member_count().get(
            pk=organization.pk
        )

        # Assert
        assert organization_with_memberships.member_count == 0

    def test_organization_with_statistics(self) -> None:
        """Test organization with computed statistics."""
        # Arrange
        organization = OrganizationFactory.create()

        # Act
        organization_with_stats = Organization.objects.with_statistics().get(
            pk=organization.pk
        )

        # Assert
        assert hasattr(organization_with_stats, "statistics")
        assert organization_with_stats.statistics is not None


class OrganizationServiceIntegrationTests(TestCase):
    """Integration tests for OrganizationService."""

    def test_create_organization_with_all_fields(self) -> None:
        """Test creating organization with all optional fields."""
        # Arrange
        data = {
            "code": "ORG002",
            "name": "Full Organization",
            "organization_type": "CLUB",
            "email": "full@example.com",
            "phone": "+1234567890",
            "website": "https://example.com",
            "country": "US",
            "language": "en",
            "currency": "USD",
            "timezone": "America/New_York",
            "description": "A full organization",
            "status": "active",
        }

        # Act
        organization = OrganizationService.create(**data)

        # Assert
        assert organization.code == "ORG002"
        assert organization.name == "Full Organization"
        assert organization.organization_type == "CLUB"
        assert organization.email == "full@example.com"
        assert organization.phone == "+1234567890"
        assert organization.website == "https://example.com"
        assert organization.country == "US"
        assert organization.language == "en"
        assert organization.currency == "USD"
        assert organization.timezone == "America/New_York"
        assert organization.description == "A full organization"
        assert organization.status == "active"

    def test_update_organization_partial_fields(self) -> None:
        """Test updating only some fields of an organization."""
        # Arrange
        organization = OrganizationFactory.create(
            code="ORG003",
            name="Original Name",
            email="original@example.com",
            phone="+1111111111",
        )

        # Act
        updated_org = OrganizationService.update(
            organization,
            name="Updated Name",
        )

        # Assert
        assert updated_org.name == "Updated Name"
        assert updated_org.email == "original@example.com"  # Unchanged
        assert updated_org.phone == "+1111111111"  # Unchanged

    def test_create_organization_rolls_back_on_failure(self) -> None:
        """Test that organization creation is atomic (rolls back on failure)."""
        # Arrange
        data = {
            "code": "ORG004",
            "name": "Transaction Test Org",
            "organization_type": "ASSOCIATION",
        }

        # Act: fail after the row insert (publish step) and assert rollback.
        with (
            patch.object(
                OrganizationService,
                "publish_event",
                side_effect=RuntimeError("boom"),
            ),
            pytest.raises(RuntimeError, match="boom"),
        ):
            OrganizationService.create(**data)

        # Assert
        assert not Organization.objects.filter(code="ORG004").exists()

    def test_delete_organization_marks_as_deleted(self) -> None:
        """Test that deleting an organization marks it as deleted."""
        # Arrange
        organization = OrganizationFactory.create(status="active")

        # Act
        OrganizationService.delete(organization)

        # Assert (canonical soft-delete behavior: flagged, status untouched)
        organization.refresh_from_db()
        assert organization.is_deleted is True
        assert organization.deleted_at is not None

    def test_archive_organization(self) -> None:
        """Test archiving an organization."""
        # Arrange
        organization = OrganizationFactory.create(status="active")

        # Act
        OrganizationService.archive(organization)

        # Assert
        organization.refresh_from_db()
        assert organization.status == "archived"


class OrganizationSelectorIntegrationTests(TestCase):
    """Integration tests for OrganizationSelector."""

    def test_get_organization_by_uuid(self) -> None:
        """Test getting organization by UUID."""
        # Arrange
        organization = OrganizationFactory.create()

        # Act (uuid is a property alias of the UUID primary key `id`,
        # which is the only ORM-queryable form).
        retrieved_org = Organization.objects.get(id=organization.id)

        # Assert
        assert retrieved_org is not None and retrieved_org.uuid == organization.uuid
        assert retrieved_org is not None and retrieved_org.pk == organization.pk

    def test_get_organization_by_code(self) -> None:
        """Test getting organization by code."""
        # Arrange
        organization = OrganizationFactory.create(code="ORG005")

        # Act
        retrieved_org = Organization.objects.get(code="ORG005")

        # Assert
        assert retrieved_org is not None and retrieved_org.code == "ORG005"
        assert retrieved_org is not None and retrieved_org.pk == organization.pk

    def test_filter_organizations_by_status(self) -> None:
        """Test filtering organizations by status."""
        # Arrange
        active_org = OrganizationFactory.create(status="active")
        OrganizationFactory.create(status="inactive")

        # Act
        active_organizations = Organization.objects.filter(status="active")

        # Assert
        assert active_organizations.count() == 1
        assert active_organizations.first() == active_org

    def test_get_active_organizations(self) -> None:
        """Test getting only active organizations."""
        # Arrange
        active_org = OrganizationFactory.create(status="active")
        OrganizationFactory.create(status="inactive")
        OrganizationFactory.create(status="deleted")

        # Act
        active_organizations = Organization.objects.active()

        # Assert
        assert active_organizations.count() == 1
        assert active_organizations.first() == active_org

    def test_get_inactive_organizations(self) -> None:
        """Test getting only inactive organizations."""
        # Arrange
        inactive_org = OrganizationFactory.create(status="inactive")
        OrganizationFactory.create(status="active")
        OrganizationFactory.create(status="deleted")

        # Act
        inactive_organizations = Organization.objects.inactive()

        # Assert
        assert inactive_organizations.count() == 1
        assert inactive_organizations.first() == inactive_org
