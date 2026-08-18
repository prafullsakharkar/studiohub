"""
Tests for organization API serializers.

This module contains comprehensive tests for all organization serializers,
testing create, update, detail, list, summary, nested, and bulk operations.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.organization.api.serializers.organization import (
    OrganizationCreateSerializer,
    OrganizationDetailSerializer,
    OrganizationListSerializer,
    OrganizationSummarySerializer,
    OrganizationUpdateSerializer,
)
from apps.organization.models import Organization
from apps.organization.tests.factories import OrganizationFactory


class TestOrganizationSummarySerializer:
    """Tests for OrganizationSummarySerializer."""

    @pytest.mark.django_db
    def test_serializer_with_valid_data(self, organization):
        """Test serializer with valid organization data."""
        serializer = OrganizationSummarySerializer(organization)

        data = serializer.data

        assert "id" in data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data
        assert "organization_type" in data
        assert "status" in data
        assert "logo" in data

    @pytest.mark.django_db
    def test_serializer_fields(self, organization):
        """Test serializer fields match expected."""
        serializer = OrganizationSummarySerializer(organization)

        data = serializer.data

        expected_fields = {
            "id",
            "uuid",
            "name",
            "code",
            "organization_type",
            "status",
            "logo",
        }

        assert expected_fields.issubset(set(data.keys()))


class TestOrganizationListSerializer:
    """Tests for OrganizationListSerializer."""

    @pytest.mark.django_db
    def test_serializer_with_valid_data(self, organization):
        """Test serializer with valid organization data."""
        serializer = OrganizationListSerializer(organization)

        data = serializer.data

        assert "id" in data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data
        assert "organization_type" in data
        assert "status" in data
        assert "logo" in data


class TestOrganizationDetailSerializer:
    """Tests for OrganizationDetailSerializer."""

    @pytest.mark.django_db
    def test_serializer_with_valid_data(self, organization):
        """Test serializer with valid organization data."""
        serializer = OrganizationDetailSerializer(organization)

        data = serializer.data

        assert "id" in data
        assert "uuid" in data
        assert "name" in data
        assert "code" in data
        assert "slug" in data
        assert "organization_type" in data
        assert "status" in data
        assert "logo" in data
        assert "description" in data
        assert "website" in data
        assert "email" in data
        assert "phone" in data
        assert "country" in data
        assert "timezone" in data
        assert "language" in data
        assert "currency" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "created_by" in data
        assert "updated_by" in data
        assert "deleted_at" in data


class TestOrganizationCreateSerializer:
    """Tests for OrganizationCreateSerializer."""

    @pytest.mark.django_db
    def test_serializer_with_valid_data(self):
        """Test serializer with valid create data."""
        user = UserFactory.create()

        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "studio",
            "status": "active",
            "description": "Test description",
            "website": "https://example.com",
            "email": "contact@example.com",
            "phone": "+1234567890",
            "country": "US",
            "timezone": "America/New_York",
            "language": "en",
            "currency": "USD",
        }

        serializer = OrganizationCreateSerializer(data=data, context={"user": user})
        assert serializer.is_valid(), serializer.errors

        validated_data = serializer.validated_data

        assert validated_data["code"] == "ORG001"
        assert validated_data["name"] == "Test Organization"
        assert validated_data["organization_type"] == "studio"
        assert validated_data["status"] == "active"

    @pytest.mark.django_db
    def test_serializer_with_invalid_data(self):
        """Test serializer with invalid data."""
        user = UserFactory.create()

        # Missing required fields
        data = {}

        serializer = OrganizationCreateSerializer(data=data, context={"user": user})
        assert not serializer.is_valid()

        # Should have errors for required fields
        assert "code" in serializer.errors
        assert "name" in serializer.errors

    @pytest.mark.django_db
    def test_serializer_creates_organization(self):
        """Test serializer creates organization."""
        user = UserFactory.create()

        data = {
            "code": "ORG001",
            "name": "Test Organization",
            "organization_type": "studio",
            "status": "active",
        }

        serializer = OrganizationCreateSerializer(data=data, context={"user": user})
        assert serializer.is_valid(), serializer.errors

        organization = serializer.save()

        assert organization is not None
        assert organization.code == "ORG001"
        assert organization.name == "Test Organization"
        assert organization.organization_type == "studio"
        assert organization.status == "active"


class TestOrganizationUpdateSerializer:
    """Tests for OrganizationUpdateSerializer."""

    @pytest.mark.django_db
    def test_serializer_with_valid_data(self, organization):
        """Test serializer with valid update data."""
        user = UserFactory.create()

        data = {
            "name": "Updated Organization",
            "description": "Updated description",
            "website": "https://updated.example.com",
            "email": "updated@example.com",
            "phone": "+0987654321",
        }

        serializer = OrganizationUpdateSerializer(
            organization, data=data, partial=True, context={"user": user}
        )
        assert serializer.is_valid(), serializer.errors

        validated_data = serializer.validated_data

        assert validated_data["name"] == "Updated Organization"
        assert validated_data["description"] == "Updated description"

    @pytest.mark.django_db
    def test_serializer_updates_organization(self, organization):
        """Test serializer updates organization."""
        user = UserFactory.create()

        original_name = organization.name

        data = {
            "name": "Updated Organization",
        }

        serializer = OrganizationUpdateSerializer(
            organization, data=data, partial=True, context={"user": user}
        )
        assert serializer.is_valid(), serializer.errors

        updated_organization = serializer.save()

        assert updated_organization is not None
        assert updated_organization.name != original_name
        assert updated_organization.name == "Updated Organization"

    @pytest.mark.django_db
    def test_serializer_with_invalid_email(self, organization):
        """Test serializer with invalid email."""
        user = UserFactory.create()

        data = {
            "email": "invalid-email",
        }

        serializer = OrganizationUpdateSerializer(
            organization, data=data, partial=True, context={"user": user}
        )
        assert not serializer.is_valid()

        assert "email" in serializer.errors

    @pytest.mark.django_db
    def test_serializer_with_invalid_website(self, organization):
        """Test serializer with invalid website."""
        user = UserFactory.create()

        data = {
            "website": "not-a-website",
        }

        serializer = OrganizationUpdateSerializer(
            organization, data=data, partial=True, context={"user": user}
        )
        assert not serializer.is_valid()

        assert "website" in serializer.errors
