"""
Organization service tests.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.organization.models.organization import Organization
from apps.organization.services import OrganizationService
from apps.organization.validators.organization import OrganizationValidator


def _valid_data(**overrides):
    data = {
        "code": "ORG001",
        "name": "Test Organization",
        "slug": "org001",
        "organization_type": "studio",
    }
    data.update(overrides)
    return data


class TestOrganizationService:
    """Tests for OrganizationService."""

    @pytest.mark.django_db
    def test_service_create(self):
        """Test create method."""
        org = OrganizationService.create(**_valid_data())
        assert org is not None
        assert org.code == "ORG001"
        assert org.name == "Test Organization"

    @pytest.mark.django_db
    def test_service_update(self, organization):
        """Test update method."""
        new_name = "Updated Organization"
        org = OrganizationService.update(organization, name=new_name)
        assert org is not None
        assert org.name == new_name

    @pytest.mark.django_db
    def test_service_delete(self, organization):
        """Test delete method (soft delete)."""
        OrganizationService.delete(organization)
        organization.refresh_from_db()
        assert organization.is_deleted is True
        assert organization.deleted_at is not None

    @pytest.mark.django_db
    def test_service_archive(self, organization):
        """Test archive method."""
        OrganizationService.archive(organization)
        organization.refresh_from_db()
        assert organization.status == "archived"

    @pytest.mark.django_db
    def test_service_activate(self, organization):
        """Test activate method."""
        organization.status = "inactive"
        organization.save()
        OrganizationService.activate(organization)
        organization.refresh_from_db()
        assert organization.status == "active"

    @pytest.mark.django_db
    def test_service_deactivate(self, organization):
        """Test deactivate method."""
        OrganizationService.deactivate(organization)
        organization.refresh_from_db()
        assert organization.status == "inactive"

    @pytest.mark.django_db
    def test_service_restore(self, organization):
        """Test restore method."""
        organization.soft_delete()
        OrganizationService.restore(organization)
        organization.refresh_from_db()
        assert organization.deleted_at is None

    @pytest.mark.django_db
    def test_service_create_with_duplicate_code(self):
        """Test create with duplicate code."""
        OrganizationService.create(**_valid_data())
        with pytest.raises(ValidationError):
            OrganizationService.create(**_valid_data(name="Test Organization 2"))

    @pytest.mark.django_db
    def test_service_create_with_transaction_rollback(self):
        """Test create with transaction rollback."""
        try:
            with transaction.atomic():
                OrganizationService.create(**_valid_data())
                raise Exception("Simulated error")
        except Exception:
            pass
        assert Organization.objects.filter(code="ORG001").count() == 0

    @pytest.mark.django_db
    def test_service_update_with_transaction_rollback(self, organization):
        """Test update with transaction rollback."""
        original_name = organization.name
        try:
            with transaction.atomic():
                OrganizationService.update(organization, name="Updated")
                raise Exception("Simulated error")
        except Exception:
            pass
        organization.refresh_from_db()
        assert organization.name == original_name

    @pytest.mark.django_db
    def test_service_before_create_hook(self):
        """Test before_create hook."""
        with patch.object(OrganizationService, "before_create") as mock_before:
            OrganizationService.create(**_valid_data())
            mock_before.assert_called_once()

    @pytest.mark.django_db
    def test_service_after_create_hook(self):
        """Test after_create hook."""
        with patch.object(OrganizationService, "after_create") as mock_after:
            OrganizationService.create(**_valid_data())
            mock_after.assert_called_once()

    @pytest.mark.django_db
    def test_service_before_update_hook(self, organization):
        """Test before_update hook."""
        with patch.object(OrganizationService, "before_update") as mock_before:
            mock_before.return_value = (organization, {"name": "Updated"})
            OrganizationService.update(organization, name="Updated")
            mock_before.assert_called_once()

    @pytest.mark.django_db
    def test_service_after_update_hook(self, organization):
        """Test after_update hook."""
        with patch.object(OrganizationService, "after_update") as mock_after:
            OrganizationService.update(organization, name="Updated")
            mock_after.assert_called_once()

    @pytest.mark.django_db
    def test_service_before_delete_hook(self, organization):
        """Test before_delete hook."""
        with patch.object(OrganizationService, "before_delete") as mock_before:
            OrganizationService.delete(organization)
            mock_before.assert_called_once()

    @pytest.mark.django_db
    def test_service_after_delete_hook(self, organization):
        """Test after_delete hook."""
        with patch.object(OrganizationService, "after_delete") as mock_after:
            OrganizationService.delete(organization)
            mock_after.assert_called_once()

    @pytest.mark.django_db
    def test_service_event_dispatch(self):
        """Test event dispatch on create."""
        with patch(
            "apps.core.events.bus.default_event_bus.publish"
        ) as mock_publish:
            OrganizationService.create(**_valid_data())
            mock_publish.assert_called_once()

    @pytest.mark.django_db
    def test_service_event_map(self):
        """Test event map."""
        assert OrganizationService.event_map is not None
        assert "create" in OrganizationService.event_map
        assert "update" in OrganizationService.event_map
        assert "delete" in OrganizationService.event_map

    @pytest.mark.django_db
    def test_service_validator_class(self):
        """Test validator class."""
        assert OrganizationService.validator_class == OrganizationValidator

    @pytest.mark.django_db
    def test_service_model(self):
        """Test model."""
        assert OrganizationService.model == Organization
