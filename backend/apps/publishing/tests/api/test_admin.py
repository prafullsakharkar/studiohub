"""The admin only shows the file registry (SEC-PUB-05): no add, change or delete, superusers included."""

from __future__ import annotations

import pytest
from django.test import Client
from django.urls import reverse

from apps.identity.tests.factories import UserFactory
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishedFile
from apps.publishing.services.files import PublishedFileService
from apps.publishing.tests.helpers import (
    member,
    published_version,
    registration,
    request_for,
)

pytestmark = pytest.mark.django_db

MODELS = ["storageroot", "publishedfile", "publishedfileevent", "publishcounter"]


@pytest.fixture
def admin_client():
    user = UserFactory.create(is_superuser=True, is_staff=True)
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def revoked_file(project, root):
    user = member(project, P.CREATE, P.REVOKE)
    version = published_version(project)
    file, _ = PublishedFileService.register(
        actor=user, request=request_for(user), version_id=version.pk,
        data=registration(version, root),
    )  # fmt: skip
    return PublishedFileService.revoke(
        actor=user, request=request_for(user), file=file, reason="confidential reason text"
    )


@pytest.mark.parametrize("model", MODELS)
def test_the_changelist_opens_and_nothing_can_be_added(admin_client, model, revoked_file):
    assert admin_client.get(reverse(f"admin:publishing_{model}_changelist")).status_code == 200
    assert admin_client.get(reverse(f"admin:publishing_{model}_add")).status_code == 403


def test_a_file_cannot_be_changed_or_deleted_in_the_admin(admin_client, revoked_file):
    change = reverse("admin:publishing_publishedfile_change", args=[revoked_file.pk])
    delete = reverse("admin:publishing_publishedfile_delete", args=[revoked_file.pk])

    assert admin_client.post(change, {"sha256": "f" * 64}).status_code == 403
    assert admin_client.post(delete, {"post": "yes"}).status_code == 403
    assert PublishedFile.objects.get(pk=revoked_file.pk).sha256 == "a" * 64


def test_the_revoke_reason_is_not_shown(admin_client, revoked_file):
    detail = admin_client.get(
        reverse("admin:publishing_publishedfile_change", args=[revoked_file.pk])
    ).content.decode()
    listing = admin_client.get(
        reverse("admin:publishing_publishedfile_changelist")
    ).content.decode()
    events = admin_client.get(
        reverse("admin:publishing_publishedfileevent_changelist")
    ).content.decode()

    assert "confidential reason text" not in detail + listing + events


def test_the_revoke_reason_cannot_be_searched_for(admin_client, revoked_file):
    url = reverse("admin:publishing_publishedfile_changelist")

    found = admin_client.get(url, {"q": "confidential"}).content.decode()

    assert "plate.exr" not in found  # the file is not matched through its reason
