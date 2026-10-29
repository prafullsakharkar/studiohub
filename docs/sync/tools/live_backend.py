"""
Hosts a REAL Django server for frontend end-to-end checks (docs/sync, Phase 1).

pytest-django's `live_server` runs the application on a random local port against the pytest
test database (a separate, throwaway database; this module asserts the name is test-prefixed).
`transaction=True` means pytest-django flushes that test database's tables when the run ends,
exactly as it does for any transactional test.

It seeds: a superuser, a user with the seeded `artist` role, and a user with TOTP MFA enrolled
(recovery codes included), writes the connection details to $SYNC_LIVE_INFO, then keeps serving
until $SYNC_LIVE_STOP exists (or 20 minutes pass).

    cd backend
    SYNC_LIVE_INFO=/path/live.json SYNC_LIVE_STOP=/path/stop \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q -s \
      ../docs/sync/tools/live_backend.py
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest

INFO = Path(os.environ["SYNC_LIVE_INFO"])
STOP = Path(os.environ["SYNC_LIVE_STOP"])
PASSWORDS = {"admin": "Live-Admin-Pass!9", "artist": "Live-Artist-Pass!9", "mfa": "Live-Mfa-Pass!9"}


@pytest.mark.django_db(transaction=True)
def test_serve(live_server, django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"

    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.models import Role, UserRole
    from apps.identity.tests.mfa_helpers import enable_mfa, pending_secret

    users = django_user_model.objects
    users.create_superuser(email="admin@example.test", password=PASSWORDS["admin"])
    artist = users.create_user(email="artist@example.test", password=PASSWORDS["artist"])
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))
    mfa = users.create_user(email="mfa@example.test", password=PASSWORDS["mfa"])
    mfa.is_active = True
    mfa.save()
    recovery_codes = enable_mfa(mfa)

    INFO.write_text(
        json.dumps(
            {
                "url": live_server.url,
                "users": {k: {"email": f"{k}@example.test", "password": v} for k, v in PASSWORDS.items()},
                "mfa": {"secret": pending_secret(mfa), "recovery_codes": list(recovery_codes)},
            },
            indent=1,
        )
    )
    print(f"LIVE_READY {live_server.url}", flush=True)

    deadline = time.time() + 20 * 60
    while time.time() < deadline and not STOP.exists():
        time.sleep(0.5)
