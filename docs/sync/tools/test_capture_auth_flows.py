"""
Phase 1 sample capture: MFA login and password-reset flows (real responses).

Runs only against the pytest test database, inside a rolled-back transaction, like
test_capture_samples.py. The MFA enrolment goes through the backend's own test helper.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_auth_flows.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])

SECRET_KEYS = re.compile(
    r"(^|_)(access|refresh|token|secret|key|challenge|passcode|password|provisioning_uri|qr|digest|hash|code_hash|recovery_codes?)$",
    re.I,
)
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def redact(v, key=""):
    if isinstance(v, dict):
        return {k: redact(x, k) for k, x in v.items()}
    if isinstance(v, list):
        return [redact(x, key) for x in v]
    if isinstance(v, str):
        # Secrets (tokens, challenges, codes) never contain spaces; validation messages always do.
        if key and SECRET_KEYS.search(key) and key not in ("key_prefix", "token_prefix", "prefix") and len(v) > 8 and " " not in v:
            return "<redacted>"
        v = EMAIL.sub("user@example.test", v)
        return v if len(v) <= 160 else v[:160] + "…<truncated>"
    return v


REQUEST_SECRETS = ("code", "recovery_code", "challenge", "new_password", "confirm_password", "password", "token", "refresh")


def redact_request(data):
    return {k: ("<redacted>" if k in REQUEST_SECRETS and v else v) for k, v in data.items()} if isinstance(data, dict) else data


def call(client, method, path, data=None):
    resp = getattr(client, method.lower())(path, data=data, format="json")
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Retry-After", "Allow") if resp.get(h)}
    return {
        "request": {"method": method, "path": path, "body": redact_request(data)},
        "status": resp.status_code,
        "headers": headers,
        "sets_cookie": bool(resp.cookies),
        "body": redact(body),
    }


@pytest.mark.django_db
def test_capture_auth_flows(django_user_model):
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"

    from apps.identity.tests.mfa_helpers import enable_mfa, valid_code

    password = "Phase1-Mfa-Pass!9"
    user = django_user_model.objects.create_user(email="mfa@example.test", password=password)
    user.is_active = True
    user.save()
    recovery_codes = enable_mfa(user)

    def new_challenge(client):
        r = client.post("/api/v1/auth/login/", {"email": "mfa@example.test", "password": password}, format="json")
        return r.json()["challenge"]

    c = APIClient()
    flow = {}

    login = c.post("/api/v1/auth/login/", {"email": "mfa@example.test", "password": password}, format="json")
    flow["login_mfa_required"] = {
        "request": {"method": "POST", "path": "/api/v1/auth/login/", "body": {"email": "user@example.test", "password": "<redacted>"}},
        "status": login.status_code,
        "headers": {"X-Request-ID": login.get("X-Request-ID")},
        "body": redact(login.json()),
        "_note": "no tokens and no user payload until the challenge is completed",
    }

    ch = login.json()["challenge"]
    flow["challenge_ok"] = call(c, "POST", "/api/v1/auth/mfa/challenge/", {"challenge": ch, "code": valid_code(user)})
    flow["challenge_wrong_code"] = call(c, "POST", "/api/v1/auth/mfa/challenge/", {"challenge": new_challenge(c), "code": "000000"})
    flow["challenge_missing_code"] = call(c, "POST", "/api/v1/auth/mfa/challenge/", {"challenge": new_challenge(c)})
    flow["challenge_missing_challenge"] = call(c, "POST", "/api/v1/auth/mfa/challenge/", {"code": "123456"})
    flow["challenge_garbage_challenge"] = call(c, "POST", "/api/v1/auth/mfa/challenge/", {"challenge": "not-a-challenge", "code": "123456"})
    flow["challenge_recovery_ok"] = call(
        c, "POST", "/api/v1/auth/mfa/challenge/", {"challenge": new_challenge(c), "recovery_code": recovery_codes[0]}
    )
    flow["challenge_recovery_reused"] = call(
        c, "POST", "/api/v1/auth/mfa/challenge/", {"challenge": new_challenge(c), "recovery_code": recovery_codes[0]}
    )
    flow["challenge_remember_device"] = call(
        c, "POST", "/api/v1/auth/mfa/challenge/", {"challenge": new_challenge(c), "code": valid_code(user), "remember_device": True}
    )

    (OUT / "identity").mkdir(parents=True, exist_ok=True)
    (OUT / "identity" / "_auth_mfa_flow.json").write_text(json.dumps(flow, indent=2, default=str) + "\n")

    reset = {}
    anon = APIClient()
    reset["forgot_ok"] = call(anon, "POST", "/api/v1/auth/forgot-password/", {"email": "mfa@example.test"})
    reset["forgot_invalid_email"] = call(anon, "POST", "/api/v1/auth/forgot-password/", {"email": "not-an-email"})
    reset["reset_invalid_token"] = call(
        anon, "POST", "/api/v1/auth/reset-password/", {"token": "bogus", "new_password": "Phase1-New-Pass!9", "confirm_password": "Phase1-New-Pass!9"}
    )
    reset["reset_mismatch"] = call(
        anon, "POST", "/api/v1/auth/reset-password/", {"token": "bogus", "new_password": "Phase1-New-Pass!9", "confirm_password": "different"}
    )
    reset["reset_missing_fields"] = call(anon, "POST", "/api/v1/auth/reset-password/", {})
    (OUT / "identity" / "_auth_password_reset_flow.json").write_text(json.dumps(reset, indent=2, default=str) + "\n")
