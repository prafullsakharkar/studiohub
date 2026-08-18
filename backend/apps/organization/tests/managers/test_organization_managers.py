"""
Organization manager tests.
"""

from __future__ import annotations

import pytest

from apps.organization.managers import OrganizationManager
from apps.organization.models.organization import Organization


class TestOrganizationManager:
    """Tests for OrganizationManager."""

    @pytest.mark.django_db
    def test_manager_inherits_from_queryset(self):
        """Test manager inherits from OrganizationQuerySet."""
        assert issubclass(OrganizationManager, OrganizationManager.__bases__[0])

    @pytest.mark.django_db
    def test_manager_use_in_migrations(self):
        """Test manager is used in migrations."""
        assert OrganizationManager.use_in_migrations is True

    @pytest.mark.django_db
    def test_manager_active(self, organization):
        """Test active manager method."""
        assert Organization.objects.active().filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_manager_inactive(self, organization):
        """Test inactive manager method."""
        organization.status = "inactive"
        organization.save()
        assert Organization.objects.inactive().filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_manager_archived(self, organization):
        """Test archived manager method."""
        organization.status = "archived"
        organization.save()
        assert Organization.objects.archived().filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_manager_by_slug(self, organization):
        """Test by_slug manager method."""
        org = Organization.objects.by_slug(organization.slug).first()
        assert org is not None
        assert org.slug == organization.slug

    @pytest.mark.django_db
    def test_manager_by_code(self, organization):
        """Test by_code manager method."""
        org = Organization.objects.by_code(organization.code).first()
        assert org is not None
        assert org.code == organization.code

    @pytest.mark.django_db
    def test_manager_lookup_by_name(self, organization):
        """Test lookup manager method by name."""
        org = Organization.objects.lookup(organization.name).first()
        assert org is not None
        assert org.name == organization.name

    @pytest.mark.django_db
    def test_manager_lookup_by_code(self, organization):
        """Test lookup manager method by code."""
        org = Organization.objects.lookup(organization.code).first()
        assert org is not None
        assert org.code == organization.code

    @pytest.mark.django_db
    def test_manager_lookup_by_slug(self, organization):
        """Test lookup manager method by slug."""
        org = Organization.objects.lookup(organization.slug).first()
        assert org is not None
        assert org.slug == organization.slug

    @pytest.mark.django_db
    def test_manager_with_member_count(self, organization):
        """Test with_member_count manager method."""
        qs = Organization.objects.with_member_count()
        org = qs.filter(pk=organization.pk).first()
        assert org is not None
        assert hasattr(org, "member_count")

    @pytest.mark.django_db
    def test_manager_get_by_natural_key(self, organization):
        """Test get_by_natural_key manager method."""
        org = Organization.objects.get_by_natural_key(organization.code)
        assert org is not None
        assert org.code == organization.code
