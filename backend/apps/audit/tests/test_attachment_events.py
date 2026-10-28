"""Attachment activity is recorded in the audit log (TPN review TM-012)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.audit.events.handlers import AttachmentAuditHandler
from apps.audit.models import AuditLog
from apps.core.events import attachment_events as events
from apps.core.services import attachment_links
from apps.core.tests.factories import AttachmentFactory
from apps.identity.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _rows():
    return AuditLog.objects.filter(target_type=AuditLog.TARGET_ATTACHMENT)


def test_the_handler_writes_one_row_per_event():
    user = UserFactory.create()
    attachment = AttachmentFactory(created_by=user, name="plate.exr", file_size=42)
    payload = events.attachment_payload(attachment, actor_id=user.pk, ip="10.0.0.9")

    for event, action in (
        (events.AttachmentUploaded, "create"),
        (events.AttachmentDownloaded, "export"),
        (events.AttachmentChanged, "update"),
        (events.AttachmentRemoved, "delete"),
    ):
        AttachmentAuditHandler().handle(event(**payload))
        row = _rows().filter(action=action).get()
        assert row.target_id == str(attachment.pk)
        assert row.target_name == "plate.exr"
        assert str(row.actor_id) == str(user.pk)
        assert row.metadata["ip"] == "10.0.0.9"
        assert row.metadata["file_size"] == 42

    assert _rows().count() == 4


def test_a_failing_audit_write_never_breaks_the_request(monkeypatch):
    attachment = AttachmentFactory()
    monkeypatch.setattr(
        AuditLog.objects, "create", lambda **kw: (_ for _ in ()).throw(RuntimeError("db down"))
    )

    AttachmentAuditHandler().handle(
        events.AttachmentUploaded(**events.attachment_payload(attachment, actor_id=None, ip=""))
    )


def test_the_handler_is_subscribed_to_every_attachment_event():
    from apps.audit.events import register_events
    from apps.core.events.bus import default_event_bus

    register_events()

    for event in events.ATTACHMENT_EVENTS:
        assert AttachmentAuditHandler in default_event_bus.registry.handlers_for(event())


def test_deleting_through_the_api_is_audited(django_capture_on_commit_callbacks):
    user = UserFactory.create()
    attachment = AttachmentFactory(created_by=user)
    client = APIClient()
    client.force_authenticate(user=user)

    with django_capture_on_commit_callbacks(execute=True):
        response = client.delete(f"/api/v1/attachments/{attachment.pk}/")

    assert response.status_code == 204, response.content[:300]
    assert _rows().filter(action="delete", target_id=str(attachment.pk)).count() == 1


def test_updating_through_the_api_is_audited(django_capture_on_commit_callbacks):
    user = UserFactory.create()
    attachment = AttachmentFactory(created_by=user)
    client = APIClient()
    client.force_authenticate(user=user)

    with django_capture_on_commit_callbacks(execute=True):
        response = client.patch(
            f"/api/v1/attachments/{attachment.pk}/", {"description": "new"}, format="json"
        )

    assert response.status_code == 200, response.content[:300]
    row = _rows().get(action="update")
    assert row.metadata["fields"] == ["description"]


def test_a_download_is_audited(settings, django_capture_on_commit_callbacks, monkeypatch):
    settings.MEDIA_ACCEL_PREFIX = "/_protected_media"
    user = UserFactory.create()
    attachment = AttachmentFactory(created_by=user)
    attachment.file.name = "attachments/plate.txt"
    attachment.save(update_fields=["file"])
    monkeypatch.setattr(
        "apps.core.api.views.attachment_download.default_storage.exists", lambda name: True
    )
    url = attachment_links.download_path(attachment, user)

    with django_capture_on_commit_callbacks(execute=True):
        response = APIClient().get(url)

    assert response.status_code == 200, response.content[:300]
    assert _rows().filter(action="export", target_id=str(attachment.pk)).count() == 1
