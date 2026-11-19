"""
Review pipeline RP-24 sample capture: waiting for my review (real responses, C-RP-58).

Two reviewers with the built-in supervisor role. Versions in Pending Review and in other statuses, on
a task each reviews, on a task with no reviewer, without a task and on an archived task. Each reviewer
asks for ``versions/?to_review=mine`` (with and without a project and a search); a client member who
takes part in a review asks too; a bad value is a 400. The tasks a reviewer reviews
(``tasks/?reviewer_id=``), and an unknown and a malformed id. Built-in roles from ``init_platform``.
Pytest test database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_queue.py
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
def test_capture_review_queue(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Profile, Role, UserRole
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

    def user(email, role_code):
        u = django_user_model.objects.create_user(email=email, password="RP24-Pass-Word!9")
        first = email.split("@")[0].title()
        Profile.objects.update_or_create(
            user=u,
            defaults={
                "first_name": first,
                "last_name": "Example",
                "display_name": f"{first} Example",
            },
        )
        UserRole.objects.create(user=u, role=Role.objects.get(code=role_code))
        return u

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP24-Admin-Pass!9"
    )
    supervisor = user("supervisor@example.test", "vfx-supervisor")
    lead = user("lead@example.test", "vfx-supervisor")
    artist = user("artist@example.test", "artist")
    client_user = user("client@example.test", "artist")
    a = client(admin)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    projects = []
    for code, name in (("RRQ", "Review queue"), ("RRQB", "Review queue B")):
        project = make(
            "/api/v1/projects/",
            {"code": code, "name": name, "workflow_type": "standard", "type": "Feature Film"},
        )
        projects.append(project)
        for u, extra in (
            (supervisor, {"role": "VFX Supervisor"}),
            (lead, {"role": "VFX Supervisor"}),
            (artist, {"role": "Artist"}),
            (client_user, {"role": "Client", "client_id": "client-1"}),
        ):
            ProjectMembership.objects.create(
                user=u, project_id=project["id"], status="active", **extra
            )
    pid, pid_b = projects[0]["id"], projects[1]["id"]

    def shot_of(project_id, code):
        seq = make(
            "/api/v1/sequences/", {"project": project_id, "code": f"{code}_SQ", "name": "Sq"}
        )
        return make(
            "/api/v1/shots/",
            {"project": project_id, "sequence_id": seq["id"], "code": code, "name": "Shot"},
        )

    shot, shot_b = shot_of(pid, "RRQ_SH0010"), shot_of(pid_b, "RRQB_SH0010")

    def task(project_id, shot_row, code, reviewer=None):
        body = {
            "project": project_id,
            "shot": shot_row["id"],
            "code": code,
            "title": code.rsplit("_", 1)[-1].title(),
            "assignee": str(artist.id),
        }
        if reviewer is not None:
            body["reviewer"] = str(reviewer.id)
        return make("/api/v1/tasks/", body)

    def version(project_id, task_row, code, status="Pending Review"):
        return make(
            "/api/v1/versions/",
            {"project": project_id, "task": task_row["id"], "code": code, "status": status},
        )

    comp = task(pid, shot, "RRQ_SH0010_COMP", supervisor)
    roto = task(pid, shot, "RRQ_SH0010_ROTO", lead)
    paint = task(pid, shot, "RRQ_SH0010_PAINT")
    old = task(pid, shot, "RRQ_SH0010_OLD", supervisor)
    elsewhere = task(pid_b, shot_b, "RRQB_SH0010_COMP", supervisor)

    waiting = version(pid, comp, "RRQ_SH0010_comp_v002")
    version(pid, comp, "RRQ_SH0010_comp_v001", "Retake")
    version(pid, comp, "RRQ_SH0010_comp_v003", "In Progress")
    for_lead = version(pid, roto, "RRQ_SH0010_roto_v001")
    version(pid, paint, "RRQ_SH0010_paint_v001")
    version(pid, old, "RRQ_SH0010_old_v001")
    other_project = version(pid_b, elsewhere, "RRQB_SH0010_comp_v001")
    no_task = make(
        "/api/v1/versions/",
        {
            "project": pid,
            "shot": shot["id"],
            "code": "RRQ_SH0010_plate_v001",
            "status": "Pending Review",
        },
    )
    archived = a.post(f"/api/v1/tasks/{old['id']}/archive/", format="json")
    assert archived.status_code == 200, archived.content[:300]

    review = make(
        "/api/v1/reviews/",
        {
            "project": pid,
            "title": "Dailies",
            "code": "RRQ_DAILIES",
            "entity_type": "Shot",
            "entity_id": shot["id"],
            "entity_code": shot["code"],
        },
    )
    make(f"/api/v1/reviews/{review['id']}/versions/", {"version_id": waiting["id"]})
    make(
        f"/api/v1/reviews/{review['id']}/participants/",
        {"user_id": str(client_user.id), "role": "Client"},
    )

    sup, ld, cli = client(supervisor), client(lead), client(client_user)
    queue = "/api/v1/versions/?to_review=mine"
    flow: dict[str, dict] = {
        "me_supervisor": call(sup, "GET", "/api/v1/auth/me/"),
        # Each reviewer's own queue, across projects.
        "to_review_supervisor": call(sup, "GET", queue),
        "to_review_lead": call(ld, "GET", queue),
        # With the list's other parameters.
        "to_review_supervisor_project": call(sup, "GET", f"{queue}&project_id={pid}"),
        "to_review_supervisor_search": call(sup, "GET", f"{queue}&search=RRQB"),
        # A client member in a review of a waiting version reviews no task: nothing waits for them.
        "to_review_client": call(cli, "GET", queue),
        # Only "mine".
        "to_review_bad_value_400": call(sup, "GET", f"/api/v1/versions/?to_review={supervisor.id}"),
        # The tasks a person reviews.
        "tasks_reviewed_by_supervisor": call(
            sup, "GET", f"/api/v1/tasks/?reviewer_id={supervisor.id}"
        ),
        "tasks_reviewer_unknown": call(
            sup, "GET", "/api/v1/tasks/?reviewer_id=5c3f0f9e-1b7a-4c1e-9a52-8f0c2d4e6b10"
        ),
        "tasks_reviewer_malformed": call(sup, "GET", "/api/v1/tasks/?reviewer_id=not-an-id"),
        # The same list without the filter, for comparison.
        "versions_all_supervisor": call(sup, "GET", f"/api/v1/versions/?project_id={pid}"),
    }
    expected = {"to_review_bad_value_400": 400}
    for name, entry in flow.items():
        assert entry["status"] == expected.get(name, 200), (name, entry["status"], entry["body"])

    def codes(name):
        return sorted(row["code"] for row in flow[name]["body"]["results"])

    assert codes("to_review_supervisor") == sorted([waiting["code"], other_project["code"]])
    assert codes("to_review_lead") == [for_lead["code"]]
    assert codes("to_review_supervisor_project") == [waiting["code"]]
    assert codes("to_review_supervisor_search") == [other_project["code"]]
    assert codes("to_review_client") == []
    assert set(flow["to_review_bad_value_400"]["body"]) >= {"to_review"}
    assert sorted(
        row["code"] for row in flow["tasks_reviewed_by_supervisor"]["body"]["results"]
    ) == [
        "RRQB_SH0010_COMP",
        "RRQ_SH0010_COMP",
    ]
    assert flow["tasks_reviewer_unknown"]["body"]["results"] == []
    assert flow["tasks_reviewer_malformed"]["body"]["results"] == []
    assert no_task["code"] in codes("versions_all_supervisor")

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_review_queue_flow.json").write_text(
        json.dumps(flow, indent=1, sort_keys=True) + "\n"
    )
