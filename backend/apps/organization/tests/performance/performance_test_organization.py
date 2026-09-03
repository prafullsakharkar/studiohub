"""
Performance tests for organization application.

These tests measure and verify the performance characteristics of
organization operations and queries.
"""

from __future__ import annotations

import time

from django.test import TestCase

from apps.organization.models.organization import Organization
from apps.organization.services.organization import OrganizationService
from apps.organization.tests.factories import OrganizationFactory


class OrganizationPerformanceTests(TestCase):
    """Performance tests for Organization model."""

    def test_organization_creation_performance(self) -> None:
        """Test organization creation performance."""
        # Arrange
        num_organizations = 100

        # Act
        start_time = time.time()
        for i in range(num_organizations):
            Organization.objects.create(
                code=f"ORG{i:03d}",
                name=f"Organization {i}",
                organization_type="STUDIO",
                email=f"org{i}@example.com",
                country="IN",
                language="en",
                currency="INR",
                timezone="Asia/Kolkata",
            )
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        avg_time_per_org = elapsed_time / num_organizations

        # Should create 100 organizations in less than 5 seconds
        assert elapsed_time < 5.0, f"Creation took {elapsed_time:.2f}s, expected < 5s"
        # Each organization should take less than 50ms on average
        assert (
            avg_time_per_org < 0.05
        ), f"Average time per org: {avg_time_per_org*1000:.2f}ms"

    def test_organization_query_performance(self) -> None:
        """Test organization query performance."""
        # Arrange
        num_organizations = 1000
        OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        organizations = list(Organization.objects.all())
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(organizations) == num_organizations
        # Should query 1000 organizations in less than 2 seconds
        assert elapsed_time < 2.0, f"Query took {elapsed_time:.2f}s, expected < 2s"

    def test_organization_filter_performance(self) -> None:
        """Test organization filter performance."""
        # Arrange
        num_organizations = 1000
        OrganizationFactory.create_batch(num_organizations, status="active")
        OrganizationFactory.create_batch(100, status="inactive")

        # Act
        start_time = time.time()
        active_organizations = list(Organization.objects.filter(status="active"))
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(active_organizations) == num_organizations
        # Filter should complete in less than 1 second
        assert elapsed_time < 1.0, f"Filter took {elapsed_time:.2f}s, expected < 1s"

    def test_organization_with_statistics_performance(self) -> None:
        """Test organization with_statistics query performance."""
        # Arrange
        num_organizations = 100
        OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        organizations = list(Organization.objects.with_statistics())
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(organizations) == num_organizations
        # Should complete in less than 3 seconds
        assert elapsed_time < 3.0, f"Query took {elapsed_time:.2f}s, expected < 3s"


class OrganizationManagerPerformanceTests(TestCase):
    """Performance tests for OrganizationManager."""

    def test_manager_active_filter_performance(self) -> None:
        """Test active filter performance."""
        # Arrange
        num_active = 500
        num_inactive = 500
        OrganizationFactory.create_batch(num_active, status="active")
        OrganizationFactory.create_batch(num_inactive, status="inactive")

        # Act
        start_time = time.time()
        active_orgs = list(Organization.objects.active())
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(active_orgs) == num_active
        assert elapsed_time < 1.0, f"Active filter took {elapsed_time:.2f}s, expected < 1s"

    def test_manager_inactive_filter_performance(self) -> None:
        """Test inactive filter performance."""
        # Arrange
        num_active = 500
        num_inactive = 500
        OrganizationFactory.create_batch(num_active, status="active")
        OrganizationFactory.create_batch(num_inactive, status="inactive")

        # Act
        start_time = time.time()
        inactive_orgs = list(Organization.objects.inactive())
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(inactive_orgs) == num_inactive
        assert (
            elapsed_time < 1.0
        ), f"Inactive filter took {elapsed_time:.2f}s, expected < 1s"

    def test_manager_lookup_performance(self) -> None:
        """Test lookup performance."""
        # Arrange
        num_organizations = 1000
        OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        for i in range(100):
            org = Organization.objects.lookup(f"ORG{i:03d}").first()
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        # 100 lookups should complete in less than 2 seconds
        assert elapsed_time < 2.0, f"Lookup took {elapsed_time:.2f}s, expected < 2s"


class OrganizationQuerySetPerformanceTests(TestCase):
    """Performance tests for OrganizationQuerySet."""

    def test_queryset_select_related_performance(self) -> None:
        """Test select_related performance."""
        # Arrange
        num_organizations = 100
        OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        organizations = list(Organization.objects.select_related().all())
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(organizations) == num_organizations
        # Should complete in less than 2 seconds
        assert elapsed_time < 2.0, f"Select related took {elapsed_time:.2f}s, expected < 2s"

    def test_queryset_prefetch_related_performance(self) -> None:
        """Test prefetch_related performance."""
        # Arrange
        num_organizations = 100
        OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        organizations = list(Organization.objects.prefetch_related().all())
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(organizations) == num_organizations
        # Should complete in less than 2 seconds
        assert (
            elapsed_time < 2.0
        ), f"Prefetch related took {elapsed_time:.2f}s, expected < 2s"

    def test_queryset_values_performance(self) -> None:
        """Test values() performance."""
        # Arrange
        num_organizations = 1000
        OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        organizations = list(Organization.objects.values("uuid", "code", "name"))
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(organizations) == num_organizations
        # Should complete in less than 1 second
        assert elapsed_time < 1.0, f"Values took {elapsed_time:.2f}s, expected < 1s"

    def test_queryset_values_list_performance(self) -> None:
        """Test values_list() performance."""
        # Arrange
        num_organizations = 1000
        OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        codes = list(Organization.objects.values_list("code", flat=True))
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        assert len(codes) == num_organizations
        # Should complete in less than 1 second
        assert elapsed_time < 1.0, f"Values list took {elapsed_time:.2f}s, expected < 1s"


class OrganizationServicePerformanceTests(TestCase):
    """Performance tests for OrganizationService."""

    def test_service_create_batch_performance(self) -> None:
        """Test batch creation performance."""
        # Arrange
        num_organizations = 100
        data = {
            "organization_type": "STUDIO",
            "email": "test@example.com",
            "country": "IN",
            "language": "en",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
        }

        # Act
        start_time = time.time()
        for i in range(num_organizations):
            OrganizationService.create(
                code=f"ORG{i:03d}",
                name=f"Organization {i}",
                **data,
            )
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        avg_time_per_org = elapsed_time / num_organizations
        # Should create 100 organizations in less than 10 seconds
        assert (
            elapsed_time < 10.0
        ), f"Batch creation took {elapsed_time:.2f}s, expected < 10s"
        # Each organization should take less than 100ms on average
        assert (
            avg_time_per_org < 0.1
        ), f"Average time per org: {avg_time_per_org*1000:.2f}ms"

    def test_service_update_batch_performance(self) -> None:
        """Test batch update performance."""
        # Arrange
        num_organizations = 100
        organizations = OrganizationFactory.create_batch(num_organizations)

        # Act
        start_time = time.time()
        for org in organizations:
            OrganizationService.update(organization=org, name=f"Updated {org.name}")
        end_time = time.time()

        # Assert
        elapsed_time = end_time - start_time
        avg_time_per_org = elapsed_time / num_organizations
        # Should update 100 organizations in less than 10 seconds
        assert elapsed_time < 10.0, f"Batch update took {elapsed_time:.2f}s, expected < 10s"
        # Each organization should take less than 100ms on average
        assert (
            avg_time_per_org < 0.1
        ), f"Average time per org: {avg_time_per_org*1000:.2f}ms"
