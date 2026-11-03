"""
CR-38 evidence: what `POST projects/{id}/members/` does to a member who is already on the project (real responses).

The add is documented as idempotent, but every field the request leaves out takes the serializer's default, and the
defaults overwrite the stored values: `status` becomes active, `role` becomes Artist, and `roles` becomes [role].
Captured here for a suspended Lead with two roles, for the other non-active statuses, and for an add with an explicit
status. Pytest test database only, inside a rolled-back transaction.

    cd backend
    # before CR-38: _readd_flow.json (the default name); after it: READD_OUT_NAME=_readd_after_cr38_flow.json
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_readd.py
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
    return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "body": clean(body)}


@pytest.mark.django_db
def test_capture_readd(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="Cr38-Admin-Pass!9")
    people = {
        name: django_user_model.objects.create_user(email=f"{name}@example.test", password=f"Cr38-{name}-Pass!9")
        for name in ("suspended", "leave", "terminated", "lead")
    }
    from apps.identity.tests.rbac_helpers import grant_all_known_codes

    for u in people.values():
        grant_all_known_codes(u)  # only the membership decides what they can reach
    a = APIClient()
    a.force_authenticate(user=admin)
    clients = {name: APIClient() for name in people}
    for name, c in clients.items():
        c.force_authenticate(user=people[name])

    project = a.post("/api/v1/projects/", {"code": "CR38", "name": "Re-add", "workflow_type": "standard", "type": "Feature Film"}, format="json").json()
    pid = project["id"]
    base = f"/api/organizations/projects/{pid}/members/"
    flow: dict = {"ids": {"project": pid}}

    # A Lead with two roles, three people whose status is not active, each added with an explicit status.
    flow["add_suspended_lead"] = call(a, "POST", base, {"user_id": str(people["suspended"].id), "role": "Lead", "roles": ["Lead", "Artist"], "status": "suspended"})
    flow["add_on_leave"] = call(a, "POST", base, {"user_id": str(people["leave"].id), "role": "Lead", "roles": ["Lead", "Artist"], "status": "on_leave"})
    flow["add_terminated"] = call(a, "POST", base, {"user_id": str(people["terminated"].id), "role": "Lead", "roles": ["Lead", "Artist"], "status": "terminated"})
    flow["add_active_lead"] = call(a, "POST", base, {"user_id": str(people["lead"].id), "role": "Lead", "roles": ["Lead", "Artist"]})
    for name in ("suspended", "leave", "terminated", "lead"):
        flow[f"{name}_sees_project_before"] = call(clients[name], "GET", f"/api/v1/projects/{pid}/")

    # The add again, naming only the person (what a "just make sure they are on the project" caller sends).
    for name in ("suspended", "leave", "terminated", "lead"):
        flow[f"readd_{name}_user_only"] = call(a, "POST", base, {"user_id": str(people[name].id)})
        flow[f"{name}_sees_project_after"] = call(clients[name], "GET", f"/api/v1/projects/{pid}/")

    # The add form of the frontend names the role as well.
    flow["readd_lead_with_role"] = call(a, "POST", base, {"user_id": str(people["lead"].id), "role": "Artist"})

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / os.environ.get("READD_OUT_NAME", "_readd_flow.json")).write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
