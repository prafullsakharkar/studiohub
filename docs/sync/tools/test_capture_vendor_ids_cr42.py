"""
CR-42 verification: what the project API does with `vendor_ids` and `vendor_names` once CR-42 is applied.

`vendor_ids` must name live vendors, each once (400 with a field error otherwise, nothing stored); `vendor_names` is
read-only and read from the vendors, in the order of the ids, following a rename and skipping a deleted vendor. The
flow before CR-42 is `test_capture_vendor_ids.py` (`_vendor_ids_flow.json`). Pytest test database only, inside a
rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_vendor_ids_cr42.py
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
def test_capture_vendor_ids_cr42(django_user_model):
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

    flow["vendor_create_north"] = call(
        a, "POST", "/api/v1/vendors/", {"name": "Northlight Roto", "code": "NLR"}
    )
    flow["vendor_create_ember"] = call(
        a, "POST", "/api/v1/vendors/", {"name": "Ember FX", "code": "EMB"}
    )
    north = flow["vendor_create_north"]["body"]["id"]
    ember = flow["vendor_create_ember"]["body"]["id"]
    project = {
        "code": "CR42",
        "name": "Vendor ids",
        "workflow_type": "standard",
        "type": "Feature Film",
    }

    # 1. Refused, nothing stored: an unknown id, a repeated id, an id that is not a UUID.
    flow["project_create_unknown_id"] = call(
        a,
        "POST",
        "/api/v1/projects/",
        {**project, "vendor_ids": [north, "00000000-0000-0000-0000-000000000000"]},
    )
    flow["project_create_duplicate_id"] = call(
        a, "POST", "/api/v1/projects/", {**project, "vendor_ids": [north, north]}
    )
    flow["project_create_not_a_uuid"] = call(
        a, "POST", "/api/v1/projects/", {**project, "vendor_ids": ["not-a-vendor"]}
    )

    # 2. Stored in the order given; the names come from the vendors, not from the client.
    flow["project_create"] = call(
        a,
        "POST",
        "/api/v1/projects/",
        {**project, "vendor_ids": [ember, north], "vendor_names": ["Somebody Else"]},
    )
    pid = flow["project_create"]["body"]["id"]
    flow["project_list"] = call(a, "GET", "/api/v1/projects/")

    # 3. A rename shows on the project; a deleted vendor drops out of the names (its id stays).
    flow["vendor_rename_north"] = call(
        a, "PATCH", f"/api/v1/vendors/{north}/", {"name": "Northlight Studios"}
    )
    flow["project_detail_after_rename"] = call(a, "GET", f"/api/v1/projects/{pid}/")
    flow["vendor_delete_ember"] = call(a, "DELETE", f"/api/v1/vendors/{ember}/")
    flow["project_detail_after_vendor_delete"] = call(a, "GET", f"/api/v1/projects/{pid}/")
    flow["project_patch_deleted_vendor"] = call(
        a, "PATCH", f"/api/v1/projects/{pid}/", {"vendor_ids": [north, ember]}
    )

    # 4. An edit that keeps the live vendor, then an empty list clears them.
    flow["project_patch_live_only"] = call(
        a, "PATCH", f"/api/v1/projects/{pid}/", {"vendor_ids": [north]}
    )
    flow["project_patch_clear"] = call(a, "PATCH", f"/api/v1/projects/{pid}/", {"vendor_ids": []})

    flow["summary"] = {
        k: {
            "status": v["status"],
            **(vendor_fields(v) if k.startswith("project") and k != "project_list" else {}),
        }
        for k, v in flow.items()
    }
    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_vendor_ids_cr42_flow.json").write_text(
        json.dumps(flow, indent=2, default=str) + "\n"
    )
