"""
API tests for scheduling endpoints.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.scheduling.models import CalendarEvent, Resource, ResourceSchedule, ResourceLeave, Holiday
from apps.organization.models import Organization


@pytest.fixture(autouse=True)
def _org_membership(user):
    """Give the built-in `user` fixture an organization membership.

    Several assertions construct objects with
    ``organization=user.organization_memberships.first().organization``,
    which crashes when the user has no membership.
    """
    from apps.organization.tests.factories import (
        OrganizationFactory,
        OrganizationMembershipFactory,
    )

    org = OrganizationFactory.create()
    OrganizationMembershipFactory.create(organization=org, user=user)
    return org


def _make_resource(user, org, code="RES-001"):
    """Create a person Resource linked to the user."""
    return Resource.objects.create(
        name=f"Resource {code}",
        code=code,
        resource_type="Person",
        organization=org,
        user=user,
    )


@pytest.mark.django_db
class TestSchedulingEndpoints:
    """Test scheduling API endpoints."""
    
    def test_list_calendar_events_empty(self, api_client, user):
        """Test listing calendar events when none exist."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:scheduling:calendar-event-list")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
    
    def test_create_calendar_event(self, api_client, user):
        """Test creating a new calendar event."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:scheduling:calendar-event-list")
        
        data = {
            "title": "Team Meeting",
            "start_time": "2026-09-01T10:00:00Z",
            "end_time": "2026-09-01T11:00:00Z",
            "event_type": "Meeting",
            "status": "Scheduled",
        }
        
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Team Meeting"
    
    def test_update_calendar_event_status(self, api_client, user):
        """Test updating calendar event status."""
        api_client.force_authenticate(user=user)
        event = CalendarEvent.objects.create(
            title="Team Meeting",
            start_time="2026-09-01T10:00:00Z",
            end_time="2026-09-01T11:00:00Z",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:scheduling:calendar-event-update-status", kwargs={"uuid": str(event.id)})
        data = {"status": "Completed"}
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Completed"
    
    def test_list_resources_empty(self, api_client, user):
        """Test listing resources when none exist."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:scheduling:resource-list")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
    
    def test_create_resource(self, api_client, user):
        """Test creating a new resource."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:scheduling:resource-list")
        
        data = {
            "name": "Artist 1",
            "code": "ART-001",
            "resource_type": "Person",
            "status": "Active",
            "capacity_hours_per_week": 40,
        }
        
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Artist 1"
    
    def test_book_resource(self, api_client, user):
        """Test booking a resource."""
        api_client.force_authenticate(user=user)
        resource = Resource.objects.create(
            name="Artist 1",
            code="ART-002",
            resource_type="Person",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:scheduling:resource-book", kwargs={"uuid": str(resource.id)})
        data = {
            "start_time": "2026-09-01T10:00:00Z",
            "end_time": "2026-09-01T14:00:00Z",
        }
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == "Booked"
    
    def test_block_resource(self, api_client, user):
        """Test blocking a resource."""
        api_client.force_authenticate(user=user)
        resource = Resource.objects.create(
            name="Artist 2",
            code="ART-003",
            resource_type="Person",
            organization=user.organization_memberships.first().organization,
        )
        
        url = reverse("api:v1:scheduling:resource-block", kwargs={"uuid": str(resource.id)})
        data = {
            "start_time": "2026-09-01T10:00:00Z",
            "end_time": "2026-09-01T14:00:00Z",
            "reason": "Maintenance",
        }
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == "Blocked"
    
    def test_list_leaves_empty(self, api_client, user):
        """Test listing leaves when none exist."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:scheduling:resource-leave-list")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
    
    def test_submit_leave_request(self, api_client, user, _org_membership):
        """Test submitting a leave request."""
        api_client.force_authenticate(user=user)
        _make_resource(user, _org_membership)
        url = reverse("api:v1:scheduling:resource-leave-list")
        
        data = {
            "leave_type": "Vacation",
            "start_date": "2026-09-01",
            "end_date": "2026-09-05",
            "reason": "Personal time",
        }
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == "Pending"
    
    def test_approve_leave(self, api_client, user, _org_membership):
        """Test approving a leave request."""
        api_client.force_authenticate(user=user)
        resource = _make_resource(user, _org_membership)
        leave = ResourceLeave.objects.create(
            resource=resource,
            leave_type="Vacation",
            start_date="2026-09-01",
            end_date="2026-09-05",
        )
        
        url = reverse("api:v1:scheduling:resource-leave-approve", kwargs={"uuid": str(leave.id)})
        response = api_client.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Approved"
    
    def test_reject_leave(self, api_client, user, _org_membership):
        """Test rejecting a leave request."""
        api_client.force_authenticate(user=user)
        resource = _make_resource(user, _org_membership)
        leave = ResourceLeave.objects.create(
            resource=resource,
            leave_type="Vacation",
            start_date="2026-09-01",
            end_date="2026-09-05",
        )
        
        url = reverse("api:v1:scheduling:resource-leave-reject", kwargs={"uuid": str(leave.id)})
        data = {"rejection_reason": "Too many requests"}
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "Rejected"
    
    def test_list_holidays_empty(self, api_client, user):
        """Test listing holidays when none exist."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:scheduling:holiday-list")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
    
    def test_create_holiday(self, api_client, user):
        """Test creating a holiday."""
        api_client.force_authenticate(user=user)
        url = reverse("api:v1:scheduling:holiday-list")
        
        data = {
            "name": "Company Holiday",
            "holiday_date": "2026-12-25",
            "is_paid": True,
        }
        response = api_client.post(url, data, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Company Holiday"
