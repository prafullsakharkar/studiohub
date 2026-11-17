"""
Review pipeline RP-15 sample capture: colour management for review copies (real responses, real
ffmpeg, the built-in ACES 2.0 OpenColorIO config).

C-RP-39 the colour options and a project's colour settings (known names stored in the config's
spelling, unknown ones refused); C-RP-40 an EXR sequence through the project's view, a movie that
names its colour space, the refusal of an unknown one, and the copies made with another view.
Pytest test database only, inside a rolled-back transaction; MEDIA_ROOT is a temporary folder.
Needs an ffmpeg that reads the baked LUT (Debian's or Ubuntu's; ``/usr/bin/ffmpeg``) with the EXR
encoder.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \\
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \\
      ../docs/sync/tools/test_capture_review_colour.py
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


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


@pytest.mark.django_db
def test_capture_review_colour(
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
    settings.REVIEW_MEDIA_OCIO_CONFIG = "ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6"
    settings.REVIEW_MEDIA_FFMPEG, settings.REVIEW_MEDIA_FFPROBE = "/usr/bin/ffmpeg", "/usr/bin/ffprobe"
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
        body = clean(body)
        if isinstance(body, dict) and isinstance(body.get("error"), dict):
            body["error"].pop("request_id", None)
        shown = None
        if data is not None:
            shown = {k: getattr(v, "name", v) for k, v in data.items()}
        return {
            "request": {"method": method, "path": clean(path), "body": shown, "params": None},
            "status": resp.status_code,
            "headers": {h: resp.get(h) for h in ("Content-Type",) if resp.get(h)},
            "body": body,
        }

    def user(email, role=None):
        u = django_user_model.objects.create_user(email=email, password="RP15-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP15-Admin-Pass!9"
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
        {"code": "RPC", "name": "Review colour", "workflow_type": "standard", "type": "Feature Film"},
    )["id"]
    for who in (producer, artist):
        make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": "Artist"})
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPC_SQ010", "name": "Opening"})
    project = Project.objects.get(pk=pid)

    def version(n):
        shot = make(
            "/api/v1/shots/",
            {"project": pid, "sequence_id": seq["id"], "code": f"RPC_SH00{n}0", "name": f"Shot {n}"},
        )
        task = make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"RPC_T_COMP{n}",
             "department": "Comp", "status": "In Progress"},
        )  # fmt: skip
        return VersionFactory.create(
            project=project, code=f"RPC_SH00{n}0_COMP_V001", shot=Shot.objects.get(pk=shot["id"]),
            task=Task.objects.get(pk=task["id"]), version_index=1, status="Pending Review",
            start_frame=1001, end_frame=1004, fps=24,
        )  # fmt: skip

    gen = tmp_path / "gen"
    gen.mkdir()
    ffmpeg = settings.REVIEW_MEDIA_FFMPEG
    subprocess.run(
        [ffmpeg, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "4", "-pix_fmt", "gbrpf32le", "-start_number", "1001",
         str(gen / "rpc_comp.%04d.exr")],
        check=True,
    )  # fmt: skip
    subprocess.run(
        [ffmpeg, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "24", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(gen / "log.mp4")],
        check=True,
    )  # fmt: skip

    flow: dict = {}
    ppath = f"/api/v1/projects/{pid}/"
    cpath = f"/api/v1/projects/{pid}/review-copies/"

    # C-RP-39: what may be chosen, and the project's settings.
    flow["colour_options"] = call(ar, "GET", "/api/v1/review-media/colour/")
    flow["project_default"] = call(pa, "GET", ppath)
    flow["project_bad_400"] = call(
        pa, "PATCH", ppath, {"color_space": "ACEScg 1.3", "review_view": "Cinema", "review_look": "Warm"}
    )
    flow["project_alias_200"] = call(pa, "PATCH", ppath, {"color_space": "lin_ap1"})

    # C-RP-40: an EXR sequence through the project's view.
    first, second, third = version(1), version(2), version(3)
    flow["sequence_bad_colour_400"] = call(
        pa, "POST", f"/api/v1/versions/{first.pk}/review-media/sequence/",
        {"name": "rpc_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1004,
         "color_space": "Kodak 2383"},
    )  # fmt: skip
    opened = call(
        pa, "POST", f"/api/v1/versions/{first.pk}/review-media/sequence/",
        {"name": "rpc_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1004},
    )  # fmt: skip
    sid = opened["body"]["id"]
    exr = [SimpleUploadedFile(p.name, p.read_bytes()) for p in sorted(gen.glob("*.exr"))]
    pa.post(f"/api/v1/review-media/{sid}/frames/", {"frames": exr}, format="multipart")
    with django_capture_on_commit_callbacks(execute=True):
        pa.post(f"/api/v1/review-media/{sid}/complete/")
        assert ReviewMediaService.process(sid) == ReviewMedia.Status.READY
    flow["version_sequence_ocio"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    assert flow["version_sequence_ocio"]["body"]["review_media"]["probe"]["colour"] == "ocio"

    # C-RP-40: a movie that names its colour space, and one that names an unknown one.
    movie = (gen / "log.mp4").read_bytes()
    flow["movie_bad_colour_400"] = call(
        pa, "POST", f"/api/v1/versions/{second.pk}/review-media/",
        {"file": SimpleUploadedFile("log.mp4", movie), "color_space": "Kodak 2383"}, multipart=True,
    )  # fmt: skip
    with django_capture_on_commit_callbacks(execute=True):
        flow["movie_named_202"] = call(
            pa, "POST", f"/api/v1/versions/{second.pk}/review-media/",
            {"file": SimpleUploadedFile("log.mp4", movie), "color_space": "acescct_ap1"},
            multipart=True,
        )  # fmt: skip
    named = flow["movie_named_202"]["body"]["id"]
    with django_capture_on_commit_callbacks(execute=True):
        assert ReviewMediaService.process(named) == ReviewMedia.Status.READY
    flow["version_movie_ocio"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")
    with django_capture_on_commit_callbacks(execute=True):
        plain = pa.post(
            f"/api/v1/versions/{third.pk}/review-media/",
            {"file": SimpleUploadedFile("plain.mp4", movie)},
            format="multipart",
        ).json()["id"]
    with django_capture_on_commit_callbacks(execute=True):
        assert ReviewMediaService.process(plain) == ReviewMedia.Status.READY
    flow["version_movie_as_stored"] = call(ar, "GET", f"/api/v1/versions/{third.pk}/")
    flow["copies_matching"] = call(pa, "GET", cpath)

    # Q-RP-72: another view; the sequence and the named movie differ, the plain movie does not.
    flow["project_view_200"] = call(
        pa, "PATCH", ppath, {"review_view": "un-tone-mapped", "review_look": ""}
    )
    flow["copies_other_view"] = call(pa, "GET", cpath)
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_all_200"] = call(pa, "POST", f"{cpath}remake/")
    for row_id in queued[-flow["remake_all_200"]["body"]["queued"] :]:
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == ReviewMedia.Status.READY
    flow["copies_after_remake"] = call(pa, "GET", cpath)
    flow["version_movie_remade"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")

    # The config cannot be read: the options say so; colour changes are refused.
    settings.REVIEW_MEDIA_OCIO_CONFIG = str(tmp_path / "missing" / "config.ocio")
    flow["colour_options_unavailable"] = call(ar, "GET", "/api/v1/review-media/colour/")
    flow["project_unavailable_400"] = call(pa, "PATCH", ppath, {"review_view": "Raw"})
    # ... and a copy is still made, by RP-12's rule, saying why its colour was not managed.
    fourth = version(4)
    opened = pa.post(
        f"/api/v1/versions/{fourth.pk}/review-media/sequence/",
        {"name": "rpc_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1004},
        format="json",
    ).json()
    exr = [SimpleUploadedFile(p.name, p.read_bytes()) for p in sorted(gen.glob("*.exr"))]
    pa.post(f"/api/v1/review-media/{opened['id']}/frames/", {"frames": exr}, format="multipart")
    with django_capture_on_commit_callbacks(execute=True):
        pa.post(f"/api/v1/review-media/{opened['id']}/complete/")
        assert ReviewMediaService.process(opened["id"]) == ReviewMedia.Status.READY
    flow["version_sequence_unmanaged"] = call(ar, "GET", f"/api/v1/versions/{fourth.pk}/")

    flow["ids"] = {"project": pid, "first": str(first.pk), "second": str(second.pk),
                   "third": str(third.pk), "sequence": sid, "named": named, "plain": plain}  # fmt: skip

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_review_colour_flow.json").write_text(
        json.dumps(flow, indent=2, sort_keys=True) + "\n"
    )
