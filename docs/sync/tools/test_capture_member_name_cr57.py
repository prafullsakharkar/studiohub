"""
CR-57 evidence (real responses): a project member's `name` is their name, and the people list narrows to people with a login.

Four members: one whose profile has a display name, one with only a first and last name, one with a blank profile whose
linked directory person has the name (what the ATOM import and the LDAP link leave), and one with neither (the e-mail).
`people_has_user` / `people_without_user` are `GET /people/?has_user=true|false`; `person_*` are the people the members
panel picks. E-mail addresses are redacted to user@example.test, names are kept.
Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_member_name_cr57.py
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
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID") if resp.get(h)}
    return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "headers": headers, "body": clean(body)}


@pytest.mark.django_db
def test_capture_member_name_cr57(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models.profile import Profile
    from apps.masterdata.models import Person, Position

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="Cr57-Admin-Pass!9")
    a = APIClient()
    a.force_authenticate(user=admin)

    def user(email, **profile):
        u = django_user_model.objects.create_user(email=email, password="Cr57-Member-Pass!9")
        if profile:
            Profile.objects.update_or_create(user=u, defaults=profile)
        return u

    display = user("display@example.test", display_name="Dee Display", first_name="Dee", last_name="D")
    first_last = user("firstlast@example.test", display_name="", first_name="Fay", last_name="Last")
    linked = user("linked@example.test", display_name="", first_name="", last_name="")
    bare = user("bare@example.test")
    lead = Position.objects.filter(code__iexact="POS-LEAD").first() or Position.objects.create(code="POS-LEAD", name="Lead Artist")
    Person.objects.create(name="Priya Person", user=linked, role=lead)
    unlinked = Person.objects.create(name="Omar Offline")

    project = a.post("/api/v1/projects/", {"code": "CR57", "name": "Member names", "workflow_type": "standard", "type": "Feature Film"}, format="json")
    assert project.status_code == 201, project.content[:300]
    pid = project.json()["id"]
    base = f"/api/organizations/projects/{pid}/members/"
    flow: dict = {"ids": {"project": pid}}

    for u in (display, first_last, bare):
        assert a.post(base, {"user_id": str(u.pk), "role": "Artist"}, format="json").status_code == 201
    flow["add_linked"] = call(a, "POST", base, {"user_id": str(linked.pk), "role": "Lead Artist"})
    flow["members_list"] = call(a, "GET", base)
    flow["patch_linked"] = call(a, "PATCH", f"{base}{flow['add_linked']['body']['id']}/", {"role": "Artist"})

    flow["people_has_user"] = call(a, "GET", "/api/v1/people/?has_user=true")
    flow["people_without_user"] = call(a, "GET", "/api/v1/people/?has_user=false")
    flow["person_linked"] = call(a, "GET", f"/api/v1/people/{Person.objects.get(user=linked).pk}/")
    flow["person_unlinked"] = call(a, "GET", f"/api/v1/people/{unlinked.pk}/")
    flow["positions"] = call(a, "GET", "/api/v1/positions/?ordering=name")

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_member_name_cr57_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
