"""Shared builders for the publishing tests."""

from __future__ import annotations

import itertools
from types import SimpleNamespace
from typing import Any

from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.production.tests.factories import VersionFactory
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import StorageRoot

SHA = "a" * 64
OTHER_SHA = "b" * 64

ALL_CODES = (
    P.VIEW,
    P.CREATE,
    P.UPDATE,
    P.DELETE,
    P.DEPRECATE,
    P.REVOKE,
    P.STORAGE_MANAGE,
)

_counter = itertools.count(1)


def member(project, *codes: str, **user_kwargs: Any):
    """A user holding ``codes`` who is an active member of ``project``."""
    user = UserFactory.create(**user_kwargs)
    if codes:
        grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def outsider(*codes: str):
    """A user holding ``codes`` who belongs to no project."""
    user = UserFactory.create()
    if codes:
        grant_permissions(user, *codes)
    return user


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def request_for(user) -> SimpleNamespace:
    """What a service needs of a request: the user and no scoped credential."""
    return SimpleNamespace(user=user, auth=None)


def published_version(project, **fields: Any):
    number = next(_counter)
    return VersionFactory.create(
        project=project,
        code=f"VER{number:04d}",
        status="Approved",
        is_published=True,
        **fields,
    )


def unpublished_version(project, **fields: Any):
    return VersionFactory.create(
        project=project, code=f"DRAFT{next(_counter):04d}", is_published=False, **fields
    )


def storage_root(code: str = "PROJECTS", **fields: Any) -> StorageRoot:
    fields.setdefault("name", code.title())
    return StorageRoot.objects.create(code=code, **fields)


def registration(version, root, path: str = "shot/v001/plate.exr", **over: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "version_id": str(version.pk),
        "storage_root": root.code,
        "relative_path": path,
        "size_bytes": 1024,
        "sha256": SHA,
    }
    body.update(over)
    return body
