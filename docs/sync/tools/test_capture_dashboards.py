"""
Phase 12 sample capture: the project dashboard, statistics, summary and the analytics aggregates (docs/sync).

A project is seeded with shots in several statuses, tasks (open, in progress, blocked, in review, done, overdue,
critical, assigned and not), assets, reviews, deliveries and milestones, then read by an MFA superuser, a member, a
member of nothing, an external (client) member and a user with no role. Every call is recorded whatever its status.
Pytest test database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_dashboards.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_capture_identity_admin import FLOW, call, redact, sign_in_plain, sign_in_with_mfa  # noqa: E402

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


def _user(U, email, password, role_code=None):
    from apps.identity.models import Role, UserRole

    user = U.create_user(email=email, password=password)
    user.is_active = True
    user.save()
    if role_code:
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
    return user


@pytest.mark.django_db
def test_capture_dashboards(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.mfa_helpers import enable_mfa
    from apps.production.models import Project
    from apps.production.tests.factories import AssetFactory, ReviewFactory, SequenceFactory, ShotFactory, TaskFactory

    FLOW.clear()
    U = django_user_model.objects
    admin = U.create_superuser(email="root@example.test", password="Admin-Pass-Phase12!1")
    enable_mfa(admin)
    sup = _user(U, "sup@example.test", "Sup-Pass-Phase12!1", "vfx-supervisor")
    artist = _user(U, "artist@example.test", "Artist-Pass-Phase12!1", "artist")
    _user(U, "stranger@example.test", "Stranger-Pass-Phase12!1", "artist")
    _user(U, "norole@example.test", "Norole-Pass-Phase12!1")

    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-Phase12!1", admin)
    sv, _ = sign_in_plain("sup@example.test", "Sup-Pass-Phase12!1")
    ar, _ = sign_in_plain("artist@example.test", "Artist-Pass-Phase12!1")
    sg, _ = sign_in_plain("stranger@example.test", "Stranger-Pass-Phase12!1")
    nr, _ = sign_in_plain("norole@example.test", "Norole-Pass-Phase12!1")

    # ------------------------------------------------------------ an empty project first
    empty = call(a, "setup_project_empty", "POST", "/api/v1/projects/", {"code": "EMP", "name": "Empty", "workflow_type": "standard"}).json()["id"]
    call(a, "dashboard_empty", "GET", f"/api/v1/projects/{empty}/dashboard/")
    call(a, "statistics_empty", "GET", f"/api/v1/projects/{empty}/statistics/")
    call(a, "summary_empty", "GET", f"/api/organizations/projects/{empty}/summary")
    call(a, "analytics_kpis_empty", "GET", "/api/v1/analytics/kpis/")
    call(a, "analytics_departments_empty", "GET", "/api/v1/analytics/departments/")

    # ------------------------------------------------------------ the seeded project
    pid = call(a, "setup_project", "POST", "/api/v1/projects/", {"code": "DSH", "name": "Dashboard show", "workflow_type": "standard", "start_date": str(date.today() - timedelta(days=60)), "delivery_date": str(date.today() + timedelta(days=45))}).json()["id"]
    for who, role in ((sup, "Supervisor"), (artist, "Artist")):
        call(a, f"setup_member_{who.email.split('@')[0]}", "POST", f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": role})
    project = Project.objects.get(pk=pid)
    seq = SequenceFactory.create(project=project, code="SQ010", name="Opening")
    today = date.today()
    for n, status in enumerate(["Approved", "Approved", "In Progress", "In Progress", "In Progress", "Pending Review", "On Hold", "Not Started", "Not Started", "Not Started"], start=1):
        ShotFactory.create(project=project, sequence=seq, code=f"SH{n:03d}", name=f"Shot {n}", status=status)
    for n, (status, priority, due, who, dept) in enumerate(
        [
            ("Not Started", "Medium", today + timedelta(days=5), None, "Compositing"),
            ("In Progress", "High", today - timedelta(days=3), artist, "Compositing"),
            ("In Progress", "Critical", today + timedelta(days=1), artist, "Lighting"),
            ("Blocked", "High", today + timedelta(days=9), sup, "Lighting"),
            ("Pending Review", "Medium", today + timedelta(days=2), artist, "Compositing"),
            ("Approved", "Low", today - timedelta(days=10), artist, "Compositing"),
            ("Approved", "Medium", today - timedelta(days=20), sup, "Lighting"),
            ("In Progress", "Medium", None, None, ""),
        ],
        start=1,
    ):
        TaskFactory.create(project=project, code=f"T{n:03d}", title=f"Task {n}", status=status, priority=priority, due_date=due, assignee=who, department=dept)
    for n, status in enumerate(["Approved", "In Progress", "Needs Revision", "Not Started"], start=1):
        AssetFactory.create(project=project, code=f"AS{n:03d}", name=f"Asset {n}", status=status)
    for n, status in enumerate(["Pending Review", "Approved", "Approved", "Changes Requested", "Rejected"], start=1):
        ReviewFactory.create(project=project, title=f"Review {n}", status=status)
    call(a, "setup_delivery_upcoming", "POST", "/api/v1/deliveries/", {"project_id": pid, "name": "Upcoming delivery", "expires_at": f"{today + timedelta(days=14)}T00:00:00Z"})
    call(a, "setup_delivery_late", "POST", "/api/v1/deliveries/", {"project_id": pid, "name": "Late delivery", "expires_at": f"{today - timedelta(days=5)}T00:00:00Z"})
    cancelled = call(a, "setup_delivery_cancelled", "POST", "/api/v1/deliveries/", {"project_id": pid, "name": "Cancelled delivery", "expires_at": f"{today - timedelta(days=2)}T00:00:00Z"}).json().get("id")
    call(a, "setup_delivery_cancel", "POST", f"/api/v1/deliveries/{cancelled}/cancel/", {"reason": "Not needed"})
    call(a, "setup_milestone_one", "POST", "/api/v1/scheduling/milestones/", {"project_id": pid, "name": "Turnover", "due_date": str(today + timedelta(days=10)), "order": 1})
    m2 = call(a, "setup_milestone_two", "POST", "/api/v1/scheduling/milestones/", {"project_id": pid, "name": "Previs lock", "due_date": str(today - timedelta(days=12)), "order": 0}).json().get("id")
    call(a, "setup_milestone_two_complete", "POST", f"/api/v1/scheduling/milestones/{m2}/complete/", {})
    call(a, "setup_task_activity", "POST", "/api/v1/tasks/", {"project": pid, "title": "Created through the API", "entity_type": "Shot", "entity_id": "SH001", "entity_code": "SH001"})

    # ------------------------------------------------------------ the project dashboard
    call(a, "dashboard", "GET", f"/api/v1/projects/{pid}/dashboard/")
    call(a, "dashboard_by_code", "GET", "/api/v1/projects/dsh/dashboard/")
    call(sv, "dashboard_supervisor", "GET", f"/api/v1/projects/{pid}/dashboard/")
    call(ar, "dashboard_artist", "GET", f"/api/v1/projects/{pid}/dashboard/")
    call(sg, "dashboard_stranger", "GET", f"/api/v1/projects/{pid}/dashboard/")
    call(nr, "dashboard_norole", "GET", f"/api/v1/projects/{pid}/dashboard/")
    call(a, "dashboard_unknown", "GET", "/api/v1/projects/00000000-0000-0000-0000-000000000000/dashboard/")
    call(a, "dashboard_fallback_route", "GET", f"/api/organizations/projects/{pid}/dashboard")
    call(ar, "dashboard_fallback_route_artist", "GET", f"/api/organizations/projects/{pid}/dashboard")
    call(sg, "dashboard_fallback_route_stranger", "GET", f"/api/organizations/projects/{pid}/dashboard")

    # ------------------------------------------------------------ statistics and summary
    call(a, "statistics", "GET", f"/api/v1/projects/{pid}/statistics/")
    call(ar, "statistics_artist", "GET", f"/api/v1/projects/{pid}/statistics/")
    call(sg, "statistics_stranger", "GET", f"/api/v1/projects/{pid}/statistics/")
    call(a, "summary", "GET", f"/api/organizations/projects/{pid}/summary")
    call(ar, "summary_artist", "GET", f"/api/organizations/projects/{pid}/summary")
    call(sg, "summary_stranger", "GET", f"/api/organizations/projects/{pid}/summary")
    for name in ("schedule", "resources", "activity", "pipeline", "members"):
        call(a, f"project_{name}", "GET", f"/api/organizations/projects/{pid}/{name}")

    # ------------------------------------------------------------ analytics
    call(a, "analytics_kpis", "GET", "/api/v1/analytics/kpis/")
    call(ar, "analytics_kpis_artist", "GET", "/api/v1/analytics/kpis/")
    call(sg, "analytics_kpis_stranger", "GET", "/api/v1/analytics/kpis/")
    call(nr, "analytics_kpis_norole", "GET", "/api/v1/analytics/kpis/")
    call(a, "analytics_departments", "GET", "/api/v1/analytics/departments/")
    call(ar, "analytics_departments_artist", "GET", "/api/v1/analytics/departments/")
    call(sg, "analytics_departments_stranger", "GET", "/api/v1/analytics/departments/")
    call(nr, "analytics_departments_norole", "GET", "/api/v1/analytics/departments/")
    call(a, "analytics_kpis_post", "POST", "/api/v1/analytics/kpis/", {})

    (OUT / "dashboards").mkdir(parents=True, exist_ok=True)
    (OUT / "dashboards" / "_flow.json").write_text(json.dumps(redact(FLOW), indent=1, sort_keys=True))
    assert FLOW["dashboard"]["status"] == 200, FLOW["dashboard"]
