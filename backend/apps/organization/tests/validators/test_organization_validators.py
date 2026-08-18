"""
Organization validator tests.
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.organization.models.organization import Organization
from apps.organization.validators.organization import OrganizationValidator


class TestOrganizationValidator:
    """Tests for OrganizationValidator."""

    @pytest.mark.django_db
    def test_validator_validate_create_valid(self):
        """Test validate_create with valid data."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
        }
        validated = OrganizationValidator.validate_create(**data)
        assert validated == data

    @pytest.mark.django_db
    def test_validator_validate_create_missing_code(self):
        """Test validate_create with missing code."""
        data = {
            "name": "Test Organization",
            "organization_type": "STUDIO",
        }
        with pytest.raises(ValidationError):
            OrganizationValidator.validate_create(**data)

    @pytest.mark.django_db
    def test_validator_validate_create_missing_name(self):
        """Test validate_create with missing name."""
        data = {
            "code": "ORG001",
            "organization_type": "STUDIO",
        }
        with pytest.raises(ValidationError):
            OrganizationValidator.validate_create(**data)

    @pytest.mark.django_db
    def test_validator_validate_create_missing_organization_type(self):
        """Test validate_create with missing organization_type."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
        }
        with pytest.raises(ValidationError):
            OrganizationValidator.validate_create(**data)

    @pytest.mark.django_db
    def test_validator_validate_update_valid(self, organization):
        """Test validate_update with valid data."""
        data = {
            "name": "Updated Organization",
        }
        validated = OrganizationValidator.validate_update(organization, **data)
        assert validated == data

    @pytest.mark.django_db
    def test_validator_validate_update_duplicate_code(self, organization):
        """Test validate_update with duplicate code."""
        organization2 = Organization.objects.create(
            code="ORG002",
            name="Another Organization",
            organization_type="STUDIO",
        )
        data = {
            "code": organization.code,
        }
        with pytest.raises(ValidationError):
            OrganizationValidator.validate_update(organization2, **data)

    @pytest.mark.django_db
    def test_validator_validate_delete(self, organization):
        """Test validate_delete."""
        OrganizationValidator.validate_delete(organization)
        assert True

    @pytest.mark.django_db
    def test_validator_validate_restore(self, organization):
        """Test validate_restore."""
        organization.delete()
        OrganizationValidator.validate_restore(organization)
        assert True

    @pytest.mark.django_db
    def test_validator_validate_activate(self, organization):
        """Test validate_activate."""
        organization.status = "inactive"
        organization.save()
        OrganizationValidator.validate_activate(organization)
        assert True

    @pytest.mark.django_db
    def test_validator_validate_deactivate(self, organization):
        """Test validate_deactivate."""
        OrganizationValidator.validate_deactivate(organization)
        assert True

    @pytest.mark.django_db
    def test_validator_validate_archive(self, organization):
        """Test validate_archive."""
        OrganizationValidator.validate_archive(organization)
        assert True

    @pytest.mark.django_db
    def test_validator_validate_draft(self, organization):
        """Test validate_draft."""
        OrganizationValidator.validate_draft(organization)
        assert True

    @pytest.mark.django_db
    def test_validator_validate_create_with_email(self):
        """Test validate_create with valid email."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "email": "contact@organization.com",
        }
        validated = OrganizationValidator.validate_create(**data)
        assert validated == data

    @pytest.mark.django_db
    def test_validator_validate_create_with_invalid_email(self):
        """Test validate_create with invalid email."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "email": "invalid-email",
        }
        with pytest.raises(ValidationError):
            OrganizationValidator.validate_create(**data)

    @pytest.mark.django_db
    def test_validator_validate_create_with_website(self):
        """Test validate_create with valid website."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "website": "https://organization.com",
        }
        validated = OrganizationValidator.validate_create(**data)
        assert validated == data

    @pytest.mark.django_db
    def test_validator_validate_create_with_invalid_website(self):
        """Test validate_create with invalid website."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "website": "invalid-url",
        }
        with pytest.raises(ValidationError):
            OrganizationValidator.validate_create(**data)

    @pytest.mark.django_db
    def test_validator_validate_create_with_phone(self):
        """Test validate_create with valid phone."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "phone": "+91-1234567890",
        }
        validated = OrganizationValidator.validate_create(**data)
        assert validated == data

    @pytest.mark.django_db
    def test_validator_validate_create_with_description(self):
        """Test validate_create with description."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "description": "Test description",
        }
        validated = OrganizationValidator.validate_create(**data)
        assert validated == data

    @pytest.mark.django_db
    def test_validator_validate_create_with_all_fields(self):
        """Test validate_create with all fields."""
        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "STUDIO",
            "email": "contact@organization.com",
            "phone": "+91-1234567890",
            "website": "https://organization.com",
            "country": "IN",
            "language": "en",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
            "description": "Test description",
        }
        validated = OrganizationValidator.validate_create(**data)
        assert validated == data

    @pytest.mark.django_db
    def test_validator_validate_update_preserves_fields(self, organization):
        """Test validate_update preserves unmodified fields."""
        original_code = organization.code
        data = {
            "name": "Updated Name",
        }
        validated = OrganizationValidator.validate_update(organization, **data)
        assert validated["name"] == "Updated Name"
        assert organization.code == original_code

    @pytest.mark.django_db
    def test_validator_validate_create_empty_data(self):
        """Test validate_create with empty data."""
        data = {}
        with pytest.raises(ValidationError):
            OrganizationValidator.validate_create(**data)

    @pytest.mark.django_db
    def test_validator_validate_update_empty_data(self, organization):
        """Test validate_update with empty data."""
        data = {}
        validated = OrganizationValidator.validate_update(organization, **data)
        assert validated == data
