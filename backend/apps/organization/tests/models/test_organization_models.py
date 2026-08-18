"""
Organization model tests.
"""

from __future__ import annotations

from datetime import date

import pytest
from django.core.exceptions import ValidationError

from apps.organization.choices import OrganizationType
from apps.organization.models.organization import Organization


class TestOrganizationModel:
    """Tests for Organization model."""

    @pytest.mark.django_db
    def test_create_organization(self, organization):
        """Test creating an organization."""
        assert organization is not None
        assert organization.code is not None
        assert organization.name is not None
        assert organization.slug is not None

    @pytest.mark.django_db
    def test_organization_uuid_generation(self, organization):
        """Test UUID is generated on creation."""
        assert organization.uuid is not None
        assert len(str(organization.uuid)) == 36

    @pytest.mark.django_db
    def test_organization_audit_fields(self, organization):
        """Test audit fields are present."""
        assert organization.created_at is not None
        assert organization.updated_at is not None
        assert organization.created_by is None
        assert organization.updated_by is None

    @pytest.mark.django_db
    def test_organization_soft_delete(self, organization):
        """Test soft delete functionality."""
        assert organization.deleted_at is None
        organization.soft_delete()
        organization.refresh_from_db()
        assert organization.deleted_at is not None

    @pytest.mark.django_db
    def test_organization_status_choices(self, organization):
        """Test status field choices."""
        assert organization.status in ["active", "inactive", "archived", "draft"]

    @pytest.mark.django_db
    def test_organization_organization_type_choices(self, organization):
        """Test organization type field choices."""
        assert organization.organization_type in [
            choice[0] for choice in OrganizationType.choices
        ]

    @pytest.mark.django_db
    def test_organization_unique_code(self, organization):
        """Test code field is unique."""
        with pytest.raises(Exception):
            Organization.objects.create(
                code=organization.code,
                name="Duplicate Organization",
            )

    @pytest.mark.django_db
    def test_organization_unique_slug(self, organization):
        """Test slug field is unique."""
        with pytest.raises(Exception):
            Organization.objects.create(
                code="ORG002",
                name="Duplicate Organization",
                slug=organization.slug,
            )

    @pytest.mark.django_db
    def test_organization_str_representation(self, organization):
        """Test string representation."""
        assert str(organization) == organization.name

    @pytest.mark.django_db
    def test_organization_email_validation(self, organization):
        """Test email field validation."""
        organization.email = "invalid-email"
        with pytest.raises(ValidationError):
            organization.full_clean()

    @pytest.mark.django_db
    def test_organization_website_validation(self, organization):
        """Test website field validation."""
        organization.website = "invalid-url"
        with pytest.raises(ValidationError):
            organization.full_clean()

    @pytest.mark.django_db
    def test_organization_country_choices(self, organization):
        """Test country field choices."""
        assert organization.country is not None

    @pytest.mark.django_db
    def test_organization_language_choices(self, organization):
        """Test language field choices."""
        assert organization.language is not None

    @pytest.mark.django_db
    def test_organization_currency_choices(self, organization):
        """Test currency field choices."""
        assert organization.currency is not None

    @pytest.mark.django_db
    def test_organization_timezone_choices(self, organization):
        """Test timezone field choices."""
        assert organization.timezone is not None

    @pytest.mark.django_db
    def test_organization_active_manager(self, organization):
        """Test active manager."""
        assert Organization.objects.active().filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_organization_inactive_manager(self, organization):
        """Test inactive manager."""
        organization.status = "inactive"
        organization.save()
        assert Organization.objects.inactive().filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_organization_archived_manager(self, organization):
        """Test archived manager."""
        organization.status = "archived"
        organization.save()
        assert Organization.objects.archived().filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_organization_by_slug(self, organization):
        """Test by_slug manager method."""
        assert Organization.objects.by_slug(organization.slug).exists()

    @pytest.mark.django_db
    def test_organization_by_code(self, organization):
        """Test by_code manager method."""
        assert Organization.objects.by_code(organization.code).exists()

    @pytest.mark.django_db
    def test_organization_lookup(self, organization):
        """Test lookup manager method."""
        assert Organization.objects.lookup(organization.name).exists()
        assert Organization.objects.lookup(organization.code).exists()
        assert Organization.objects.lookup(organization.slug).exists()

    @pytest.mark.django_db
    def test_organization_with_member_count(self, organization):
        """Test with_member_count queryset method."""
        qs = Organization.objects.with_member_count()
        org = qs.get(pk=organization.pk)
        assert hasattr(org, "member_count")

    @pytest.mark.django_db
    def test_organization_ordering(self, organization):
        """Test default ordering."""
        organizations = Organization.objects.all()
        if organizations.count() > 1:
            for i in range(len(organizations) - 1):
                assert organizations[i].name <= organizations[i + 1].name

    @pytest.mark.django_db
    def test_organization_meta_db_table(self, organization):
        """Test database table name."""
        assert organization._meta.db_table == "organizations"

    @pytest.mark.django_db
    def test_organization_meta_ordering(self, organization):
        """Test default ordering."""
        assert organization._meta.ordering == ("name",)
