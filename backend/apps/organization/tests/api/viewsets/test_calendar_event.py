"""Regression: nested calendar-events CRUD (real event entity)."""

from __future__ import annotations

import pytest

from apps.organization.tests.factories import OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_nested_calendar_event_crud(staff_client, staff_user):
    from apps.organization.models import CalendarEvent

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)

    created = staff_client.post(
        f"/api/organizations/{org.id}/calendar-events/",
        {
            "organization": str(org.id),
            "code": "EVT-T1",
            "name": "Turnover Test",
            "date": "2026-11-20",
            "event_type": "turnover",
            "office_name": "Montreal HQ",
            "all_day": False,
        },
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert created.status_code == 201, created.content[:500]
    event_id = created.json()["id"]
    assert created.json()["event_type"] == "turnover"

    listed = staff_client.get(
        f"/api/organizations/{org.id}/calendar-events/?page=1&page_size=25",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert listed.status_code == 200
    assert listed.json()["count"] == 1

    searched = staff_client.get(
        f"/api/organizations/{org.id}/calendar-events/?search=turnover",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert searched.status_code == 200

    deleted = staff_client.delete(
        f"/api/organizations/{org.id}/calendar-events/{event_id}/",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert deleted.status_code == 204
    assert not CalendarEvent.objects.active().filter(pk=event_id).exists()
