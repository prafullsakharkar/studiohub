"""
Review pipeline RP-26 sample capture: the task on the Versions list (real responses, C-RP-61).

Versions on a vendor's task, on a studio task, on an archived task and with no task. The list, a
version and the project-scoped list read as the studio (a supervisor, with the built-in role), as a
member of the task's vendor, as a client member who takes part in a review holding one version, and
as a role without ``task.view``: ``task_code`` and ``task_title`` are given only to a caller who
could open the task. ``versions/?task_id=`` with a known, an unknown and a malformed id, with
``to_review=mine`` and with another project. Built-in roles from ``init_platform``. Pytest test
database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_version_task_list.py
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
def test_capture_version_task_list(django_user_model):
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
        u = django_user_model.objects.create_user(email=email, password="RP26-Pass-Word!9")
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
        email="root@example.test", password="RP26-Admin-Pass!9"
    )
    supervisor = user("supervisor@example.test", "vfx-supervisor")
    artist = user("artist@example.test", "artist")
    vendor = user("vendor@example.test", "artist")
    client_user = user("client@example.test", "artist")
    no_tasks = user("versions-only@example.test")
    grant_permissions(no_tasks, "project.view", "version.view")
    no_versions = user("tasks-only@example.test")
    grant_permissions(no_versions, "project.view", "task.view")
    a = client(admin)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make(
        "/api/v1/projects/",
        {
            "code": "RVL",
            "name": "Version list",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )
    other = make(
        "/api/v1/projects/",
        {"code": "RVO", "name": "Other", "workflow_type": "standard", "type": "Feature Film"},
    )
    pid = project["id"]
    for u, extra in (
        (supervisor, {"role": "VFX Supervisor"}),
        (artist, {"role": "Artist"}),
        (no_tasks, {"role": "Coordinator"}),
        (no_versions, {"role": "Coordinator"}),
        (vendor, {"role": "Artist", "vendor_id": "vendor-1"}),
        (client_user, {"role": "Client", "client_id": "client-1"}),
    ):
        ProjectMembership.objects.create(user=u, project_id=pid, status="active", **extra)
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RVL_SQ010", "name": "Opening"})
    shot = make(
        "/api/v1/shots/",
        {"project": pid, "sequence_id": seq["id"], "code": "RVL_SH0010", "name": "Hero walk"},
    )

    def task(code, title, **extra):
        return make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "code": code, "title": title, **extra},
        )

    comp = task("RVL_SH0010_COMP", "Comp", assignee=str(artist.id), reviewer=str(supervisor.id))
    a.patch(f"/api/v1/tasks/{comp['id']}/", {"vendor_id": "vendor-1"}, format="json")
    light = task("RVL_SH0010_LIGHT", "Lighting", reviewer=str(supervisor.id))
    roto = task("RVL_SH0010_ROTO", "Roto")

    def version(code, task_id=None, **extra):
        body = {"project": pid, "code": code, **extra}
        body.update({"task": task_id} if task_id else {"shot": shot["id"]})
        return make("/api/v1/versions/", body)

    comp_1 = version("RVL_SH0010_comp_v001", comp["id"], status="Pending Review")
    version("RVL_SH0010_comp_v002", comp["id"], status="In Progress")
    version("RVL_SH0010_light_v001", light["id"], status="Pending Review")
    on_roto = version("RVL_SH0010_roto_v001", roto["id"])
    version("RVL_SH0010_plate_v001")
    resp = a.delete(f"/api/v1/tasks/{roto['id']}/")
    assert resp.status_code in (200, 204), resp.content[:300]

    review = make(
        "/api/v1/reviews/",
        {
            "project": pid,
            "title": "Dailies",
            "code": "RVL_DAILIES",
            "entity_type": "Shot",
            "entity_id": shot["id"],
            "entity_code": shot["code"],
        },
    )
    make(f"/api/v1/reviews/{review['id']}/versions/", {"version_id": comp_1["id"]})
    make(
        f"/api/v1/reviews/{review['id']}/participants/",
        {"user_id": str(client_user.id), "role": "Client"},
    )

    sup, ven, cli, nt = client(supervisor), client(vendor), client(client_user), client(no_tasks)
    nv = client(no_versions)
    lst = f"/api/v1/versions/?project_id={pid}&ordering=code"
    flow: dict[str, dict] = {
        # The studio: every row names its task; none for the plate, none for the archived task.
        "list_as_supervisor": call(sup, "GET", lst),
        "version_as_supervisor": call(sup, "GET", f"/api/v1/versions/{comp_1['id']}/"),
        "version_on_archived_task": call(sup, "GET", f"/api/v1/versions/{on_roto['id']}/"),
        "project_scoped_list": call(
            sup, "GET", f"/api/organizations/projects/{pid}/versions/?ordering=code"
        ),
        # The vendor reads its own task's versions, with the task.
        "list_as_vendor": call(ven, "GET", lst),
        # The client reads the version in their review, without its task.
        "list_as_client": call(cli, "GET", lst),
        "version_as_client": call(cli, "GET", f"/api/v1/versions/{comp_1['id']}/"),
        # A role with version.view and no task.view: the rows, without their tasks.
        "list_without_task_view": call(nt, "GET", lst),
        # One task's versions.
        "task_filter": call(sup, "GET", f"/api/v1/versions/?task_id={comp['id']}&ordering=code"),
        "task_filter_unknown": call(
            sup, "GET", "/api/v1/versions/?task_id=00000000-0000-0000-0000-000000000000"
        ),
        "task_filter_malformed": call(sup, "GET", "/api/v1/versions/?task_id=not-a-uuid"),
        "task_filter_with_queue": call(
            sup, "GET", f"/api/v1/versions/?task_id={light['id']}&to_review=mine"
        ),
        "task_filter_other_project": call(
            sup, "GET", f"/api/v1/versions/?task_id={comp['id']}&project_id={other['id']}"
        ),
        "task_filter_as_client": call(cli, "GET", f"/api/v1/versions/?task_id={light['id']}"),
        "queue_as_supervisor": call(sup, "GET", "/api/v1/versions/?to_review=mine&ordering=code"),
        # The task's page: the task, and who reads it (with and without version.view).
        "task_as_supervisor": call(sup, "GET", f"/api/v1/tasks/{comp['id']}/"),
        "me_supervisor": call(sup, "GET", "/api/v1/auth/me/"),
        "task_without_version_view": call(nv, "GET", f"/api/v1/tasks/{comp['id']}/"),
        "me_without_version_view": call(nv, "GET", "/api/v1/auth/me/"),
    }
    for name, entry in flow.items():
        assert entry["status"] == 200, (name, entry["status"], entry["body"])

    def rows(name):
        body = flow[name]["body"]
        return {r["code"]: (r["task_code"], r["task_title"]) for r in body["results"]}

    assert rows("list_as_supervisor") == {
        "RVL_SH0010_COMP_V001": ("RVL_SH0010_COMP", "Comp"),
        "RVL_SH0010_COMP_V002": ("RVL_SH0010_COMP", "Comp"),
        "RVL_SH0010_LIGHT_V001": ("RVL_SH0010_LIGHT", "Lighting"),
        "RVL_SH0010_PLATE_V001": (None, None),
        "RVL_SH0010_ROTO_V001": (None, None),
    }
    assert rows("list_as_vendor") == {
        "RVL_SH0010_COMP_V001": ("RVL_SH0010_COMP", "Comp"),
        "RVL_SH0010_COMP_V002": ("RVL_SH0010_COMP", "Comp"),
    }
    assert rows("list_as_client") == {"RVL_SH0010_COMP_V001": (None, None)}
    assert set(rows("list_without_task_view").values()) == {(None, None)}
    assert len(rows("list_without_task_view")) == 5
    assert sorted(rows("task_filter")) == ["RVL_SH0010_COMP_V001", "RVL_SH0010_COMP_V002"]
    assert rows("task_filter_unknown") == rows("task_filter_malformed") == {}
    assert sorted(rows("task_filter_with_queue")) == ["RVL_SH0010_LIGHT_V001"]
    assert rows("task_filter_other_project") == rows("task_filter_as_client") == {}
    assert sorted(rows("queue_as_supervisor")) == ["RVL_SH0010_COMP_V001", "RVL_SH0010_LIGHT_V001"]
    scoped = {r["code"]: r["task_code"] for r in flow["project_scoped_list"]["body"]["results"]}
    assert scoped["RVL_SH0010_COMP_V001"] == "RVL_SH0010_COMP"
    assert flow["version_as_client"]["body"]["task_code"] is None
    assert flow["version_as_client"]["body"]["task_id"] == comp["id"]

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_version_task_list_flow.json").write_text(
        json.dumps(flow, indent=1, sort_keys=True) + "\n"
    )
