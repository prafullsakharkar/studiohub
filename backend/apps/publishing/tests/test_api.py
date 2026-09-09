"""
API tests for publishing endpoints.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.publishing.models import PublishItem


@pytest.fixture(autouse=True)
def _org_membership(user, staff_user):
    """Give `user` and `staff_user` an organization membership.

    Several assertions construct objects with
    ``organization=user.organization_memberships.first().organization``,
    which crashes when the user has no membership. Tests authenticate via
    `staff_client`, so `staff_user` needs a membership for headerless
    organization resolution too.
    """
    from apps.organization.tests.factories import (
        OrganizationFactory,
        OrganizationMembershipFactory,
    )

    org = OrganizationFactory.create()
    OrganizationMembershipFactory.create(organization=org, user=user)
    OrganizationMembershipFactory.create(organization=org, user=staff_user)
    return org


@pytest.mark.django_db
class TestPublishingEndpoints:
    """Test publishing API endpoints."""
    
    def test_list_publishing_empty(self, staff_client):
        """Test listing publishing items when none exist."""
        url = reverse("api:v1:publishing:publishing-list")
        response = staff_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_create_publishing_item(self, staff_client):
        """Test creating a new publishing item."""
        url = reverse("api:v1:publishing:publishing-list")
        
        data = {
            "name": "Test Publish",
            "code": "PUB-TEST-001",
            "entity_type": "Shot",
            "entity_id": "shot-001",
            "entity_code": "SH001",
            "entity_name": "Test Shot",
            "dcc_tool": "Nuke",
            "dcc_version": "15.0",
            "source_file": "/path/to/source.nk",
        }
        
        response = staff_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Test Publish"
        assert response.data["code"] == "PUB-TEST-001"
    
    def test_get_publishing_detail(self, staff_client, _org_membership):
        """Test getting publishing item details."""
        publish = PublishItem.objects.create(
            name="Test Publish",
            code="PUB-TEST-002",
            entity_type="Shot",
            entity_id="shot-002",
            entity_code="SH002",
            entity_name="Test Shot",
            dcc_tool="Nuke",
            organization=_org_membership,
        )
        
        url = reverse("api:v1:publishing:publishing-detail", kwargs={"uuid": str(publish.id)})
        response = staff_client.get(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Test Publish"
    
    def test_validate_publishing(self, staff_client, _org_membership):
        """Test validating a publishing item."""
        publish = PublishItem.objects.create(
            name="Test Publish",
            code="PUB-TEST-003",
            entity_type="Shot",
            entity_id="shot-003",
            entity_code="SH003",
            entity_name="Test Shot",
            dcc_tool="Nuke",
            organization=_org_membership,
        )
        
        url = reverse("api:v1:publishing:publishing-validate", kwargs={"uuid": str(publish.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))
        
        assert response.status_code == status.HTTP_200_OK
        assert "success" in response.data
    
    def test_republish_publishing(self, staff_client, _org_membership):
        """Test republishing an item."""
        publish = PublishItem.objects.create(
            name="Test Publish",
            code="PUB-TEST-004",
            entity_type="Shot",
            entity_id="shot-004",
            entity_code="SH004",
            entity_name="Test Shot",
            dcc_tool="Nuke",
            organization=_org_membership,
        )
        
        url = reverse("api:v1:publishing:publishing-republish", kwargs={"uuid": str(publish.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))
        
        assert response.status_code == status.HTTP_201_CREATED
        assert "PUB-TEST-004_v2" in response.data["code"]
    
    def test_unpublish_publishing(self, staff_client, _org_membership):
        """Test unpublishing an item."""
        publish = PublishItem.objects.create(
            name="Test Publish",
            code="PUB-TEST-005",
            entity_type="Shot",
            entity_id="shot-005",
            entity_code="SH005",
            entity_name="Test Shot",
            dcc_tool="Nuke",
            organization=_org_membership,
        )
        
        url = reverse("api:v1:publishing:publishing-unpublish", kwargs={"uuid": str(publish.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Cancelled"
    
    def test_retry_publishing(self, staff_client, _org_membership):
        """Test retrying a failed publish."""
        publish = PublishItem.objects.create(
            name="Test Publish",
            code="PUB-TEST-006",
            entity_type="Shot",
            entity_id="shot-006",
            entity_code="SH006",
            entity_name="Test Shot",
            dcc_tool="Nuke",
            status="Failed",
            organization=_org_membership,
        )
        
        url = reverse("api:v1:publishing:publishing-retry", kwargs={"uuid": str(publish.id)})
        response = staff_client.post(url, HTTP_X_ORGANIZATION_ID=str(_org_membership.id))
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Pending"
