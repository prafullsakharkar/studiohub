"""
Phase 18 sample capture: what the shot and asset workspaces do (real responses).

Notes linked to a shot or an asset and found by searching the code, assigning and unassigning, approving from
Pending Review, archiving one record and what the detail route answers afterwards, restoring. Pytest test database
only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_workspaces.py
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return EMAIL.sub("user@example.test", v)
    return v


def call(client, method, path, data=None):
    send = getattr(client, method.lower())
    resp = send(path, data=data, format="json") if data is not None else send(path)
    try:
        body = resp.json()
    except Exception:
        body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
    headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)}
    return {"request": {"method": method, "path": path, "body": data}, "status": resp.status_code, "headers": headers, "body": clean(body)}


@pytest.mark.django_db
def test_capture_workspaces(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="Phase18-Admin-Pass!9")
    artist = django_user_model.objects.create_user(email="artist@example.test", password="Phase18-Artist-Pass!9")
    stranger = django_user_model.objects.create_user(email="stranger@example.test", password="Phase18-Stranger-Pass!9")
    a = APIClient()
    a.force_authenticate(user=admin)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make("/api/v1/projects/", {"code": "WS18", "name": "Workspaces", "workflow_type": "standard", "type": "Feature Film"})
    pid = project["id"]
    make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(artist.id), "role": "Artist"})
    seq = make("/api/v1/sequences/", {"project": pid, "code": "SQ010", "name": "Opening"})
    shot = make("/api/v1/shots/", {"project": pid, "sequence_id": seq["id"], "code": "SH0010", "name": "Hero walk", "frame_in": 1001, "frame_out": 1096, "handle_frames": 8})
    asset = make("/api/v1/assets/", {"project": pid, "code": "CHR-HERO", "name": "Hero", "category": "Character"})
    sid, aid = shot["id"], asset["id"]

    flow: dict[str, dict] = {"ids": {"project": pid, "shot": sid, "asset": aid, "artist": str(artist.id), "stranger": str(stranger.id)}}  # type: ignore[dict-item]
    notes = f"/api/organizations/projects/{pid}/notes/"
    flow["note_on_shot"] = call(a, "POST", notes, {"subject": "Match the plate", "body": "Grade to the ref.", "category": "Supervisor Note", "entity_type": "Shot", "entity_id": sid, "entity_code": "SH0010", "entity_name": "Hero walk"})
    flow["note_on_asset"] = call(a, "POST", notes, {"subject": "Fix the rig", "category": "Pipeline Notice", "entity_type": "Asset", "entity_id": aid, "entity_code": "CHR-HERO", "entity_name": "Hero"})
    flow["note_on_project"] = call(a, "POST", notes, {"subject": "Delivery spec"})
    flow["note_mentions_code"] = call(a, "POST", notes, {"subject": "Remember SH0010 later", "entity_type": "Project"})
    flow["note_empty_400"] = call(a, "POST", notes, {})
    flow["notes_all"] = call(a, "GET", notes)
    flow["notes_search_shot"] = call(a, "GET", f"{notes}?search=SH0010")
    flow["notes_search_asset"] = call(a, "GET", f"{notes}?search=CHR-HERO")

    flow["shot_detail"] = call(a, "GET", f"/api/v1/shots/{sid}/")
    flow["shot_assign"] = call(a, "PATCH", f"/api/v1/shots/{sid}/", {"assigned_artist": str(artist.id)})
    flow["shot_assign_non_member_400"] = call(a, "PATCH", f"/api/v1/shots/{sid}/", {"assigned_artist": str(stranger.id)})
    flow["shot_unassign"] = call(a, "PATCH", f"/api/v1/shots/{sid}/", {"assigned_artist": None})
    flow["shot_approve_from_not_started_400"] = call(a, "POST", f"/api/v1/shots/{sid}/approve/", {})
    call(a, "PATCH", f"/api/v1/shots/{sid}/", {"status": "In Progress"})
    flow["shot_to_review"] = call(a, "PATCH", f"/api/v1/shots/{sid}/", {"status": "Pending Review"})
    flow["shot_approve"] = call(a, "POST", f"/api/v1/shots/{sid}/approve/", {})
    flow["shot_archive"] = call(a, "POST", f"/api/v1/shots/{sid}/archive/")
    flow["shot_detail_after_archive"] = call(a, "GET", f"/api/v1/shots/{sid}/")
    flow["shots_archived"] = call(a, "GET", f"/api/v1/shots/archived/?project={pid}")
    flow["shot_restore"] = call(a, "POST", f"/api/v1/shots/{sid}/restore/")
    flow["shot_delete"] = call(a, "DELETE", f"/api/v1/shots/{sid}/")
    flow["shot_detail_after_delete"] = call(a, "GET", f"/api/v1/shots/{sid}/")
    flow["shots_archived_after_delete"] = call(a, "GET", f"/api/v1/shots/archived/?project={pid}")

    flow["asset_detail"] = call(a, "GET", f"/api/v1/assets/{aid}/")
    flow["asset_assign"] = call(a, "PATCH", f"/api/v1/assets/{aid}/", {"assigned_artist": str(artist.id)})
    flow["asset_unassign"] = call(a, "PATCH", f"/api/v1/assets/{aid}/", {"assigned_artist": None})
    flow["asset_archive"] = call(a, "POST", f"/api/v1/assets/{aid}/archive/")
    flow["asset_detail_after_archive"] = call(a, "GET", f"/api/v1/assets/{aid}/")
    flow["asset_restore"] = call(a, "POST", f"/api/v1/assets/{aid}/restore/")
    flow["asset_shots"] = call(a, "GET", f"/api/v1/assets/{aid}/shots/")

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_workspaces_flow.json").write_text(json.dumps(flow, indent=2, default=str) + "\n")
