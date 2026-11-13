"""
Review pipeline RP-4 sample capture: file dependencies, the loader, path templates (real responses).

C-RP-16 dependencies written with the downstream file and read both ways; C-RP-17 the loader
(`latest`, `approved`, `hero`); C-RP-18 path templates (studio and project), resolve-path and an
enforcing template refusing a path. Pytest test database only, inside a rolled-back transaction.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_publishing_depth.py
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
SHA = "c" * 64


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return EMAIL.sub("user@example.test", v)
    return v


@pytest.mark.django_db
def test_capture_publishing_depth(django_user_model):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Role, UserRole
    from apps.masterdata.models import MasterFileType
    from apps.production.tests.factories import VersionFactory

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))

    def call(client, method, path, data=None, params=None):
        send = getattr(client, method.lower())
        if params is not None:
            resp = send(path, params)
        elif data is not None:
            resp = send(path, data=data, format="json")
        else:
            resp = send(path)
        try:
            body = resp.json()
        except Exception:
            body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
        headers = {h: resp.get(h) for h in ("Content-Type", "X-Request-ID", "Allow") if resp.get(h)}
        return {"request": {"method": method, "path": path, "body": data, "params": params}, "status": resp.status_code, "headers": headers, "body": clean(body)}

    def user(email, role=None):
        u = django_user_model.objects.create_user(email=email, password="RP4-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(email="root@example.test", password="RP4-Admin-Pass!9")
    producer = user("producer@example.test", "production-admin")
    supervisor = user("supervisor@example.test", "vfx-supervisor")
    artist = user("artist@example.test", "artist")

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    a, pa, sv, ar = client(admin), client(producer), client(supervisor), client(artist)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    flow: dict = {}
    pid = make("/api/v1/projects/", {"code": "RPD", "name": "Depth", "workflow_type": "standard", "type": "Feature Film"})["id"]
    for who in (producer, supervisor, artist):
        make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": "Artist"})
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPD_SQ010", "name": "Opening"})
    shot = make("/api/v1/shots/", {"project": pid, "sequence_id": seq["id"], "code": "RPD_SH0010", "name": "Hero walk"})
    comp = make("/api/v1/tasks/", {"project": pid, "shot": shot["id"], "title": "Comp", "code": "RPD_T_COMP", "department": "Comp", "status": "In Progress"})
    MasterFileType.objects.create(code="EXR", name="OpenEXR", extension="exr")
    MasterFileType.objects.create(code="ABC", name="Alembic", extension="abc")

    from apps.production.models import Project, Shot, Task

    project, shot_row, task_row = Project.objects.get(pk=pid), Shot.objects.get(pk=shot["id"]), Task.objects.get(pk=comp["id"])

    def version(index, **fields):
        fields.setdefault("status", "Approved")
        return VersionFactory.create(project=project, code=f"RPD_SH0010_COMP_V{index:03d}", shot=shot_row, task=task_row, version_index=index, is_published=True, **fields)

    v1 = version(1, is_hero=True)
    v2 = version(2, status="Pending Review")
    make("/api/v1/publishing/storage-roots/", {"code": "PROJECTS", "name": "Projects", "linux_path": "/mnt/projects"})

    def file_body(v, path, **over):
        return {"version_id": str(v.pk), "storage_root": "PROJECTS", "relative_path": path, "size_bytes": 2048, "sha256": SHA, **over}

    # C-RP-16: an upstream cache, then a render built from it.
    up = call(sv, "POST", "/api/v1/publishing/files/", file_body(v1, "RPD/RPD_SH0010/anim/v001/cache.abc", file_type="ABC"))
    flow["register_upstream"] = up
    up_id = up["body"]["id"]
    flow["register_with_upstream"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v1, "RPD/RPD_SH0010/comp/v001/render.%04d.exr", file_type="EXR", frame_start=1001, frame_end=1096, upstream_ids=[up_id]))
    down_id = flow["register_with_upstream"]["body"]["id"]
    flow["register_upstream_unknown_400"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v1, "RPD/x/a.exr", upstream_ids=["00000000-0000-4000-8000-000000000001"]))
    flow["register_upstream_twice_400"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v1, "RPD/x/b.exr", upstream_ids=[up_id, up_id]))
    flow["retry_other_upstreams_409"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v1, "RPD/RPD_SH0010/comp/v001/render.%04d.exr", file_type="EXR", frame_start=1001, frame_end=1096))
    flow["file_detail_downstream"] = call(ar, "GET", f"/api/v1/publishing/files/{down_id}/")
    flow["files_list"] = call(ar, "GET", "/api/v1/publishing/files/", params={"project_id": pid})
    flow["dependencies_of_downstream"] = call(ar, "GET", f"/api/v1/publishing/files/{down_id}/dependencies/")
    flow["dependencies_of_upstream"] = call(ar, "GET", f"/api/v1/publishing/files/{up_id}/dependencies/")

    # C-RP-17: v2 (Pending Review) is the latest, v1 (Approved, hero) the approved and the hero.
    flow["register_v2_render"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v2, "RPD/RPD_SH0010/comp/v002/render.%04d.exr", file_type="EXR", frame_start=1001, frame_end=1096))
    flow["dependencies_none"] = call(ar, "GET", f"/api/v1/publishing/files/{flow['register_v2_render']['body']['id']}/dependencies/")
    flow["loader_latest"] = call(ar, "GET", "/api/v1/publishing/files/loader/", params={"shot": shot["id"], "file_type": "EXR"})
    flow["loader_approved"] = call(ar, "GET", "/api/v1/publishing/files/loader/", params={"shot": shot["id"], "file_type": "EXR", "which": "approved"})
    flow["loader_hero_task"] = call(ar, "GET", "/api/v1/publishing/files/loader/", params={"task": comp["id"], "which": "hero"})
    flow["loader_no_entity_400"] = call(ar, "GET", "/api/v1/publishing/files/loader/", params={"file_type": "EXR"})
    flow["loader_unknown_404"] = call(ar, "GET", "/api/v1/publishing/files/loader/", params={"shot": "00000000-0000-4000-8000-000000000002"})

    # C-RP-18: a studio template, the project's override, resolve-path, and enforcement.
    flow["template_create_studio"] = call(pa, "POST", "/api/v1/publishing/path-templates/", {"file_type": "EXR", "storage_root": "PROJECTS", "pattern": "{project}/{shot}/{task}/v{version:03}/{name}.{frame}.{ext}"})
    flow["template_create_by_supervisor_403"] = call(sv, "POST", "/api/v1/publishing/path-templates/", {"file_type": "EXR", "storage_root": "PROJECTS", "pattern": "{shot}/{name}.exr"})
    flow["template_create_bad_token_400"] = call(pa, "POST", "/api/v1/publishing/path-templates/", {"file_type": "ABC", "storage_root": "PROJECTS", "pattern": "{shoot}/{name}.abc"})
    flow["template_create_duplicate_400"] = call(pa, "POST", "/api/v1/publishing/path-templates/", {"file_type": "EXR", "storage_root": "PROJECTS", "pattern": "x/{name}.exr"})
    flow["resolve_path_studio"] = call(ar, "GET", "/api/v1/publishing/files/resolve-path/", params={"version_id": str(v2.pk), "file_type": "EXR"})
    project_template = call(pa, "POST", "/api/v1/publishing/path-templates/", {"project": pid, "file_type": "EXR", "storage_root": "PROJECTS", "pattern": "{project}/{sequence}/{shot}/{task}/v{version:03}/{name}.{frame}.{ext}", "enforce": True})
    flow["template_create_project_enforcing"] = project_template
    flow["resolve_path_project"] = call(ar, "GET", "/api/v1/publishing/files/resolve-path/", params={"version_id": str(v2.pk), "file_type": "EXR"})
    flow["resolve_path_none_404"] = call(ar, "GET", "/api/v1/publishing/files/resolve-path/", params={"version_id": str(v2.pk), "file_type": "ABC"})
    flow["register_mismatch_400"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v2, "RPD/elsewhere/render.%04d.exr", file_type="EXR", frame_start=1001, frame_end=1096))
    flow["register_match_201"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v2, "RPD/RPD_SQ010/RPD_SH0010/RPD_T_COMP/v002/denoised.%04d.exr", file_type="EXR", frame_start=1001, frame_end=1096))
    flow["templates_list"] = call(ar, "GET", "/api/v1/publishing/path-templates/")
    flow["templates_list_project"] = call(ar, "GET", "/api/v1/publishing/path-templates/", params={"project_id": pid})
    flow["template_patch_enforce_off"] = call(pa, "PATCH", f"/api/v1/publishing/path-templates/{project_template['body']['id']}/", {"enforce": False})
    flow["template_patch_key_400"] = call(pa, "PATCH", f"/api/v1/publishing/path-templates/{project_template['body']['id']}/", {"role": "proxy"})
    flow["template_delete_405"] = call(pa, "DELETE", f"/api/v1/publishing/path-templates/{project_template['body']['id']}/")
    # Revoking an upstream later leaves the downstream as it is; its dependency read shows the status.
    flow["revoke_upstream"] = call(sv, "POST", f"/api/v1/publishing/files/{up_id}/revoke/", {"reason": "Wrong cache"})
    flow["dependencies_after_upstream_revoked"] = call(ar, "GET", f"/api/v1/publishing/files/{down_id}/dependencies/")
    flow["register_revoked_upstream_400"] = call(sv, "POST", "/api/v1/publishing/files/", file_body(v1, "RPD/x/c.exr", upstream_ids=[up_id]))
    flow["ids"] = {"project": pid, "shot": shot["id"], "task": comp["id"], "v1": str(v1.pk), "v2": str(v2.pk), "upstream": up_id, "downstream": down_id}

    OUT.joinpath("publishing").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("publishing", "_dependencies_flow.json").write_text(json.dumps(flow, indent=2, sort_keys=True) + "\n")
