"""
CR-36 evidence: what the project member API does about a show (real responses).

A membership can be bound to one show (`ProjectMembership.show`) and the backend narrows what such a member sees.
Before CR-36 the API ignored `show` and did not return it (POST answered 201 with `show_id: null`; PATCH and DELETE on a
member are 404 because the routes do not exist). After it, `show` binds and the rows carry `show_id` and `show_code`.
`member_add_with_show_id` sends the unknown key `show_id`: it is ignored and the binding from the call before stays.
Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_membership_show.py
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


def call(client, method, path, data=None):
    send = getattr(client, method.lower())
    resp = send(path, data=data, format="json") if data is not None else send(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)}
    return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "headers": headers, "body": clean(body)}


@pytest.mark.django_db
def test_capture_membership_show(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.production.models import ProjectMembership

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="Cr36-Admin-Pass!9")
    member = django_user_model.objects.create_user(email="member@example.test", password="Cr36-Member-Pass!9")
    a = APIClient()
    a.force_authenticate(user=admin)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make("/api/v1/projects/", {"code": "CR36", "name": "Show members", "workflow_type": "standard", "type": "Feature Film"})
    pid = project["id"]
    show = make("/api/v1/shows/", {"project": pid, "code": "S1", "name": "Season One"})
    base = f"/api/organizations/projects/{pid}/members/"

    flow: dict = {"ids": {"project": pid, "show": show["id"]}}
    flow["member_add_with_show"] = call(a, "POST", base, {"user_id": str(member.id), "role": "Artist", "show": show["id"]})
    flow["member_add_with_show_id"] = call(a, "POST", base, {"user_id": str(member.id), "role": "Artist", "show_id": show["id"]})
    flow["members_list"] = call(a, "GET", base)
    row = ProjectMembership.objects.get(project_id=pid, user=member)
    flow["database_after"] = {"show_id": str(row.show_id) if row.show_id else None, "scope": row.scope}

    mid = flow["member_add_with_show"]["body"].get("id")
    flow["member_patch"] = call(a, "PATCH", f"{base}{mid}/", {"role": "Lead"})
    flow["member_delete"] = call(a, "DELETE", f"{base}{mid}/")

    # What the narrowing does once a membership IS bound (set directly, as `assign_shows` does): the member's own
    # payload carries the show, and the project's other shows are out of reach.
    row.show_id = show["id"]
    row.save()
    flow["database_bound"] = {"show_id": str(row.show_id), "scope": ProjectMembership.objects.get(pk=row.pk).scope}
    m = APIClient()
    m.force_authenticate(user=member)
    flow["me_bound_member"] = call(m, "GET", "/api/v1/auth/me/")

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_membership_show_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
