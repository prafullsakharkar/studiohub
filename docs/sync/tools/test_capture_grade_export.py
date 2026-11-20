"""
Review pipeline RP-27 sample capture: exporting shot grades (real responses, C-RP-62).

A project with two sequences: shots graded by typing and by importing a client's ``.ccc`` (so with a
source), an ungraded shot and an archived graded one. ``grades/export/`` read by a supervisor (the
whole project, one sequence, an unknown and a malformed sequence id), by a vendor member (their
task's shot), by a client member (no shots), by a role without ``shot.view`` (403) and by someone
outside the project (404). The exported file imported again as a dry run (every shot unchanged), and
the export's audit row from the audit list. Built-in roles from ``init_platform``. Pytest test
database only, rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \\
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \\
      ../docs/sync/tools/test_capture_grade_export.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
HEADERS = ("Content-Type", "Content-Disposition", "Cache-Control")
CLIENT_CCC = b"""<?xml version="1.0" encoding="UTF-8"?>
<ColorCorrectionCollection xmlns="urn:ASC:CDL:v1.2">
  <ColorCorrection id="REX_SH0030">
    <SOPNode><Slope>1.05 1 0.97</Slope><Offset>0.002 0 -0.004</Offset><Power>1 1 1</Power></SOPNode>
    <SatNode><Saturation>0.92</Saturation></SatNode>
  </ColorCorrection>
