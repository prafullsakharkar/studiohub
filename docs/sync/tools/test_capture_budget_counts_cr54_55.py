"""
CR-54 / CR-55 evidence: the project's delivery count and its budget, as each seeded role reads them.

After CR-53 an artist holds no ``delivery.view`` and the dashboard's delivery figures are empty for them, but the
project's ``statistics`` and ``summary`` routes still count the deliveries. ``budget_usd`` is a field of the project
record: every internal member reads it on the project list, the detail, the summary and the dashboard. Pytest test
database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_budget_counts_cr54_55.py

The committed sample holds the responses from before the change (the CRs' evidence); to capture
after it without overwriting that, point ``SYNC_SAMPLES_OUT`` elsewhere (``SYNC_SAMPLE_NAME`` renames
the file). The supervisor's two PATCH entries were added with the change.
"""

from __future__ import annotations

import json
import os
from decimal import Decimal
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])


def call(client, name, path, flow):
    resp = client.get(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    flow[name] = {"request": {"method": "GET", "path": path}, "status": resp.status_code, "body": body}


@pytest.mark.django_db
def test_capture_budget_counts_cr54_55(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    with open(os.devnull, "w") as quiet:
        call_command("init_platform", stdout=quiet, stderr=quiet)

    from apps.deliveries.tests.helpers import make_package
    from apps.identity.models import Role, UserRole
    from apps.production.models import ProjectMembership
    from apps.production.tests.factories import ProjectFactory

    project = ProjectFactory.create(code="BDG", budget_usd=Decimal("4800000.00"))
    make_package(project, name="Turnover 1")
    make_package(project, name="Turnover 2")

    flow: dict[str, dict] = {}
    for role_code in ("artist", "lead-artist", "vfx-supervisor", "production-admin"):
        user = django_user_model.objects.create_user(email=f"{role_code}@example.test", password="Cr5455-Pass!9")
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
        client = APIClient()
        client.force_authenticate(user=user)
        who = role_code.replace("-", "_")
        call(client, f"projects_list_{who}", "/api/v1/projects/", flow)
        call(client, f"project_detail_{who}", f"/api/v1/projects/{project.pk}/", flow)
        call(client, f"statistics_{who}", f"/api/v1/projects/{project.pk}/statistics/", flow)
        call(client, f"summary_{who}", f"/api/organizations/projects/{project.pk}/summary/", flow)
        call(client, f"dashboard_{who}", f"/api/v1/projects/{project.pk}/dashboard/", flow)
        if role_code == "vfx-supervisor":
            # After CR-55: a write naming the budget is refused, one leaving it out is answered without it.
            for name, body in (("budget", {"budget_usd": "1.00"}), ("name", {"name": "BDG renamed"})):
                path = f"/api/v1/projects/{project.pk}/"
                resp = client.patch(path, body, format="json")
                flow[f"patch_{name}_{who}"] = {
                    "request": {"method": "PATCH", "path": path, "body": body},
                    "status": resp.status_code,
                    "body": resp.json(),
                }

    name = os.environ.get("SYNC_SAMPLE_NAME", "_budget_counts_cr54_55.json")
    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / name).write_text(json.dumps(flow, indent=2, default=str) + "\n")
