"""
The project dashboard for a lead artist whose membership covers the whole project, one department, one show,
or a vendor's side.

The dashboard sums up the whole project, so the backend admits only whole-project members
(``user_has_full_project_access``, TM-002): a department- or show-limited member, and a vendor or client
member, get 404 "Project not found.".
Captures each lead's ``/auth/me`` (its ``project_memberships`` carry ``show_id``, ``department``,
``department_id``) and the dashboard's answer. Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_partial_dashboard.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


@pytest.mark.django_db
def test_capture_partial_dashboard(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    with open(os.devnull, "w") as quiet:
        call_command("init_platform", stdout=quiet, stderr=quiet)

    from apps.identity.models import Role, UserRole
    from apps.production.models import ProjectMembership, Show
    from apps.production.tests.factories import ProjectFactory

    project = ProjectFactory.create(code="PDB")
    show = Show.objects.create(project=project, code="PDB_S1", name="Show 1")
    kinds = {
        "whole": {},
        "department": {"department": "Compositing"},
        "show": {"show": show},
        "vendor": {"vendor_id": "vendor-a"},
    }

    flow: dict[str, dict] = {"ids": {"project": str(project.pk), "show": str(show.pk)}}
    for name, extra in kinds.items():
        user = django_user_model.objects.create_user(
            email=f"lead-{name}@example.test", password="PartialDash-Pass!9"
        )
        UserRole.objects.create(user=user, role=Role.objects.get(code="lead-artist"))
        ProjectMembership.objects.create(
            user=user, project=project, status="active", role="Lead", **extra
        )
        client = APIClient()
        client.force_authenticate(user=user)
        for key, path in (
            (f"me_{name}", "/api/v1/auth/me/"),
            (f"dashboard_{name}", f"/api/v1/projects/{project.pk}/dashboard/"),
        ):
            resp = client.get(path)
            flow[key] = {
                "request": {"method": "GET", "path": path},
                "status": resp.status_code,
                "body": resp.json(),
            }

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_partial_dashboard_flow.json").write_text(
        json.dumps(flow, indent=2, default=str) + "\n"
    )
