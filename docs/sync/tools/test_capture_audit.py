"""
Phase 4 sample capture: audit & activity (docs/sync).

Edits real records through the API as an MFA-enrolled superuser (real JWT flow) and records what the
audit routes then say: change logs for a department, the AuditLog compat list searched by target id,
filters, the compat activity feed, background-job and error-log actions, and a non-privileged caller.

Pytest test database only, rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_audit.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_capture_identity_admin import FLOW, call, redact, sign_in_plain, sign_in_with_mfa  # noqa: E402

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


@pytest.mark.django_db
def test_capture_audit(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.audit.models import BackgroundJob, ErrorLog
    from apps.identity.models import Role, UserRole
    from apps.identity.tests.mfa_helpers import enable_mfa

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase4!9")
    enable_mfa(admin)
    artist = U.create_user(email="artist@example.test", password="Artist-Pass-Phase4!9")
    UserRole.objects.create(user=artist, role=Role.objects.get(code="artist"))

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase4!9", admin)

    # -------------------------------------------------- make some history through the API
    dept = call(a, "dept_create", "POST", "/api/v1/departments/", {"code": "XLD", "name": "Look Dev Unit", "department_type": "creative"}).json()
    did = dept["id"]
    call(a, "dept_patch_1", "PATCH", f"/api/v1/departments/{did}/", {"name": "Look Dev Unit Renamed", "description": "Look development"})
    call(a, "dept_patch_2", "PATCH", f"/api/v1/departments/{did}/", {"color": "#ff8800"})
    team = call(a, "team_create", "POST", "/api/v1/teams/", {"code": "XLD-A", "name": "Look Dev A", "department": did}).json()
    call(a, "team_patch", "PATCH", f"/api/v1/teams/{team['id']}/", {"capacity": 5})
    call(a, "client_create", "POST", "/api/v1/clients/", {"name": "Acme", "code": "ACME"})

    # -------------------------------------------------- change logs
    call(a, "changelogs_for_dept", "GET", f"/api/v1/audit/change-logs/?target_id={did}")
    call(a, "changelogs_for_dept_ordered_asc", "GET", f"/api/v1/audit/change-logs/?target_id={did}&ordering=created_at")
    call(a, "changelogs_all", "GET", "/api/v1/audit/change-logs/?page_size=50")
    rows = a.get(f"/api/v1/audit/change-logs/?target_id={did}").json()["results"]
    if rows:
        call(a, "changelog_detail", "GET", f"/api/v1/audit/change-logs/{rows[0]['id']}/")
        tt = rows[0]["target_type"]
        call(a, "changelogs_by_type", "GET", f"/api/v1/audit/change-logs/?target_type={tt}&change_type=update")
    call(a, "changelogs_by_date", "GET", "/api/v1/audit/change-logs/?created_at__gte=2020-01-01&created_at__lte=2100-01-01&page_size=2")
    call(a, "changelogs_by_user", "GET", f"/api/v1/audit/change-logs/?user={admin.id}&page_size=2")
    call(a, "changelogs_search", "GET", "/api/v1/audit/change-logs/?search=Look")
    call(a, "changelogs_unknown_ordering", "GET", "/api/v1/audit/change-logs/?ordering=nope&page_size=2")

    # -------------------------------------------------- audit log (compat + native)
    call(a, "audit_compat_search_dept", "GET", f"/api/v1/audit/?search={did}")
    call(a, "audit_compat_all", "GET", "/api/v1/audit/?page_size=5")
    call(a, "audit_logs_native", "GET", "/api/v1/audit/audit-logs/")
    call(a, "audit_logs_filtered", "GET", f"/api/v1/audit/audit-logs/?target_type=department&severity=info")

    # -------------------------------------------------- activity feed
    call(a, "activity_compat", "GET", "/api/v1/audit/activity/?page_size=5")
    call(a, "activity_top", "GET", "/api/v1/activity/?page_size=5")
    call(a, "activities_native", "GET", "/api/v1/audit/activities/")
    call(a, "activities_filtered", "GET", "/api/v1/audit/activities/?status=failed")

    # -------------------------------------------------- api requests, tracks
    call(a, "api_requests", "GET", "/api/v1/audit/api-requests/?page_size=3")
    call(a, "api_requests_filtered", "GET", "/api/v1/audit/api-requests/?method=PATCH&status_code=200&page_size=3")
    call(a, "tracks", "GET", "/api/v1/audit/tracks/?page_size=3")

    # -------------------------------------------------- jobs and errors with actions
    queued = BackgroundJob.objects.create(job_type="report", status=BackgroundJob.STATUS_QUEUED, job_id="job-queued")
    failed = BackgroundJob.objects.create(job_type="report", status=BackgroundJob.STATUS_FAILED, job_id="job-failed")
    call(a, "jobs_list", "GET", "/api/v1/audit/background-jobs/?page_size=5")
    call(a, "jobs_filtered", "GET", "/api/v1/audit/background-jobs/?status=failed")
    call(a, "job_cancel", "POST", f"/api/v1/audit/background-jobs/{queued.id}/cancel/", {})
    call(a, "job_cancel_again", "POST", f"/api/v1/audit/background-jobs/{queued.id}/cancel/", {})
    call(a, "job_retry", "POST", f"/api/v1/audit/background-jobs/{failed.id}/retry/", {})
    call(a, "job_retry_not_failed", "POST", f"/api/v1/audit/background-jobs/{queued.id}/retry/", {})
    err = ErrorLog.objects.create(error_type="server", severity=ErrorLog.SEVERITY_ERROR, message="Boom", user=admin)
    call(a, "errors_list", "GET", "/api/v1/audit/error-logs/?page_size=5")
    call(a, "errors_filtered", "GET", "/api/v1/audit/error-logs/?severity=error")
    call(a, "error_resolve", "POST", f"/api/v1/audit/error-logs/{err.id}/resolve/", {})
    call(a, "error_detail_after", "GET", f"/api/v1/audit/error-logs/{err.id}/")

    # -------------------------------------------------- non-privileged caller
    b, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase4!9")
    call(b, "artist_changelogs", "GET", f"/api/v1/audit/change-logs/?target_id={did}")
    call(b, "artist_audit", "GET", "/api/v1/audit/?page_size=2")
    call(b, "artist_job_cancel", "POST", f"/api/v1/audit/background-jobs/{failed.id}/cancel/", {})

    (OUT / "audit").mkdir(parents=True, exist_ok=True)
    (OUT / "audit" / "_audit_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
