"""Shared builders for the deliveries tests: packages, published versions with registered files."""

from __future__ import annotations

import itertools
from typing import Any

from rest_framework.test import APIClient

from apps.deliveries.models import DeliveryPackage
from apps.deliveries.services.package import DeliveryService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, VersionFactory
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import StorageRoot
from apps.publishing.services.files import PublishedFileService

SHA = "a" * 64
_counter = itertools.count(1)


class _Request:
    """What the registry service needs of a request: a user and no scoped credential."""

    def __init__(self, user: Any) -> None:
        self.user = user
        self.auth = None


def operator(project: Any, *codes: str, superuser: bool = False):
    """A user who is a member of ``project`` and holds ``codes``."""
    user = UserFactory.create(is_superuser=superuser)
    if codes:
        grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def storage_root(code: str = "PROJECTS") -> StorageRoot:
    return StorageRoot.objects.get_or_create(code=code, defaults={"name": code.title()})[0]


def published_version(project, *, files: int = 1, published: bool = True, **fields: Any):
    """A version of ``project`` with ``files`` registered files (one main file by default)."""
    number = next(_counter)
    version = VersionFactory.create(
        project=project,
        code=f"DV{number:04d}",
        status="Approved" if published else "Not Started",
        is_published=published,
        **fields,
    )
    registrar = UserFactory.create(is_superuser=True)
    root = storage_root()
    for index in range(files):
        PublishedFileService.register(
            actor=registrar,
            request=_Request(registrar),
            version_id=version.pk,
            data={
                "version_id": str(version.pk),
                "storage_root": root.code,
                "relative_path": f"show/{version.code}/plate_{index}.exr",
                "size_bytes": 1000 * (index + 1),
                "sha256": f"{index + 1:x}" * 64,
                "role": "main" if index == 0 else "proxy",
            },
        )
    return version


def make_package(project=None, *, code: str | None = None, **fields: Any) -> DeliveryPackage:
    """A Draft delivery of ``project`` (a new project when none is given)."""
    project = project or ProjectFactory.create(code=f"DP{next(_counter):04d}")
    data = {"name": "Turnover", "project_id": project.pk, **fields}
    if code:
        data["code"] = code
    return DeliveryService.create(actor=None, data=data)


def package_with_items(project=None, *, items: int = 1, **fields: Any):
    """A Draft delivery holding ``items`` published versions."""
    package = make_package(project, **fields)
    for _ in range(items):
        version = published_version(package.project)
        DeliveryService.add_version(actor=None, package=package, version_id=version.pk)
    return DeliveryPackage.objects.get(pk=package.pk)


def prepared_package(project=None, **fields: Any) -> DeliveryPackage:
    package = package_with_items(project, **fields)
    package, _ = DeliveryService.prepare(actor=None, package=package)
    return package


ALL_CODES = (
    "delivery.view",
    "delivery.create",
    "delivery.update",
    "delivery.delete",
    P.VIEW,
)
