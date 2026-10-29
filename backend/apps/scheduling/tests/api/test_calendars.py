"""
Work calendars (DOM-SCH-01, API-SCH-08/09): a real IANA zone, a working week, hours per day, a code
unique in any case, one calendar per office and exactly one default; holidays belong to a calendar;
a resource follows one (or the default).
"""

from __future__ import annotations

from datetime import date

import pytest
from django.db import IntegrityError, transaction

from apps.masterdata.tests.factories import OfficeFactory
from apps.scheduling.models import Holiday, WorkCalendar
from apps.scheduling.services.calendar import WorkCalendarService
from apps.scheduling.tests.helpers import (
    VIEW,
    admin_client,
    client_for,
    default_calendar,
    make_calendar,
    make_resource,
    person,
)

pytestmark = pytest.mark.django_db

URL = "/api/v1/scheduling/calendars/"
HOLIDAYS = "/api/v1/scheduling/holidays/"
RESOURCES = "/api/v1/scheduling/resources/"


@pytest.fixture
def api():
    default_calendar()
    return admin_client()


def _create(api, **fields):
    return api.post(
        URL,
        {"code": "LON", "name": "London", "time_zone": "Europe/London", **fields},
        format="json",
    )


class TestCreating:
    def test_a_calendar_with_its_rules(self, api):
        response = _create(api, working_weekdays=[5, 1, 3, 2, 4], hours_per_day="7.50")

        assert response.status_code == 201, response.content
        body = response.json()
        assert body["code"] == "LON" and body["time_zone"] == "Europe/London"
        assert body["working_weekdays"] == [1, 2, 3, 4, 5]  # sorted
        assert body["hours_per_day"] == "7.50" and body["is_default"] is False

    def test_the_defaults_are_a_monday_to_friday_eight_hour_week(self, api):
        body = _create(api, time_zone="America/Los_Angeles").json()

        assert body["working_weekdays"] == [1, 2, 3, 4, 5] and body["hours_per_day"] == "8.00"

    @pytest.mark.parametrize("zone", ["Mars/Phobos", "../../etc/passwd", "europe london", "UTC+2x"])
    def test_an_unknown_time_zone_is_a_400(self, api, zone):
        response = _create(api, time_zone=zone)

        assert response.status_code == 400 and "time zone" in response.content.decode().lower()
        assert not WorkCalendar.objects.filter(code="LON").exists()

    @pytest.mark.parametrize("weekdays", [[], [0], [8], [1, 1], ["mon"], [True], [1.5], "12345"])
    def test_bad_weekdays_are_a_400(self, api, weekdays):
        assert _create(api, working_weekdays=weekdays).status_code == 400

    @pytest.mark.parametrize("hours", ["0", "-1", "24.5", "abc"])
    def test_bad_hours_are_a_400(self, api, hours):
        assert _create(api, hours_per_day=hours).status_code == 400

    def test_twenty_four_hours_is_the_most(self, api):
        assert _create(api, hours_per_day="24").status_code == 201

    def test_a_code_is_unique_in_any_case(self, api):
        assert _create(api).status_code == 201

        for code in ("LON", "lon", "Lon"):
            response = _create(api, code=code)
            assert response.status_code == 400, code
            assert "already exists" in response.content.decode()

    def test_a_code_is_required(self, api):
        assert api.post(URL, {"name": "x"}, format="json").status_code == 400

    def test_an_office_supplies_the_zone_when_none_is_sent(self, api):
        office = OfficeFactory.create(timezone="Asia/Kolkata")

        response = api.post(
            URL, {"code": "BLR", "name": "Bangalore", "office_id": str(office.pk)}, format="json"
        )

        assert response.status_code == 201 and response.json()["time_zone"] == "Asia/Kolkata"
        assert response.json()["office"] == str(office.pk)

    def test_an_office_has_at_most_one_calendar(self, api):
        office = OfficeFactory.create()
        assert _create(api, office_id=str(office.pk)).status_code == 201

        response = _create(api, code="LON2", office_id=str(office.pk))

        assert response.status_code == 400 and "already has a calendar" in response.content.decode()

    def test_an_unknown_office_is_a_400(self, api):
        response = _create(api, office_id="00000000-0000-0000-0000-000000000000")

        assert response.status_code == 400 and "Unknown office" in response.content.decode()

    def test_the_very_first_calendar_becomes_the_default(self):
        WorkCalendar.all_objects.all().delete()

        calendar = WorkCalendarService.create(actor=None, data={"code": "FIRST", "name": "First"})

        assert calendar.is_default


