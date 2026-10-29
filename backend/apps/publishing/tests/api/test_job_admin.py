"""The admin cannot write a job's status or its history (the workflow service is the only writer)."""

from __future__ import annotations

import pytest
from django.contrib import admin
from django.test import RequestFactory

from apps.publishing.models import PublishItem

pytestmark = pytest.mark.django_db

PROTECTED = {
    "code",
    "status",
    "retry_count",
    "is_archived",
    "validation_results",
    "error_message",
    "cancel_reason",
    "version",
    "republished_from",
}


def test_the_status_and_history_fields_are_read_only_in_the_admin():
    model_admin = admin.site._registry[PublishItem]
    request = RequestFactory().get("/")

    assert set(model_admin.get_readonly_fields(request)) >= PROTECTED
    assert set(model_admin.get_readonly_fields(request, obj=PublishItem())) >= PROTECTED


def test_jobs_are_view_only_in_the_admin_even_for_a_superuser(client, project):
    from django.urls import reverse

    from apps.identity.tests.factories import UserFactory
    from apps.publishing.services.jobs import create_job

    job = create_job(
        actor=None,
        data={
            "name": "n", "entity_type": "Shot", "entity_id": "1", "entity_code": "S1",
            "entity_name": "S", "dcc_tool": "Maya", "source_file": "a", "project_id": str(project.pk),
        },
    )  # fmt: skip
    client.force_login(UserFactory.create(is_superuser=True, is_staff=True))

    assert client.get(reverse("admin:publishing_publishitem_changelist")).status_code == 200
    assert client.get(reverse("admin:publishing_publishitem_add")).status_code == 403
    change = reverse("admin:publishing_publishitem_change", args=[job.pk])
    delete = reverse("admin:publishing_publishitem_delete", args=[job.pk])
    assert (
        client.post(change, {"name": "n", "status": "Exported", "code": "HACK-1"}).status_code
        == 403
    )
    assert client.post(delete, {"post": "yes"}).status_code == 403
    fresh = PublishItem.objects.get(pk=job.pk)
    assert (fresh.status, fresh.code) == ("Pending", job.code)
