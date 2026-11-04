"""
CR-40 evidence: the directory (LDAP) settings API, a directory sign-in, and the per-user MFA switch.

Real responses from the backend on the pytest test database, inside a rolled-back transaction. Only the
directory itself is ldap3's in-memory mock (the same fake the backend tests use); the search, the bind and
every API layer are the real code. Passwords and tokens are redacted.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_directory.py
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
    if isinstance(body, dict) and "tokens" in body:
        body = {**body, "tokens": "<redacted>"}
    shown = {k: ("<redacted>" if "password" in k else v) for k, v in data.items()} if isinstance(data, dict) else data
    return {"request": {"method": method, "path": path, "body": shown}, "status": resp.status_code, "body": body}


@pytest.mark.django_db
def test_capture_directory(monkeypatch, settings):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.directory_helpers import (
        DIRECTORY,
        PASSWORD,
        SERVICE_DN,
        SERVICE_PASSWORD,
        TEST_CONNECTION,
        TEST_USER,
        FakeDirectory,
        as_user,
        give_role,
    )
    from apps.identity.tests.factories import UserFactory

    fake = FakeDirectory()
    fake.install(monkeypatch)
    fake.add("jdoe", given="Jane", sn="Doe", display="Jane Doe")
    fake.add("nomail", no_mail=True)

    admin_user = UserFactory.create(email="platform.admin@example.test", is_staff=True)
    give_role(admin_user, "platform-admin")
    admin = as_user(admin_user)
    artist_user = UserFactory.create(email="artist@example.test")
    give_role(artist_user, "artist")
    artist = as_user(artist_user)
    org_admin_user = UserFactory.create(email="org.admin@example.test")
    give_role(org_admin_user, "org-admin")
    org_admin = as_user(org_admin_user)

    connection_fields = {
        "server_uri": "ldaps://ldap.example.test",
        "bind_dn": SERVICE_DN,
        "bind_password": SERVICE_PASSWORD,
        "user_search_base": "ou=people,dc=studio,dc=test",
    }

    flow: dict = {}
    flow["get_initial"] = call(admin, "GET", DIRECTORY)
    flow["get_artist"] = call(artist, "GET", DIRECTORY)
    flow["get_org_admin"] = call(org_admin, "GET", DIRECTORY)
    flow["patch_plain_ldap"] = call(admin, "PATCH", DIRECTORY, {**connection_fields, "server_uri": "ldap://ldap.example.test"})
    flow["patch_connection"] = call(admin, "PATCH", DIRECTORY, connection_fields)
    flow["patch_enable_untested"] = call(admin, "PATCH", DIRECTORY, {"enabled": True})
    flow["patch_bad_filter"] = call(admin, "PATCH", DIRECTORY, {"user_filter": "(uid=*)"})
    flow["patch_bad_role"] = call(admin, "PATCH", DIRECTORY, {"default_role_code": "nope"})
    fake.down = True
    flow["test_connection_down"] = call(admin, "POST", TEST_CONNECTION, {})
    fake.down = False
    flow["test_connection_ok"] = call(admin, "POST", TEST_CONNECTION, {})
    flow["patch_enable"] = call(admin, "PATCH", DIRECTORY, {"enabled": True})
    flow["test_user_found"] = call(admin, "POST", TEST_USER, {"username": "jdoe"})
    flow["test_user_no_mail"] = call(admin, "POST", TEST_USER, {"username": "nomail"})
    flow["test_user_missing"] = call(admin, "POST", TEST_USER, {"username": "ghost"})
    flow["test_user_blank"] = call(admin, "POST", TEST_USER, {"username": ""})

    # A directory sign-in (the first one makes the account), then what the account sees.
    anon = APIClient()
    login = anon.post("/api/v1/auth/login/", {"email": "jdoe", "password": PASSWORD}, format="json")
    flow["login_directory_user"] = {"status": login.status_code, "body": {**login.json(), "tokens": "<redacted>"}}
    flow["login_directory_wrong_password"] = call(APIClient(), "POST", "/api/v1/auth/login/", {"email": "jdoe", "password": "wrong"})
    flow["login_blank_identifier"] = call(APIClient(), "POST", "/api/v1/auth/login/", {"email": "", "password": "x"})
    flow["login_bad_email"] = call(APIClient(), "POST", "/api/v1/auth/login/", {"email": "a@b", "password": "x"})
    me = APIClient()
    me.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['tokens']['access']}")
    flow["me_directory_user"] = call(me, "GET", "/api/v1/auth/me/")
    flow["change_password_directory_user"] = call(
        me, "POST", "/api/v1/auth/change-password/", {"old_password": PASSWORD, "new_password": "Another-Pass-42!", "confirm_password": "Another-Pass-42!"}
    )

    from apps.identity.models import User

    jdoe = User.objects.get(email="jdoe@studio.test")
    flow["user_detail_directory_user"] = call(admin, "GET", f"/api/v1/identity/users/{jdoe.pk}/")
    flow["user_detail_local_user"] = call(admin, "GET", f"/api/v1/identity/users/{artist_user.pk}/")
    flow["users_list"] = call(admin, "GET", "/api/v1/identity/users/")
    flow["require_mfa_on"] = call(admin, "POST", f"/api/v1/identity/users/{jdoe.pk}/require-mfa/", {"required": True})
    flow["me_after_require_mfa"] = call(me, "GET", "/api/v1/projects/")
    flow["require_mfa_off"] = call(admin, "POST", f"/api/v1/identity/users/{jdoe.pk}/require-mfa/", {"required": False})
    flow["require_mfa_bad_value"] = call(admin, "POST", f"/api/v1/identity/users/{jdoe.pk}/require-mfa/", {"required": "yes"})
    flow["require_mfa_artist"] = call(artist, "POST", f"/api/v1/identity/users/{jdoe.pk}/require-mfa/", {"required": True})
    flow["require_mfa_org_admin_not_staff"] = call(org_admin, "POST", f"/api/v1/identity/users/{jdoe.pk}/require-mfa/", {"required": True})
    flow["reset_password_directory_user"] = call(admin, "POST", f"/api/v1/identity/users/{jdoe.pk}/reset-password/", {})

    settings.DIRECTORY_ENCRYPTION_KEYS = ()
    flow["patch_password_without_key"] = call(admin, "PATCH", DIRECTORY, {"bind_password": "new-secret"})
    flow["get_without_key"] = call(admin, "GET", DIRECTORY)

    (OUT / "identity").mkdir(parents=True, exist_ok=True)
    (OUT / "identity" / "_directory_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
