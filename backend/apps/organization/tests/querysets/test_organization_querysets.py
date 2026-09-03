"""
Organization queryset tests.
"""

from __future__ import annotations

import pytest

from apps.organization.models.organization import Organization
from apps.organization.querysets import OrganizationQuerySet


class TestOrganizationQuerySet:
    """Tests for OrganizationQuerySet."""

    @pytest.mark.django_db
    def test_queryset_active(self, organization):
        """Test active queryset method."""
        qs = Organization.objects.active()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_inactive(self, organization):
        """Test inactive queryset method."""
        organization.status = "inactive"
        organization.save()
        qs = Organization.objects.inactive()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_archived(self, organization):
        """Test archived queryset method."""
        organization.status = "archived"
        organization.save()
        qs = Organization.objects.archived()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_by_slug(self, organization):
        """Test by_slug queryset method."""
        qs = Organization.objects.by_slug(organization.slug)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_by_code(self, organization):
        """Test by_code queryset method."""
        qs = Organization.objects.by_code(organization.code)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_by_country(self, organization):
        """Test by_country queryset method."""
        qs = Organization.objects.by_country(organization.country)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_by_timezone(self, organization):
        """Test by_timezone queryset method."""
        qs = Organization.objects.by_timezone(organization.timezone)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_with_member_count(self, organization):
        """Test with_member_count queryset method."""
        qs = Organization.objects.with_member_count()
        org = qs.filter(pk=organization.pk).first()
        assert org is not None
        assert hasattr(org, "member_count")

    @pytest.mark.django_db
    def test_queryset_lookup_by_name(self, organization):
        """Test lookup queryset method by name."""
        qs = Organization.objects.lookup(organization.name)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_lookup_by_code(self, organization):
        """Test lookup queryset method by code."""
        qs = Organization.objects.lookup(organization.code)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_lookup_by_slug(self, organization):
        """Test lookup queryset method by slug."""
        qs = Organization.objects.lookup(organization.slug)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_search(self, organization):
        """Test search queryset method."""
        qs = Organization.objects.search(organization.name[:5])
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_ordering(self, organization):
        """Test ordering queryset method."""
        qs = Organization.objects.order_by("name")
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_filter(self, organization):
        """Test filter queryset method."""
        qs = Organization.objects.filter(name=organization.name)
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_exclude(self, organization):
        """Test exclude queryset method."""
        qs = Organization.objects.exclude(name="Different Name")
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_exists(self, organization):
        """Test exists queryset method."""
        assert Organization.objects.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_count(self, organization):
        """Test count queryset method."""
        assert Organization.objects.count() >= 1

    @pytest.mark.django_db
    def test_queryset_first(self, organization):
        """Test first queryset method."""
        org = Organization.objects.first()
        assert org is not None

    @pytest.mark.django_db
    def test_queryset_last(self, organization):
        """Test last queryset method."""
        org = Organization.objects.last()
        assert org is not None

    @pytest.mark.django_db
    def test_queryset_none(self, organization):
        """Test none queryset method."""
        qs = Organization.objects.none()
        assert qs.count() == 0

    @pytest.mark.django_db
    def test_queryset_all(self, organization):
        """Test all queryset method."""
        qs = Organization.objects.all()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_values(self, organization):
        """Test values queryset method."""
        qs = Organization.objects.values("name")
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_values_list(self, organization):
        """Test values_list queryset method."""
        qs = Organization.objects.values_list("name", flat=True)
        assert organization.name in qs

    @pytest.mark.django_db
    def test_queryset_distinct(self, organization):
        """Test distinct queryset method."""
        qs = Organization.objects.distinct()
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_annotate(self, organization):
        """Test annotate queryset method."""
        from django.db.models import Count

        qs = Organization.objects.annotate(member_count=Count("memberships"))
        assert qs.filter(pk=organization.pk).exists()

    @pytest.mark.django_db
    def test_queryset_aggregate(self, organization):
        """Test aggregate queryset method."""
        from django.db.models import Count

        result = Organization.objects.aggregate(count=Count("id"))
        assert result["count"] >= 1

    @pytest.mark.django_db
    def test_queryset_default_ordering(self, organization):
        """Test default ordering."""
        qs = Organization.objects.all()
        assert qs.model._meta.ordering == ("name",)

    @pytest.mark.django_db
    def test_queryset_search_fields(self, organization):
        """Test search fields."""
        assert OrganizationQuerySet.search_fields == (
            "name",
            "code",
            "email",
            "website",
            "description",
        )

    @pytest.mark.django_db
    def test_queryset_default_ordering_field(self, organization):
        """Test default ordering field."""
        assert OrganizationQuerySet.default_ordering == ("name",)