class TestEditing:
    def test_rules_can_change_but_not_the_code(self, api):
        calendar = make_calendar(code="EDIT")

        changed = api.patch(
            f"{URL}{calendar.pk}/",
            {"time_zone": "Europe/Berlin", "working_weekdays": [1, 2, 3, 4], "hours_per_day": "6"},
            format="json",
        )
        code = api.patch(f"{URL}{calendar.pk}/", {"code": "OTHER"}, format="json")
        same_code = api.patch(
            f"{URL}{calendar.pk}/", {"code": "EDIT", "name": "New"}, format="json"
        )

        assert changed.status_code == 200, changed.content
        assert changed.json()["time_zone"] == "Europe/Berlin"
        assert code.status_code == 400 and same_code.status_code == 200

    def test_a_bad_value_on_edit_is_a_400_and_changes_nothing(self, api):
        calendar = make_calendar(code="EDIT2")

        response = api.patch(f"{URL}{calendar.pk}/", {"time_zone": "Nowhere/Land"}, format="json")

        assert response.status_code == 400
        calendar.refresh_from_db()
        assert calendar.time_zone == "UTC"

    def test_moving_a_calendar_onto_an_office_that_has_one_is_a_400(self, api):
        office = OfficeFactory.create()
        make_calendar(code="HAS", office=office)
        other = make_calendar(code="WANTS")

        response = api.patch(f"{URL}{other.pk}/", {"office_id": str(office.pk)}, format="json")

        assert response.status_code == 400

    def test_a_full_put_of_what_was_read_is_accepted(self, api):
        calendar = make_calendar(code="PUT1")
        read = api.get(f"{URL}{calendar.pk}/").json()

        response = api.put(f"{URL}{calendar.pk}/", read, format="json")

        assert response.status_code == 200, response.content


class TestTheDefault:
    def test_set_default_moves_it(self, api):
        old = default_calendar()
        new = make_calendar(code="NEWDEF")

        response = api.post(f"{URL}{new.pk}/set-default/")

        assert response.status_code == 200 and response.json()["is_default"] is True
        old.refresh_from_db()
        assert old.is_default is False
        assert list(WorkCalendar.objects.filter(is_default=True)) == [new]

    def test_creating_a_calendar_as_the_default_replaces_the_old_default(self, api):
        _create(api, is_default=True)

        assert [c.code for c in WorkCalendar.objects.filter(is_default=True)] == ["LON"]

    def test_the_database_allows_one_live_default(self):
        default_calendar()

        with pytest.raises(IntegrityError), transaction.atomic():
            WorkCalendar.objects.create(
                code="TWO", name="Two", is_default=True, working_weekdays=[1]
            )

    def test_ensure_default_makes_one_when_none_exists_and_is_repeatable(self):
        WorkCalendar.all_objects.all().delete()

        first = WorkCalendarService.ensure_default()
        second = WorkCalendarService.ensure_default()

        assert first.pk == second.pk and first.is_default and first.time_zone == "UTC"
        assert first.working_weekdays == [1, 2, 3, 4, 5]


