"""
Tests for the real scheduling capacity / overbooking / resolve endpoints.

Contract: studiohub-react `SchedulingRepository.ts` — bare-array capacity
summaries and overbooking alerts computed from real schedules, and
`{success, message}` from resolve-overbooking.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.organization.tests.factories import DepartmentFactory, OrganizationFactory
from apps.scheduling.models import CalendarEvent, Resource, ResourceSchedule

CAPACITY_URL = reverse("api:v1:production:scheduling-capacity")
OVERBOOKING_URL = reverse("api:v1:production:scheduling-overbooking")
RESOLVE_URL = reverse("api:v1:production:scheduling-resolve-overbooking")


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _week_slot(weekday, start_hour, duration_hours):
    now = timezone.now()
    monday = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    start = monday + timedelta(days=weekday, hours=start_hour)
    return start, start + timedelta(hours=duration_hours)


def _current_week_stamp():
    now = timezone.now()
    monday = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return monday.strftime("%Y%m%d")


_resource_seq = 0


def _make_resource(org, department=None, capacity=40, resource_type="Person"):
    global _resource_seq
    _resource_seq += 1
    return Resource.objects.create(
        name=f"Artist {_resource_seq}",
        code=f"CAP-RES-{_resource_seq}",
        resource_type=resource_type,
        organization=org,
        department=department,
        capacity_hours_per_week=capacity,
    )


def _book(resource, weekday, start_hour, duration_hours, event=None, status="Booked"):
    start, end = _week_slot(weekday, start_hour, duration_hours)
    return ResourceSchedule.objects.create(
        resource=resource, start_time=start, end_time=end, status=status, event=event
    )


@pytest.mark.django_db
class TestCapacitySummary:
    def test_unauthenticated_401(self, api_client):
        assert api_client.get(CAPACITY_URL).status_code == 401

    def test_empty_organization(self, staff_client):
        org = OrganizationFactory.create()
        assert staff_client.get(CAPACITY_URL, **_org_header(org)).data == []

    def test_capacity_math(self, staff_client):
        org = OrganizationFactory.create()
        dept = DepartmentFactory.create(organization=org, name="FX")
        resource = _make_resource(org, department=dept, capacity=40)
        _book(resource, weekday=0, start_hour=9, duration_hours=8)
        _book(resource, weekday=1, start_hour=9, duration_hours=12)

        resp = staff_client.get(CAPACITY_URL, **_org_header(org))
        assert resp.status_code == 200
        assert resp.data == [
            {
                "department": "FX",
                "total_resources": 1,
                "total_capacity_hours": 40,
                "allocated_hours": 20.0,
                "free_hours": 20.0,
                "utilization_pct": 50.0,
                "overbooked_count": 0,
            }
        ]

    def test_unassigned_department_group(self, staff_client):
        org = OrganizationFactory.create()
        resource = _make_resource(org, capacity=20)
        _book(resource, weekday=2, start_hour=9, duration_hours=5)

        resp = staff_client.get(CAPACITY_URL, **_org_header(org))
        assert resp.data[0]["department"] == "Unassigned"
        assert resp.data[0]["allocated_hours"] == 5.0

    def test_org_isolation(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        resource = _make_resource(org_a, capacity=40)
        _book(resource, weekday=0, start_hour=9, duration_hours=8)

        assert staff_client.get(CAPACITY_URL, **_org_header(org_b)).data == []


@pytest.mark.django_db
class TestOverbookingAlerts:
    def test_unauthenticated_401(self, api_client):
        assert api_client.get(OVERBOOKING_URL).status_code == 401

    def test_no_alerts_within_capacity(self, staff_client):
        org = OrganizationFactory.create()
        resource = _make_resource(org, capacity=40)
        _book(resource, weekday=0, start_hour=9, duration_hours=8)

        assert staff_client.get(OVERBOOKING_URL, **_org_header(org)).data == []

    def test_alert_shape(self, staff_client):
        org = OrganizationFactory.create()
        dept = DepartmentFactory.create(organization=org, name="Comp")
        resource = _make_resource(org, department=dept, capacity=40)
        start, end = _week_slot(0, 9, 30)
        event = CalendarEvent.objects.create(
            title="Comp sprint",
            organization=org,
            event_type="Work Block",
            start_time=start,
            end_time=end,
        )
        _book(resource, weekday=0, start_hour=9, duration_hours=30, event=event)
        _book(resource, weekday=2, start_hour=9, duration_hours=20)

        resp = staff_client.get(OVERBOOKING_URL, **_org_header(org))
        assert resp.status_code == 200
        assert len(resp.data) == 1
        alert = resp.data[0]
        assert alert["id"].startswith("ob-")
        assert alert["resource_id"] == str(resource.id)
        assert alert["resource_name"] == resource.name
        assert alert["resource_type"] == "person"
        assert alert["department"] == "Comp"
        assert alert["scheduled_hours"] == 50.0
        assert alert["max_capacity_hours"] == 40
        assert alert["excess_hours"] == 10.0
        assert len(alert["conflicting_events"]) == 2
        first = alert["conflicting_events"][0]
        assert first["title"] == "Comp sprint"
        assert first["event_type"] == "task"
        assert first["hours"] == 30.0
        assert "10.0h" in alert["suggested_resolution"]

    def test_org_isolation(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        resource = _make_resource(org_a, capacity=10)
        _book(resource, weekday=0, start_hour=0, duration_hours=20)

        assert staff_client.get(OVERBOOKING_URL, **_org_header(org_b)).data == []


@pytest.mark.django_db
class TestResolveOverbooking:
    def test_unauthenticated_401(self, api_client):
        assert api_client.post(RESOLVE_URL, {}).status_code == 401

    def test_missing_alert_id_400(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.post(RESOLVE_URL, {}, **_org_header(org), format="json")
        assert resp.status_code == 400

    def test_unknown_alert_400(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.post(
            RESOLVE_URL, {"alert_id": "bogus"}, **_org_header(org), format="json"
        )
        assert resp.status_code == 400

    def test_resolve_flags_slots(self, staff_client):
        org = OrganizationFactory.create()
        resource = _make_resource(org, capacity=40)
        slot = _book(resource, weekday=0, start_hour=9, duration_hours=50)
        alert_id = f"ob-{resource.id}-{_current_week_stamp()}"

        resp = staff_client.post(
            RESOLVE_URL,
            {"alert_id": alert_id, "resource_id": str(resource.id)},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["success"] is True
        assert "Flagged 1 booking" in resp.data["message"]

        slot.refresh_from_db()
        assert slot.status == "Overbooked"

        # Second resolve: nothing left unflagged, excess honestly reported.
        again = staff_client.post(
            RESOLVE_URL, {"alert_id": alert_id}, **_org_header(org), format="json"
        )
        assert again.data["success"] is True
        assert "already flagged" in again.data["message"]

    def test_resolve_within_capacity(self, staff_client):
        org = OrganizationFactory.create()
        resource = _make_resource(org, capacity=40)
        _book(resource, weekday=0, start_hour=9, duration_hours=8)

        resp = staff_client.post(
            RESOLVE_URL,
            {"alert_id": f"ob-{resource.id}-{_current_week_stamp()}"},
            **_org_header(org),
            format="json",
        )
        assert resp.data["success"] is True
        assert "within capacity" in resp.data["message"]

    def test_resolve_other_org_404(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        resource = _make_resource(org_a, capacity=10)
        _book(resource, weekday=0, start_hour=0, duration_hours=20)

        resp = staff_client.post(
            RESOLVE_URL,
            {"alert_id": "x", "resource_id": str(resource.id)},
            **_org_header(org_b),
            format="json",
        )
        assert resp.status_code == 404
