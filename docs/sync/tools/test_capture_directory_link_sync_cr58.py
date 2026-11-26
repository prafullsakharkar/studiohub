"""
CR-58 evidence: linking an account to the directory and syncing the directory accounts, from the API.

Real responses from the backend on the pytest test database, inside a rolled-back transaction. Only the
directory is ldap3's in-memory mock (the fake the backend tests use); every API layer is the real code.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_directory_link_sync_cr58.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
LINK = "/api/v1/identity/directory/link/"
SYNC = "/api/v1/identity/directory/sync/"


def call(client, method, path, data=None):
    send = getattr(client, method.lower())
    resp = send(path, data=data, format="json") if data is not None else send(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "body": body}


@pytest.mark.django_db
def test_capture_directory_link_sync_cr58(monkeypatch):
    from django.core.cache import cache
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))
    cache.clear()

    from apps.identity.tests.directory_helpers import (
        FakeDirectory,
        as_user,
        configure,
        give_role,
        session,
    )
    from apps.identity.tests.factories import UserFactory

    fake = FakeDirectory()
    fake.install(monkeypatch)
    configure()

    admin_user = UserFactory.create(email="platform.admin@example.test")
    give_role(admin_user, "platform-admin")
    admin = as_user(admin_user)
    artist_user = UserFactory.create(email="artist@example.test")
    give_role(artist_user, "artist")
    artist = as_user(artist_user)
    UserFactory.create(email="jane@example.test")
    UserFactory.create(email="omar@example.test")

    fake.add("jdoe", mail="jane@example.test", given="Jane", sn="Doe")
    fake.add("twin")
    fake.add("twin", dn="uid=twin,ou=more,ou=people,dc=studio,dc=test", subject="uuid-twin-2")
    leaver_dn = fake.add("leaver", given="Lee", sn="Leaver")
    fake.add("stayer", given="Stan", sn="Stayer")
    session("leaver")
    session("stayer")

    flow: dict = {}
    flow["link_artist"] = call(artist, "POST", LINK, {"email": "jane@example.test", "username": "jdoe"})
    flow["link_check"] = call(admin, "POST", LINK, {"email": "jane@example.test", "username": "jdoe", "dry_run": True})
    flow["link_no_account"] = call(admin, "POST", LINK, {"email": "nobody@example.test", "username": "jdoe"})
    flow["link_no_entry"] = call(admin, "POST", LINK, {"email": "jane@example.test", "username": "ghost"})
    flow["link_two_entries"] = call(admin, "POST", LINK, {"email": "jane@example.test", "username": "twin"})
    flow["link_bad_email"] = call(admin, "POST", LINK, {"email": "jane", "username": ""})
    flow["link"] = call(admin, "POST", LINK, {"email": "jane@example.test", "username": "jdoe"})
    flow["link_again"] = call(admin, "POST", LINK, {"email": "jane@example.test", "username": "jdoe"})
    flow["link_entry_taken"] = call(admin, "POST", LINK, {"email": "omar@example.test", "username": "jdoe"})
    fake.down = True
    flow["link_outage"] = call(admin, "POST", LINK, {"email": "omar@example.test", "username": "stayer"})
    flow["sync_outage"] = call(admin, "POST", SYNC, {})
    fake.down = False

    fake.remove(leaver_dn)
    flow["sync_artist"] = call(artist, "POST", SYNC, {})
    flow["sync_preview"] = call(admin, "POST", SYNC, {"dry_run": True})
    flow["sync"] = call(admin, "POST", SYNC, {})
    flow["sync_after"] = call(admin, "POST", SYNC, {"dry_run": True})
    configure(enabled=False)
    flow["sync_sign_in_off"] = call(admin, "POST", SYNC, {})

    (OUT / "identity").mkdir(parents=True, exist_ok=True)
    (OUT / "identity" / "_directory_link_sync_cr58_flow.json").write_text(
        json.dumps(flow, indent=1, sort_keys=True, default=str)
    )
