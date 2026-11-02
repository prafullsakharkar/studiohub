"""
CR-37 evidence: what the project members API does to a member that already exists (real responses).

Before CR-37 there was `GET` and `POST` on `projects/{id}/members/` and nothing else: `PATCH`/`DELETE` on a member were
404, `department` sent on an add was ignored (although a department-narrowed membership is enforced), and a plain re-add
of a suspended two-role member reactivated them and dropped a role. Access needs `status = active` and `is_deleted = False`
(captured: active 200, suspended 404, deleted 404). The first part of this file keeps those observations (now `patch` and
`delete` answer 200/204 and `add_with_department` still ignores a department: it is the add's behaviour, unchanged); the
second part (`cr37_*`) is the new route: change a member, refuse an empty body, the self-protection rule, remove.
Pytest test database only, inside a rolled-back transaction.

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

    # ---- CR-37: the new route, on a second member (the first was removed above).
    second = django_user_model.objects.create_user(email="second@example.test", password="Cr37-Second-Pass!9")
    grant_all_known_codes(second)
    s = APIClient()
    s.force_authenticate(user=second)
    show = make("/api/v1/shows/", {"project": pid, "code": "S1", "name": "Season One"})
    added = make(base, {"user_id": str(second.id), "role": "Artist", "roles": ["Artist", "Lead"]})
    sid = added["id"]
    detail = f"{base}{sid}/"
    flow["cr37_show"] = show
    flow["cr37_added"] = added
    flow["cr37_patch_role"] = call(a, "PATCH", detail, {"role": "Supervisor"})
    flow["cr37_patch_status"] = call(a, "PATCH", detail, {"status": "Suspended"})
    flow["cr37_sees_project_suspended"] = call(s, "GET", f"/api/v1/projects/{pid}/")
    flow["cr37_patch_back"] = call(a, "PATCH", detail, {"status": "active"})
    flow["cr37_sees_project_active"] = call(s, "GET", f"/api/v1/projects/{pid}/")
    flow["cr37_patch_department"] = call(a, "PATCH", detail, {"department": "Comp"})
    flow["cr37_patch_show"] = call(a, "PATCH", detail, {"show": show["id"]})
    flow["cr37_patch_release_show"] = call(a, "PATCH", detail, {"show": None})
    flow["cr37_patch_unknown_show"] = call(a, "PATCH", detail, {"show": "00000000-0000-4000-8000-000000000000"})
    flow["cr37_patch_empty"] = call(a, "PATCH", detail, {})
    flow["cr37_patch_bad_status"] = call(a, "PATCH", detail, {"status": "retired"})
    flow["cr37_get_detail"] = call(a, "GET", detail)
    # Self-protection: a platform administrator with a membership of their own.
    mine = ProjectMembership.objects.create(user=admin, project_id=pid, status="active", role="Lead")
    flow["cr37_self_delete"] = call(a, "DELETE", f"{base}{mine.pk}/")
    flow["cr37_self_suspend"] = call(a, "PATCH", f"{base}{mine.pk}/", {"status": "suspended"})
    flow["cr37_self_role"] = call(a, "PATCH", f"{base}{mine.pk}/", {"role": "Producer"})
    flow["cr37_delete"] = call(a, "DELETE", detail)
    flow["cr37_sees_project_removed"] = call(s, "GET", f"/api/v1/projects/{pid}/")
    flow["cr37_patch_removed"] = call(a, "PATCH", detail, {"role": "Lead"})
    flow["cr37_members_after"] = call(a, "GET", base)
    flow["cr37_readd"] = call(a, "POST", base, {"user_id": str(second.id), "role": "Artist"})

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_member_detail_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
