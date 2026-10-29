"""
Phase 1 sample capture: restricted sessions (docs/sync).

A user who owes a password change or MFA enrollment can reach only `me`, `logout` and the
endpoints that settle the debt; everything else is `403 {detail, code}`
(apps/identity/authentication/restrictions.py). Captured through the REAL auth chain (JWT login,
Bearer header), not `force_authenticate`, which skips the check.

Pytest test database only, rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_restricted_flow.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
SECRET_KEYS = re.compile(r"(^|_)(access|refresh|token|secret|key|challenge|passcode|password|uri|digest|hash|recovery_codes?)$", re.I)
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def redact(v, key=""):
    if isinstance(v, dict):
        return {k: redact(x, k) for k, x in v.items()}
    if isinstance(v, list):
        return [redact(x, key) for x in v]  # secrets never contain spaces; validation messages always do
    if isinstance(v, str):
        if key and SECRET_KEYS.search(key) and len(v) > 8 and " " not in v:
            return "<redacted>"
        v = EMAIL.sub("user@example.test", v)
        return v if len(v) <= 120 else v[:120] + "…<truncated>"
    return v


def call(client, method, path, data=None):
    resp = getattr(client, method.lower())(path, data=data, format="json") if data is not None else getattr(client, method.lower())(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)}
    req_body = {k: ("<redacted>" if SECRET_KEYS.search(k) or k in ("code",) else v) for k, v in data.items()} if isinstance(data, dict) else data
    return {"request": {"method": method, "path": path, "body": req_body}, "status": resp.status_code, "headers": headers, "body": redact(body)}


def signed_in(email, password):
    client = APIClient()
    login = client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")
    assert login.status_code == 200, login.content
    body = login.json()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['tokens']['access']}")
    return client, login, body


@pytest.mark.django_db
def test_capture_restricted_flow(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.authentication.totp import TOTPService
    from apps.identity.models import Profile, UserMFA

    flow = {}

    # --- MFA enrollment owed (policy requires MFA of a superuser) ---
    root = django_user_model.objects.create_superuser(email="root@example.test", password="Restricted-Pass-9!")
    client, login, body = signed_in("root@example.test", "Restricted-Pass-9!")
    flow["login_mfa_enrollment_required"] = {"status": login.status_code, "keys": sorted(body), "mfa_enrollment_required": body.get("mfa_enrollment_required"), "is_superuser": body["user"]["is_superuser"]}
    flow["restricted_list_departments"] = call(client, "GET", "/api/v1/departments/")
    flow["restricted_create_department"] = call(client, "POST", "/api/v1/departments/", {"code": "R-1", "name": "R1", "department_type": "creative"})
    flow["restricted_me"] = call(client, "GET", "/api/v1/auth/me/")
    flow["restricted_mfa_config"] = call(client, "GET", "/api/v1/identity/mfa/config/")
    flow["totp_setup"] = call(client, "POST", "/api/v1/identity/mfa/totp/setup/")
    flow["totp_enable_wrong_code"] = call(client, "POST", "/api/v1/identity/mfa/totp/enable/", {"code": "000000"})
    flow["totp_enable_missing_code"] = call(client, "POST", "/api/v1/identity/mfa/totp/enable/", {})
    secret = UserMFA.objects.get(user=root).totp_secret
    flow["totp_enable_ok"] = call(client, "POST", "/api/v1/identity/mfa/totp/enable/", {"code": TOTPService.current_code(secret)})
    flow["after_enrollment_list_departments"] = call(client, "GET", "/api/v1/departments/")
    flow["after_enrollment_mfa_config"] = call(client, "GET", "/api/v1/identity/mfa/config/")

    # --- password change owed ---
    pw = django_user_model.objects.create_user(email="reset@example.test", password="Temp-Pass-123!")
    pw.is_active = True
    pw.save()
    Profile.objects.update_or_create(user=pw, defaults={"must_change_password": True})
    client2, login2, body2 = signed_in("reset@example.test", "Temp-Pass-123!")
    flow["login_must_change_password"] = {"status": login2.status_code, "must_change_password": body2["user"]["must_change_password"], "keys": sorted(body2)}
    flow["password_restricted_list_departments"] = call(client2, "GET", "/api/v1/departments/")
    flow["password_restricted_me"] = call(client2, "GET", "/api/v1/auth/me/")
    flow["change_password_wrong_old"] = call(client2, "POST", "/api/v1/auth/change-password/", {"old_password": "nope-nope-1", "new_password": "Brand-New-Pass-9!", "confirm_password": "Brand-New-Pass-9!"})
    flow["change_password_missing_fields"] = call(client2, "POST", "/api/v1/auth/change-password/", {})
    flow["change_password_weak"] = call(client2, "POST", "/api/v1/auth/change-password/", {"old_password": "Temp-Pass-123!", "new_password": "123", "confirm_password": "123"})
    flow["change_password_ok"] = call(client2, "POST", "/api/v1/auth/change-password/", {"old_password": "Temp-Pass-123!", "new_password": "Brand-New-Pass-9!", "confirm_password": "Brand-New-Pass-9!"})
    flow["after_change_old_token_list_departments"] = call(client2, "GET", "/api/v1/departments/")
    client3, login3, body3 = signed_in("reset@example.test", "Brand-New-Pass-9!")
    flow["relogin_after_change"] = {"status": login3.status_code, "must_change_password": body3["user"]["must_change_password"]}
    flow["after_change_relogin_list_departments"] = call(client3, "GET", "/api/v1/departments/")

    # --- confirm_password is not compared by change-password (reset-password does compare) ---
    mm = django_user_model.objects.create_user(email="mismatch@example.test", password="Temp-Pass-123!")
    mm.is_active = True
    mm.save()
    client4, _login4, _body4 = signed_in("mismatch@example.test", "Temp-Pass-123!")
    flow["change_password_confirm_mismatch"] = call(client4, "POST", "/api/v1/auth/change-password/", {"old_password": "Temp-Pass-123!", "new_password": "Brand-New-Pass-9!", "confirm_password": "something-else"})

    (OUT / "identity").mkdir(parents=True, exist_ok=True)
    (OUT / "identity" / "_restricted_sessions_flow.json").write_text(json.dumps(flow, indent=2, default=str) + "\n")
