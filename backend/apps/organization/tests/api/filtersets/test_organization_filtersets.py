"""
Tests for organization API filtersets.

This module contains comprehensive tests for all organization filtersets,
testing search, ordering, date filtering, boolean filtering, multiple filters, and invalid filters.
"""

from __future__ import annotations

import pytest

from apps.organization.api.filtersets import OrganizationFilterSet
from apps.organization.models import Organization
from apps.organization.tests.factories import OrganizationFactory


class TestOrganizationFilterSet:
    """Tests for OrganizationFilterSet."""

    @pytest.mark.django_db
    def test_filter_by_code(self):
        """Test filtering by code."""
        org1 = OrganizationFactory.create(code="ORG001")
        OrganizationFactory.create(code="ORG002")

        filterset = OrganizationFilterSet(
            data={"code": "ORG001"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_filter_by_name(self):
        """Test filtering by name."""
        org1 = OrganizationFactory.create(name="Test Organization 1")
        OrganizationFactory.create(name="Another Organization")

        filterset = OrganizationFilterSet(
            data={"name": "Test Organization"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_filter_by_organization_type(self):
        """Test filtering by organization type."""
        org1 = OrganizationFactory.create(organization_type="studio")
        OrganizationFactory.create(organization_type="client")

        filterset = OrganizationFilterSet(
            data={"organization_type": "studio"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_filter_by_country(self):
        """Test filtering by country."""
        org1 = OrganizationFactory.create(country="US")
        OrganizationFactory.create(country="UK")

        filterset = OrganizationFilterSet(
            data={"country": "US"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_filter_by_language(self):
        """Test filtering by language."""
        org1 = OrganizationFactory.create(language="en")
        OrganizationFactory.create(language="fr")

        filterset = OrganizationFilterSet(
            data={"language": "en"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_filter_by_status(self):
        """Test filtering by status."""
        org1 = OrganizationFactory.create(status="active")
        OrganizationFactory.create(status="inactive")

        filterset = OrganizationFilterSet(
            data={"status": "active"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_search_filter(self):
        """Test search filter."""
        org1 = OrganizationFactory.create(name="Test Organization", code="ORG001")
        OrganizationFactory.create(name="Another Organization", code="ORG002")

        filterset = OrganizationFilterSet(
            data={"search": "Test Organization"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_ordering_filter(self):
        """Test ordering filter."""
        OrganizationFactory.create(name="Z Organization")
        OrganizationFactory.create(name="A Organization")
        OrganizationFactory.create(name="M Organization")

        filterset = OrganizationFilterSet(
            data={"ordering": "name"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 3
        assert results.first().name == "A Organization"

    @pytest.mark.django_db
    def test_ordering_descending_filter(self):
        """Test ordering descending filter."""
        OrganizationFactory.create(name="Z Organization")
        OrganizationFactory.create(name="A Organization")
        OrganizationFactory.create(name="M Organization")

        filterset = OrganizationFilterSet(
            data={"ordering": "-name"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 3
        assert results.first().name == "Z Organization"

    @pytest.mark.django_db
    def test_date_range_filter(self):
        """Test date range filter."""

        from django.utils import timezone

        org1 = OrganizationFactory.create()
        org2 = OrganizationFactory.create()
        org3 = OrganizationFactory.create()

        # created_at is auto-now-add, so set the timestamps explicitly.
        Organization.objects.filter(pk=org1.pk).update(
            created_at=timezone.make_aware(timezone.datetime(2024, 1, 1))
        )
        Organization.objects.filter(pk=org2.pk).update(
            created_at=timezone.make_aware(timezone.datetime(2024, 2, 1))
        )
        Organization.objects.filter(pk=org3.pk).update(
            created_at=timezone.make_aware(timezone.datetime(2024, 3, 1))
        )

        filterset = OrganizationFilterSet(
            data={"created_after": "2024-01-15", "created_before": "2024-02-15"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org2

    @pytest.mark.django_db
    def test_multiple_filters(self):
        """Test multiple filters combined."""
        org1 = OrganizationFactory.create(
            code="ORG001", name="Test Organization", organization_type="studio"
        )
        OrganizationFactory.create(
            code="ORG002", name="Test Organization", organization_type="client"
        )
        OrganizationFactory.create(
            code="ORG003", name="Another Organization", organization_type="studio"
        )

        filterset = OrganizationFilterSet(
            data={
                "name": "Test Organization",
                "organization_type": "studio",
            },
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1

    @pytest.mark.django_db
    def test_invalid_filter_ignored(self):
        """Test that invalid filters are ignored."""
        OrganizationFactory.create()

        filterset = OrganizationFilterSet(
            data={"invalid_filter": "value"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        # Should return all organizations since invalid filter is ignored
        assert results.count() == 1

    @pytest.mark.django_db
    def test_empty_filter_returns_all(self):
        """Test that empty filter returns all organizations."""
        OrganizationFactory.create_batch(3)

        filterset = OrganizationFilterSet(
            data={},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 3

    @pytest.mark.django_db
    def test_no_results_for_nonexistent_code(self):
        """Test filtering with non-existent code."""
        OrganizationFactory.create(code="ORG001")

        filterset = OrganizationFilterSet(
            data={"code": "ORG999"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 0

    @pytest.mark.django_db
    def test_partial_name_match(self):
        """Test partial name matching."""
        OrganizationFactory.create(name="Test Organization")
        OrganizationFactory.create(name="Another Organization")

        filterset = OrganizationFilterSet(
            data={"name": "Organization"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 2

    @pytest.mark.django_db
    def test_case_insensitive_search(self):
        """Test case insensitive search."""
        org1 = OrganizationFactory.create(name="Test Organization")
        OrganizationFactory.create(name="Another Organization")

        filterset = OrganizationFilterSet(
            data={"name": "test organization"},
            queryset=Organization.objects.all(),
        )

        assert filterset.is_valid()
        results = filterset.qs

        assert results.count() == 1
        assert results.first() == org1
