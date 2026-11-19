"""
Review pipeline RP-21 sample capture: a version's task, as the version page reads it (real responses).

A version on a vendor's task that names an assignee and a reviewer; a version with no task. Read as
the studio (a supervisor, with the built-in role), as a member of the task's vendor and as a client
member who takes part in a review holding the version: the client reads the version and gets 404 for
its task (the external scope, ``selectors/external_scope.py``). A task without a reviewer, and a role
without ``task.view`` (403). Built-in roles from ``init_platform``. Pytest test database only, rolled
back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_version_task.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return EMAIL.sub("user@example.test", v)
    return v


@pytest.mark.django_db
def test_capture_version_task(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Profile, Role, UserRole
    from apps.identity.tests.rbac_helpers import grant_permissions
    from apps.production.models import ProjectMembership

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    devnull = open(os.devnull, "w")  # noqa: SIM115
    call_command("init_platform", stdout=devnull, stderr=devnull)

    def call(client, method, path, data=None):
        send = getattr(client, method.lower())
        resp = send(path, data=data, format="json") if data is not None else send(path)
        return {
            "request": {"method": method, "path": path, "body": data},
            "status": resp.status_code,
            "body": clean(resp.json()),
        }

    def user(email, role_code=None):
        u = django_user_model.objects.create_user(email=email, password="RP21-Pass-Word!9")
        first = email.split("@")[0].title()
        Profile.objects.update_or_create(
            user=u,
            defaults={
                "first_name": first,
                "last_name": "Example",
                "display_name": f"{first} Example",
            },
        )
        if role_code:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role_code))
        return u

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP21-Admin-Pass!9"
    )
    supervisor = user("supervisor@example.test", "vfx-supervisor")
    artist = user("artist@example.test", "artist")
    vendor = user("vendor@example.test", "artist")
    client_user = user("client@example.test", "artist")
    no_tasks = user("versions-only@example.test")
    grant_permissions(no_tasks, "project.view", "version.view")
    a = client(admin)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make(
        "/api/v1/projects/",
        {
            "code": "RVT",
            "name": "Version task",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )
    pid = project["id"]
    for u, extra in (
        (supervisor, {"role": "VFX Supervisor"}),
        (artist, {"role": "Artist"}),
        (no_tasks, {"role": "Coordinator"}),
        (vendor, {"role": "Artist", "vendor_id": "vendor-1"}),
        (client_user, {"role": "Client", "client_id": "client-1"}),
    ):
        ProjectMembership.objects.create(user=u, project_id=pid, status="active", **extra)
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RVT_SQ010", "name": "Opening"})
    shot = make(
        "/api/v1/shots/",
        {"project": pid, "sequence_id": seq["id"], "code": "RVT_SH0010", "name": "Hero walk"},
    )
    task = make(
        "/api/v1/tasks/",
        {
            "project": pid,
            "shot": shot["id"],
            "code": "RVT_SH0010_COMP",
            "title": "Comp",
            "assignee": str(artist.id),
            "reviewer": str(supervisor.id),
        },
    )
    a.patch(f"/api/v1/tasks/{task['id']}/", {"vendor_id": "vendor-1"}, format="json")
    bare = make(
        "/api/v1/tasks/",
        {
            "project": pid,
            "shot": shot["id"],
            "code": "RVT_SH0010_ROTO",
            "title": "Roto",
            "assignee": str(artist.id),
        },
    )
    version = make(
        "/api/v1/versions/",
        {
            "project": pid,
            "task": task["id"],
            "code": "RVT_SH0010_comp_v001",
            "status": "Pending Review",
        },
    )
    unreviewed = make(
        "/api/v1/versions/", {"project": pid, "task": bare["id"], "code": "RVT_SH0010_roto_v001"}
    )
    taskless = make(
        "/api/v1/versions/", {"project": pid, "shot": shot["id"], "code": "RVT_SH0010_plate_v001"}
    )
    review = make(
        "/api/v1/reviews/",
        {
            "project": pid,
            "title": "Dailies",
            "code": "RVT_DAILIES",
            "entity_type": "Shot",
            "entity_id": shot["id"],
            "entity_code": shot["code"],
        },
    )
    make(f"/api/v1/reviews/{review['id']}/versions/", {"version_id": version["id"]})
    make(
        f"/api/v1/reviews/{review['id']}/participants/",
        {"user_id": str(client_user.id), "role": "Client"},
    )

    sup, ven, cli, nt = client(supervisor), client(vendor), client(client_user), client(no_tasks)
    v, t = f"/api/v1/versions/{version['id']}/", f"/api/v1/tasks/{task['id']}/"
    flow: dict[str, dict] = {
        # The studio: the version names its task; the task names its assignee and reviewer.
        "version_with_task": call(sup, "GET", v),
        "task_of_version": call(sup, "GET", t),
        "me_reviewer": call(sup, "GET", "/api/v1/auth/me/"),
        # A task with no reviewer; a version with no task.
        "version_unreviewed": call(sup, "GET", f"/api/v1/versions/{unreviewed['id']}/"),
        "task_without_reviewer": call(sup, "GET", f"/api/v1/tasks/{bare['id']}/"),
        "version_without_task": call(sup, "GET", f"/api/v1/versions/{taskless['id']}/"),
        # The vendor of the task reads both.
        "version_as_vendor": call(ven, "GET", v),
        "task_as_vendor": call(ven, "GET", t),
        # The client reads the version in their review, not its task.
        "version_as_client": call(cli, "GET", v),
        "task_as_client_404": call(cli, "GET", t),
        # A role with version.view and no task.view.
        "version_without_task_view": call(nt, "GET", v),
        "task_without_task_view_403": call(nt, "GET", t),
        "me_without_task_view": call(nt, "GET", "/api/v1/auth/me/"),
    }
    expected = {"task_as_client_404": 404, "task_without_task_view_403": 403}
    for name, entry in flow.items():
        assert entry["status"] == expected.get(name, 200), (name, entry["status"], entry["body"])
    assert flow["version_with_task"]["body"]["task_id"] == task["id"]
    assert flow["task_of_version"]["body"]["reviewer_id"] == str(supervisor.id)
    assert flow["task_of_version"]["body"]["vendor_id"] == "vendor-1"
    assert flow["version_without_task"]["body"]["task_id"] is None

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_version_task_flow.json").write_text(
        json.dumps(flow, indent=1, sort_keys=True) + "\n"
    )
