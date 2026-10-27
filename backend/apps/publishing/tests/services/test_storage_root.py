"""Storage roots (DOM-PUB-01)."""

from __future__ import annotations

import pytest
from rest_framework.exceptions import ValidationError

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishedFile, StorageRoot
from apps.publishing.services.files import PublishedFileService
from apps.publishing.services.storage import StorageRootService
from apps.publishing.tests.helpers import (
    member,
    published_version,
    registration,
    request_for,
    storage_root,
)

pytestmark = pytest.mark.django_db


def test_create_and_the_code_is_unique_in_any_case():
    root = StorageRootService.create(actor=None, data={"code": "PROJECTS", "name": "Projects"})

    assert root.code == "PROJECTS"
    for again in ("PROJECTS", "projects"):
        with pytest.raises(ValidationError):
            StorageRootService.create(actor=None, data={"code": again, "name": "x"})


@pytest.mark.parametrize("code", ["", "  ", "1abc", "has space", "a/b", "x" * 51])
def test_a_bad_code_is_refused(code):
    with pytest.raises(ValidationError) as error:
        StorageRootService.create(actor=None, data={"code": code, "name": "x"})
    assert "code" in error.value.detail


def test_a_deleted_roots_code_is_never_reused():
    root = storage_root("OLDROOT")
    root.delete()

    with pytest.raises(ValidationError):
        StorageRootService.create(actor=None, data={"code": "oldroot", "name": "x"})


def test_the_code_cannot_change_but_the_rest_can():
    root = storage_root("KEEP")

    with pytest.raises(ValidationError):
        StorageRootService.update(actor=None, root=root, data={"code": "OTHER"})
    updated = StorageRootService.update(
        actor=None, root=root, data={"code": "keep", "name": "New name", "linux_path": "/mnt/x"}
    )
    assert (updated.name, updated.linux_path) == ("New name", "/mnt/x")


def test_a_root_with_live_files_is_not_deleted_but_may_be_retired(project):
    root = storage_root()
    user = member(project, P.CREATE)
    version = published_version(project)
    file, _ = PublishedFileService.register(
        actor=user,
        request=request_for(user),
        version_id=version.pk,
        data=registration(version, root),
    )

    with pytest.raises(ValidationError):
        StorageRootService.delete(actor=user, root=root)
    retired = StorageRootService.update(actor=user, root=root, data={"is_active": False})
    assert retired.is_active is False
    assert PublishedFile.objects.filter(pk=file.pk).exists()  # existing files stay valid

    PublishedFile.all_objects.filter(pk=file.pk).update(status="Revoked", revoke_reason="x")
    StorageRootService.delete(actor=user, root=root)
    assert not StorageRoot.objects.filter(pk=root.pk).exists()


def test_the_database_keeps_a_root_that_files_point_at(project):
    from django.db.models import ProtectedError

    root = storage_root()
    user = member(project, P.CREATE)
    version = published_version(project)
    PublishedFileService.register(
        actor=user, request=request_for(user), version_id=version.pk,
        data=registration(version, root),
    )  # fmt: skip

    with pytest.raises(ProtectedError):
        StorageRoot.all_objects.filter(pk=root.pk).delete()
