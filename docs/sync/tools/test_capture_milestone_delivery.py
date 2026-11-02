"""
Phase 27 evidence: how a delivery milestone names its delivery (real responses).

The milestone form asked for a pasted delivery id. This captures what the server accepts for `delivery_package_id` and,
above all, what a change of kind does to an existing delivery milestone, so the picker is built on the server's rules:
the list a picker reads (`projects/{id}/deliveries/`), a delivery of another project, an empty string, and a milestone
moved back to the general kind with and without clearing its delivery.
Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_milestone_delivery.py
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
def test_capture_milestone_delivery(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="P27-Admin-Pass!9")
    a = APIClient()
    a.force_authenticate(user=admin)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    pid = make("/api/v1/projects/", {"code": "P27", "name": "Milestone picker", "workflow_type": "standard", "type": "Feature Film"})["id"]
    other = make("/api/v1/projects/", {"code": "P27B", "name": "Elsewhere", "workflow_type": "standard", "type": "Feature Film"})["id"]
    d1 = make("/api/v1/deliveries/", {"name": "Reel 1 turnover", "project_id": pid})
    d2 = make("/api/v1/deliveries/", {"name": "Reel 2 turnover", "project_id": pid})
    foreign = make("/api/v1/deliveries/", {"name": "Not this project", "project_id": other})
    S = "/api/v1/scheduling/"
    flow: dict = {"ids": {"project": pid, "delivery": d1["id"], "delivery_two": d2["id"], "foreign": foreign["id"]}}

    # What a picker reads: the project's own deliveries (the studio list ignores a project filter, CR-17).
    flow["project_deliveries"] = call(a, "GET", f"/api/organizations/projects/{pid}/deliveries/")
    flow["project_deliveries_search"] = call(a, "GET", f"/api/organizations/projects/{pid}/deliveries/?search=Reel+2")
    flow["project_deliveries_search_nothing"] = call(a, "GET", f"/api/organizations/projects/{pid}/deliveries/?search=Zzzz")
    flow["project_deliveries_search_code"] = call(a, "GET", f"/api/organizations/projects/{pid}/deliveries/?search=0001")
    flow["project_deliveries_page_size"] = call(a, "GET", f"/api/organizations/projects/{pid}/deliveries/?page_size=1")
    flow["delivery_detail"] = call(a, "GET", f"/api/v1/deliveries/{d1['id']}/")

    # Create.
    flow["create_with_delivery"] = call(a, "POST", f"{S}milestones/", {"project_id": pid, "name": "Reel 1 due", "due_date": "2027-03-01", "kind": "delivery", "delivery_package_id": d1["id"]})
    mid = flow["create_with_delivery"]["body"].get("id")
    flow["create_foreign_delivery"] = call(a, "POST", f"{S}milestones/", {"project_id": pid, "name": "Wrong project", "due_date": "2027-03-02", "kind": "delivery", "delivery_package_id": foreign["id"]})
    flow["create_empty_string"] = call(a, "POST", f"{S}milestones/", {"project_id": pid, "name": "Blank id", "due_date": "2027-03-02", "kind": "delivery", "delivery_package_id": ""})
    flow["create_null"] = call(a, "POST", f"{S}milestones/", {"project_id": pid, "name": "Null id", "due_date": "2027-03-02", "kind": "delivery", "delivery_package_id": None})
    flow["create_general_with_delivery"] = call(a, "POST", f"{S}milestones/", {"project_id": pid, "name": "General with id", "due_date": "2027-03-02", "kind": "general", "delivery_package_id": d1["id"]})
    flow["detail"] = call(a, "GET", f"{S}milestones/{mid}/")

    # Edit: the form sends only what the user touched, and a hidden field is not sent.
    flow["patch_other_delivery"] = call(a, "PATCH", f"{S}milestones/{mid}/", {"delivery_package_id": d2["id"]})
    flow["patch_kind_general_alone"] = call(a, "PATCH", f"{S}milestones/{mid}/", {"kind": "general"})
    flow["after_kind_general_alone"] = call(a, "GET", f"{S}milestones/{mid}/")
    flow["patch_delivery_empty_string"] = call(a, "PATCH", f"{S}milestones/{mid}/", {"delivery_package_id": ""})
    flow["patch_delivery_null_alone"] = call(a, "PATCH", f"{S}milestones/{mid}/", {"delivery_package_id": None})
    flow["patch_kind_general_and_null"] = call(a, "PATCH", f"{S}milestones/{mid}/", {"kind": "general", "delivery_package_id": None})
    flow["after_kind_general_and_null"] = call(a, "GET", f"{S}milestones/{mid}/")
    flow["patch_back_to_delivery_alone"] = call(a, "PATCH", f"{S}milestones/{mid}/", {"kind": "delivery"})
    flow["patch_back_to_delivery"] = call(a, "PATCH", f"{S}milestones/{mid}/", {"kind": "delivery", "delivery_package_id": d2["id"]})

    (OUT / "scheduling").mkdir(parents=True, exist_ok=True)
    (OUT / "scheduling" / "_milestone_delivery_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
