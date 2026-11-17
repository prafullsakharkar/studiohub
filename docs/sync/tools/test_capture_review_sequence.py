"""
Review pipeline RP-12 sample capture: an image sequence and burn-ins (real responses, real ffmpeg).

C-RP-31 open, frames, complete, cancel and their refusals; C-RP-32 the processed sequence (probe,
range filled on the version, frames gone); C-RP-33 the project switch and a copy with burn-ins.
Pytest test database only, inside a rolled-back transaction; MEDIA_ROOT is a temporary folder.
Needs ffmpeg with the EXR encoder and ``drawtext`` (Debian's, as in the worker image) and a DejaVu
Sans font (``REVIEW_MEDIA_BURN_IN_FONT`` or one of the usual places).

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_sequence.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

import pytest
from rest_framework.test import APIClient

OUT = Path(os.environ["SYNC_SAMPLES_OUT"])
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
TOKEN = re.compile(r"token=[^\"&\s]+")
FONTS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
)


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


@pytest.mark.django_db
def test_capture_review_sequence(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Role, UserRole
    from apps.production.models import Project, ReviewMedia, Shot, Task, Version
    from apps.production.services import review_media as service_module
    from apps.production.services.review_media import ReviewMediaService
    from apps.production.tests.factories import VersionFactory

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    font = os.environ.get("REVIEW_MEDIA_BURN_IN_FONT") or next(f for f in FONTS if Path(f).is_file())
    settings.REVIEW_MEDIA_BURN_IN_FONT = font
    queued: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: queued.append(str(media_id)))

    def call(client, method, path, data=None, multipart=False):
        send = getattr(client, method.lower())
        if data is not None:
            resp = send(path, data=data, format="multipart" if multipart else "json")
        else:
            resp = send(path)
        try:
            body = resp.json()
        except Exception:
            body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
        headers = {h: resp.get(h) for h in ("Content-Type", "Allow") if resp.get(h)}
        shown = None
        if data is not None:
            shown = {
                k: ([f.name for f in v] if isinstance(v, list) else getattr(v, "name", v))
                for k, v in data.items()
            }
        return {
            "request": {"method": method, "path": clean(path), "body": shown, "params": None},
            "status": resp.status_code,
            "headers": headers,
            "body": clean(body),
        }

    def user(email, role=None):
        u = django_user_model.objects.create_user(email=email, password="RP12-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP12-Admin-Pass!9"
    )
    producer = user("producer@example.test", "production-admin")
    artist = user("artist@example.test", "artist")

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    a, pa, ar = client(admin), client(producer), client(artist)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    pid = make(
        "/api/v1/projects/",
        {"code": "RPS", "name": "Review sequences", "workflow_type": "standard", "type": "Feature Film"},
    )["id"]
    for who in (producer, artist):
        make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": "Artist"})
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPS_SQ010", "name": "Opening"})
    shot = make(
        "/api/v1/shots/",
        {"project": pid, "sequence_id": seq["id"], "code": "RPS_SH0010", "name": "Hero walk"},
    )
    comp = make(
        "/api/v1/tasks/",
        {"project": pid, "shot": shot["id"], "title": "Comp", "code": "RPS_T_COMP",
         "department": "Comp", "status": "In Progress"},
    )  # fmt: skip
    project = Project.objects.get(pk=pid)
    shot_row, task_row = Shot.objects.get(pk=shot["id"]), Task.objects.get(pk=comp["id"])
    version = VersionFactory.create(
        project=project, code="RPS_SH0010_COMP_V001", shot=shot_row, task=task_row,
        version_index=1, status="Pending Review", start_frame=None, end_frame=None, fps=24,
    )  # fmt: skip
    vid = str(version.pk)

    gen = tmp_path / "gen"
    gen.mkdir()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "8", "-pix_fmt", "gbrpf32le", "-start_number", "1001",
         str(gen / "rps_sh0010_comp.%04d.exr")],
        check=True,
    )  # fmt: skip
    exr = {int(p.name.split(".")[1]): p.read_bytes() for p in sorted(gen.glob("*.exr"))}

    def frames(*numbers, name="rps_sh0010_comp", ext="exr", body=None):
        return [SimpleUploadedFile(f"{name}.{n}.{ext}", body or exr[n]) for n in numbers]

    flow: dict = {}
    vpath = f"/api/v1/versions/{vid}/"
    opath = f"/api/v1/versions/{vid}/review-media/sequence/"
    opening = {"name": "rps_sh0010_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1008}

    # C-RP-31: refusals, then an opening.
    settings.REVIEW_MEDIA_ENABLED = False
    flow["open_disabled_409"] = call(pa, "POST", opath, opening)
    settings.REVIEW_MEDIA_ENABLED = True
    flow["open_by_artist_403"] = call(ar, "POST", opath, opening)
    flow["open_bad_400"] = call(
        pa, "POST", opath, {"name": "renders/rps", "extension": "mov", "first_frame": 10, "last_frame": 1}
    )
    flow["open_too_many_400"] = call(pa, "POST", opath, {**opening, "first_frame": 1, "last_frame": 5000})
    flow["open_201"] = call(pa, "POST", opath, opening)
    sid = flow["open_201"]["body"]["id"]
    fpath, cpath = f"/api/v1/review-media/{sid}/frames/", f"/api/v1/review-media/{sid}/complete/"
    flow["open_busy_409"] = call(pa, "POST", opath, opening)
    flow["version_uploading"] = call(ar, "GET", vpath)

    flow["frames_part1_200"] = call(pa, "POST", fpath, {"frames": frames(1001, 1002, 1003, 1004)}, multipart=True)
    flow["frames_bad_400"] = call(
        pa, "POST", fpath,
        {"frames": [*frames(1005), *frames(1006, name="rps_sh0010_plate"), *frames(1009, body=exr[1001]), *frames(1001)]},
        multipart=True,
    )  # fmt: skip
    flow["frames_not_exr_400"] = call(
        pa, "POST", fpath, {"frames": frames(1005, body=b"SDPX" + b"\x00" * 64)}, multipart=True
    )
    flow["complete_gap_400"] = call(pa, "POST", cpath)
    flow["frames_part2_200"] = call(pa, "POST", fpath, {"frames": frames(1005, 1006, 1007, 1008)}, multipart=True)
    with django_capture_on_commit_callbacks(execute=True):
        flow["complete_202"] = call(pa, "POST", cpath)
    flow["frames_after_complete_400"] = call(pa, "POST", fpath, {"frames": frames(1001)}, multipart=True)
    flow["version_queued"] = call(ar, "GET", vpath)

    # C-RP-32: the worker's job.
    with django_capture_on_commit_callbacks(execute=True):
        assert ReviewMediaService.process(sid) == ReviewMedia.Status.READY
    flow["version_ready"] = call(ar, "GET", vpath)
    row = ReviewMedia.objects.get(pk=sid)
    # RP-16 (C-RP-41): the frames are kept for REVIEW_MEDIA_SEQUENCE_KEEP_DAYS (14 by default)
    assert row.frames_until is not None and (Path(settings.MEDIA_ROOT) / row.source_path).is_dir()
    version.refresh_from_db()
    assert (version.start_frame, version.end_frame) == (1001, 1008)

    # C-RP-31: cancel an upload in progress.
    flow["open_second_201"] = call(pa, "POST", opath, opening)
    second = flow["open_second_201"]["body"]["id"]
    call(pa, "POST", f"/api/v1/review-media/{second}/frames/", {"frames": frames(1001, 1002)}, multipart=True)
    with django_capture_on_commit_callbacks(execute=True):
        flow["cancel_204"] = call(pa, "DELETE", f"/api/v1/review-media/{second}/")
    flow["version_after_cancel"] = call(ar, "GET", vpath)

    # C-RP-33: the project switch, and a copy with burn-ins.
    ppath = f"/api/v1/projects/{pid}/"
    flow["project_default"] = call(pa, "GET", ppath)
    flow["project_switch_on"] = call(pa, "PATCH", ppath, {"review_burn_ins": True})
    flow["project_switch_bad_400"] = call(pa, "PATCH", ppath, {"review_burn_ins": "sometimes"})
    flow["project_with_burn_ins"] = call(pa, "GET", ppath)
    flow["open_burnt_201"] = call(pa, "POST", opath, opening)
    burnt = flow["open_burnt_201"]["body"]["id"]
    call(pa, "POST", f"/api/v1/review-media/{burnt}/frames/", {"frames": frames(*range(1001, 1009))}, multipart=True)
    with django_capture_on_commit_callbacks(execute=True):
        call(pa, "POST", f"/api/v1/review-media/{burnt}/complete/")
        assert ReviewMediaService.process(burnt) == ReviewMedia.Status.READY
    flow["version_ready_with_burn_ins"] = call(ar, "GET", vpath)
    assert flow["version_ready_with_burn_ins"]["body"]["review_media"]["probe"]["burn_ins"] is True
    assert Version.objects.get(pk=vid).start_frame == 1001

    flow["ids"] = {"project": pid, "version": vid, "sequence": sid, "cancelled": second, "burnt": burnt}
    flow["queued"] = len(queued)

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_review_sequence_flow.json").write_text(
        json.dumps(flow, indent=2, sort_keys=True) + "\n"
    )
