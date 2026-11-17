"""
Review pipeline RP-16 sample capture: sequence copies after a settings change (real responses, real ffmpeg).

C-RP-41 a sequence keeps its frames for a while once its copy is ready, and is remade from them; C-RP-42
the project's copies read lists which copies differ; C-RP-43 copies that cannot be remade are kept as
they are. Pytest test database only, inside a rolled-back transaction; MEDIA_ROOT is a temporary folder.
Needs ffmpeg with the EXR encoder and ``drawtext`` (Debian's, as in the worker image: ``/usr/bin/ffmpeg``
on this host) and a DejaVu Sans font (``REVIEW_MEDIA_BURN_IN_FONT`` or one of the usual places).

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_sequence_copies.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import timedelta
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
FFMPEG = os.environ.get("REVIEW_MEDIA_FFMPEG", "/usr/bin/ffmpeg")


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


@pytest.mark.django_db
def test_capture_review_sequence_copies(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.core.management import call_command
    from django.db import connection
    from django.utils import timezone

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
    settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 14
    settings.REVIEW_MEDIA_FFMPEG = FFMPEG
    settings.REVIEW_MEDIA_FFPROBE = str(Path(FFMPEG).with_name("ffprobe"))
    font = os.environ.get("REVIEW_MEDIA_BURN_IN_FONT") or next(f for f in FONTS if Path(f).is_file())
    settings.REVIEW_MEDIA_BURN_IN_FONT = font
    queued: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: queued.append(str(media_id)))
    monkeypatch.setattr(service_module, "discard_later", lambda folder: None)

    def call(client, method, path, data=None):
        send = getattr(client, method.lower())
        resp = send(path, data=data, format="json") if data is not None else send(path)
        try:
            body = resp.json()
        except Exception:
            body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
        headers = {h: resp.get(h) for h in ("Content-Type", "Allow") if resp.get(h)}
        return {
            "request": {"method": method, "path": clean(path), "body": data, "params": None},
            "status": resp.status_code,
            "headers": headers,
            "body": clean(body),
        }

    def user(email, role=None):
        u = django_user_model.objects.create_user(email=email, password="RP16-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP16-Admin-Pass!9"
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
        {"code": "RPS", "name": "Sequence copies", "workflow_type": "standard", "type": "Feature Film"},
    )["id"]
    for who in (producer, artist):
        make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": "Artist"})
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPS_SQ010", "name": "Opening"})
    project = Project.objects.get(pk=pid)

    def version(n):
        shot = make(
            "/api/v1/shots/",
            {"project": pid, "sequence_id": seq["id"], "code": f"RPS_SH00{n}0", "name": f"Shot {n}"},
        )
        task = make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"RPS_T_COMP{n}",
             "department": "Comp", "status": "In Progress"},
        )  # fmt: skip
        return VersionFactory.create(
            project=project, code=f"RPS_SH00{n}0_COMP_V001", shot=Shot.objects.get(pk=shot["id"]),
            task=Task.objects.get(pk=task["id"]), version_index=1, status="Pending Review",
            start_frame=1001, end_frame=1024, fps=24,
        )  # fmt: skip

    gen = tmp_path / "gen"
    gen.mkdir()
    subprocess.run(
        [FFMPEG, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "24", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(gen / "comp.mp4")],
        check=True,
    )  # fmt: skip
    subprocess.run(
        [FFMPEG, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "2", "-pix_fmt", "gbrpf32le", "-start_number", "1001",
         str(gen / "rps_comp.%04d.exr")],
        check=True,
    )  # fmt: skip

    def process(row_id):
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == ReviewMedia.Status.READY

    def ready_movie(v):
        resp = pa.post(
            f"/api/v1/versions/{v.pk}/review-media/",
            {"file": SimpleUploadedFile("rps_comp_v001.mp4", (gen / "comp.mp4").read_bytes())},
            format="multipart",
        )
        assert resp.status_code == 202, resp.content[:300]
        process(resp.json()["id"])
        return resp.json()["id"]

    def ready_sequence(v):
        resp = pa.post(
            f"/api/v1/versions/{v.pk}/review-media/sequence/",
            {"name": "rps_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1002},
            format="json",
        )
        sid = resp.json()["id"]
        exr = [SimpleUploadedFile(p.name, p.read_bytes()) for p in sorted(gen.glob("*.exr"))]
        pa.post(f"/api/v1/review-media/{sid}/frames/", {"frames": exr}, format="multipart")
        with django_capture_on_commit_callbacks(execute=True):
            pa.post(f"/api/v1/review-media/{sid}/complete/")
        process(sid)
        return sid

    first, second, third = version(1), version(2), version(3)
    flow: dict = {}
    cpath = f"/api/v1/projects/{pid}/review-copies/"
    kpath = f"/api/v1/projects/{pid}/review-copies/keep/"

    # C-RP-41: a sequence uploaded long ago (its frames' time is up and the sweep has run), a recent
    # one (its frames are kept) and a movie, all made with the switch off.
    gone = ready_sequence(first)
    ReviewMedia.objects.filter(pk=gone).update(frames_until=timezone.now() - timedelta(minutes=1))
    with django_capture_on_commit_callbacks(execute=True):
        ReviewMediaService.sweep()
    kept = ready_sequence(second)
    movie = ready_movie(third)
    flow["version_frames_kept"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")
    flow["version_frames_gone"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    flow["copies_switch_off"] = call(pa, "GET", cpath)

    # C-RP-42: the switch goes on; all three differ.
    call(pa, "PATCH", f"/api/v1/projects/{pid}/", {"review_burn_ins": True})
    flow["copies_switch_on"] = call(pa, "GET", cpath)
    flow["copies_by_artist"] = call(ar, "GET", cpath)

    # C-RP-41: the recent sequence is remade from its frames; the old one is refused.
    flow["remake_gone_400"] = call(pa, "POST", f"/api/v1/review-media/{gone}/remake/")
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_kept_202"] = call(pa, "POST", f"/api/v1/review-media/{kept}/remake/")
    remade = flow["remake_kept_202"]["body"]["id"]
    flow["version_sequence_remaking"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")
    process(remade)
    flow["version_sequence_remade"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")
    assert flow["version_sequence_remade"]["body"]["review_media"]["probe"]["burn_ins"] is True

    # C-RP-43: keep as they are; only copies that cannot be remade, by whoever may change the project.
    flow["keep_by_artist_403"] = call(ar, "POST", kpath, {"review_media_ids": [gone]})
    flow["keep_remakable_400"] = call(pa, "POST", kpath, {"review_media_ids": [movie]})
    flow["keep_empty_400"] = call(pa, "POST", kpath, {"review_media_ids": []})
    flow["keep_200"] = call(pa, "POST", kpath, {"review_media_ids": [gone]})
    flow["copies_after_keep"] = call(pa, "GET", cpath)

    # A later change of view counts the kept copy again (and the others, in colour).
    call(pa, "PATCH", f"/api/v1/projects/{pid}/", {"review_view": "Un-tone-mapped"})
    flow["copies_after_view_change"] = call(pa, "GET", cpath)
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_all_200"] = call(pa, "POST", f"/api/v1/projects/{pid}/review-copies/remake/")
    for row_id in queued[-flow["remake_all_200"]["body"]["queued"] :]:
        process(row_id)
    flow["copies_after_all"] = call(pa, "GET", cpath)

    flow["ids"] = {"project": pid, "gone": gone, "kept": kept, "movie": movie, "remade": remade,
                   "first": str(first.pk), "second": str(second.pk), "third": str(third.pk)}  # fmt: skip

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_review_sequence_copies_flow.json").write_text(
        json.dumps(flow, indent=2, sort_keys=True) + "\n"
    )