class TestDeleting:
    def test_an_unused_calendar_is_deleted_and_its_code_stays_reserved(self, api):
        calendar = make_calendar(code="GONE")

        response = api.delete(f"{URL}{calendar.pk}/")

        assert response.status_code == 204
        assert WorkCalendar.objects.filter(pk=calendar.pk).count() == 0
        assert _create(api, code="gone").status_code == 400  # unique over deleted rows too

    def test_the_default_cannot_be_deleted(self, api):
        response = api.delete(f"{URL}{default_calendar().pk}/")

        assert response.status_code == 409 and "calendar_in_use" in response.content.decode()

    def test_a_calendar_with_a_resource_cannot_be_deleted(self, api):
        calendar = make_calendar(code="USED1")
        make_resource(calendar=calendar)

        assert api.delete(f"{URL}{calendar.pk}/").status_code == 409
        assert WorkCalendar.objects.filter(pk=calendar.pk).exists()

    def test_a_calendar_with_a_holiday_cannot_be_deleted(self, api):
        calendar = make_calendar(code="USED2")
        Holiday.objects.create(name="Day", holiday_date=date(2026, 12, 25), calendar=calendar)

        assert api.delete(f"{URL}{calendar.pk}/").status_code == 409

    def test_a_hard_delete_is_blocked_by_the_database(self):
        from django.db.models import ProtectedError

        calendar = make_calendar(code="PROT")
        Holiday.objects.create(name="Day", holiday_date=date(2026, 12, 25), calendar=calendar)

        with pytest.raises(ProtectedError):
            WorkCalendar.all_objects.filter(pk=calendar.pk).delete()


class TestAccess:
    def test_anyone_who_can_view_the_schedule_can_list_calendars(self, api):
        viewer = client_for(person(VIEW))

        assert viewer.get(URL).status_code == 200
        assert viewer.get(f"{URL}{default_calendar().pk}/").json()["code"]

    def test_writing_needs_more_than_viewing(self, api):
        viewer = client_for(person(VIEW))
        calendar = make_calendar(code="ACC")

        assert viewer.post(URL, {"code": "X", "name": "x"}, format="json").status_code == 403
        assert viewer.patch(f"{URL}{calendar.pk}/", {"name": "y"}, format="json").status_code == 403
        assert viewer.post(f"{URL}{calendar.pk}/set-default/").status_code == 403
        assert viewer.delete(f"{URL}{calendar.pk}/").status_code == 403

    def test_a_user_with_no_schedule_code_sees_nothing(self, api):
        assert client_for(person()).get(URL).status_code == 403


