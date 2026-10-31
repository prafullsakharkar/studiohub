"""
CR-32 sample capture: team memberships (a person in several teams), real responses.

Pytest test database only, inside a rolled-back transaction (like test_capture_samples.py).

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_team_memberships.py
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
def test_capture_team_memberships(django_user_model):
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"

    from django.core.management import call_command

    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.models import Role, UserRole

    admin = django_user_model.objects.create_superuser(email="admin@example.test", password="Phase1-Admin-Pass!9")
    artist = django_user_model.objects.create_user(email="artist@example.test", password="Phase1-Artist-Pass!9")
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))

    a = APIClient()
    a.force_authenticate(user=admin)
    m = APIClient()
    m.force_authenticate(user=artist)

    def make(path, body):
        return call(a, "POST", path, body)["body"]

    comp = make("/api/v1/departments/", {"code": "DEPT-TM-COMP", "name": "Membership Compositing", "department_type": "creative"})
    light = make("/api/v1/departments/", {"code": "DEPT-TM-LGT", "name": "Membership Lighting", "department_type": "creative"})
    team_a = make("/api/v1/teams/", {"code": "TEAM-COMP-A", "name": "Comp A", "department": comp["id"]})
    team_b = make("/api/v1/teams/", {"code": "TEAM-LGT-A", "name": "Lighting A", "department": light["id"]})
    ada = make("/api/v1/people/", {"name": "Ada Lovelace", "department": comp["id"]})
    grace = make("/api/v1/people/", {"name": "Grace Hopper"})

    flow = {}
    flow["add_ada_to_comp"] = call(a, "POST", "/api/v1/team-memberships/", {"team": team_a["id"], "person": ada["id"]})
    flow["add_ada_to_lighting"] = call(a, "POST", "/api/v1/team-memberships/", {"team": team_b["id"], "person": ada["id"]})
    flow["add_grace_to_comp"] = call(a, "POST", "/api/v1/team-memberships/", {"team": team_a["id"], "person": grace["id"]})
    flow["add_duplicate_400"] = call(a, "POST", "/api/v1/team-memberships/", {"team": team_a["id"], "person": ada["id"]})
    flow["add_missing_fields_400"] = call(a, "POST", "/api/v1/team-memberships/", {})
    flow["add_unknown_person_400"] = call(a, "POST", "/api/v1/team-memberships/", {"team": team_a["id"], "person": "00000000-0000-0000-0000-000000000000"})
    flow["add_as_artist_403"] = call(m, "POST", "/api/v1/team-memberships/", {"team": team_b["id"], "person": grace["id"]})
    flow["list_admin"] = call(a, "GET", "/api/v1/team-memberships/")
    flow["list_as_artist"] = call(m, "GET", "/api/v1/team-memberships/")
    flow["list_of_team"] = call(a, "GET", f"/api/v1/team-memberships/?team={team_a['id']}")
    flow["list_of_person"] = call(a, "GET", f"/api/v1/team-memberships/?person={ada['id']}")
    flow["list_search_ada"] = call(a, "GET", "/api/v1/team-memberships/?search=ada")
    first = flow["add_ada_to_comp"]["body"]
    flow["detail"] = call(a, "GET", f"/api/v1/team-memberships/{first['id']}/")
    flow["patch_405"] = call(a, "PATCH", f"/api/v1/team-memberships/{first['id']}/", {"person": grace["id"]})
    flow["delete_team_with_members_409"] = call(a, "DELETE", f"/api/v1/teams/{team_a['id']}/")
    flow["remove_as_artist_403"] = call(m, "DELETE", f"/api/v1/team-memberships/{first['id']}/")
    flow["remove_ok"] = call(a, "DELETE", f"/api/v1/team-memberships/{first['id']}/")
    flow["list_of_team_after_removal"] = call(a, "GET", f"/api/v1/team-memberships/?team={team_a['id']}")
    flow["add_again_ok"] = call(a, "POST", "/api/v1/team-memberships/", {"team": team_a["id"], "person": ada["id"]})
    flow["restore_refused_409"] = call(a, "POST", f"/api/v1/team-memberships/{first['id']}/restore/")
    # The primary team (Person.team) keeps a membership in step.
    flow["set_primary_team"] = call(a, "PATCH", f"/api/v1/people/{grace['id']}/", {"team": team_b["id"]})
    flow["list_of_grace"] = call(a, "GET", f"/api/v1/team-memberships/?person={grace['id']}")
    flow["people_filter_by_team_is_primary_only"] = call(a, "GET", f"/api/v1/people/?team={team_a['id']}")

    (OUT / "masterdata").mkdir(parents=True, exist_ok=True)
    (OUT / "masterdata" / "_team_memberships_flow.json").write_text(json.dumps(flow, indent=2, default=str) + "\n")
