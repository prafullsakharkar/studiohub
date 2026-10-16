"""
API contract tests for the platform endpoints (notifications, reports).

Verifies the frontend contract: bare-array lists (no pagination), field
shapes, and the notification read actions.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.platform.models import ProductionReport, StudioNotification


def _notif_url(**kwargs):
    return reverse("api:v1:platform:notification-list", kwargs=kwargs)


def _notif_detail(notif):
    return reverse(
        "api:v1:platform:notification-detail", kwargs={"uuid": str(notif.id)}
    )


def _notif_read(notif):
    return reverse(
        "api:v1:platform:notification-mark-read",
        kwargs={"uuid": str(notif.id)},
    )


def _notif_read_all():
    return reverse("api:v1:platform:notification-mark-all-read")


def _report_url(**kwargs):
    return reverse("api:v1:platform:report-list", kwargs=kwargs)


def _notification(**overrides):
    defaults = {
        "title": "Dailies published",
        "message": "New dailies are available",
        "type": "success",
        "category": "Dailies",
        "read": False,
        "link": "/dailies",
        "timestamp": "2h ago",
    }
    defaults.update(overrides)
    return StudioNotification.objects.create(**defaults)


def _report(**overrides):
    defaults = {
        "title": "Weekly Production Report",
        "project_code": "VEL01",
        "category": "Production",
        "generated_at": "2026-01-15 10:00",
        "generated_by": "Supervisor",
        "status": "Complete",
        "summary_metrics": {"shots_done": 12, "open_tasks": 4},
        "download_url": "/downloads/weekly.pdf",
    }
    defaults.update(overrides)
    return ProductionReport.objects.create(**defaults)


@pytest.mark.django_db
class TestNotificationApiContract:
    def test_list_returns_bare_array(self, staff_client, staff_user):
        _notification(title="A")
        _notification(title="B")
        resp = staff_client.get(_notif_url())
        assert resp.status_code == status.HTTP_200_OK
        assert isinstance(resp.data, list)
        assert {n["title"] for n in resp.data} == {"A", "B"}

    def test_list_is_global_without_header(self, staff_client, staff_user):
        # Platform-global: every row is visible with no scoping header.
        _notification(title="A")
        _notification(title="B")
        resp = staff_client.get(_notif_url())
        assert resp.status_code == status.HTTP_200_OK
        assert {n["title"] for n in resp.data} == {"A", "B"}

    def test_notification_contract_fields(self, staff_client, staff_user):
        _notification()
        resp = staff_client.get(_notif_url())
        assert resp.status_code == status.HTTP_200_OK
        item = resp.data[0]
        for key in (
            "id",
            "title",
            "message",
            "type",
            "category",
            "read",
            "link",
            "timestamp",
            "created_at",
            "updated_at",
        ):
            assert key in item, f"missing field {key}"
        assert item["type"] == "success"
        assert item["read"] is False

    def test_mark_read_single(self, staff_client, staff_user):
        notif = _notification()
        url = _notif_read(notif)
        resp = staff_client.patch(url, format="json")
        assert resp.status_code == status.HTTP_200_OK
        notif.refresh_from_db()
        assert notif.read is True

    def test_mark_all_read(self, staff_client, staff_user):
        _notification()
        _notification()
        url = _notif_read_all()
        resp = staff_client.patch(url, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert StudioNotification.objects.filter(read=True).count() == 2


@pytest.mark.django_db
class TestReportApiContract:
    def test_list_returns_bare_array(self, staff_client, staff_user):
        _report()
        resp = staff_client.get(_report_url())
        assert resp.status_code == status.HTTP_200_OK
        assert isinstance(resp.data, list)
        assert resp.data[0]["title"] == "Weekly Production Report"

    def test_report_contract_fields(self, staff_client, staff_user):
        _report()
        resp = staff_client.get(_report_url())
        item = resp.data[0]
        for key in (
            "id",
            "title",
            "project_code",
            "category",
            "generated_at",
            "generated_by",
            "status",
            "summary_metrics",
            "download_url",
            "created_at",
            "updated_at",
        ):
            assert key in item, f"missing field {key}"
        assert item["summary_metrics"]["shots_done"] == 12
