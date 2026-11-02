"""
CR-37 evidence: what the project members API can and cannot do to a member that already exists (real responses).

There is `GET` and `POST` on `projects/{id}/members/` and nothing else: no way to change a member except adding them
again, and no way to remove one. Captured here: `PATCH`/`DELETE` on a member (404), `department` sent on an add (ignored,
although a department-narrowed membership is enforced), what a status change or a removal does to the member's access
(it is gone at once: access needs `status = active` and `is_deleted = False`), and what a plain re-add does to a
suspended two-role member (reactivates them, drops a role). Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_member_detail.py
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
def test_capture_member_detail(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.production.models import ProjectMembership

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="Cr37-Admin-Pass!9")
    member = django_user_model.objects.create_user(email="member@example.test", password="Cr37-Member-Pass!9")
    from apps.identity.tests.rbac_helpers import grant_all_known_codes

    grant_all_known_codes(member)  # so that only the membership decides what they can reach
    a = APIClient()
    a.force_authenticate(user=admin)
    m = APIClient()
    m.force_authenticate(user=member)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make("/api/v1/projects/", {"code": "CR37", "name": "Member detail", "workflow_type": "standard", "type": "Feature Film"})
    pid = project["id"]
    base = f"/api/organizations/projects/{pid}/members/"
    flow: dict = {"ids": {"project": pid}}

    flow["add"] = call(a, "POST", base, {"user_id": str(member.id), "role": "Artist", "roles": ["Artist", "Lead"]})
    mid = flow["add"]["body"]["id"]
    flow["member_sees_project"] = call(m, "GET", f"/api/v1/projects/{pid}/")

    # No way to change or remove a member by id.
    flow["patch"] = call(a, "PATCH", f"{base}{mid}/", {"status": "suspended"})
    flow["delete"] = call(a, "DELETE", f"{base}{mid}/")

    # A department on an add is ignored (the serializer has no such field), though narrowing by department is enforced.
    flow["add_with_department"] = call(a, "POST", base, {"user_id": str(member.id), "role": "Artist", "roles": ["Artist", "Lead"], "department": "Comp", "department_id": "d-comp"})
    row = ProjectMembership.objects.get(pk=mid)
    flow["database_after_department"] = {"department": row.department, "department_id": row.department_id}

    # Status decides access: suspended (set in the database, there is no route) and the member loses the project at once.
    row.status = "suspended"
    row.save()
    flow["member_sees_project_when_suspended"] = call(m, "GET", f"/api/v1/projects/{pid}/")
    # ... and a plain re-add, the only "update", reactivates them and drops a role.
    flow["readd_plain"] = call(a, "POST", base, {"user_id": str(member.id), "role": "Artist"})
    flow["member_sees_project_after_readd"] = call(m, "GET", f"/api/v1/projects/{pid}/")

    # Removal (soft delete, as the model does it) takes the access away too.
    row.refresh_from_db()
    row.is_deleted = True
    row.save()
    flow["member_sees_project_when_deleted"] = call(m, "GET", f"/api/v1/projects/{pid}/")
    flow["members_list_after_delete"] = call(a, "GET", base)

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_member_detail_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
