"""
CR-60 evidence (real responses): a project's one client and its vendors, and the records that may name only those.

A project with a client and two vendors; a project with neither (`project_bare`). A task's vendor, a delivery's client,
a member's client or vendor (add, then edit and clear), and the refusals for anything not the project's. Changing the
client, or dropping a vendor, while a record still names it is refused. E-mail addresses are redacted to
user@example.test. Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_project_partners_cr60.py
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
def test_capture_project_partners_cr60(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="Cr60-Admin-Pass!9")
    a = APIClient()
    a.force_authenticate(user=admin)

    def made(response):
        assert response.status_code == 201, response.content[:300]
        return response.json()["id"]

    acme = made(a.post("/api/v1/clients/", {"code": "CLI-ACME", "name": "Acme Pictures"}, format="json"))
    globex = made(a.post("/api/v1/clients/", {"code": "CLI-GLOBEX", "name": "Globex"}, format="json"))
    north = made(a.post("/api/v1/vendors/", {"code": "VEN-NORTH", "name": "Northlight"}, format="json"))
    ember = made(a.post("/api/v1/vendors/", {"code": "VEN-EMBER", "name": "Ember FX"}, format="json"))
    other = made(a.post("/api/v1/vendors/", {"code": "VEN-OTHER", "name": "Elsewhere VFX"}, format="json"))

    flow: dict = {"ids": {"acme": acme, "globex": globex, "north": north, "ember": ember, "other": other}}
    body = {"code": "CR60", "name": "Partners", "workflow_type": "standard", "type": "Feature Film"}
    flow["project_client_code"] = call(a, "POST", "/api/v1/projects/", {**body, "client_id": "CLI-ACME"})
    flow["project_create"] = call(a, "POST", "/api/v1/projects/", {**body, "client_id": acme, "client_name": "Typed", "vendor_ids": [north, ember]})
    pid = flow["project_create"]["body"]["id"]
    flow["ids"]["project"] = pid
    flow["project_detail"] = call(a, "GET", f"/api/v1/projects/{pid}/")
    bare = made(a.post("/api/v1/projects/", {**body, "code": "CR60B", "name": "No partners"}, format="json"))
    flow["ids"]["project_bare"] = bare
    flow["project_bare"] = call(a, "GET", f"/api/v1/projects/{bare}/")

    task = {"project_id": pid, "title": "Comp", "entity_type": "General"}
    flow["task_vendor"] = call(a, "POST", "/api/v1/tasks/", {**task, "code": "CR60_T1", "vendor_id": north, "vendor_name": "Typed"})
    flow["task_vendor_refused"] = call(a, "POST", "/api/v1/tasks/", {**task, "code": "CR60_T2", "vendor_id": other})

    flow["delivery_client"] = call(a, "POST", "/api/v1/deliveries/", {"name": "Turnover", "project_id": pid, "client_id": acme})
    flow["delivery_client_refused"] = call(a, "POST", "/api/v1/deliveries/", {"name": "Wrong", "project_id": pid, "client_id": globex})
    flow["delivery_bare_refused"] = call(a, "POST", "/api/v1/deliveries/", {"name": "Bare", "project_id": bare, "client_id": acme})

    members = f"/api/organizations/projects/{pid}/members/"
    people = [django_user_model.objects.create_user(email=f"m{i}@example.test", password="Cr60-Member-Pass!9") for i in range(4)]
    flow["member_add_client"] = call(a, "POST", members, {"user_id": str(people[0].pk), "role": "Artist", "client_id": acme})
    flow["member_add_vendor"] = call(a, "POST", members, {"user_id": str(people[1].pk), "role": "Artist", "vendor_id": ember})
    flow["member_vendor_refused"] = call(a, "POST", members, {"user_id": str(people[2].pk), "role": "Artist", "vendor_id": other})
    flow["member_client_refused"] = call(a, "POST", members, {"user_id": str(people[2].pk), "role": "Artist", "client_id": globex})
    plain = a.post(members, {"user_id": str(people[3].pk), "role": "Artist"}, format="json").json()["id"]
    flow["member_patch_vendor"] = call(a, "PATCH", f"{members}{plain}/", {"client_id": "", "vendor_id": north})
    flow["member_patch_studio"] = call(a, "PATCH", f"{members}{plain}/", {"client_id": "", "vendor_id": ""})
    flow["members_list"] = call(a, "GET", members)

    flow["project_vendor_in_use"] = call(a, "PATCH", f"/api/v1/projects/{pid}/", {"vendor_ids": [north]})
    flow["project_client_in_use"] = call(a, "PATCH", f"/api/v1/projects/{pid}/", {"client_id": globex})

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_project_partners_cr60_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
