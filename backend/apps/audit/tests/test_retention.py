"""Audit retention: expired rows leave through the one sanctioned path (TPN review TM-011)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.audit.models import APIRequest, AuditLog, ChangeLog, Track
from apps.audit.services import retention
from apps.audit.tests.factories import (
    APIRequestFactory,
    AuditLogFactory,
    ChangeLogFactory,
    TrackFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def windows(settings):
    settings.AUDIT_RETENTION_DAYS = 730
    settings.API_REQUEST_RETENTION_DAYS = 180
    settings.TRACK_RETENTION_DAYS = 90
    return settings


def _seed():
    AuditLogFactory(), ChangeLogFactory(), APIRequestFactory(), TrackFactory()


def _later(days):
    """A clock ``days`` ahead, which ages the rows just created (created_at is not settable)."""
    return timezone.now() + timedelta(days=days)


def test_nothing_is_removed_inside_its_window(windows):
    _seed()

    counts = retention.purge_expired(now=_later(30))

    assert counts == {"audit_logs": 0, "change_logs": 0, "api_requests": 0, "tracks": 0}
    assert AuditLog.objects.count() == 1


def test_each_table_follows_its_own_window(windows):
    _seed()

    counts = retention.purge_expired(now=_later(200))  # past tracks (90) and api requests (180)

    assert counts["tracks"] == 1
    assert counts["api_requests"] == 1
    assert counts["audit_logs"] == 0
    assert counts["change_logs"] == 0
    assert Track.objects.count() == 0
    assert APIRequest.objects.count() == 0
    assert AuditLog.objects.filter(action=AuditLog.ACTION_DELETE, target_id="retention").exists()


def test_the_audit_and_change_logs_go_after_two_years(windows):
    AuditLogFactory()
    ChangeLogFactory()

    counts = retention.purge_expired(now=_later(731))

    assert counts["audit_logs"] == 1
    assert counts["change_logs"] == 1
    assert ChangeLog.objects.count() == 0


def test_a_purge_is_itself_recorded(windows):
    AuditLogFactory()

    retention.purge_expired(now=_later(731))

    entry = AuditLog.objects.get(target_type=AuditLog.TARGET_AUDIT, target_id="retention")
    assert entry.metadata["removed"]["audit_logs"] == 1


def test_a_purge_that_removes_nothing_leaves_no_entry(windows):
    retention.purge_expired(now=_later(731))

    assert not AuditLog.objects.filter(target_type=AuditLog.TARGET_AUDIT).exists()


def test_a_window_of_zero_keeps_the_table(windows):
    windows.AUDIT_RETENTION_DAYS = 0
    AuditLogFactory()

    counts = retention.purge_expired(now=_later(5000))

    assert counts["audit_logs"] == 0
    assert AuditLog.objects.count() == 1


def test_dry_run_counts_and_deletes_nothing(windows):
    _seed()

    counts = retention.purge_expired(dry_run=True, now=_later(731))

    assert counts == {"audit_logs": 1, "change_logs": 1, "api_requests": 1, "tracks": 1}
    assert AuditLog.objects.count() == 1
    assert Track.objects.count() == 1


def test_rows_are_removed_in_batches(windows, monkeypatch):
    monkeypatch.setattr(retention, "BATCH_SIZE", 2)
    for _ in range(5):
        AuditLogFactory()

    counts = retention.purge_expired(now=_later(731))

    assert counts["audit_logs"] == 5


def test_the_command_reports_and_honours_dry_run(windows, capsys):
    AuditLogFactory()
    future = _later(731)

    from unittest import mock

    with mock.patch.object(retention.timezone, "now", return_value=future):
        call_command("audit_purge", "--dry-run")
        assert "Would remove 1 row(s) from audit_logs" in capsys.readouterr().out
        assert AuditLog.objects.filter(target_type__isnull=False).count() == 1

        call_command("audit_purge")
        assert "Removed 1 row(s) from audit_logs" in capsys.readouterr().out


def test_the_task_and_schedule_exist(settings):
    from apps.audit.tasks.retention import audit_purge

    assert audit_purge.name == "audit.purge"
    assert "audit-purge" in settings.CELERY_BEAT_SCHEDULE
    assert settings.CELERY_BEAT_SCHEDULE["audit-purge"]["task"] == "audit.purge"