</ColorCorrectionCollection>
"""


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return EMAIL.sub("user@example.test", v)
    return v


@pytest.mark.django_db
def test_capture_grade_export(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Profile, Role, UserRole
    from apps.identity.tests.rbac_helpers import grant_permissions
    from apps.production.models import ProjectMembership

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    devnull = open(os.devnull, "w")  # noqa: SIM115
    call_command("init_platform", stdout=devnull, stderr=devnull)

    def call(client, method, path, data=None, multipart=False):
        send = getattr(client, method.lower())
        if data is not None:
            resp = send(path, data=data, format="multipart" if multipart else "json")
        else:
            resp = send(path)
        return {
            "request": {"method": method, "path": path, "body": None if multipart else data},
            "status": resp.status_code,
            "body": clean(resp.json()),
        }

    def export(client, path):
        """The file as it came: its status, the headers that matter and its text (JSON when refused)."""
        resp = client.get(path)
        is_file = resp["Content-Type"].startswith("application/xml")
        return {
            "request": {"method": "GET", "path": path},
            "status": resp.status_code,
            "headers": {name: resp[name] for name in HEADERS if name in resp},
            "body": resp.content.decode() if is_file else clean(resp.json()),
        }

    def user(email, role_code=None):
        u = django_user_model.objects.create_user(email=email, password="RP27-Pass-Word!9")
        first = email.split("@")[0].title()
        Profile.objects.update_or_create(
            user=u,
            defaults={
                "first_name": first,
                "last_name": "Example",
                "display_name": f"{first} Example",
            },
        )
        if role_code:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role_code))
        return u

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP27-Admin-Pass!9"
    )
    supervisor = user("supervisor@example.test", "vfx-supervisor")
    vendor = user("vendor@example.test", "artist")
    client_user = user("client@example.test", "artist")
    no_shots = user("projects-only@example.test")
    grant_permissions(no_shots, "project.view")
    outsider = user("outsider@example.test", "vfx-supervisor")
    a = client(admin)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make(
        "/api/v1/projects/",
        {
            "code": "REX",
            "name": "Grade export",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )
    elsewhere = make(
        "/api/v1/projects/",
        {"code": "REO", "name": "Elsewhere", "workflow_type": "standard", "type": "Feature Film"},
    )
    pid = project["id"]
    for u, extra in (
        (supervisor, {"role": "VFX Supervisor"}),
        (no_shots, {"role": "Coordinator"}),
        (vendor, {"role": "Artist", "vendor_id": "vendor-1"}),
        (client_user, {"role": "Client", "client_id": "client-1"}),
    ):
        ProjectMembership.objects.create(user=u, project_id=pid, status="active", **extra)
    ProjectMembership.objects.create(
        user=outsider, project_id=elsewhere["id"], status="active", role="VFX Supervisor"
    )
    sq010 = make("/api/v1/sequences/", {"project": pid, "code": "REX_SQ010", "name": "Opening"})
    sq020 = make("/api/v1/sequences/", {"project": pid, "code": "REX_SQ020", "name": "Chase"})

    def shot(code, sequence):
        return make(
            "/api/v1/shots/",
            {"project": pid, "sequence_id": sequence["id"], "code": code, "name": code},
        )

    sh10, sh20 = shot("REX_SH0010", sq010), shot("REX_SH0020", sq010)
    sh30, sh40 = shot("REX_SH0030", sq020), shot("REX_SH0040", sq010)
    sh50 = shot("REX_SH0050", sq010)
    warm = {"slope": [1.1, 1, 0.9], "offset": [0.01, 0, -0.01], "power": [1, 1, 1.05],
            "saturation": 0.9}  # fmt: skip
    cool = {"slope": [0.9, 1, 1.1], "offset": [0, 0, 0], "power": [1, 1, 1], "saturation": 1}
    for target, grade in ((sh10, warm), (sh20, cool), (sh50, cool)):
        resp = a.patch(f"/api/v1/shots/{target['id']}/", {"grade": grade}, format="json")
        assert resp.status_code == 200, resp.content[:300]
    imported = a.post(
        f"/api/v1/projects/{pid}/grades/import/",
        {"file": SimpleUploadedFile("client_reel1.ccc", CLIENT_CCC), "dry_run": "false"},
        format="multipart",
    )
    assert imported.status_code == 200 and imported.json()["applied"] == 1, imported.content[:300]
    assert a.delete(f"/api/v1/shots/{sh50['id']}/").status_code in (200, 204)
    comp = make(
        "/api/v1/tasks/",
        {
            "project": pid,
            "entity_type": "Shot",
            "entity_id": sh20["id"],
            "code": "REX_SH0020_COMP",
            "title": "Comp",
        },
    )
    marked = a.patch(f"/api/v1/tasks/{comp['id']}/", {"vendor_id": "vendor-1"}, format="json")
    assert marked.status_code == 200, marked.content[:300]
    assert marked.json()["vendor_id"] == "vendor-1", marked.json()
    assert marked.json()["entity_id"] == sh20["id"], marked.json()

    sup, ven, cli = client(supervisor), client(vendor), client(client_user)
    ns, out = client(no_shots), client(outsider)
    e = f"/api/v1/projects/{pid}/grades/export/"
    flow: dict[str, dict] = {
        "export_project": export(sup, e),
        "export_sequence": export(sup, f"{e}?sequence_id={sq010['id']}"),
        "export_sequence_unknown": export(
            sup, f"{e}?sequence_id=00000000-0000-0000-0000-000000000000"
        ),
        "export_sequence_malformed": export(sup, f"{e}?sequence_id=not-a-uuid"),
        "export_as_vendor": export(ven, e),
        "export_as_client": export(cli, e),
        "export_without_shot_view_403": export(ns, e),
        "export_outside_404": export(out, e),
        "shot_imported": call(sup, "GET", f"/api/v1/shots/{sh30['id']}/"),
        "shot_ungraded": call(sup, "GET", f"/api/v1/shots/{sh40['id']}/"),
        "me_supervisor": call(sup, "GET", "/api/v1/auth/me/"),
        "me_without_shot_view": call(ns, "GET", "/api/v1/auth/me/"),
        "sequences": call(sup, "GET", f"/api/v1/sequences/?project_id={pid}&ordering=code"),
        "project": call(sup, "GET", f"/api/v1/projects/{pid}/"),
    }
    # The round trip: the exported file imported again changes nothing.
    flow["reimport_dry_run"] = call(
        sup,
        "POST",
        f"/api/v1/projects/{pid}/grades/import/",
        {
            "file": SimpleUploadedFile("REX_grades.ccc", flow["export_project"]["body"].encode()),
            "dry_run": "true",
        },
        multipart=True,
    )
    flow["audit_of_exports"] = call(a, "GET", f"/api/v1/audit/?search={pid}&action=EXPORT")

    expected = {"export_without_shot_view_403": 403, "export_outside_404": 404}
    for name, entry in flow.items():
        assert entry["status"] == expected.get(name, 200), (name, entry["status"], entry["body"])

    def ids(name):
        return re.findall(r'<ColorCorrection id="([^"]+)"', flow[name]["body"])

    assert flow["export_project"]["headers"] == {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="REX_grades.ccc"',
        "Cache-Control": "no-store",
    }
    assert ids("export_project") == ["REX_SH0010", "REX_SH0020", "REX_SH0030"]
    assert "<Description>client_reel1.ccc" in flow["export_project"]["body"]
    assert ids("export_sequence") == ["REX_SH0010", "REX_SH0020"]
    assert ids("export_sequence_unknown") == ids("export_sequence_malformed") == []
    assert ids("export_as_vendor") == ["REX_SH0020"]
    assert ids("export_as_client") == []
    again = flow["reimport_dry_run"]["body"]
    assert again["matched"] == again["unmatched"] == again["invalid"] == []
    assert sorted(r["shot"]["code"] for r in again["unchanged"]) == ids("export_project")
    # supervisor x4 (project, sequence, unknown, malformed), vendor, client: six rows, refusals none
    assert flow["audit_of_exports"]["body"]["count"] == 6

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_grade_export_flow.json").write_text(
        json.dumps(flow, indent=1, sort_keys=True) + "\n"
    )
