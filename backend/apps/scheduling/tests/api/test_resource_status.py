"""
A resource's status is derived (DOM-SCH-03, decision Q33): "On Leave" while an Approved leave covers
today's date in the resource's calendar zone, "Unavailable" when stored so, otherwise "Active".
Writing "On Leave" is a 400. The clock is frozen on Sunday 1 November 2026, 20:00 UTC, which is
already Monday 2 November, 01:30 in Kolkata.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.scheduling.models import Resource, ResourceLeave
from apps.scheduling.tests.helpers import (
    admin_client,
    default_calendar,
    make_calendar,
    make_resource,
)

pytestmark = pytest.mark.django_db

URL = "/api/v1/scheduling/resources/"
FROZEN = datetime(2026, 11, 1, 20, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: FROZEN)


@pytest.fixture
def api():
    default_calendar()
    return admin_client()


def _leave(resource, first, last, status="Approved"):
    return ResourceLeave.objects.create(
        resource=resource,
        leave_type="Vacation",
        start_date=first,
        end_date=last,
        total_days=1,
        status=status,
    )


def _status(api, resource):
    return api.get(f"{URL}{resource.pk}/").json()["status"]


class TestDerivation:
    def test_an_approved_leave_covering_today_shows_on_leave(self, api):
        resource = make_resource()
        _leave(resource, date(2026, 11, 1), date(2026, 11, 3))

        assert _status(api, resource) == "On Leave"

    def test_the_first_and_last_day_are_inside(self, api):
        first, last = make_resource(), make_resource()
        _leave(first, date(2026, 11, 1), date(2026, 11, 1))
        _leave(last, date(2026, 10, 28), date(2026, 11, 1))

        assert _status(api, first) == "On Leave" and _status(api, last) == "On Leave"

    def test_leave_in_the_past_or_future_does_not(self, api):
        resource = make_resource()
        _leave(resource, date(2026, 10, 20), date(2026, 10, 31))
        _leave(resource, date(2026, 11, 2), date(2026, 11, 6))

        assert _status(api, resource) == "Active"

    @pytest.mark.parametrize("status", ["Pending", "Rejected", "Cancelled"])
    def test_leave_that_is_not_approved_does_not(self, api, status):
        resource = make_resource()
        _leave(resource, date(2026, 11, 1), date(2026, 11, 3), status=status)

        assert _status(api, resource) == "Active"

    def test_deleted_leave_does_not(self, api):
        resource = make_resource()
        _leave(resource, date(2026, 11, 1), date(2026, 11, 3)).soft_delete()

        assert _status(api, resource) == "Active"

    def test_today_is_the_date_in_the_resources_calendar_zone(self, api):
        """Leave on Monday 2 November only: it has begun in Kolkata and not yet in UTC."""
        kolkata = make_calendar(code="BLR", time_zone="Asia/Kolkata")
        in_utc, in_india = make_resource(), make_resource(calendar=kolkata)
        for resource in (in_utc, in_india):
            _leave(resource, date(2026, 11, 2), date(2026, 11, 2))

        assert _status(api, in_utc) == "Active"
        assert _status(api, in_india) == "On Leave"

    def test_unavailable_stays_unavailable_and_wins_over_nothing_but_leave(self, api):
        resource = make_resource(status="Unavailable")
        assert _status(api, resource) == "Unavailable"

        _leave(resource, date(2026, 11, 1), date(2026, 11, 3))
        assert _status(api, resource) == "On Leave"

    def test_an_old_stored_on_leave_with_no_leave_behind_it_reads_active(self, api):
        resource = make_resource(status="On Leave")

        assert _status(api, resource) == "Active"
        assert Resource.objects.get(pk=resource.pk).status == "On Leave"  # the column is kept

    def test_status_display_agrees(self, api):
        resource = make_resource()
        _leave(resource, date(2026, 11, 1), date(2026, 11, 3))

        body = api.get(f"{URL}{resource.pk}/").json()

        assert body["status"] == body["status_display"] == "On Leave"

    def test_the_list_agrees_with_the_detail(self, api):
        on_leave, active = make_resource(), make_resource()
        _leave(on_leave, date(2026, 11, 1), date(2026, 11, 3))

        listed = {row["id"]: row["status"] for row in api.get(URL).json()}

        assert listed == {str(on_leave.pk): "On Leave", str(active.pk): "Active"}

    def test_the_list_does_not_ask_the_database_once_per_resource(self, api):
        def count(resources):
            for _ in range(resources):
                resource = make_resource()
                _leave(resource, date(2026, 11, 1), date(2026, 11, 3))
            with CaptureQueriesContext(connection) as queries:
                assert api.get(URL).status_code == 200
            return len(queries)

        few = count(2)
        many = count(8)

        assert many == few


class TestWriting:
    def test_creating_with_on_leave_is_a_400(self, api):
        response = api.post(
            URL,
            {"name": "A", "code": "NEW-1", "resource_type": "Person", "status": "On Leave"},
            format="json",
        )

        assert response.status_code == 400 and "cannot be set" in response.content.decode()
        assert not Resource.objects.filter(code="NEW-1").exists()

    def test_creating_and_editing_with_the_other_statuses_still_work(self, api):
        created = api.post(
            URL, {"name": "A", "code": "NEW-2", "status": "Unavailable"}, format="json"
        )
        resource_id = created.json()["id"]

        edited = api.patch(f"{URL}{resource_id}/", {"status": "Active"}, format="json")

        assert created.status_code == 201 and created.json()["status"] == "Unavailable"
        assert edited.status_code == 200 and edited.json()["status"] == "Active"

    def test_editing_to_on_leave_is_a_400_and_changes_nothing(self, api):
        resource = make_resource()

        response = api.patch(f"{URL}{resource.pk}/", {"status": "On Leave"}, format="json")

        assert response.status_code == 400
        assert Resource.objects.get(pk=resource.pk).status == "Active"

    def test_sending_back_what_a_read_showed_is_accepted_and_keeps_the_stored_value(self, api):
        resource = make_resource(status="Unavailable")
        _leave(resource, date(2026, 11, 1), date(2026, 11, 3))
        read = api.get(f"{URL}{resource.pk}/").json()
        assert read["status"] == "On Leave"

        response = api.patch(
            f"{URL}{resource.pk}/", {"status": read["status"], "location": "Mumbai"}, format="json"
        )

        assert response.status_code == 200
        stored = Resource.objects.get(pk=resource.pk)
        assert stored.status == "Unavailable" and stored.location == "Mumbai"


class TestBothReadPaths:
    """The list reads leave from a prefetch; a resource made or edited a moment ago has none and
    asks the database. Both must apply the same rules."""

    @staticmethod
    def _from_selector(resource):
        from apps.scheduling.selectors import ResourceSelector

        return ResourceSelector.get_queryset().get(pk=resource.pk)

    @pytest.mark.parametrize("prefetched", [True, False])
    @pytest.mark.parametrize("status", ["Pending", "Rejected", "Cancelled"])
    def test_leave_that_is_not_approved_never_shows(self, status, prefetched):
        from apps.scheduling.selectors.resource_status import ResourceStatusSelector

        default_calendar()
        resource = make_resource()
        _leave(resource, date(2026, 11, 1), date(2026, 11, 3), status=status)
        subject = self._from_selector(resource) if prefetched else resource

        assert ResourceStatusSelector().status_of(subject) == "Active"

    @pytest.mark.parametrize("prefetched", [True, False])
    def test_approved_leave_shows_and_a_leave_that_ended_does_not(self, prefetched):
        from apps.scheduling.selectors.resource_status import ResourceStatusSelector

        default_calendar()
        covering, ended = make_resource(), make_resource()
        _leave(covering, date(2026, 11, 1), date(2026, 11, 1))
        _leave(ended, date(2026, 10, 25), date(2026, 10, 31))
        pick = self._from_selector if prefetched else (lambda resource: resource)

        statuses = ResourceStatusSelector()
        assert statuses.status_of(pick(covering)) == "On Leave"
        assert statuses.status_of(pick(ended)) == "Active"

    def test_the_response_to_a_create_or_edit_is_derived_too(self, api):
        resource = make_resource()
        _leave(resource, date(2026, 11, 1), date(2026, 11, 3))

        response = api.patch(f"{URL}{resource.pk}/", {"location": "Pune"}, format="json")

        assert response.status_code == 200 and response.json()["status"] == "On Leave"
