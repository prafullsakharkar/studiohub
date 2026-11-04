"""
CR-39 evidence: an account that owes a password change AND MFA enrollment (the first sign-in of `manage.py bootstrap`'s superuser).

`restrictions.enforce` lets an endpoint through only when it settles EVERY debt the user has; the password endpoint settles one and the
MFA endpoints settle the other, so the account can reach neither. Real responses, pytest test database only, inside a rolled-back
transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_restricted_both.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
PASSWORD = "Cr39-Bootstrap-Pass!9"


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
def test_capture_restricted_both(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.models import Profile

    flow: dict = {}
    # The superuser bootstrap makes: a superuser (MFA is required of them) who must change their password at the first login.
    boot = django_user_model.objects.create_superuser(email="bootstrap@example.test", password=PASSWORD)
    Profile.objects.update_or_create(user=boot, defaults={"must_change_password": True})
    # For comparison: an ordinary user who owes ONLY the password, and a superuser who owes ONLY MFA.
    only_pw = django_user_model.objects.create_user(email="onlypw@example.test", password=PASSWORD)
    only_pw.is_active = True
    only_pw.save()
    Profile.objects.update_or_create(user=only_pw, defaults={"must_change_password": True})
    django_user_model.objects.create_superuser(email="onlymfa@example.test", password=PASSWORD)

    def sign_in(email):
        client = APIClient()
        login = client.post("/api/v1/auth/login/", {"email": email, "password": PASSWORD}, format="json")
        assert login.status_code == 200, login.content
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['tokens']['access']}")
        return client, login

    for label, email in (("both", "bootstrap@example.test"), ("password_only", "onlypw@example.test"), ("mfa_only", "onlymfa@example.test")):
        client, login = sign_in(email)
        flow[f"{label}_login"] = {"status": login.status_code, "flags": {k: v for k, v in login.json().items() if k != "tokens" and not isinstance(v, (dict, list))}, "user_must_change_password": login.json().get("user", {}).get("must_change_password")}
        flow[f"{label}_me"] = call(client, "GET", "/api/v1/auth/me/")
        flow[f"{label}_change_password"] = call(client, "POST", "/api/v1/auth/change-password/", {"old_password": PASSWORD, "new_password": "Cr39-New-Pass!42", "confirm_password": "Cr39-New-Pass!42"})
        flow[f"{label}_mfa_totp_setup"] = call(client, "POST", "/api/v1/identity/mfa/totp/setup/", {})

    (OUT / "identity").mkdir(parents=True, exist_ok=True)
    (OUT / "identity" / "_restricted_both_flow.json").write_text(json.dumps(flow, indent=1, sort_keys=True, default=str))
