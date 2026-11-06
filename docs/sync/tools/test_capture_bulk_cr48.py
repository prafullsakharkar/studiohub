"""
CR-48 sample capture: bulk create and update of sequences, shots, assets and tasks with `dry_run`,
`atomic`, code matching, the field whitelist and the 500-item limit (docs/episodic-bulk-discovery.md).

Real MFA-enrolled superuser JWT flow; every call is recorded whatever its status. Batch answers are
kept whole (no row trimming): the frontend tests read them row by row. Pytest test database only,
rolled back.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_bulk_cr48.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_capture_identity_admin import redact, sign_in_with_mfa  # noqa: E402

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
FLOW: dict[str, dict] = {}


def call(client, name, method, path, data=None):
    fn = getattr(client, method.lower())
    resp = fn(path, data=data, format="json") if data is not None else fn(path)
    body = resp.json()
    request = data
    if isinstance(data, dict) and len(data.get("items") or []) > 10:
        request = {**data, "items": f"<{len(data['items'])} items>"}
    FLOW[name] = {
        "request": {"method": method, "path": path, "body": request},
        "status": resp.status_code,
        "body": redact(body),
    }
    return resp


@pytest.mark.django_db
def test_capture_bulk_cr48(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    from apps.identity.tests.mfa_helpers import enable_mfa

    FLOW.clear()
    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="Admin-Pass-CR48!9"
    )
    enable_mfa(admin)
    a, _ = sign_in_with_mfa("root@example.test", "Admin-Pass-CR48!9", admin)

    def post(path, body):
        response = a.post(path, body, format="json")
        assert response.status_code in (200, 201), response.content
        return response.json()

    std = post("/api/v1/projects/", {"code": "STD", "name": "Standard", "workflow_type": "standard"})
    epic = post("/api/v1/projects/", {"code": "EPIC", "name": "Episodic", "workflow_type": "episodic"})
    call(a, "projects_detail_standard", "GET", f"/api/v1/projects/{std['id']}/")
    call(a, "projects_detail_episodic", "GET", f"/api/v1/projects/{epic['id']}/")
    # An episodic project starts with its first episode (EP101).
    first = a.get(f"/api/v1/episodes/?project={epic['id']}").json()["results"][0]
    assert first["code"] == "EP101", first
    call(a, "episodes_of_episodic", "GET", f"/api/v1/episodes/?project={epic['id']}")
    sq010 = post("/api/v1/sequences/", {"project": std["id"], "code": "SQ010", "name": "Opening"})
    post("/api/v1/shots/", {"project": std["id"], "code": "SH010", "sequence_id": sq010["id"]})

    def create(project, rows, **flags):
        return {
            "project_id": project["id"],
            "items": [{"code": code, "action": "create", "data": data} for code, data in rows],
            **flags,
        }

    S = "/api/v1/sequences/"
    # ------------------------------------------------------------ sequences: create
    call(a, "sequences_create_dry_run_ok", "POST", f"{S}bulk-create/",
         create(std, [("SQ020", {"name": "Chase"}), ("SQ030", {"frame_in": 1001, "frame_out": 1100})], dry_run=True, atomic=True))
    call(a, "sequences_create_dry_run_errors", "POST", f"{S}bulk-create/",
         create(std, [("SQ010", {}), ("SQ040", {}), ("SQ040", {}), ("BAD CODE", {}), ("SQ050", {"frame_in": 1100, "frame_out": 1001})], dry_run=True, atomic=True))
    call(a, "sequences_create_commit", "POST", f"{S}bulk-create/",
         create(std, [("SQ020", {"name": "Chase"}), ("SQ030", {})], dry_run=False, atomic=True))
    call(a, "sequences_create_atomic_fails", "POST", f"{S}bulk-create/",
         create(std, [("SQ060", {}), ("BAD/CODE", {})], dry_run=False, atomic=True))
    call(a, "sequences_create_skip_invalid", "POST", f"{S}bulk-create/",
         create(std, [("SQ070", {}), ("BAD/CODE", {})], dry_run=False, atomic=False))
    call(a, "sequences_create_episodic_dry_run", "POST", f"{S}bulk-create/",
         create(epic, [("SQA", {"episode_id": "EP101"}), ("SQB", {})], dry_run=True, atomic=True))
    call(a, "sequences_create_over_limit", "POST", f"{S}bulk-create/",
         create(std, [(f"SQ{n:04d}", {}) for n in range(501)], dry_run=True, atomic=True))
    call(a, "sequences_create_bad_flag", "POST", f"{S}bulk-create/",
         create(std, [("SQ080", {})], dry_run="maybe"))

    # ------------------------------------------------------------ sequences: update
    call(a, "sequences_update_dry_run", "POST", f"{S}bulk-update/",
         {"project_id": std["id"], "dry_run": True, "atomic": True,
          "items": [{"code": "SQ010", "description": "Re-cut"}, {"code": "NOPE", "name": "x"}]})
    call(a, "sequences_update_commit", "POST", f"{S}bulk-update/",
         {"project_id": std["id"], "dry_run": False, "atomic": True,
          "items": [{"code": "sq010", "description": "Re-cut"}, {"code": "SQ020", "status": "In Progress"}]})
    call(a, "sequences_update_ids", "POST", f"{S}bulk-update/",
         {"ids": [sq010["id"]], "changes": {"status": "Pending Review"}, "dry_run": False, "atomic": True})
    call(a, "sequences_update_ids_refused", "POST", f"{S}bulk-update/",
         {"ids": [sq010["id"]], "changes": {"status": "Nope"}, "dry_run": False, "atomic": True})
    call(a, "sequences_update_not_bulk_updatable", "POST", f"{S}bulk-update/",
         {"project_id": std["id"], "dry_run": True, "atomic": True,
          "items": [{"code": "SQ010", "metadata": {"a": 1}}]})

    # ------------------------------------------------------------ shots, assets, tasks
    call(a, "shots_create_dry_run", "POST", "/api/v1/shots/bulk-create/",
         create(std, [("SH020", {"sequence_id": "SQ010", "frame_in": 1001, "frame_out": 1050}), ("SH030", {"sequence_id": "SQ999"})], dry_run=True, atomic=True))
    call(a, "assets_create_dry_run", "POST", "/api/v1/assets/bulk-create/",
         create(std, [("HERO", {"name": "Hero", "category": "Character"}), ("PROP1", {"name": "Prop", "asset_type_id": "NOPE"}), ("PROP2", {})], dry_run=True, atomic=True))
    call(a, "tasks_create_dry_run", "POST", "/api/v1/tasks/bulk-create/",
         create(std, [("COMP010", {"title": "Comp", "entity_type": "Shot", "entity_id": "SH010"}), ("COMP020", {"title": "Comp", "entity_type": "Shot", "entity_id": "SH999"})], dry_run=True, atomic=True))

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_bulk_cr48_flow.json").write_text(
        json.dumps(redact(FLOW), indent=1, sort_keys=True)
    )
