"""
Tests for organization API viewsets.

Tests CRUD, filtering, ordering, search, permissions, and error responses
against the actual ``OrganizationViewSet`` implementation.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from django.urls import reverse

from apps.organization.models import Organization
from apps.organization.tests.factories import OrganizationFactory


def _detail_url(org):
    return reverse(
        "api:v1:organization:organization-detail",
        kwargs={"uuid": org.uuid},
    )


def _create_payload(**overrides):
    data = {
        "code": "ORG001",
        "name": "Test Organization",
        "organization_type": "studio",
        "status": "active",
    }
    data.update(overrides)
    return data


class TestOrganizationViewSet:
    """Tests for OrganizationViewSet."""

    @pytest.mark.django_db
    def test_list_organizations(self, staff_client):
        """Test listing organizations."""
        OrganizationFactory.create_batch(3)

        url = reverse("api:v1:organization:organization-list")
        response = staff_client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 3

    @pytest.mark.django_db
    def test_list_organizations_unauthenticated(self, api_client):
        """Test listing organizations without authentication."""
        url = reverse("api:v1:organization:organization-list")
        response = api_client.get(url)

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_organization(self, staff_client):
        """Test retrieving a single organization."""
        organization = OrganizationFactory.create()

        response = staff_client.get(_detail_url(organization))

        assert response.status_code == 200

        data = response.json()

        assert data["id"] == str(organization.id)
        assert data["uuid"] == str(organization.uuid)
        assert data["name"] == organization.name
        assert data["code"] == organization.code

    @pytest.mark.django_db
    def test_retrieve_organization_not_found(self, staff_client):
        """Test retrieving a non-existent organization."""
        url = reverse(
            "api:v1:organization:organization-detail",
            kwargs={"uuid": uuid4()},
        )
        response = staff_client.get(url)

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_create_organization(self, staff_client):
        """Test creating an organization."""
        url = reverse("api:v1:organization:organization-list")
        response = staff_client.post(
            url, _create_payload(), format="json"
        )

        assert response.status_code == 201

        data = response.json()

        assert data["code"] == "ORG001"
        assert data["name"] == "Test Organization"
        assert data["organization_type"] == "studio"

    @pytest.mark.django_db
    def test_create_organization_validation_error(self, staff_client):
        """Test creating an organization with validation errors."""
        url = reverse("api:v1:organization:organization-list")
        response = staff_client.post(
            url, _create_payload(code=""), format="json"
        )

        assert response.status_code == 400
        assert "code" in response.json()["errors"]

    @pytest.mark.django_db
    def test_create_organization_unauthenticated(self, api_client):
        """Test creating an organization without authentication."""
        url = reverse("api:v1:organization:organization-list")
        response = api_client.post(url, _create_payload(), format="json")

        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_organization(self, staff_client):
        """Test updating an organization."""
        organization = OrganizationFactory.create()

        data = {
            "name": "Updated Organization",
            "description": "Updated description",
        }

        response = staff_client.put(
            _detail_url(organization), data, format="json"
        )

        assert response.status_code == 200

        organization.refresh_from_db()
        assert organization.name == "Updated Organization"
        assert organization.description == "Updated description"

    @pytest.mark.django_db
    def test_partial_update_organization(self, staff_client):
        """Test partially updating an organization."""
        organization = OrganizationFactory.create(name="Original Name")

        data = {"name": "Updated Name"}

        response = staff_client.patch(
            _detail_url(organization), data, format="json"
        )

        assert response.status_code == 200

        organization.refresh_from_db()
        assert organization.name == "Updated Name"

    @pytest.mark.django_db
    def test_update_organization_not_found(self, staff_client):
        """Test updating a non-existent organization."""
        url = reverse(
            "api:v1:organization:organization-detail",
            kwargs={"uuid": uuid4()},
        )
        response = staff_client.put(
            url, {"name": "Updated Organization"}, format="json"
        )

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_delete_organization(self, staff_client):
        """Test deleting an organization (soft delete)."""
        organization = OrganizationFactory.create()

        response = staff_client.delete(_detail_url(organization))

        assert response.status_code == 204

        organization.refresh_from_db()
        assert organization.deleted_at is not None

    @pytest.mark.django_db
    def test_delete_organization_not_found(self, staff_client):
        """Test deleting a non-existent organization."""
        url = reverse(
            "api:v1:organization:organization-detail",
            kwargs={"uuid": uuid4()},
        )
        response = staff_client.delete(url)

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_search_organizations(self, staff_client):
        """Test searching organizations."""
        OrganizationFactory.create(name="Test Organization 1")
        OrganizationFactory.create(name="Test Organization 2")
        OrganizationFactory.create(name="Another Organization")

        url = reverse("api:v1:organization:organization-list")
        response = staff_client.get(url, {"search": "Test Organization"})

        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2

    @pytest.mark.django_db
    def test_filter_organizations_by_type(self, staff_client):
        """Test filtering organizations by type."""
        OrganizationFactory.create(organization_type="studio")
        OrganizationFactory.create(organization_type="client")
        OrganizationFactory.create(organization_type="vendor")

        url = reverse("api:v1:organization:organization-list")
        response = staff_client.get(
            url, {"organization_type": "studio"}
        )

        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1

    @pytest.mark.django_db
    def test_order_organizations(self, staff_client):
        """Test ordering organizations."""
        OrganizationFactory.create(name="Z Organization")
        OrganizationFactory.create(name="A Organization")
        OrganizationFactory.create(name="M Organization")

        url = reverse("api:v1:organization:organization-list")
        response = staff_client.get(url, {"ordering": "name"})

        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3
        assert data[0]["name"] == "A Organization"

    @pytest.mark.django_db
    def test_filter_by_status(self, staff_client):
        """Test filtering organizations by status."""
        OrganizationFactory.create(status="active")
        OrganizationFactory.create(status="inactive")
        OrganizationFactory.create(status="active")

        url = reverse("api:v1:organization:organization-list")
        response = staff_client.get(url, {"status": "active"})

        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2

    @pytest.mark.django_db
    def test_filter_by_country(self, staff_client):
        """Test filtering organizations by country."""
        OrganizationFactory.create(country="US")
        OrganizationFactory.create(country="UK")
        OrganizationFactory.create(country="US")

        url = reverse("api:v1:organization:organization-list")
        response = staff_client.get(url, {"country": "US"})

        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2

    @pytest.mark.django_db
    def test_admin_can_view(self, admin_client):
        """Test admin can view an organization."""
        organization = OrganizationFactory.create()

        response = admin_client.get(_detail_url(organization))

        assert response.status_code == 200

    @pytest.mark.django_db
    def test_staff_can_view(self, staff_client):
        """Test staff can view an organization."""
        organization = OrganizationFactory.create()

        response = staff_client.get(_detail_url(organization))

        assert response.status_code == 200

    @pytest.mark.django_db
    def test_invalid_uuid(self, staff_client):
        """Test with invalid UUID format."""
        url = reverse(
            "api:v1:organization:organization-detail",
            kwargs={"uuid": "invalid-uuid"},
        )
        response = staff_client.get(url)

        assert response.status_code in (400, 404)

    @pytest.mark.django_db
    def test_invalid_organization_type(self, staff_client):
        """Test with invalid organization type."""
        url = reverse("api:v1:organization:organization-list")
        response = staff_client.post(
            url,
            _create_payload(organization_type="INVALID"),
            format="json",
        )

        assert response.status_code == 400
        assert "organization_type" in response.json()["errors"]

    @pytest.mark.django_db
    def test_duplicate_code(self, staff_client):
        """Test with duplicate code."""
        OrganizationFactory.create(code="ORG001")

        url = reverse("api:v1:organization:organization-list")
        response = staff_client.post(
            url, _create_payload(), format="json"
        )

        assert response.status_code == 400
        assert "code" in response.json()["errors"]

    @pytest.mark.django_db
    def test_invalid_email(self, staff_client):
        """Test with invalid email."""
        url = reverse("api:v1:organization:organization-list")
        response = staff_client.post(
            url,
            _create_payload(email="invalid-email"),
            format="json",
        )

        assert response.status_code == 400
        assert "email" in response.json()["errors"]

    @pytest.mark.django_db
    def test_invalid_website(self, staff_client):
        """Test with invalid website."""
        url = reverse("api:v1:organization:organization-list")
        response = staff_client.post(
            url,
            _create_payload(website="not-a-website"),
            format="json",
        )

        assert response.status_code == 400
        assert "website" in response.json()["errors"]

    @pytest.mark.django_db
    def test_content_type_header(self, staff_client):
        """Test Content-Type header."""
        url = reverse("api:v1:organization:organization-list")
        response = staff_client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

    @pytest.mark.django_db
    def test_regular_user_forbidden_on_list(self, authenticated_client):
        """Test a regular user without permissions gets 403."""
        url = reverse("api:v1:organization:organization-list")
        response = authenticated_client.get(url)

        assert response.status_code == 403

    @pytest.mark.django_db
    def test_regular_user_forbidden_on_update(self, authenticated_client):
        """Test a regular user cannot update an organization."""
        organization = OrganizationFactory.create()

        response = authenticated_client.patch(
            _detail_url(organization),
            {"name": "Updated"},
            format="json",
        )

        assert response.status_code == 403
