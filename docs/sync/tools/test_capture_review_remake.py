"""
Review pipeline RP-14 sample capture: remaking review copies (real responses, real ffmpeg).

C-RP-37 remake one copy (the old copy stays shown, the new one replaces it when ready) and its
refusals; C-RP-38 a project's copies that differ from its burn-in switch, and remaking them.
Pytest test database only, inside a rolled-back transaction; MEDIA_ROOT is a temporary folder.
Needs ffmpeg with the EXR encoder and ``drawtext`` (Debian's, as in the worker image) and a DejaVu
Sans font (``REVIEW_MEDIA_BURN_IN_FONT`` or one of the usual places).

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_remake.py
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
def test_capture_review_remake(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Role, UserRole
    from apps.production.models import Project, ReviewMedia, Shot, Task
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
        u = django_user_model.objects.create_user(email=email, password="RP14-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP14-Admin-Pass!9"
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
        {"code": "RPR", "name": "Review remakes", "workflow_type": "standard", "type": "Feature Film"},
    )["id"]
    for who in (producer, artist):
        make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": "Artist"})
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPR_SQ010", "name": "Opening"})
    project = Project.objects.get(pk=pid)

    def version(n):
        shot = make(
            "/api/v1/shots/",
            {"project": pid, "sequence_id": seq["id"], "code": f"RPR_SH00{n}0", "name": f"Shot {n}"},
        )
        task = make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"RPR_T_COMP{n}",
             "department": "Comp", "status": "In Progress"},
        )  # fmt: skip
        return VersionFactory.create(
            project=project, code=f"RPR_SH00{n}0_COMP_V001", shot=Shot.objects.get(pk=shot["id"]),
            task=Task.objects.get(pk=task["id"]), version_index=1, status="Pending Review",
            start_frame=1001, end_frame=1024, fps=24,
        )  # fmt: skip

    gen = tmp_path / "gen"
    gen.mkdir()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "24", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(gen / "comp.mp4")],
        check=True,
    )  # fmt: skip
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "2", "-pix_fmt", "gbrpf32le", "-start_number", "1001",
         str(gen / "rpr_comp.%04d.exr")],
        check=True,
    )  # fmt: skip
    movie = (gen / "comp.mp4").read_bytes()

    def ready_movie(v):
        resp = pa.post(
            f"/api/v1/versions/{v.pk}/review-media/",
            {"file": SimpleUploadedFile("rpr_comp_v001.mp4", movie)},
            format="multipart",
        )
        assert resp.status_code == 202, resp.content[:300]
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(resp.json()["id"]) == ReviewMedia.Status.READY
        return resp.json()["id"]

    first, second, third = version(1), version(2), version(3)
    flow: dict = {}
    cpath = f"/api/v1/projects/{pid}/review-copies/"
    rpath = f"/api/v1/projects/{pid}/review-copies/remake/"

    # Copies made with the switch off.
    old = ready_movie(first)
    ready_movie(second)
    seq_resp = pa.post(
        f"/api/v1/versions/{third.pk}/review-media/sequence/",
        {"name": "rpr_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1002},
        format="json",
    )
    sid = seq_resp.json()["id"]
    exr = [SimpleUploadedFile(p.name, p.read_bytes()) for p in sorted(gen.glob("*.exr"))]
    pa.post(f"/api/v1/review-media/{sid}/frames/", {"frames": exr}, format="multipart")
    with django_capture_on_commit_callbacks(execute=True):
        pa.post(f"/api/v1/review-media/{sid}/complete/")
        assert ReviewMediaService.process(sid) == ReviewMedia.Status.READY
    flow["copies_switch_off"] = call(pa, "GET", cpath)

    # C-RP-38: the switch goes on; three copies were made without burn-ins.
    call(pa, "PATCH", f"/api/v1/projects/{pid}/", {"review_burn_ins": True})
    flow["copies_switch_on"] = call(pa, "GET", cpath)
    flow["copies_by_artist"] = call(ar, "GET", cpath)
    flow["remake_all_by_artist_403"] = call(ar, "POST", rpath)

    # C-RP-37: one copy.
    mpath = f"/api/v1/review-media/{old}/remake/"
    flow["remake_by_artist_403"] = call(ar, "POST", mpath)
    flow["remake_sequence_400"] = call(pa, "POST", f"/api/v1/review-media/{sid}/remake/")
    settings.REVIEW_MEDIA_ENABLED = False
    flow["remake_disabled_409"] = call(pa, "POST", mpath)
    settings.REVIEW_MEDIA_ENABLED = True
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_202"] = call(pa, "POST", mpath)
    new = flow["remake_202"]["body"]["id"]
    flow["remake_busy_409"] = call(pa, "POST", mpath)
    flow["version_remaking"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    flow["remake_old_not_ready_400"] = None
    with django_capture_on_commit_callbacks(execute=True):
        assert ReviewMediaService.process(new) == ReviewMedia.Status.READY
    flow["version_remade"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    assert flow["version_remade"]["body"]["review_media"]["probe"]["burn_ins"] is True
    flow["remake_old_not_ready_400"] = call(pa, "POST", mpath)  # it is superseded now
    flow["copies_after_one"] = call(pa, "GET", cpath)

    # C-RP-38: the rest of the project.
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_all_200"] = call(pa, "POST", rpath)
    for row_id in queued[-flow["remake_all_200"]["body"]["queued"] :]:
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == ReviewMedia.Status.READY
    flow["copies_after_all"] = call(pa, "GET", cpath)
    flow["version_two_remade"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")

    flow["ids"] = {"project": pid, "first": str(first.pk), "second": str(second.pk),
                   "third": str(third.pk), "old": old, "remade": new, "sequence": sid}  # fmt: skip
    flow["queued"] = len(queued)

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_review_remake_flow.json").write_text(
        json.dumps(flow, indent=2, sort_keys=True) + "\n"
    )
