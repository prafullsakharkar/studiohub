"""Storage roots API (API-PUB-12): studio-wide, writes need publishing.storage.manage."""

from __future__ import annotations

import pytest

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import StorageRoot
from apps.publishing.tests.helpers import (
    client_for,
    member,
    outsider,
    published_version,
    registration,
    storage_root,
)

pytestmark = pytest.mark.django_db

URL = "/api/v1/publishing/storage-roots/"


@pytest.fixture
def admin():
    return client_for(outsider(P.VIEW, P.STORAGE_MANAGE))


def test_create_list_read_update(admin):
    created = admin.post(
        URL,
        {"code": "PROJECTS", "name": "Projects", "linux_path": "/mnt/projects"},
        format="json",
    )
    assert created.status_code == 201
    root_id = created.json()["id"]

    assert [r["code"] for r in admin.get(URL).json()["results"]] == ["PROJECTS"]
    assert admin.get(f"{URL}{root_id}/").json()["linux_path"] == "/mnt/projects"
    patched = admin.patch(f"{URL}{root_id}/", {"name": "All projects"}, format="json")
    assert (patched.status_code, patched.json()["name"]) == (200, "All projects")


def test_a_duplicate_code_in_any_case_is_400(admin):
    storage_root("PROJECTS")

    for code in ("PROJECTS", "projects"):
        assert admin.post(URL, {"code": code, "name": "x"}, format="json").status_code == 400


def test_the_code_cannot_be_changed(admin):
    root = storage_root("KEEPME")

    response = admin.patch(f"{URL}{root.pk}/", {"code": "CHANGED"}, format="json")

    assert response.status_code == 400
    assert StorageRoot.objects.get(pk=root.pk).code == "KEEPME"


def test_reading_needs_only_the_view_code_but_writing_needs_manage(project):
    storage_root("PROJECTS")
    viewer = client_for(member(project, P.VIEW, P.CREATE, P.UPDATE, P.DELETE))

    assert viewer.get(URL).status_code == 200
    assert viewer.post(URL, {"code": "X", "name": "x"}, format="json").status_code == 403
    root = StorageRoot.objects.get()
    assert viewer.patch(f"{URL}{root.pk}/", {"name": "y"}, format="json").status_code == 403
    assert viewer.delete(f"{URL}{root.pk}/").status_code == 403


def test_a_root_holding_files_is_not_deleted(admin, project):
    root = storage_root()
    user = member(project, P.CREATE, P.VIEW)
    version = published_version(project)
    client_for(user).post("/api/v1/publishing/files/", registration(version, root), format="json")

    assert admin.delete(f"{URL}{root.pk}/").status_code == 400
    assert StorageRoot.objects.filter(pk=root.pk).exists()


def test_an_empty_root_is_deleted(admin):
    root = storage_root("EMPTY")

    assert admin.delete(f"{URL}{root.pk}/").status_code == 204
    assert not StorageRoot.objects.filter(pk=root.pk).exists()


def test_the_response_has_no_audit_internals(admin):
    body = admin.post(URL, {"code": "A", "name": "a"}, format="json").json()

    assert set(body) == {
        "id", "code", "name", "linux_path", "windows_path", "mac_path", "is_active",
        "created_at", "updated_at",
    }  # fmt: skip


def test_anonymous_is_refused():
    from rest_framework.test import APIClient

    assert APIClient().get(URL).status_code in (401, 403)
