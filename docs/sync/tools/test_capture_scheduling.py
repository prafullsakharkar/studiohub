"""
Phase 10 sample capture: scheduling (resources, bookings, leave, holidays, work calendars, milestones, events,
capacity) (docs/sync).

Real JWT flow for an MFA superuser and the seeded roles that matter: a production-admin (schedule.manage and
schedule.approve), a vfx-supervisor, a lead-artist and an artist (own leave and events only), and a stranger who
belongs to no project. Every call is recorded whatever its status, so failures are data. Pytest test database only,
rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_scheduling.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_capture_identity_admin import FLOW, call, redact, sign_in_plain, sign_in_with_mfa  # noqa: E402

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
S = "/api/v1/scheduling/"


def _user(U, email, password, role_code=None):
    from apps.identity.models import Role, UserRole

    user = U.create_user(email=email, password=password)
    user.is_active = True
    user.save()
    if role_code:
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    return user


@pytest.mark.django_db
def test_capture_scheduling(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.mfa_helpers import enable_mfa

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase10!1")
    enable_mfa(admin)
    sup = _user(U, "sup@example.test", "Sup-Pass-Phase10!1", "vfx-supervisor")
    padmin = _user(U, "padmin@example.test", "Padmin-Pass-Phase10!1", "production-admin")
    lead = _user(U, "lead@example.test", "Lead-Pass-Phase10!1", "lead-artist")
    artist = _user(U, "artist@example.test", "Artist-Pass-Phase10!1", "artist")
    _user(U, "stranger@example.test", "Stranger-Pass-Phase10!1", "artist")
    norole = _user(U, "norole@example.test", "Norole-Pass-Phase10!1")

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase10!1", admin)
    sv, _ = sign_in_plain("sup@example.test", "Sup-Pass-Phase10!1")
    pa, _ = sign_in_plain("padmin@example.test", "Padmin-Pass-Phase10!1")
    ld, _ = sign_in_plain("lead@example.test", "Lead-Pass-Phase10!1")
    ar, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase10!1")
    sg, _ = sign_in_plain("stranger@example.test", "Stranger-Pass-Phase10!1")
    nr, _ = sign_in_plain("norole@example.test", "Norole-Pass-Phase10!1")

    # ------------------------------------------------------------ setup
    pid = call(a, "setup_project", "POST", "/api/v1/projects/", {"code": "SCH", "name": "Scheduling", "workflow_type": "standard"}).json()["id"]
    pid2 = call(a, "setup_project_two", "POST", "/api/v1/projects/", {"code": "OTH", "name": "Other", "workflow_type": "standard"}).json()["id"]
    for who, role in ((sup, "Supervisor"), (padmin, "Producer"), (lead, "Lead"), (artist, "Artist")):
        call(a, f"setup_member_{who.email.split('@')[0]}", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": role})
    dept = call(a, "setup_department", "POST", "/api/v1/departments/", {"code": "COMP", "name": "Compositing"}).json().get("id")

    # The migration seeds the default "STUDIO" calendar; a flushed test database has none, so make it as the service does.
    from apps.scheduling.services.calendar import WorkCalendarService

    WorkCalendarService.ensure_default()

    # ------------------------------------------------------------ calendars
    call(pa, "calendars_list", "GET", f"{S}calendars/")
    call(ar, "calendars_list_artist", "GET", f"{S}calendars/")
    call(nr, "calendars_list_norole", "GET", f"{S}calendars/")
    cal = call(pa, "calendars_create", "POST", f"{S}calendars/", {"code": "LON", "name": "London", "time_zone": "Europe/London", "working_weekdays": [1, 2, 3, 4, 5], "hours_per_day": "7.50"}).json().get("id")
    call(pa, "calendars_create_duplicate", "POST", f"{S}calendars/", {"code": "lon", "name": "Again"})
    call(pa, "calendars_create_bad_zone", "POST", f"{S}calendars/", {"code": "BAD", "name": "Bad", "time_zone": "Mars/Olympus"})
    call(pa, "calendars_create_bad_weekdays", "POST", f"{S}calendars/", {"code": "BAD2", "name": "Bad", "working_weekdays": [1, 1, 9]})
    call(pa, "calendars_create_bad_hours", "POST", f"{S}calendars/", {"code": "BAD3", "name": "Bad", "hours_per_day": "25"})
    call(pa, "calendars_create_empty", "POST", f"{S}calendars/", {})
    call(ar, "calendars_create_artist", "POST", f"{S}calendars/", {"code": "ART", "name": "Art"})
    call(sv, "calendars_create_supervisor", "POST", f"{S}calendars/", {"code": "SUP", "name": "Sup"})
    call(pa, "calendars_detail", "GET", f"{S}calendars/{cal}/")
    call(pa, "calendars_patch", "PATCH", f"{S}calendars/{cal}/", {"hours_per_day": "8"})
    call(pa, "calendars_set_default", "POST", f"{S}calendars/{cal}/set-default/", {})
    call(pa, "calendars_list_after_default", "GET", f"{S}calendars/")
    default_id = next((c["id"] for c in call(pa, "calendars_list_again", "GET", f"{S}calendars/").json() if c["code"] == "STUDIO"), None)
    call(pa, "calendars_delete_default", "DELETE", f"{S}calendars/{cal}/")
    call(pa, "calendars_set_default_back", "POST", f"{S}calendars/{default_id}/set-default/", {})
    cal2 = call(pa, "calendars_create_second", "POST", f"{S}calendars/", {"code": "NYC", "name": "New York", "time_zone": "America/New_York"}).json().get("id")
    call(pa, "calendars_delete_unused", "DELETE", f"{S}calendars/{cal2}/")

    # ------------------------------------------------------------ holidays
    call(pa, "holidays_list_empty", "GET", f"{S}holidays/")
    h1 = call(pa, "holidays_create", "POST", f"{S}holidays/", {"name": "New Year", "holiday_date": "2027-01-01", "is_paid": True}).json().get("id")
    call(pa, "holidays_create_duplicate", "POST", f"{S}holidays/", {"name": "Again", "holiday_date": "2027-01-01"})
    call(pa, "holidays_create_on_calendar", "POST", f"{S}holidays/", {"name": "Boxing Day", "holiday_date": "2026-12-28", "calendar_id": cal, "is_optional": True})
    call(pa, "holidays_create_unknown_calendar", "POST", f"{S}holidays/", {"name": "X", "holiday_date": "2027-02-01", "calendar_id": "00000000-0000-0000-0000-000000000000"})
    call(pa, "holidays_create_bad_date", "POST", f"{S}holidays/", {"name": "X", "holiday_date": "01/02/2027"})
    call(pa, "holidays_create_empty", "POST", f"{S}holidays/", {})
    call(ar, "holidays_create_artist", "POST", f"{S}holidays/", {"name": "X", "holiday_date": "2027-03-01"})
    call(pa, "holidays_list", "GET", f"{S}holidays/")
    call(ar, "holidays_list_artist", "GET", f"{S}holidays/")
    call(pa, "holidays_by_calendar", "GET", f"{S}holidays/?calendar_id={cal}")
    call(pa, "holidays_detail", "GET", f"{S}holidays/{h1}/")
    call(pa, "holidays_patch", "PATCH", f"{S}holidays/{h1}/", {"description": "Public holiday"})
    h3 = call(pa, "holidays_create_for_delete", "POST", f"{S}holidays/", {"name": "Delete me", "holiday_date": "2027-05-05"}).json().get("id")
    call(ar, "holidays_delete_artist", "DELETE", f"{S}holidays/{h3}/")
    call(pa, "holidays_delete", "DELETE", f"{S}holidays/{h3}/")

    # ------------------------------------------------------------ resources
    call(pa, "resources_create_empty", "POST", f"{S}resources/", {})
    r1 = call(pa, "resources_create", "POST", f"{S}resources/", {"name": "Alice Artist", "code": "ALICE", "resource_type": "Person", "department_id": dept, "user_id": str(artist.id), "capacity_hours_per_week": 40, "hourly_rate_usd": "55.00", "location": "London"}).json().get("id")
    r2 = call(pa, "resources_create_second", "POST", f"{S}resources/", {"name": "Bob Lead", "code": "BOB", "user_id": str(lead.id), "calendar_id": cal, "capacity_hours_per_week": 32, "hourly_rate_usd": "70.00"}).json().get("id")
    r3 = call(pa, "resources_create_equipment", "POST", f"{S}resources/", {"name": "Render node 1", "code": "RN1", "resource_type": "Equipment", "capacity_hours_per_week": 168}).json().get("id")
    r4 = call(pa, "resources_create_supervisor_person", "POST", f"{S}resources/", {"name": "Sam Super", "code": "SAM", "user_id": str(sup.id)}).json().get("id")
    call(pa, "resources_create_duplicate", "POST", f"{S}resources/", {"name": "Dup", "code": "alice"})
    call(pa, "resources_create_on_leave", "POST", f"{S}resources/", {"name": "X", "code": "XL", "status": "On Leave"})
    call(pa, "resources_create_negative_rate", "POST", f"{S}resources/", {"name": "X", "code": "XR", "hourly_rate_usd": "-1"})
    call(pa, "resources_create_negative_capacity", "POST", f"{S}resources/", {"name": "X", "code": "XC", "capacity_hours_per_week": -5})
    call(pa, "resources_create_bad_type", "POST", f"{S}resources/", {"name": "X", "code": "XT", "resource_type": "Banana"})
    call(pa, "resources_create_unknown_user", "POST", f"{S}resources/", {"name": "X", "code": "XU", "user_id": "00000000-0000-0000-0000-000000000000"})
    call(pa, "resources_create_unknown_calendar", "POST", f"{S}resources/", {"name": "X", "code": "XK", "calendar_id": "00000000-0000-0000-0000-000000000000"})
    call(ar, "resources_create_artist", "POST", f"{S}resources/", {"name": "X", "code": "XA"})
    call(sv, "resources_create_supervisor", "POST", f"{S}resources/", {"name": "X", "code": "XS"})
    call(pa, "resources_list", "GET", f"{S}resources/")
    call(sv, "resources_list_supervisor", "GET", f"{S}resources/")
    call(ld, "resources_list_lead", "GET", f"{S}resources/")
    call(ar, "resources_list_artist", "GET", f"{S}resources/")
    call(nr, "resources_list_norole", "GET", f"{S}resources/")
    call(pa, "resources_detail", "GET", f"{S}resources/{r1}/")
    call(ar, "resources_detail_artist_own", "GET", f"{S}resources/{r1}/")
    call(ar, "resources_detail_artist_other", "GET", f"{S}resources/{r2}/")
    call(pa, "resources_patch", "PATCH", f"{S}resources/{r1}/", {"location": "Remote"})
    call(pa, "resources_patch_on_leave", "PATCH", f"{S}resources/{r1}/", {"status": "On Leave"})
    call(pa, "resources_patch_unavailable", "PATCH", f"{S}resources/{r3}/", {"status": "Unavailable"})
    call(ar, "resources_patch_artist", "PATCH", f"{S}resources/{r1}/", {"location": "Home"})
    call(pa, "resources_order_rate_admin", "GET", f"{S}resources/?ordering=-hourly_rate_usd")
    call(ar, "resources_order_rate_artist", "GET", f"{S}resources/?ordering=-hourly_rate_usd")
    call(pa, "resources_search", "GET", f"{S}resources/?search=alice")

    # ------------------------------------------------------------ bookings
    call(pa, "schedules_list_empty", "GET", f"{S}schedules/")
    b1 = call(pa, "schedules_create", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-02T09:00:00Z", "end_time": "2026-11-02T13:00:00Z", "status": "Booked", "notes": "Comp shots"}).json().get("id")
    call(pa, "schedules_create_overlap", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-02T12:00:00Z", "end_time": "2026-11-02T15:00:00Z", "status": "Booked"})
    b2 = call(pa, "schedules_create_adjacent", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-02T13:00:00Z", "end_time": "2026-11-02T17:00:00Z", "status": "Booked"}).json().get("id")
    call(pa, "schedules_create_available_overlap", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-02T10:00:00Z", "end_time": "2026-11-02T11:00:00Z", "status": "Available"})
    call(pa, "schedules_create_naive", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-03T09:00:00", "end_time": "2026-11-03T12:00:00", "status": "Booked"})
    call(pa, "schedules_create_end_before_start", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-03T12:00:00Z", "end_time": "2026-11-03T09:00:00Z"})
    call(pa, "schedules_create_equal", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-03T12:00:00Z", "end_time": "2026-11-03T12:00:00Z"})
    call(pa, "schedules_create_unknown_resource", "POST", f"{S}schedules/", {"resource": "00000000-0000-0000-0000-000000000000", "start_time": "2026-11-03T09:00:00Z", "end_time": "2026-11-03T12:00:00Z"})
    call(pa, "schedules_create_empty", "POST", f"{S}schedules/", {})
    call(pa, "schedules_create_bad_status", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-03T09:00:00Z", "end_time": "2026-11-03T12:00:00Z", "status": "Banana"})
    call(ar, "schedules_create_artist", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-04T09:00:00Z", "end_time": "2026-11-04T12:00:00Z"})
    call(pa, "resources_book", "POST", f"{S}resources/{r2}/book/", {"start_time": "2026-11-02T09:00:00Z", "end_time": "2026-11-02T18:00:00Z", "notes": "Review day"})
    call(pa, "resources_book_overlap", "POST", f"{S}resources/{r2}/book/", {"start_time": "2026-11-02T10:00:00Z", "end_time": "2026-11-02T11:00:00Z"})
    call(pa, "resources_book_naive", "POST", f"{S}resources/{r2}/book/", {"start_time": "2026-11-05T10:00:00", "end_time": "2026-11-05T11:00:00"})
    call(pa, "resources_block", "POST", f"{S}resources/{r3}/block/", {"start_time": "2026-11-09T00:00:00Z", "end_time": "2026-11-10T00:00:00Z", "reason": "Maintenance"})
    call(pa, "resources_block_overlap", "POST", f"{S}resources/{r3}/block/", {"start_time": "2026-11-09T12:00:00Z", "end_time": "2026-11-09T13:00:00Z"})
    call(sv, "resources_book_supervisor", "POST", f"{S}resources/{r3}/book/", {"start_time": "2026-11-11T09:00:00Z", "end_time": "2026-11-11T10:00:00Z"})
    call(pa, "schedules_list", "GET", f"{S}schedules/")
    call(ar, "schedules_list_artist", "GET", f"{S}schedules/")
    call(pa, "schedules_detail", "GET", f"{S}schedules/{b1}/")
    call(pa, "schedules_patch", "PATCH", f"{S}schedules/{b1}/", {"notes": "Comp shots v2"})
    call(pa, "schedules_patch_into_overlap", "PATCH", f"{S}schedules/{b2}/", {"start_time": "2026-11-02T12:00:00Z"})
    call(pa, "schedules_window", "GET", f"{S}schedules/?start=2026-11-02T00:00:00Z&end=2026-11-02T12:00:00Z")
    call(pa, "schedules_window_bad", "GET", f"{S}schedules/?start=yesterday")
    call(pa, "schedules_window_naive", "GET", f"{S}schedules/?start=2026-11-02T00:00:00")
    call(pa, "schedules_search_notes", "GET", f"{S}schedules/?search=Comp")
    call(pa, "schedules_search_resource", "GET", f"{S}schedules/?search=alice")
    call(pa, "schedules_baseline", "GET", f"{S}schedules/")
    for name, value in (("resource", r1), ("resource_id", r1), ("status", "Blocked"), ("event", "00000000-0000-0000-0000-000000000000"), ("nonsense", "1")):
        call(pa, f"schedules_by_{name}", "GET", f"{S}schedules/?{name}={value}")
    b3 = call(pa, "schedules_create_for_delete", "POST", f"{S}schedules/", {"resource": r1, "start_time": "2026-11-20T09:00:00Z", "end_time": "2026-11-20T10:00:00Z", "status": "Booked"}).json().get("id")
    call(ar, "schedules_delete_artist", "DELETE", f"{S}schedules/{b3}/")
    call(pa, "schedules_bulk_delete_empty", "POST", f"{S}schedules/bulk-delete/", {"ids": []})
    call(ar, "schedules_bulk_delete_artist", "POST", f"{S}schedules/bulk-delete/", {"ids": [b3]})
    call(pa, "schedules_bulk_delete_partial", "POST", f"{S}schedules/bulk-delete/", {"ids": [b3, "00000000-0000-0000-0000-000000000000"]})
    call(pa, "schedules_bulk_delete_all", "POST", f"{S}schedules/bulk-delete/", {"ids": [b2]})

    # ------------------------------------------------------------ leave
    call(ar, "leaves_list_empty", "GET", f"{S}leaves/")
    l1 = call(ar, "leaves_create_own", "POST", f"{S}leaves/", {"resource": r1, "leave_type": "Vacation", "start_date": "2026-12-21", "end_date": "2026-12-31", "reason": "Holiday trip"}).json().get("id")
    call(ar, "leaves_create_other", "POST", f"{S}leaves/", {"resource": r2, "leave_type": "Vacation", "start_date": "2026-12-21", "end_date": "2026-12-22"})
    call(ar, "leaves_create_overlap", "POST", f"{S}leaves/", {"resource": r1, "leave_type": "Personal", "start_date": "2026-12-28", "end_date": "2026-12-29"})
    call(ar, "leaves_create_end_before_start", "POST", f"{S}leaves/", {"resource": r1, "leave_type": "Personal", "start_date": "2027-02-10", "end_date": "2027-02-01"})
    call(ar, "leaves_create_bad_type", "POST", f"{S}leaves/", {"resource": r1, "leave_type": "Banana", "start_date": "2027-02-01", "end_date": "2027-02-02"})
    call(ar, "leaves_create_set_status", "POST", f"{S}leaves/", {"resource": r1, "leave_type": "Personal", "start_date": "2027-02-01", "end_date": "2027-02-02", "status": "Approved"})
    call(ar, "leaves_create_empty", "POST", f"{S}leaves/", {})
    call(ar, "leaves_create_total_days", "POST", f"{S}leaves/", {"resource": r1, "leave_type": "Personal", "start_date": "2027-02-01", "end_date": "2027-02-02", "total_days": 9})
    call(nr, "leaves_create_norole", "POST", f"{S}leaves/", {"resource": r1, "leave_type": "Personal", "start_date": "2027-02-01", "end_date": "2027-02-02"})
    l2 = call(pa, "leaves_create_for_other_manager", "POST", f"{S}leaves/", {"resource": r2, "leave_type": "Sick Leave", "start_date": "2026-11-16", "end_date": "2026-11-17", "reason": "Flu"}).json().get("id")
    call(ar, "leaves_detail_own", "GET", f"{S}leaves/{l1}/")
    call(ar, "leaves_detail_other", "GET", f"{S}leaves/{l2}/")
    call(pa, "leaves_detail_manager", "GET", f"{S}leaves/{l2}/")
    call(ar, "leaves_list_artist", "GET", f"{S}leaves/")
    call(ld, "leaves_list_lead", "GET", f"{S}leaves/")
    call(pa, "leaves_list_manager", "GET", f"{S}leaves/")
    call(ar, "leaves_patch_own_pending", "PATCH", f"{S}leaves/{l1}/", {"end_date": "2026-12-30"})
    call(ar, "leaves_patch_move_resource", "PATCH", f"{S}leaves/{l1}/", {"resource": r2})
    call(ar, "leaves_patch_other", "PATCH", f"{S}leaves/{l2}/", {"end_date": "2026-11-18"})
    call(ar, "leaves_approve_own", "POST", f"{S}leaves/{l1}/approve/", {})
    call(ld, "leaves_approve_lead", "POST", f"{S}leaves/{l1}/approve/", {})
    call(pa, "leaves_reject_empty", "POST", f"{S}leaves/{l2}/reject/", {})
    call(pa, "leaves_approve", "POST", f"{S}leaves/{l1}/approve/", {})
    call(pa, "leaves_approve_again", "POST", f"{S}leaves/{l1}/approve/", {})
    call(ar, "leaves_patch_approved", "PATCH", f"{S}leaves/{l1}/", {"end_date": "2026-12-29"})
    call(pa, "leaves_reject", "POST", f"{S}leaves/{l2}/reject/", {"rejection_reason": "Need a doctor's note"})
    call(ar, "leaves_detail_rejected_other", "GET", f"{S}leaves/{l2}/")
    call(pa, "resources_detail_on_leave", "GET", f"{S}resources/{r1}/")
    l3 = call(pa, "leaves_create_for_sup", "POST", f"{S}leaves/", {"resource": r4, "leave_type": "Personal", "start_date": "2027-03-01", "end_date": "2027-03-02"}).json().get("id")
    call(sv, "leaves_approve_sup_own_by_supervisor", "POST", f"{S}leaves/{l3}/approve/", {})
    call(a, "leaves_approve_by_admin", "POST", f"{S}leaves/{l3}/approve/", {})
    l4 = call(pa, "leaves_create_for_delete", "POST", f"{S}leaves/", {"resource": r3, "leave_type": "Other", "start_date": "2027-04-01", "end_date": "2027-04-01"}).json().get("id")
    call(ar, "leaves_delete_artist", "DELETE", f"{S}leaves/{l4}/")
    call(pa, "leaves_delete", "DELETE", f"{S}leaves/{l4}/")
    call(pa, "leaves_baseline", "GET", f"{S}leaves/")
    for name, value in (("status", "Pending"), ("resource", r1), ("resource_id", r1), ("leave_type", "Vacation"), ("start_date", "2026-12-01"), ("nonsense", "1")):
        call(pa, f"leaves_by_{name}", "GET", f"{S}leaves/?{name}={value}")
    call(pa, "leaves_search_reason", "GET", f"{S}leaves/?search=Flu")
    call(pa, "leaves_search_resource", "GET", f"{S}leaves/?search=alice")

    # ------------------------------------------------------------ milestones
    call(pa, "milestones_list_empty", "GET", f"{S}milestones/")
    m1 = call(pa, "milestones_create", "POST", f"{S}milestones/", {"project_id": pid, "name": "Turnover", "due_date": "2026-12-01", "order": 1, "notes": "Plates in"}).json().get("id")
    m2 = call(pa, "milestones_create_second", "POST", f"{S}milestones/", {"project_id": pid, "name": "Final delivery", "due_date": "2027-02-01", "order": 2, "kind": "general"}).json().get("id")
    call(pa, "milestones_create_other_project", "POST", f"{S}milestones/", {"project_id": pid2, "name": "Elsewhere", "due_date": "2027-01-01"})
    call(pa, "milestones_create_duplicate", "POST", f"{S}milestones/", {"project_id": pid, "name": "TURNOVER", "due_date": "2026-12-05"})
    call(pa, "milestones_create_empty", "POST", f"{S}milestones/", {})
    call(pa, "milestones_create_unknown_project", "POST", f"{S}milestones/", {"project_id": "00000000-0000-0000-0000-000000000000", "name": "X", "due_date": "2026-12-05"})
    call(pa, "milestones_create_delivery_without_package", "POST", f"{S}milestones/", {"project_id": pid, "name": "Delivery", "due_date": "2027-02-02", "kind": "delivery"})
    call(pa, "milestones_create_bad_kind", "POST", f"{S}milestones/", {"project_id": pid, "name": "X", "due_date": "2027-02-02", "kind": "banana"})
    call(pa, "milestones_create_bad_date", "POST", f"{S}milestones/", {"project_id": pid, "name": "X", "due_date": "soon"})
    call(pa, "milestones_create_completed", "POST", f"{S}milestones/", {"project_id": pid, "name": "Done already", "due_date": "2027-02-02", "status": "Completed"})
    call(ar, "milestones_create_artist", "POST", f"{S}milestones/", {"project_id": pid, "name": "X", "due_date": "2027-02-02"})
    call(sg, "milestones_create_stranger", "POST", f"{S}milestones/", {"project_id": pid, "name": "X", "due_date": "2027-02-02"})
    call(pa, "milestones_list", "GET", f"{S}milestones/")
    call(ar, "milestones_list_artist", "GET", f"{S}milestones/")
    call(sg, "milestones_list_stranger", "GET", f"{S}milestones/")
    call(pa, "milestones_detail", "GET", f"{S}milestones/{m1}/")
    call(sg, "milestones_detail_stranger", "GET", f"{S}milestones/{m1}/")
    call(pa, "milestones_patch", "PATCH", f"{S}milestones/{m1}/", {"due_date": "2026-12-03", "status": "In Progress"})
    call(pa, "milestones_patch_project", "PATCH", f"{S}milestones/{m1}/", {"project_id": pid2})
    call(pa, "milestones_patch_completed_status", "PATCH", f"{S}milestones/{m1}/", {"status": "Completed"})
    call(ar, "milestones_complete_artist", "POST", f"{S}milestones/{m1}/complete/", {})
    call(pa, "milestones_complete", "POST", f"{S}milestones/{m1}/complete/", {})
    call(pa, "milestones_complete_again", "POST", f"{S}milestones/{m1}/complete/", {})
    call(pa, "milestones_patch_completed", "PATCH", f"{S}milestones/{m1}/", {"name": "Turnover v2"})
    call(pa, "milestones_reopen", "POST", f"{S}milestones/{m1}/reopen/", {})
    call(pa, "milestones_reopen_again", "POST", f"{S}milestones/{m1}/reopen/", {})
    call(pa, "projects_schedule_route", "GET", f"/api/organizations/projects/{pid}/schedule")
    call(pa, "milestones_baseline", "GET", f"{S}milestones/")
    for name, value in (("project_id", pid), ("project", pid), ("status", "Pending"), ("kind", "delivery"), ("nonsense", "1")):
        call(pa, f"milestones_by_{name}", "GET", f"{S}milestones/?{name}={value}")
    call(pa, "milestones_by_project_code", "GET", f"{S}milestones/?project_id=SCH")
    m3 = call(pa, "milestones_create_for_delete", "POST", f"{S}milestones/", {"project_id": pid, "name": "Throwaway", "due_date": "2027-03-01"}).json().get("id")
    call(ar, "milestones_delete_artist", "DELETE", f"{S}milestones/{m3}/")
    call(pa, "milestones_delete", "DELETE", f"{S}milestones/{m3}/")

    # ------------------------------------------------------------ events
    call(ar, "events_list_empty", "GET", f"{S}events/")
    e1 = call(ar, "events_create", "POST", f"{S}events/", {"title": "Dailies", "start_time": "2026-11-04T10:00:00Z", "end_time": "2026-11-04T11:00:00Z", "event_type": "Review Session", "visibility": "Team", "project_id": pid, "location": "Room 1", "meeting_url": "https://meet.example.test/x"}).json().get("id")
    e2 = call(pa, "events_create_private", "POST", f"{S}events/", {"title": "1:1 with HR", "start_time": "2026-11-05T10:00:00Z", "end_time": "2026-11-05T11:00:00Z", "visibility": "Private", "notes": "salary"}).json().get("id")
    call(pa, "events_create_all_day", "POST", f"{S}events/", {"title": "Offsite", "start_time": "2026-11-06T00:00:00Z", "end_time": "2026-11-07T00:00:00Z", "is_all_day": True, "visibility": "Organization"})
    call(ar, "events_create_start_date_form", "POST", f"{S}events/", {"title": "Frontend form", "start_date": "2026-11-04", "end_date": "2026-11-04"})
    call(ar, "events_create_naive", "POST", f"{S}events/", {"title": "Naive", "start_time": "2026-11-04T10:00:00", "end_time": "2026-11-04T11:00:00"})
    call(ar, "events_create_end_before_start", "POST", f"{S}events/", {"title": "Backwards", "start_time": "2026-11-04T12:00:00Z", "end_time": "2026-11-04T11:00:00Z"})
    call(ar, "events_create_unknown_project", "POST", f"{S}events/", {"title": "X", "start_time": "2026-11-04T10:00:00Z", "end_time": "2026-11-04T11:00:00Z", "project_id": pid2})
    call(ar, "events_create_bad_type", "POST", f"{S}events/", {"title": "X", "start_time": "2026-11-04T10:00:00Z", "end_time": "2026-11-04T11:00:00Z", "event_type": "Party"})
    call(ar, "events_create_empty", "POST", f"{S}events/", {})
    call(nr, "events_create_norole", "POST", f"{S}events/", {"title": "X", "start_time": "2026-11-04T10:00:00Z", "end_time": "2026-11-04T11:00:00Z"})
    call(pa, "events_list", "GET", f"{S}events/")
    call(ar, "events_list_artist", "GET", f"{S}events/")
    call(sg, "events_list_stranger", "GET", f"{S}events/")
    call(pa, "events_detail", "GET", f"{S}events/{e1}/")
    call(sg, "events_detail_private_stranger", "GET", f"{S}events/{e2}/")
    call(ar, "events_patch_artist", "PATCH", f"{S}events/{e1}/", {"location": "Room 2"})
    call(ar, "events_update_status_artist", "POST", f"{S}events/{e1}/update-status/", {"status": "In Progress"})
    call(pa, "events_patch", "PATCH", f"{S}events/{e1}/", {"location": "Room 2"})
    call(pa, "events_patch_bad_status", "PATCH", f"{S}events/{e1}/", {"status": "Banana"})
    call(pa, "events_patch_naive", "PATCH", f"{S}events/{e1}/", {"start_time": "2026-11-04T10:00:00"})
    call(pa, "events_update_status", "POST", f"{S}events/{e1}/update-status/", {"status": "In Progress"})
    call(pa, "events_update_status_bad", "POST", f"{S}events/{e1}/update-status/", {"status": "Banana"})
    call(pa, "events_update_status_missing", "POST", f"{S}events/{e1}/update-status/", {})
    call(sv, "events_patch_supervisor", "PATCH", f"{S}events/{e1}/", {"location": "Room 3"})
    call(ar, "events_delete_artist", "DELETE", f"{S}events/{e1}/")
    call(pa, "events_baseline", "GET", f"{S}events/")
    for name, value in (("project_id", pid), ("project", pid), ("event_type", "Meeting"), ("status", "Scheduled"), ("start", "2026-11-05T00:00:00Z"), ("end", "2026-11-05T00:00:00Z"), ("nonsense", "1")):
        call(pa, f"events_by_{name}", "GET", f"{S}events/?{name}={value}")
    call(pa, "events_search", "GET", f"{S}events/?search=Dailies")
    call(pa, "events_order", "GET", f"{S}events/?ordering=-start_time")
    e3 = call(pa, "events_create_for_delete", "POST", f"{S}events/", {"title": "Delete me", "start_time": "2026-11-30T10:00:00Z", "end_time": "2026-11-30T11:00:00Z"}).json().get("id")
    call(pa, "events_delete", "DELETE", f"{S}events/{e3}/")

    # ------------------------------------------------------------ capacity, overbooking
    call(pa, "capacity_get", "GET", f"{S}capacity/")
    call(ar, "capacity_artist", "GET", f"{S}capacity/")
    call(nr, "capacity_norole", "GET", f"{S}capacity/")
    call(pa, "capacity_post", "POST", f"{S}capacity/", {})
    # an over-allocated week: the equipment node is booked for more than its weekly capacity of 8 hours
    r5 = call(pa, "resources_create_small", "POST", f"{S}resources/", {"name": "Small box", "code": "SMALL", "resource_type": "Equipment", "capacity_hours_per_week": 8}).json().get("id")
    # capacity and overbooking read the CURRENT week, so the bookings use the monday of this week
    from datetime import datetime, timedelta, timezone

    monday = (datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())).replace(hour=8, minute=0, second=0, microsecond=0)
    iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    call(pa, "schedules_over_a", "POST", f"{S}schedules/", {"resource": r5, "start_time": iso(monday), "end_time": iso(monday + timedelta(hours=6)), "status": "Booked"})
    call(pa, "schedules_over_b", "POST", f"{S}schedules/", {"resource": r5, "start_time": iso(monday + timedelta(days=1)), "end_time": iso(monday + timedelta(days=1, hours=6)), "status": "Booked"})
    cap = call(pa, "capacity_get_over", "GET", f"{S}capacity/")
    alerts = call(pa, "overbooking_get", "GET", f"{S}overbooking/")
    call(ar, "overbooking_artist", "GET", f"{S}overbooking/")
    call(nr, "overbooking_norole", "GET", f"{S}overbooking/")
    alert_id = (alerts.json() or [{}])[0].get("id") if isinstance(alerts.json(), list) and alerts.json() else "none"
    call(pa, "resolve_get", "GET", f"{S}resolve-overbooking/")
    call(pa, "resolve_empty", "POST", f"{S}resolve-overbooking/", {})
    call(pa, "resolve_unknown_key", "POST", f"{S}resolve-overbooking/", {"alert_id": alert_id, "nope": 1})
    call(ar, "resolve_artist", "POST", f"{S}resolve-overbooking/", {"alert_id": alert_id})
    call(pa, "resolve", "POST", f"{S}resolve-overbooking/", {"alert_id": alert_id, "resource_id": r5})
    call(pa, "resolve_unknown_alert", "POST", f"{S}resolve-overbooking/", {"alert_id": "nope"})
    call(pa, "overbooking_after", "GET", f"{S}overbooking/")

    # ------------------------------------------------------------ resource deletion
    call(pa, "resources_delete_with_bookings", "DELETE", f"{S}resources/{r1}/")
    r6 = call(pa, "resources_create_for_delete", "POST", f"{S}resources/", {"name": "Delete me", "code": "DEL"}).json().get("id")
    call(ar, "resources_delete_artist", "DELETE", f"{S}resources/{r6}/")
    call(pa, "resources_delete", "DELETE", f"{S}resources/{r6}/")
    call(pa, "resources_baseline", "GET", f"{S}resources/")
    for name, value in (("resource_type", "Equipment"), ("status", "Active"), ("department", dept), ("department_id", dept), ("calendar_id", cal), ("nonsense", "1")):
        call(pa, f"resources_by_{name}", "GET", f"{S}resources/?{name}={value}")

    (OUT / "scheduling").mkdir(parents=True, exist_ok=True)
    (OUT / "scheduling" / "_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
    assert FLOW["resources_create"]["status"] in (200, 201), FLOW["resources_create"]
