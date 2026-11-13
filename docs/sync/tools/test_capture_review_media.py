"""
Review pipeline RP-5 sample capture: review media on a version (real responses, real ffmpeg).

C-RP-19 upload and list; C-RP-20 processing, failure and retry; C-RP-21 the version shape with
signed links and the stream route; C-RP-22 remove. Pytest test database only, inside a rolled-back
transaction; MEDIA_ROOT is a temporary folder. Needs ffmpeg that accepts ``-protocol_whitelist``.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_media.py
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
        # Signed links expire; a sample keeps their shape, not a working token.
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


@pytest.mark.django_db
def test_capture_review_media(
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
    queued: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: queued.append(str(media_id)))

    def call(client, method, path, data=None, params=None, multipart=False, raw=False):
        send = getattr(client, method.lower())
        if params is not None:
            resp = send(path, params)
        elif data is not None:
            resp = send(path, data=data, format="multipart" if multipart else "json")
        else:
            resp = send(path)
        if raw:
            body = {
                "_bytes": len(b"".join(resp.streaming_content) if resp.streaming else resp.content)
            }
        else:
            try:
                body = resp.json()
            except Exception:
                body = {"_non_json": resp.get("Content-Type"), "_len": len(resp.content)}
        names = (
            "Content-Type",
            "Content-Range",
            "Accept-Ranges",
            "Cache-Control",
            "Content-Security-Policy",
            "X-Content-Type-Options",
            "Allow",
        )
        headers = {h: resp.get(h) for h in names if resp.get(h)}
        shown = (
            {k: (v.name if hasattr(v, "name") else v) for k, v in (data or {}).items()}
            if data
            else data
        )
        return {
            "request": {"method": method, "path": clean(path), "body": shown, "params": params},
            "status": resp.status_code,
            "headers": headers,
            "body": clean(body),
        }

    def user(email, role=None):
        u = django_user_model.objects.create_user(email=email, password="RP5-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP5-Admin-Pass!9"
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
        {
            "code": "RPM",
            "name": "Review media",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )["id"]
    for who in (producer, artist):
        make(
            f"/api/organizations/projects/{pid}/members/",
            {"user_id": str(who.id), "role": "Artist"},
        )
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPM_SQ010", "name": "Opening"})
    shot = make(
        "/api/v1/shots/",
        {"project": pid, "sequence_id": seq["id"], "code": "RPM_SH0010", "name": "Hero walk"},
    )
    comp = make(
        "/api/v1/tasks/",
        {
            "project": pid,
            "shot": shot["id"],
            "title": "Comp",
            "code": "RPM_T_COMP",
            "department": "Comp",
            "status": "In Progress",
        },
    )
    project, shot_row, task_row = (
        Project.objects.get(pk=pid),
        Shot.objects.get(pk=shot["id"]),
        Task.objects.get(pk=comp["id"]),
    )
    version = VersionFactory.create(
        project=project,
        code="RPM_SH0010_COMP_V001",
        shot=shot_row,
        task=task_row,
        version_index=1,
        status="Pending Review",
        start_frame=1001,
        end_frame=1048,
        fps=24,
    )
    vid = str(version.pk)

    gen = tmp_path / "gen"
    gen.mkdir()
    clip = gen / "comp_v001.mov"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=24", "-frames:v", "48",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", str(clip)],
        check=True,
    )  # fmt: skip
    movie = clip.read_bytes()

    def upload(name, body):
        return SimpleUploadedFile(name, body)

    flow: dict = {}
    vpath, rmpath = f"/api/v1/versions/{vid}/", f"/api/v1/versions/{vid}/review-media/"
    flow["version_without_media"] = call(ar, "GET", vpath)

    # C-RP-19: refusals, then an upload.
    settings.REVIEW_MEDIA_ENABLED = False
    flow["upload_disabled_409"] = call(
        pa, "POST", rmpath, {"file": upload("comp_v001.mov", movie)}, multipart=True
    )
    settings.REVIEW_MEDIA_ENABLED = True
    flow["upload_by_artist_403"] = call(
        ar, "POST", rmpath, {"file": upload("comp_v001.mov", movie)}, multipart=True
    )
    flow["upload_exr_400"] = call(
        pa,
        "POST",
        rmpath,
        {"file": upload("plate.1001.exr", b"v/1\x01" + b"\x00" * 64)},
        multipart=True,
    )
    flow["upload_mismatch_400"] = call(
        pa,
        "POST",
        rmpath,
        {"file": upload("clip.mov", b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)},
        multipart=True,
    )
    with django_capture_on_commit_callbacks(execute=True):
        flow["upload_movie_202"] = call(
            pa, "POST", rmpath, {"file": upload("comp_v001.mov", movie)}, multipart=True
        )
    first = flow["upload_movie_202"]["body"]["id"]
    flow["upload_busy_409"] = call(
        pa, "POST", rmpath, {"file": upload("comp_v001.mov", movie)}, multipart=True
    )
    flow["version_with_queued_job"] = call(ar, "GET", vpath)

    # C-RP-20: the worker's job, as the media worker runs it.
    assert ReviewMediaService.process(first) == ReviewMedia.Status.READY
    flow["version_ready"] = call(ar, "GET", vpath)
    flow["versions_list"] = call(ar, "GET", "/api/v1/versions/", params={"project_id": pid})
    links = a.get(vpath).json()["review_media"]
    flow["stream_proxy"] = call(APIClient(), "GET", links["proxy_url"], raw=True)
    flow["stream_proxy_range"] = {
        "request": {
            "method": "GET",
            "path": "…/proxy/?token=SAMPLE",
            "headers": {"Range": "bytes=0-99"},
        }
    }
    ranged = APIClient().get(links["proxy_url"], HTTP_RANGE="bytes=0-99")
    flow["stream_proxy_range"].update(
        status=ranged.status_code,
        headers={
            h: ranged.get(h)
            for h in ("Content-Type", "Content-Range", "Content-Length")
            if ranged.get(h)
        },
    )
    flow["stream_thumbnail"] = call(APIClient(), "GET", links["thumbnail_url"], raw=True)
    flow["stream_bad_token_404"] = call(
        APIClient(), "GET", links["proxy_url"].split("?")[0] + "?token=forged"
    )

    # A second upload that fails (a movie's first bytes, then nothing a demuxer can read), and a retry.
    with django_capture_on_commit_callbacks(execute=True):
        flow["upload_broken_202"] = call(
            pa,
            "POST",
            rmpath,
            {"file": upload("comp_v002.mov", b"\x00\x00\x00\x18ftypqt  " + b"\x00" * 512)},
            multipart=True,
        )
    broken = flow["upload_broken_202"]["body"]["id"]
    assert ReviewMediaService.process(broken) == ReviewMedia.Status.FAILED
    flow["version_with_failed_job"] = call(ar, "GET", vpath)
    flow["retry_by_artist_403"] = call(ar, "POST", f"/api/v1/review-media/{broken}/retry/")
    with django_capture_on_commit_callbacks(execute=True):
        flow["retry_202"] = call(pa, "POST", f"/api/v1/review-media/{broken}/retry/")
    flow["retry_not_failed_400"] = call(pa, "POST", f"/api/v1/review-media/{broken}/retry/")
    ReviewMediaService.process(broken)
    flow["review_media_list"] = call(ar, "GET", rmpath)

    # C-RP-22: remove the ready movie.
    flow["remove_by_artist_403"] = call(ar, "DELETE", f"/api/v1/review-media/{first}/")
    with django_capture_on_commit_callbacks(execute=True):
        flow["remove_204"] = call(pa, "DELETE", f"/api/v1/review-media/{first}/")
    flow["remove_again_400"] = call(pa, "DELETE", f"/api/v1/review-media/{first}/")
    flow["version_after_remove"] = call(ar, "GET", vpath)

    # A still.
    png = gen / "frame.png"
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=2048x858",
            "-frames:v",
            "1",
            "-y",
            str(png),
        ],
        check=True,
    )
    with django_capture_on_commit_callbacks(execute=True):
        flow["upload_still_202"] = call(
            pa, "POST", rmpath, {"file": upload("frame.png", png.read_bytes())}, multipart=True
        )
    assert (
        ReviewMediaService.process(flow["upload_still_202"]["body"]["id"])
        == ReviewMedia.Status.READY
    )
    flow["version_with_still"] = call(ar, "GET", vpath)

    # RP-10, C-RP-26: the version's artist (seeded `artist` role: version view and create) uploads,
    # retries and removes on their own version; another artist on the project may not.
    colleague = user("colleague@example.test", "artist")
    make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(colleague.id), "role": "Artist"})
    own = VersionFactory.create(
        project=project, code="RPM_SH0010_COMP_V002", shot=shot_row, task=task_row, version_index=2,
        status="Pending Review", start_frame=1001, end_frame=1048, fps=24, artist=artist,
    )  # fmt: skip
    own_path, own_rm = f"/api/v1/versions/{own.pk}/", f"/api/v1/versions/{own.pk}/review-media/"
    flow["rp10_own_version"] = call(ar, "GET", own_path)
    flow["rp10_upload_by_colleague_403"] = call(
        client(colleague), "POST", own_rm, {"file": upload("comp_v002.mov", movie)}, multipart=True
    )
    with django_capture_on_commit_callbacks(execute=True):
        flow["rp10_upload_own_202"] = call(
            ar, "POST", own_rm, {"file": upload("comp_v002.mov", movie)}, multipart=True
        )
    own_movie = flow["rp10_upload_own_202"]["body"]["id"]
    assert ReviewMediaService.process(own_movie) == ReviewMedia.Status.READY
    flow["rp10_own_version_ready"] = call(ar, "GET", own_path)
    flow["rp10_remove_by_colleague_403"] = call(
        client(colleague), "DELETE", f"/api/v1/review-media/{own_movie}/"
    )
    with django_capture_on_commit_callbacks(execute=True):
        flow["rp10_remove_own_204"] = call(ar, "DELETE", f"/api/v1/review-media/{own_movie}/")
    flow["ids"] = {
        "project": pid,
        "shot": shot["id"],
        "task": comp["id"],
        "version": vid,
        "movie": first,
        "broken": broken,
        "artist": str(artist.id),
        "colleague": str(colleague.id),
        "own_version": str(own.pk),
    }
    flow["queued"] = len(queued)

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_review_media_flow.json").write_text(
        json.dumps(flow, indent=2, sort_keys=True) + "\n"
    )
