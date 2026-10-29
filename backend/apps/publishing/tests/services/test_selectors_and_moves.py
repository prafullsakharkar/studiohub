"""The X-04 interface Deliveries will read, and the move of the shared viewset base (X-02)."""

from __future__ import annotations

from uuid import UUID

import pytest

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishedFile
from apps.publishing.selectors.files import FileSnapshot, PublishedFileSelector
from apps.publishing.services.files import PublishedFileService
from apps.publishing.tests.helpers import (
    member,
    published_version,
    registration,
    request_for,
    storage_root,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(project):
    user = member(project, P.CREATE, P.DEPRECATE, P.REVOKE)
    root = storage_root()
    version = published_version(project)

    def register(path, **over):
        file, _ = PublishedFileService.register(
            actor=user,
            request=request_for(user),
            version_id=version.pk,
            data=registration(version, root, path, **over),
        )
        return file

    return user, version, register


def test_files_for_versions_returns_plain_snapshots(setup):
    _, version, register = setup
    file = register("s/plate.exr")

    result = PublishedFileSelector.files_for_versions([version.pk])

    assert result == {
        version.pk: [
            FileSnapshot(
                file_id=file.pk,
                version_id=version.pk,
                project_id=version.project_id,
                storage_root_code="PROJECTS",
                relative_path="s/plate.exr",
                role="main",
                file_type_code="",
                size_bytes=1024,
                sha256="a" * 64,
                frame_start=None,
                frame_end=None,
                status="Registered",
            )
        ]
    }


def test_deliverable_files_are_registered_files_of_published_versions_without_checksum_trouble(
    setup,
):
    user, version, register = setup
    good = register("s/good.exr")
    deprecated = register("s/deprecated.exr")
    revoked = register("s/revoked.exr")
    mismatch = register("s/mismatch.exr")
    missing = register("s/missing.exr")
    verified = register("s/verified.exr")
    PublishedFileService.deprecate(actor=user, request=request_for(user), file=deprecated)
    PublishedFileService.revoke(actor=user, request=request_for(user), file=revoked, reason="bad")
    PublishedFileService.record_verification(file_id=mismatch.pk, state="mismatch")
    PublishedFileService.record_verification(file_id=missing.pk, state="missing")
    PublishedFileService.record_verification(file_id=verified.pk, state="verified")

    paths = {
        s.relative_path for s in PublishedFileSelector.deliverable_files([version.pk])[version.pk]
    }

    assert paths == {"s/good.exr", "s/verified.exr"}
    assert {
        s.relative_path for s in PublishedFileSelector.files_for_versions([version.pk])[version.pk]
    } == {f.relative_path for f in PublishedFile.objects.all()}
    assert good.pk  # registered, declared checksum: deliverable


def test_unpublishing_the_version_makes_its_files_undeliverable(setup):
    _, version, register = setup
    register("s/plate.exr")
    type(version).objects.filter(pk=version.pk).update(is_published=False)

    assert PublishedFileSelector.deliverable_files([version.pk]) == {}
    assert len(PublishedFileSelector.files_for_versions([version.pk])[version.pk]) == 1


def test_an_unknown_version_gives_nothing():
    assert PublishedFileSelector.files_for_versions([UUID(int=0)]) == {}


def test_the_viewset_base_lives_in_core_and_the_old_module_is_gone():
    """X-02, removed in Phase 12 as Q38 planned: the re-export is deleted and nothing needs it."""
    import importlib.util

    from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet
    from apps.deliveries.api.viewsets.delivery import DeliveryViewSet
    from apps.deliveries.api.viewsets.destination import DestinationViewSet

    assert importlib.util.find_spec("apps.deliveries.api.viewsets.base") is None
    assert issubclass(DeliveryViewSet, PlatformCrudViewSet)
    assert issubclass(DestinationViewSet, PlatformCrudViewSet)


def test_no_app_imports_the_deliveries_base_any_more():
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[4]
    needle = "apps.deliveries.api.viewsets.base"
    offenders = [
        str(path.relative_to(root))
        for app in ("publishing", "scheduling", "production", "deliveries")
        for path in (root / app).rglob("*.py")
        if "/tests/" not in str(path) and needle in path.read_text()
    ]
    assert offenders == []
