"""
Organization isolation tests for the scheduling API.

Verifies fail-closed organization scoping:
  * create auto-assigns the active organization (from the X-Organization header);
  * listing is scoped to the active organization (cross-tenant isolation);
  * switching the active organization changes the returned set;
  * detail access to another organization's event returns 404;
  * no organization context resolves to empty results / rejected writes;
  * cross-organization resource references are rejected.
"""
import uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import OrganizationFactory
from apps.scheduling.models import CalendarEvent, Resource


def _event_payload(**overrides):
    payload = {
        "title": "Org Scoped Event",
        "start_time": "2026-09-10T10:00:00Z",
        "end_time": "2026-09-10T11:00:00Z",
    }
    payload.update(overrides)
    return payload


def _create_resource(org, code):
    return Resource.objects.create(
        name=f"Resource {code}",
        code=code,
        resource_type="Person",
        organization=org,
    )


@pytest.mark.django_db
class TestCalendarEventOrganizationScoping:
    def _list_url(self):
        return reverse("api:v1:scheduling:calendar-event-list")

    def _detail_url(self, event):
        return reverse(
            "api:v1:scheduling:calendar-event-detail",
            kwargs={"uuid": str(event.id)},
        )

    def test_create_auto_assigns_organization_from_header(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.post(
            self._list_url(),
            data=_event_payload(),
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        event = CalendarEvent.objects.get(title="Org Scoped Event")
        assert event.organization_id == org.id

    def test_list_is_scoped_to_organization_header(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        CalendarEvent.objects.create(
            title="Event A",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=org_a,
        )
        CalendarEvent.objects.create(
            title="Event B",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=org_b,
        )
        resp = staff_client.get(
            self._list_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id)
        )
        assert resp.status_code == status.HTTP_200_OK
        titles = {e["title"] for e in resp.data["results"]}
        assert "Event A" in titles
        assert "Event B" not in titles

    def test_switching_organization_header_changes_results(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        CalendarEvent.objects.create(
            title="Event A2",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=org_a,
        )
        CalendarEvent.objects.create(
            title="Event B2",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=org_b,
        )
        resp_b = staff_client.get(
            self._list_url(), HTTP_X_ORGANIZATION_ID=str(org_b.id)
        )
        assert resp_b.status_code == status.HTTP_200_OK
        titles_b = {e["title"] for e in resp_b.data["results"]}
        assert "Event B2" in titles_b
        assert "Event A2" not in titles_b

    def test_detail_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        event = CalendarEvent.objects.create(
            title="Event A3",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=org_a,
        )
        resp = staff_client.get(
            self._detail_url(event),
            HTTP_X_ORGANIZATION_ID=str(org_b.id),
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_list_without_org_context_fails_closed(self, staff_client):
        """No org header must not leak every organization's events."""
        CalendarEvent.objects.create(
            title="Event A4",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=OrganizationFactory.create(),
        )
        resp = staff_client.get(self._list_url())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"] == []

    def test_list_with_unknown_org_id_does_not_leak(self, staff_client):
        """An unresolvable org id must not fall back to all events."""
        CalendarEvent.objects.create(
            title="Event A5",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=OrganizationFactory.create(),
        )
        resp = staff_client.get(
            self._list_url(),
            HTTP_X_ORGANIZATION_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"] == []

    def test_create_without_org_context_fails_closed(self, staff_client):
        """Create must not assign to an arbitrary/first organization."""
        resp = staff_client.post(
            self._list_url(),
            data=_event_payload(title="No Org Event"),
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert not CalendarEvent.objects.filter(title="No Org Event").exists()


@pytest.mark.django_db
class TestResourceScheduleOrganizationScoping:
    def _list_url(self):
        return reverse("api:v1:scheduling:resource-schedule-list")

    def test_create_with_cross_org_resource_is_rejected(self, staff_client):
        """A schedule may only reference resources of the active org."""
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        foreign_resource = _create_resource(org_b, "RES-ORG-F1")

        resp = staff_client.post(
            self._list_url(),
            data={
                "resource": str(foreign_resource.id),
                "start_time": "2026-09-10T10:00:00Z",
                "end_time": "2026-09-10T12:00:00Z",
            },
            HTTP_X_ORGANIZATION_ID=str(org_a.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_same_org_resource_is_allowed(self, staff_client):
        org = OrganizationFactory.create()
        resource = _create_resource(org, "RES-ORG-S1")

        resp = staff_client.post(
            self._list_url(),
            data={
                "resource": str(resource.id),
                "start_time": "2026-09-10T10:00:00Z",
                "end_time": "2026-09-10T12:00:00Z",
            },
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data

    def test_create_without_org_context_fails_closed(self, staff_client):
        org = OrganizationFactory.create()
        resource = _create_resource(org, "RES-ORG-S2")

        resp = staff_client.post(
            self._list_url(),
            data={
                "resource": str(resource.id),
                "start_time": "2026-09-10T10:00:00Z",
                "end_time": "2026-09-10T12:00:00Z",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestResourceLeaveOrganizationScoping:
    def _list_url(self):
        return reverse("api:v1:scheduling:resource-leave-list")

    def test_create_without_matching_resource_is_rejected(self, staff_client):
        """A leave without an org-scoped resource for the user is rejected."""
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        _create_resource(org_b, "RES-ORG-L1")

        resp = staff_client.post(
            self._list_url(),
            data={
                "start_date": "2026-09-14",
                "end_date": "2026-09-14",
                "leave_type": "Vacation",
                "reason": "Family holiday",
            },
            HTTP_X_ORGANIZATION_ID=str(org_a.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_with_matching_org_resource_is_allowed(
        self, staff_client, staff_user
    ):
        org = OrganizationFactory.create()
        resource = _create_resource(org, "RES-ORG-L2")
        resource.user = staff_user
        resource.save()

        resp = staff_client.post(
            self._list_url(),
            data={
                "start_date": "2026-09-14",
                "end_date": "2026-09-14",
                "leave_type": "Vacation",
                "reason": "Family holiday",
            },
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data

    def test_create_with_cross_org_explicit_resource_is_rejected(
        self, staff_client
    ):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        foreign_resource = _create_resource(org_b, "RES-ORG-L3")

        resp = staff_client.post(
            self._list_url(),
            data={
                "resource": str(foreign_resource.id),
                "start_date": "2026-09-14",
                "end_date": "2026-09-14",
                "leave_type": "Vacation",
            },
            HTTP_X_ORGANIZATION_ID=str(org_a.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
