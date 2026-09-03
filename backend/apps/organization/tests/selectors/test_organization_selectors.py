"""
Organization selector tests.
"""

from __future__ import annotations

import pytest
from django.test import RequestFactory

from apps.organization.selectors import OrganizationSelector


class TestOrganizationSelector:
    """Tests for OrganizationSelector."""

    @pytest.fixture
    def rf(self):
        """RequestFactory instance."""
        return RequestFactory()

    @pytest.mark.django_db
    def test_selector_get_queryset(self, organization):
        """Test get_queryset method."""
        qs = OrganizationSelector.get_queryset()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_get_queryset_with_request(self, organization, rf):
        """Test get_queryset method with request."""
        request = rf.get("/")
        qs = OrganizationSelector.get_queryset(request=request)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_get_queryset_with_view(self, organization, rf):
        """Test get_queryset method with view."""
        from django.views.generic import View

        request = rf.get("/")
        view = View()
        qs = OrganizationSelector.get_queryset(request=request, view=view)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_all(self, organization):
        """Test all method."""
        qs = OrganizationSelector.all()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_get(self, organization):
        """Test get method."""
        org = OrganizationSelector.get(id=organization.id)
        assert org is not None
        assert org.id == organization.id

    @pytest.mark.django_db
    def test_selector_get_by_uuid(self, organization):
        """Test get_by_uuid method."""
        org = OrganizationSelector.get_by_uuid(organization.uuid)
        assert org is not None
        assert org.uuid == organization.uuid

    @pytest.mark.django_db
    def test_selector_get_by_code(self, organization):
        """Test get_by_code method."""
        org = OrganizationSelector.get_by_code(organization.code)
        assert org is not None
        assert org.code == organization.code

    @pytest.mark.django_db
    def test_selector_filter(self, organization):
        """Test filter method."""
        qs = OrganizationSelector.filter(name=organization.name)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_exclude(self, organization):
        """Test exclude method."""
        qs = OrganizationSelector.exclude(name="Different Name")
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_exists(self, organization):
        """Test exists method."""
        assert OrganizationSelector.exists(id=organization.id)

    @pytest.mark.django_db
    def test_selector_first(self, organization):
        """Test first method."""
        org = OrganizationSelector.first()
        assert org is not None

    @pytest.mark.django_db
    def test_selector_last(self, organization):
        """Test last method."""
        org = OrganizationSelector.last()
        assert org is not None

    @pytest.mark.django_db
    def test_selector_count(self, organization):
        """Test count method."""
        assert OrganizationSelector.count() >= 1

    @pytest.mark.django_db
    def test_selector_none(self, organization):
        """Test none method."""
        qs = OrganizationSelector.none()
        assert qs.count() == 0

    @pytest.mark.django_db
    def test_selector_get_or_none(self, organization):
        """Test get_or_none method."""
        org = OrganizationSelector.get_or_none(id=organization.id)
        assert org is not None
        assert org.id == organization.id

    @pytest.mark.django_db
    def test_selector_get_or_none_not_exists(self, organization):
        """Test get_or_none method when object doesn't exist."""
        org = OrganizationSelector.get_or_none(id="00000000-0000-0000-0000-000000000000")
        assert org is None

    @pytest.mark.django_db
    def test_selector_values(self, organization):
        """Test values method."""
        qs = OrganizationSelector.values("name")
        assert qs.filter(id=organization.id).exists()

    @pytest.mark.django_db
    def test_selector_values_list(self, organization):
        """Test values_list method."""
        qs = OrganizationSelector.values_list("name", flat=True)
        assert organization.name in qs

    @pytest.mark.django_db
    def test_selector_exists_method(self, organization):
        """Test exists method."""
        assert OrganizationSelector.exists(id=organization.id)

    @pytest.mark.django_db
    def test_selector_active(self, organization):
        """Test active selector method."""
        qs = OrganizationSelector.active()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_inactive(self, organization):
        """Test inactive selector method."""
        organization.status = "inactive"
        organization.save()
        qs = OrganizationSelector.inactive()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_queryset_by_slug(self, organization):
        """Test by_slug queryset method through selector."""
        qs = OrganizationSelector.get_queryset().by_slug(organization.slug)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_queryset_by_code(self, organization):
        """Test by_code queryset method through selector."""
        qs = OrganizationSelector.get_queryset().by_code(organization.code)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_queryset_by_country(self, organization):
        """Test by_country queryset method through selector."""
        qs = OrganizationSelector.get_queryset().by_country(organization.country)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_queryset_by_timezone(self, organization):
        """Test by_timezone queryset method through selector."""
        qs = OrganizationSelector.get_queryset().by_timezone(organization.timezone)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_selector_queryset_with_member_count(self, organization):
        """Test with_member_count queryset method through selector."""
        qs = OrganizationSelector.get_queryset().with_member_count()
        org = qs.filter(pk=organization.pk).first()
        assert org is not None
        assert hasattr(org, "member_count")

    @pytest.mark.django_db
    def test_selector_queryset_lookup(self, organization):
        """Test lookup queryset method through selector."""
        qs = OrganizationSelector.get_queryset().lookup(organization.name)
        assert qs.filter(pk=organization.pk).exists()
