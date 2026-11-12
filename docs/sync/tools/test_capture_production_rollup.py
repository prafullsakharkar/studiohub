"""
Review pipeline RP-3 sample capture: the approval roll-up switch and its effect (real responses).

C-RP-14: the switch in the project responses and writes. C-RP-15: a version approved on a project with
the switch on approves its task; on a project with it off, it does not. Pytest test database only,
inside a rolled-back transaction; the after-commit roll-up runs through
``django_capture_on_commit_callbacks(execute=True)``.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_production_rollup.py
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
def test_capture_production_rollup(django_user_model, django_capture_on_commit_callbacks):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.tests.rbac_helpers import grant_permissions

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    def call(client, method, path, data=None):
        send = getattr(client, method.lower())
        with django_capture_on_commit_callbacks(execute=True):
            resp = send(path, data=data, format="json") if data is not None else send(path)
        try:
            body = resp.json()
        except Exception:
            body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
        headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)}
        return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "headers": headers, "body": clean(body)}

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="RP3-Admin-Pass!9")
    supervisor = django_user_model.objects.create_user(email="supervisor@example.test", password="RP3-Sup-Pass!9")
    artist = django_user_model.objects.create_user(email="artist@example.test", password="RP3-Artist-Pass!9")
    # The approver holds no task code: the project's rule approves the task (C-RP-15).
    grant_permissions(supervisor, "project.view", "version.view", "version.update", "version.publish")
    grant_permissions(artist, "project.view", "task.view", "version.view")

    def client(user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    a, sup, art = client(admin), client(supervisor), client(artist)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    flow: dict[str, dict] = {}  # type: ignore[assignment]
    flow["create_project_on"] = call(a, "POST", "/api/v1/projects/", {"code": "RPR", "name": "Roll-up", "workflow_type": "standard", "type": "Feature Film", "approve_task_on_version_approval": True})
    flow["create_project_default"] = call(a, "POST", "/api/v1/projects/", {"code": "RPQ", "name": "By hand", "workflow_type": "standard", "type": "Feature Film"})
    on, off = flow["create_project_on"]["body"]["id"], flow["create_project_default"]["body"]["id"]
    for pid in (on, off):
        for user in (supervisor, artist):
            make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(user.id), "role": "Artist"})

    # Read as the admin, so the shape has every key (budget_usd needs project.view_budget, CR-55).
    flow["projects_list"] = call(a, "GET", "/api/v1/projects/")
    flow["project_detail"] = call(a, "GET", f"/api/v1/projects/{on}/")
    flow["patch_switch_off"] = call(a, "PATCH", f"/api/v1/projects/{off}/", {"approve_task_on_version_approval": False})
    flow["patch_switch_by_artist_403"] = call(art, "PATCH", f"/api/v1/projects/{on}/", {"approve_task_on_version_approval": False})
    flow["patch_switch_bad_400"] = call(a, "PATCH", f"/api/v1/projects/{on}/", {"approve_task_on_version_approval": "sometimes"})

    def work(pid, prefix):
        seq = make("/api/v1/sequences/", {"project": pid, "code": f"{prefix}_SQ010", "name": "Opening"})
        shot = make("/api/v1/shots/", {"project": pid, "sequence_id": seq["id"], "code": f"{prefix}_SH0010", "name": "Hero walk"})
        task = make("/api/v1/tasks/", {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"{prefix}_T_COMP", "department": "Comp", "assignee": str(artist.id), "status": "In Progress"})
        version = make("/api/v1/versions/", {"project": pid, "shot": shot["id"], "task": task["id"], "code": f"{prefix}_SH0010_comp_v001", "status": "Pending Review"})
        return task, version

    task_on, version_on = work(on, "RPR")
    task_off, version_off = work(off, "RPQ")
    flow["ids"] = {"project_on": on, "project_off": off, "task_on": task_on["id"], "version_on": version_on["id"], "task_off": task_off["id"], "version_off": version_off["id"], "supervisor": str(supervisor.id), "artist": str(artist.id)}  # type: ignore[assignment]

    # C-RP-15: the approval's answer is the version, as before.
    flow["approve_version_on"] = call(sup, "PATCH", f"/api/v1/versions/{version_on['id']}/", {"status": "Approved"})
    flow["task_on_after"] = call(art, "GET", f"/api/v1/tasks/{task_on['id']}/")
    flow["task_on_status_history"] = call(art, "GET", f"/api/v1/tasks/{task_on['id']}/status-history/")
    flow["approve_version_off"] = call(sup, "PATCH", f"/api/v1/versions/{version_off['id']}/", {"status": "Approved"})
    flow["task_off_after"] = call(art, "GET", f"/api/v1/tasks/{task_off['id']}/")
    flow["task_off_status_history"] = call(art, "GET", f"/api/v1/tasks/{task_off['id']}/status-history/")

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_rollup_flow.json").write_text(json.dumps(flow, indent=2, sort_keys=True) + "\n")
