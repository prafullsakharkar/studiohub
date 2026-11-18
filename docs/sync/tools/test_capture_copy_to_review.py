"""
Review pipeline RP-19 sample capture: a copy ready to review (real responses, real ffmpeg).

C-RP-50: a render-farm account reads a version's render by path from the project's review folder
(RP-18); when the worker has made the copy, the farm account and the version's artist are told
``review_media_ready`` and the reviewer of the version's task ``review_media_to_review``. A remake
tells nobody; a failed copy tells the farm account and the artist, never the reviewer; an approved
version tells no reviewer. C-RP-51: the reviewer can mute the new kind. Pytest test database only,
inside a rolled-back transaction; MEDIA_ROOT and the studio root are temporary folders. Needs ffmpeg
(``/usr/bin/ffmpeg`` on this host) and a DejaVu Sans font.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \\
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \\
      ../docs/sync/tools/test_capture_copy_to_review.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from io import StringIO
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
FOLDER = "shows/rpr/renders"
MOVIE = "sh010/comp/v003/rpr_sh010_comp_v003.mov"
ESCAPING = "sh010/comp/v003/rpr_sh010_comp_v003_escaping.mov"


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


@pytest.mark.django_db
def test_capture_copy_to_review(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Role, UserRole
    from apps.production.models import Project, ReviewMedia, Shot, Task
    from apps.production.services import review_media as service_module
    from apps.production.services.review_media import ReviewMediaService
    from apps.production.tests.factories import VersionFactory

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=StringIO(), stderr=StringIO())
    studio = tmp_path / "studio"
    studio.mkdir()
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_FFMPEG = FFMPEG
    settings.REVIEW_MEDIA_FFPROBE = str(Path(FFMPEG).with_name("ffprobe"))
    settings.PUBLISHING_STORAGE_MOUNTS = {"STUDIO": str(studio)}
    font = os.environ.get("REVIEW_MEDIA_BURN_IN_FONT") or next(
        f for f in FONTS if Path(f).is_file()
    )
    settings.REVIEW_MEDIA_BURN_IN_FONT = font
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: None)
    monkeypatch.setattr(service_module, "discard_later", lambda folder: None)

    def call(client, method, path, data=None):
        send = getattr(client, method.lower())
        with django_capture_on_commit_callbacks(execute=True):
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

    def user(email, role):
        u = django_user_model.objects.create_user(email=email, password="RP19-Capture-Pass!9")
        UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP19-Admin-Pass!9"
    )
    producer = user("producer@example.test", "production-admin")
    artist = user("artist@example.test", "artist")
    supervisor = user("supervisor@example.test", "vfx-supervisor")
    # the render farm's account: a pipeline account with version.update (C-RP-26; RP-18, WP 18.6)
    farm = user("farm@example.test", "lead-artist")

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    a, pa, ar, sa, fa = (client(u) for u in (admin, producer, artist, supervisor, farm))

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    pid = make(
        "/api/v1/projects/",
        {"code": "RPR", "name": "Copy to review", "workflow_type": "standard",
         "type": "Feature Film"},
    )["id"]  # fmt: skip
    for who, role in ((producer, "Producer"), (artist, "Artist"), (supervisor, "Supervisor"),
                      (farm, "Artist")):  # fmt: skip
        make(f"/api/organizations/projects/{pid}/members/", {"user_id": str(who.id), "role": role})
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPR_SQ010", "name": "Opening"})
    project = Project.objects.get(pk=pid)
    assert pa.patch(
        f"/api/v1/projects/{pid}/",
        {"review_source_root": "STUDIO", "review_source_folder": FOLDER},
        format="json",
    ).status_code == 200  # fmt: skip

    flow: dict = {}

    def version(n, status="Pending Review"):
        shot = make(
            "/api/v1/shots/",
            {"project": pid, "sequence_id": seq["id"], "code": f"RPR_SH0{n}0", "name": f"Shot {n}"},
        )
        task = make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"RPR_T_COMP{n}",
             "department": "Comp", "status": "In Progress"},
        )  # fmt: skip
        return VersionFactory.create(
            project=project, code=f"RPR_SH0{n}0_COMP_V003", shot=Shot.objects.get(pk=shot["id"]),
            task=Task.objects.get(pk=task["id"]), version_index=3, status=status,
            is_published=False, start_frame=1001, end_frame=1024, fps=24, artist=artist,
        )  # fmt: skip

    def ffmpeg(*args):
        subprocess.run([FFMPEG, "-v", "error", *args], check=True)  # noqa: S603 (fixed arguments)

    renders = studio / FOLDER
    (renders / MOVIE).parent.mkdir(parents=True)
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-frames:v", "24",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "mov", str(renders / MOVIE))  # fmt: skip
    other = studio / "shows/other/renders/secret.mov"  # another show's render, reached by a link
    other.parent.mkdir(parents=True)
    other.write_bytes((renders / MOVIE).read_bytes())
    os.symlink(other, renders / ESCAPING)

    first, settled, muted = version(1), version(2, status="Approved"), version(3)

    # C-RP-50: the task's reviewer is set in the task form (an existing field).
    flow["task_reviewer_set_200"] = call(
        pa, "PATCH", f"/api/v1/tasks/{first.task_id}/", {"reviewer": str(supervisor.id)}
    )
    for v in (settled, muted):
        Task.objects.filter(pk=v.task_id).update(reviewer=supervisor)

    def process(row_id, expect=ReviewMedia.Status.READY):
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == expect

    def from_storage(v, path):
        return call(fa, "POST", f"/api/v1/versions/{v.pk}/review-media/from-storage/", {"path": path})

    # A ready copy: the farm account, the artist and the reviewer are each told once.
    flow["farm_copy_202"] = from_storage(first, MOVIE)
    assert flow["farm_copy_202"]["status"] == 202, flow["farm_copy_202"]
    process(flow["farm_copy_202"]["body"]["id"])
    # A remake that becomes ready tells nobody.
    flow["farm_remake_202"] = call(
        fa, "POST", f"/api/v1/review-media/{flow['farm_copy_202']['body']['id']}/remake/"
    )
    process(flow["farm_remake_202"]["body"]["id"])
    # A failed copy tells the farm account and the artist, never the reviewer.
    flow["farm_escaping_202"] = from_storage(first, ESCAPING)
    process(flow["farm_escaping_202"]["body"]["id"], expect=ReviewMedia.Status.FAILED)
    # An approved version tells no reviewer.
    flow["settled_copy_202"] = from_storage(settled, MOVIE)
    process(flow["settled_copy_202"]["body"]["id"])

    inbox = "/api/v1/notifications/"
    flow["farm_list"] = call(fa, "GET", inbox)
    flow["artist_list"] = call(ar, "GET", inbox)
    flow["supervisor_list"] = call(sa, "GET", inbox)
    flow["supervisor_to_review_only"] = call(sa, "GET", f"{inbox}?kind=review_media_to_review")

    # C-RP-51: the reviewer mutes the new kind; the next copy writes no row for them.
    prefs = "/api/v1/notifications/preferences/"
    flow["supervisor_preferences"] = call(sa, "GET", prefs)
    flow["supervisor_mute_200"] = call(sa, "PUT", prefs, {"muted_kinds": ["review_media_to_review"]})
    flow["muted_copy_202"] = from_storage(muted, MOVIE)
    process(flow["muted_copy_202"]["body"]["id"])
    flow["supervisor_list_after_mute"] = call(sa, "GET", inbox)
    flow["artist_list_after_mute"] = call(ar, "GET", inbox)

    for key, captured in flow.items():
        assert captured["status"] < 500, (key, captured)
    out = OUT / "notifications" / "_copy_to_review_flow.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(flow, indent=2, sort_keys=True, default=str) + "\n")
