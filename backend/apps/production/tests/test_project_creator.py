"""
What creating a project gives its creator (Q14 is open, see DECISIONS.md D-06).

The creator becomes a member labelled "Production Admin". The label is display
only: nothing branches on it, the membership grants visibility of the project
and no permission, so the creator's rights are exactly the global codes they
already held.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from rest_framework.test import APIClient

from apps.identity.services.permission_cache import PermissionCacheService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Project, ProjectMembership

pytestmark = pytest.mark.django_db

CODES = {"project.view", "project.create"}


def _creator():
    user = UserFactory.create()
    grant_permissions(user, *CODES)
    client = APIClient()
    client.force_authenticate(user=user)
    return user, client


def _create(client):
    resp = client.post("/api/v1/projects/", {"code": "OWN1", "name": "Owned"}, format="json")
    assert resp.status_code == 201, resp.json()
    return Project.objects.get(code="OWN1")


def test_the_creators_permission_set_is_exactly_what_they_already_held():
    user, client = _creator()
    before = set(PermissionCacheService.get_permissions(user=user))

    _create(client)
    PermissionCacheService.invalidate(user=user)
    after = set(PermissionCacheService.get_permissions(user=user))

    assert before == after
    assert {
        code for code in after if code.split(".")[0] in {"project", "shot", "task", "version"}
    } == CODES


def test_the_membership_is_visibility_only():
    user, client = _creator()
    project = _create(client)

    membership = ProjectMembership.objects.get(user=user, project=project)
    assert (membership.role, membership.scope, membership.status) == (
        "Production Admin",
        "PROJECT",
        "active",
    )
    # Visible ...
    assert [row["code"] for row in client.get("/api/v1/projects/").json()["results"]] == ["OWN1"]
    # ... but nothing beyond the codes: no edits, no shots, no members, no deletion.
    assert (
        client.patch(f"/api/v1/projects/{project.id}/", {"name": "x"}, format="json").status_code
        == 403
    )
    assert client.delete(f"/api/v1/projects/{project.id}/").status_code == 403
    shot = {"project_id": str(project.id), "code": "S1", "name": "s"}
    assert client.post("/api/v1/shots/", shot, format="json").status_code == 403
    member = {"user_id": str(UserFactory.create().id), "role": "Artist"}
    assert (
        client.post(
            f"/api/organizations/projects/{project.id}/members/", member, format="json"
        ).status_code
        == 403
    )


def test_renaming_the_role_changes_nothing():
    user, client = _creator()
    project = _create(client)
    probes = [
        ("get", "/api/v1/projects/"),
        ("get", f"/api/v1/projects/{project.id}/"),
        ("get", f"/api/organizations/projects/{project.id}/summary"),
        ("patch", f"/api/v1/projects/{project.id}/"),
    ]

    def outcomes():
        return [
            getattr(client, verb)(
                url, {"name": "x"} if verb == "patch" else None, format="json"
            ).status_code
            for verb, url in probes
        ]

    before = outcomes()
    ProjectMembership.objects.filter(user=user, project=project).update(
        role="Artist", roles=["Artist"]
    )
    assert outcomes() == before


def test_no_production_source_branches_on_the_membership_role_name():
    root = Path(__file__).resolve().parents[1]
    pattern = re.compile(
        r"""\.role\s*(==|!=|in\b)|role__(iexact|exact|in|contains|icontains)\b|roles__|["']Production Admin["']\s*(==|in\b)"""
    )
    offenders = []
    for path in root.rglob("*.py"):
        if "tests" in path.parts or "migrations" in path.parts:
            continue
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            if pattern.search(line):
                offenders.append(f"{path.relative_to(root)}:{number}: {line.strip()}")
    assert offenders == []
