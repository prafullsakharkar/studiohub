"""
The admin cannot bypass the services (bookings, leave, calendars and milestones are read-only
there), and ``redact_leave_reasons`` (decision Q37) blanks old decided reasons: dry run by default,
counts only, pending leave never touched.
"""

from __future__ import annotations

from datetime import date, timedelta
from io import StringIO

import pytest
from django.contrib import admin
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import RequestFactory
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.scheduling.management.commands.redact_leave_reasons import cutoff
from apps.scheduling.models import (
    Milestone,
    ResourceLeave,
    ResourceSchedule,
    WorkCalendar,
)
from apps.scheduling.tests.helpers import make_resource, person

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "model", [ResourceSchedule, ResourceLeave, WorkCalendar, Milestone], ids=lambda m: m.__name__
)
def test_these_models_are_read_only_in_the_admin_even_for_a_superuser(model):
    request = RequestFactory().get("/admin/")
    request.user = person(superuser=True)
    model_admin = admin.site._registry[model]

    assert model_admin.has_view_permission(request)
    assert not model_admin.has_add_permission(request)
    assert not model_admin.has_change_permission(request)
    assert not model_admin.has_delete_permission(request)


def _leave(resource, ended, status="Approved", reason="private", rejection=""):
    return ResourceLeave.objects.create(
        resource=resource,
        leave_type="Vacation",
        start_date=ended - timedelta(days=2),
        end_date=ended,
        total_days=3,
        status=status,
        reason=reason,
        rejection_reason=rejection,
    )


def _run(*args) -> str:
    out = StringIO()
    call_command("redact_leave_reasons", *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def old():
    return timezone.now().date() - timedelta(days=4 * 365)


class TestRedactLeaveReasons:
    def test_the_cutoff_is_whole_years_back_and_survives_29_february(self):
        assert cutoff(3, date(2026, 11, 2)) == date(2023, 11, 2)
        assert cutoff(1, date(2028, 2, 29)) == date(2027, 2, 28)

    def test_it_is_a_dry_run_unless_asked(self, old):
        leave = _leave(make_resource(), old)

        output = _run()

        assert "1 decided leave rows" in output and "Dry run" in output
        assert ResourceLeave.objects.get(pk=leave.pk).reason == "private"
        assert not AuditLog.objects.filter(target_name="Leave reasons redacted").exists()

    def test_apply_blanks_both_reasons_of_old_decided_leave_and_keeps_the_rows(self, old):
        approved = _leave(make_resource(), old)
        rejected = _leave(make_resource(), old, "Rejected", "private", "no cover")

        output = _run("--apply")

        assert "Blanked the reasons of 2 leave rows" in output
        for leave in (approved, rejected):
            leave.refresh_from_db()
            assert leave.reason == "" and leave.rejection_reason == ""
            assert leave.start_date and leave.status in ("Approved", "Rejected")
        row = AuditLog.objects.get(target_name="Leave reasons redacted")
        assert row.metadata["count"] == 2

    def test_it_prints_counts_never_a_reason(self, old):
        _leave(make_resource(), old, reason="secret-words", rejection="more-secret")

        assert "secret-words" not in _run() + _run("--apply")

    def test_recent_pending_and_already_blank_leave_are_left_alone(self, old):
        recent = _leave(make_resource(), timezone.now().date() - timedelta(days=30))
        pending = _leave(make_resource(), old, "Pending")
        blank = _leave(make_resource(), old, reason="")

        output = _run("--apply")

        assert "Blanked the reasons of 0 leave rows" in output
        assert ResourceLeave.objects.get(pk=recent.pk).reason == "private"
        assert ResourceLeave.objects.get(pk=pending.pk).reason == "private"
        assert ResourceLeave.objects.get(pk=blank.pk).reason == ""

    def test_deleted_leave_is_included(self, old):
        gone = _leave(make_resource(), old)
        gone.soft_delete()

        _run("--apply")

        assert ResourceLeave.all_objects.get(pk=gone.pk).reason == ""

    def test_the_number_of_years_is_a_choice_and_must_be_positive(self, old):
        leave = _leave(make_resource(), timezone.now().date() - timedelta(days=2 * 365 + 30))

        assert "0 decided" in _run("--older-than-years", "3")
        assert "1 decided" in _run("--older-than-years", "2")
        with pytest.raises(CommandError):
            _run("--older-than-years", "0")
        assert ResourceLeave.objects.get(pk=leave.pk).reason == "private"
