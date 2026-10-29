"""
Hosts a REAL Django server for frontend end-to-end checks (docs/sync, Phase 1).

pytest-django's `live_server` runs the application on a random local port against the pytest
test database (a separate, throwaway database; this module asserts the name is test-prefixed).
`transaction=True` means pytest-django flushes that test database's tables when the run ends,
exactly as it does for any transactional test.

It seeds (each exercises a different backend rule):
  admin    superuser, MFA not enrolled  -> restricted session (only me/logout/MFA setup work)
  enroll   superuser, MFA not enrolled  -> used up by the enrollment end-to-end test
  manager  superuser, MFA enrolled      -> signs in with a TOTP code and uses the app
  artist   seeded `artist` role         -> ordinary user
  mfa      ordinary user, MFA enrolled  -> MFA login (TOTP + recovery codes)
  pwdue    ordinary user owing a password change
  delegate ordinary user holding `live-delegate` and `live-viewer` (Phase 2: RBAC admin without being a superuser)
  selfmfa  ordinary user without MFA (Phase 2: voluntary enrollment from My account)
  lead     holds the seeded `lead-artist` role, no MFA (Phase 6: approves time and shots)
  supervisor holds the seeded `vfx-supervisor` role, no MFA (Phase 7: decides reviews)
  audit    a queued and a failed background job and an open error log (Phase 4)
  roles    `live-escalation` (grants project.delete, held by nobody), `live-viewer` (grants shot.view) and `live-delegate` (grants identity.role.update/view + identity.user.view)
Writes the connection details to $SYNC_LIVE_INFO, then keeps serving
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
PASSWORDS = {
    "admin": "Live-Admin-Pass!9",
    "enroll": "Live-Enroll-Pass!9",
    "manager": "Live-Manager-Pass!9",
    "artist": "Live-Artist-Pass!9",
    "mfa": "Live-Mfa-Pass!9",
    "pwdue": "Live-Pwdue-Pass!9",
    "delegate": "Live-Delegate-Pass!9",
    "selfmfa": "Live-Selfmfa-Pass!9",
    "lead": "Live-Lead-Pass!9",
    "supervisor": "Live-Supervisor-Pass!9",
}


@pytest.mark.django_db(transaction=True)
def test_serve(live_server, django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"

    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.models import Role, UserRole
    from apps.identity.tests.mfa_helpers import enable_mfa, pending_secret

    from apps.identity.models import Profile

    users = django_user_model.objects
    users.create_superuser(email="admin@example.test", password=PASSWORDS["admin"])
    users.create_superuser(email="enroll@example.test", password=PASSWORDS["enroll"])
    manager = users.create_superuser(email="manager@example.test", password=PASSWORDS["manager"])
    enable_mfa(manager)
    artist = users.create_user(email="artist@example.test", password=PASSWORDS["artist"])
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))
    mfa = users.create_user(email="mfa@example.test", password=PASSWORDS["mfa"])
    mfa.is_active = True
    mfa.save()
    recovery_codes = enable_mfa(mfa)
    pwdue = users.create_user(email="pwdue@example.test", password=PASSWORDS["pwdue"])
    pwdue.is_active = True
    pwdue.save()
    Profile.objects.update_or_create(user=pwdue, defaults={"must_change_password": True})

    from apps.identity.models import Permission, RolePermission

    def make_role(code: str, name: str, permission_codes: list[str]) -> Role:
        role = Role.objects.create(name=name, code=code, scope="organization", priority=40)
        for permission_code in permission_codes:
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=permission_code), granted=True)
        return role

    make_role("live-viewer", "Live Viewer", ["shot.view"])
    make_role("live-escalation", "Live Escalation", ["project.delete"])
    delegate_role = make_role("live-delegate", "Live Delegate", ["identity.role.update", "identity.role.view", "identity.user.view"])
    delegate = users.create_user(email="delegate@example.test", password=PASSWORDS["delegate"])
    delegate.is_active = True
    delegate.save()
    UserRole.objects.create(user=delegate, role=delegate_role)
    UserRole.objects.create(user=delegate, role=Role.objects.get(code="live-viewer"))
    selfmfa = users.create_user(email="selfmfa@example.test", password=PASSWORDS["selfmfa"])
    selfmfa.is_active = True
    selfmfa.save()
    lead = users.create_user(email="lead@example.test", password=PASSWORDS["lead"])
    lead.is_active = True
    lead.save()
    UserRole.objects.create(user=lead, role=Role.objects.get(code="lead-artist"))
    supervisor = users.create_user(email="supervisor@example.test", password=PASSWORDS["supervisor"])
    supervisor.is_active = True
    supervisor.save()
    UserRole.objects.create(user=supervisor, role=Role.objects.get(code="vfx-supervisor"))

    from apps.audit.models import BackgroundJob, ErrorLog

    BackgroundJob.objects.create(job_type="report", status=BackgroundJob.STATUS_QUEUED, job_id="live-job-queued")
    BackgroundJob.objects.create(job_type="report", status=BackgroundJob.STATUS_FAILED, job_id="live-job-failed")
    ErrorLog.objects.create(error_type="server", severity=ErrorLog.SEVERITY_ERROR, message="Live open error", user=manager)

    INFO.write_text(
        json.dumps(
            {
                "url": live_server.url,
                "users": {k: {"email": f"{k}@example.test", "password": v} for k, v in PASSWORDS.items()},
                "mfa": {"secret": pending_secret(mfa), "recovery_codes": list(recovery_codes)},
                "manager": {"secret": pending_secret(manager)},
            },
            indent=1,
        )
    )
    print(f"LIVE_READY {live_server.url}", flush=True)

    deadline = time.time() + 20 * 60
    while time.time() < deadline and not STOP.exists():
        time.sleep(0.5)