class TestHolidays:
    def test_a_holiday_with_no_calendar_goes_to_the_default(self, api):
        response = api.post(
            HOLIDAYS, {"name": "Christmas", "holiday_date": "2026-12-25"}, format="json"
        )

        assert response.status_code == 201, response.content
        assert response.json()["calendar"] == str(default_calendar().pk)

    def test_a_holiday_can_be_put_in_another_calendar(self, api):
        calendar = make_calendar(code="HOL")

        response = api.post(
            HOLIDAYS,
            {"name": "Local day", "holiday_date": "2026-12-26", "calendar_id": str(calendar.pk)},
            format="json",
        )

        assert response.status_code == 201
        assert response.json()["calendar"] == str(calendar.pk)
        assert response.json()["calendar_name"] == calendar.name

    def test_one_holiday_per_date_in_a_calendar_but_the_same_date_in_two_calendars_is_fine(
        self, api
    ):
        other = make_calendar(code="TWOCAL")
        body = {"name": "Day", "holiday_date": "2026-12-25"}
        assert api.post(HOLIDAYS, body, format="json").status_code == 201

        again = api.post(HOLIDAYS, body, format="json")
        elsewhere = api.post(HOLIDAYS, {**body, "calendar_id": str(other.pk)}, format="json")

        assert again.status_code == 400 and "already has a holiday" in again.content.decode()
        assert elsewhere.status_code == 201

    def test_a_deleted_holiday_frees_its_date(self, api):
        body = {"name": "Day", "holiday_date": "2026-12-25"}
        first = api.post(HOLIDAYS, body, format="json").json()
        assert api.delete(f"{HOLIDAYS}{first['id']}/").status_code == 204

        assert api.post(HOLIDAYS, body, format="json").status_code == 201

    def test_editing_a_holiday_onto_a_taken_date_is_a_400(self, api):
        api.post(HOLIDAYS, {"name": "A", "holiday_date": "2026-12-25"}, format="json")
        second = api.post(
            HOLIDAYS, {"name": "B", "holiday_date": "2026-12-26"}, format="json"
        ).json()

        clash = api.patch(
            f"{HOLIDAYS}{second['id']}/", {"holiday_date": "2026-12-25"}, format="json"
        )
        same = api.patch(f"{HOLIDAYS}{second['id']}/", {"name": "B2"}, format="json")

        assert clash.status_code == 400 and same.status_code == 200

    def test_an_unknown_calendar_is_a_400(self, api):
        response = api.post(
            HOLIDAYS,
            {
                "name": "Day",
                "holiday_date": "2026-12-25",
                "calendar_id": "00000000-0000-0000-0000-000000000000",
            },
            format="json",
        )

        assert response.status_code == 400 and "Unknown calendar" in response.content.decode()

    def test_the_list_can_be_narrowed_to_a_calendar(self, api):
        other = make_calendar(code="FILT")
        api.post(HOLIDAYS, {"name": "Studio day", "holiday_date": "2026-12-25"}, format="json")
        api.post(
            HOLIDAYS,
            {"name": "Other day", "holiday_date": "2026-12-26", "calendar_id": str(other.pk)},
            format="json",
        )

        names = [h["name"] for h in api.get(HOLIDAYS, {"calendar_id": str(other.pk)}).json()]

        assert names == ["Other day"]
        assert len(api.get(HOLIDAYS).json()) == 2
        assert api.get(HOLIDAYS, {"calendar_id": "nonsense"}).json() == []

    def test_with_no_default_row_a_holiday_makes_one_instead_of_failing(self):
        WorkCalendar.all_objects.all().delete()
        api = admin_client()

        response = api.post(HOLIDAYS, {"name": "Day", "holiday_date": "2026-12-25"}, format="json")

        assert response.status_code == 201, response.content
        assert WorkCalendar.objects.get(is_default=True).code == "STUDIO"

    def test_the_database_holds_one_live_holiday_per_calendar_and_date(self):
        calendar = default_calendar()
        Holiday.objects.create(name="A", holiday_date=date(2026, 12, 25), calendar=calendar)

        with pytest.raises(IntegrityError), transaction.atomic():
            Holiday.objects.create(name="B", holiday_date=date(2026, 12, 25), calendar=calendar)


class TestResourcesFollowACalendar:
    def test_a_resource_is_created_with_a_calendar_and_shows_it(self, api):
        calendar = make_calendar(code="RES1")

        response = api.post(
            RESOURCES,
            {"name": "Ann", "code": "ANN", "calendar_id": str(calendar.pk)},
            format="json",
        )
        read = api.get(f"{RESOURCES}{response.json()['id']}/").json()

        assert response.status_code == 201, response.content
        assert read["calendar"] == str(calendar.pk) and read["calendar_name"] == calendar.name

    def test_a_resource_with_no_calendar_shows_none(self, api):
        resource = make_resource()

        read = api.get(f"{RESOURCES}{resource.pk}/").json()

        assert read["calendar"] is None and read["calendar_name"] == ""

    def test_the_calendar_can_be_changed_and_cleared(self, api):
        calendar = make_calendar(code="RES2")
        resource = make_resource()

        set_ = api.patch(
            f"{RESOURCES}{resource.pk}/", {"calendar_id": str(calendar.pk)}, format="json"
        )
        cleared = api.patch(f"{RESOURCES}{resource.pk}/", {"calendar_id": None}, format="json")

        assert set_.json()["calendar"] == str(calendar.pk)
        assert cleared.json()["calendar"] is None

    def test_an_unknown_calendar_is_a_400(self, api):
        response = api.post(
            RESOURCES,
            {"name": "Bo", "code": "BO", "calendar_id": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )

        assert response.status_code == 400 and "Unknown calendar" in response.content.decode()

    def test_a_negative_rate_or_capacity_is_a_400_not_a_500(self, api):
        for field, value in (("hourly_rate_usd", "-1"), ("capacity_hours_per_week", -5)):
            response = api.post(
                RESOURCES, {"name": "Cy", "code": f"CY{field[:3]}", field: value}, format="json"
            )
            assert response.status_code == 400, field
