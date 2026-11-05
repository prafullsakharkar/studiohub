"""
CR-42 evidence: what the project API does with `vendor_ids` and `vendor_names` (real responses).

Both are plain JSON lists on the project, written by the client as sent: ids that name no vendor are stored, the names
are whatever the client says (nothing ties them to the ids), and deleting a vendor leaves its id on the project.
Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_vendor_ids.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


def call(client, method, path, data=None):
    send = getattr(client, method.lower())
    resp = send(path, data=data, format="json") if data is not None else send(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    return {
        "request": {"method": method, "path": path, "body": data},
        "status": resp.status_code,
        "body": body,
    }


def vendor_fields(entry):
    body = entry["body"]
    return (
        {k: body.get(k) for k in ("vendor_ids", "vendor_names", "vendor_team_ids")}
        if isinstance(body, dict)
        else body
    )


@pytest.mark.django_db
def test_capture_vendor_ids(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    with open(os.devnull, "w") as quiet:
        call_command("init_platform", stdout=quiet, stderr=quiet)

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="Cr42-Admin-Pass!9"
    )
    a = APIClient()
    a.force_authenticate(user=admin)
    flow: dict = {}

    flow["vendor_create"] = call(
        a, "POST", "/api/v1/vendors/", {"name": "Northlight Roto", "code": "NLR"}
    )
    vendor = flow["vendor_create"]["body"]
    vid = vendor["id"]

    # 1. Ids that name no vendor, and names that do not match the ids, are stored as sent.
    flow["project_create_bad_ids"] = call(
        a,
        "POST",
        "/api/v1/projects/",
        {
            "code": "CR42",
            "name": "Vendor ids",
            "workflow_type": "standard",
            "type": "Feature Film",
            "vendor_ids": [vid, "not-a-vendor", "00000000-0000-0000-0000-000000000000"],
            "vendor_names": ["Somebody Else"],
        },
    )
    pid = flow["project_create_bad_ids"]["body"]["id"]
    flow["project_detail_after_create"] = call(a, "GET", f"/api/v1/projects/{pid}/")

    # 2. Changing the ids leaves the names as they were.
    flow["project_patch_ids_only"] = call(
        a, "PATCH", f"/api/v1/projects/{pid}/", {"vendor_ids": [vid]}
    )

    # 3. Not a list of strings.
    flow["project_patch_not_strings"] = call(
        a, "PATCH", f"/api/v1/projects/{pid}/", {"vendor_ids": [{"id": vid}, 42]}
    )

    # 4. Deleting the vendor leaves its id (and the name the client wrote) on the project.
    flow["project_patch_real_id"] = call(
        a, "PATCH", f"/api/v1/projects/{pid}/", {"vendor_ids": [vid]}
    )
    flow["vendor_delete"] = call(a, "DELETE", f"/api/v1/vendors/{vid}/")
    flow["vendor_detail_after_delete"] = call(a, "GET", f"/api/v1/vendors/{vid}/")
    flow["project_detail_after_vendor_delete"] = call(a, "GET", f"/api/v1/projects/{pid}/")

    flow["summary"] = {
        k: {"status": v["status"], **(vendor_fields(v) if k.startswith("project") else {})}
        for k, v in flow.items()
    }
    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_vendor_ids_flow.json").write_text(
        json.dumps(flow, indent=2, default=str) + "\n"
    )
