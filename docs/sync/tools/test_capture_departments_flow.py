"""
Phase 1 sample capture: the departments list/create flow (real responses).

Pytest test database only, inside a rolled-back transaction (like test_capture_samples.py).

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_departments_flow.py
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
    resp = getattr(client, method.lower())(path, data=data, format="json") if data is not None else getattr(client, method.lower())(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Retry-After", "Allow") if resp.get(h)}
    return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "headers": headers, "body": clean(body)}


@pytest.mark.django_db
def test_capture_departments_flow(django_user_model):
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"

    from django.core.management import call_command

    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.models import Role, UserRole
    from apps.masterdata.models import Department

    admin = django_user_model.objects.create_superuser(email="admin@example.test", password="Phase1-Admin-Pass!9")
    artist = django_user_model.objects.create_user(email="artist@example.test", password="Phase1-Artist-Pass!9")
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))

    a = APIClient()
    a.force_authenticate(user=admin)
    m = APIClient()
    m.force_authenticate(user=artist)

    flow = {}
    payload = {"name": "Lookdev", "code": "DEPT-LOOK", "department_type": "creative", "description": "Look development", "color": "#6366f1", "parent": None, "manager": None, "software_stack": ["Katana", "USD"]}
    flow["create_ok"] = call(a, "POST", "/api/v1/departments/", payload)
    flow["create_duplicate_code"] = call(a, "POST", "/api/v1/departments/", payload)
    flow["create_duplicate_name_ci"] = call(a, "POST", "/api/v1/departments/", {**payload, "code": "DEPT-OTHER", "name": "LOOKDEV"})
    flow["create_missing_fields"] = call(a, "POST", "/api/v1/departments/", {})
    flow["create_invalid_type"] = call(a, "POST", "/api/v1/departments/", {**payload, "code": "DEPT-X", "department_type": "wizard"})
    flow["create_code_too_long"] = call(a, "POST", "/api/v1/departments/", {**payload, "code": "X" * 31})
    flow["create_as_artist_403"] = call(m, "POST", "/api/v1/departments/", {**payload, "code": "DEPT-ART"})
    flow["list_as_artist"] = call(m, "GET", "/api/v1/departments/")
    flow["list_default"] = call(a, "GET", "/api/v1/departments/")
    flow["list_search_comp"] = call(a, "GET", "/api/v1/departments/?search=comp")
    flow["list_search_no_match"] = call(a, "GET", "/api/v1/departments/?search=zzzz")
    flow["list_ordering_name_desc"] = call(a, "GET", "/api/v1/departments/?ordering=-name")
    flow["list_filter_type"] = call(a, "GET", "/api/v1/departments/?department_type=technical")
    flow["list_page_size_2"] = call(a, "GET", "/api/v1/departments/?page_size=2")
    flow["list_page_2_of_size_2"] = call(a, "GET", "/api/v1/departments/?page_size=2&page=2")
    flow["list_page_out_of_range"] = call(a, "GET", "/api/v1/departments/?page_size=2&page=99")
    flow["list_invalid_type_filter"] = call(a, "GET", "/api/v1/departments/?department_type=wizard")
    created = flow["create_ok"]["body"]
    flow["delete_ok"] = call(a, "DELETE", f"/api/v1/departments/{created['id']}/")
    flow["delete_as_artist_403"] = call(m, "DELETE", f"/api/v1/departments/{Department.objects.first().id}/")

    (OUT / "masterdata").mkdir(parents=True, exist_ok=True)
    (OUT / "masterdata" / "_departments_flow.json").write_text(json.dumps(flow, indent=2, default=str) + "\n")
