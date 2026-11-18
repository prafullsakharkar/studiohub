"""
Review pipeline RP-17 sample capture: review copies read from studio storage (real responses, real ffmpeg).

C-RP-44 a copy is made from a registered published file (``POST publishing/files/{id}/review-copy/``);
C-RP-45 the media worker reads it where it lies, through links it checks under the root's directory;
C-RP-46 such a copy is remade at any time, and revoking its file stops that. Pytest test database only,
inside a rolled-back transaction; MEDIA_ROOT and the studio root are temporary folders. Needs ffmpeg with
the EXR encoder and ``drawtext`` (Debian's, as in the worker image: ``/usr/bin/ffmpeg`` on this host) and a
DejaVu Sans font (``REVIEW_MEDIA_BURN_IN_FONT`` or one of the usual places).

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \\
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \\
      ../docs/sync/tools/test_capture_review_storage_copies.py
"""

from __future__ import annotations

import hashlib
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
PATTERN = "shots/sh010/comp/v001/rpt_sh010_comp_v001.%04d.exr"
MOVIE = "shots/sh020/comp/v001/rpt_sh020_comp_v001.mov"


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.mark.django_db
def test_capture_review_storage_copies(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Role, UserRole
    from apps.production.models import Project, ReviewMedia, Shot, Task
    from apps.production.services import review_media as service_module
    from apps.production.services.review_media import ReviewMediaService
    from apps.production.tests.factories import VersionFactory
    from apps.publishing.tasks.verify import sequence_digest

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
        u = django_user_model.objects.create_user(email=email, password="RP17-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP17-Admin-Pass!9"
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
            "code": "RPT",
            "name": "Storage copies",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )["id"]
    for who in (producer, artist):
        make(
            f"/api/organizations/projects/{pid}/members/",
            {"user_id": str(who.id), "role": "Artist"},
        )
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPT_SQ010", "name": "Opening"})
    project = Project.objects.get(pk=pid)
    for code in ("STUDIO", "ARCHIVE"):
        make(
            "/api/v1/publishing/storage-roots/",
            {"code": code, "name": code.title(), "linux_path": f"/mnt/{code.lower()}"},
        )

    def version(n):
        shot = make(
            "/api/v1/shots/",
            {"project": pid, "sequence_id": seq["id"], "code": f"RPT_SH0{n}0", "name": f"Shot {n}"},
        )
        task = make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"RPT_T_COMP{n}",
             "department": "Comp", "status": "In Progress"},
        )  # fmt: skip
        return VersionFactory.create(
            project=project, code=f"RPT_SH0{n}0_COMP_V001", shot=Shot.objects.get(pk=shot["id"]),
            task=Task.objects.get(pk=task["id"]), version_index=1, status="Approved",
            is_published=True, start_frame=1001, end_frame=1024, fps=24,
        )  # fmt: skip

    def ffmpeg(*args):
        subprocess.run([FFMPEG, "-v", "error", *args], check=True)  # noqa: S603 (fixed arguments)

    frames_dir = studio / Path(PATTERN).parent
    frames_dir.mkdir(parents=True)
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-frames:v", "2",
           "-pix_fmt", "gbrpf32le", "-start_number", "1001", str(studio / PATTERN))  # fmt: skip
    movie = studio / MOVIE
    movie.parent.mkdir(parents=True)
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-frames:v", "24",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "mov", str(movie))  # fmt: skip
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "elsewhere.mov").write_bytes(movie.read_bytes())
    linked = studio / "shots/sh030/comp/v001"
    linked.mkdir(parents=True)
    os.symlink(outside / "elsewhere.mov", linked / "rpt_sh030_comp_v001.mov")

    first, second, third = version(1), version(2), version(3)
    frames = [(Path(PATTERN.replace("%04d", str(n))).name, sha(studio / PATTERN.replace("%04d", str(n))))
              for n in (1001, 1002)]  # fmt: skip

    def register(v, path, **over):
        body = {"version_id": str(v.pk), "storage_root": "STUDIO", "relative_path": path,
                "size_bytes": 1024, "sha256": "0" * 64, **over}  # fmt: skip
        return make("/api/v1/publishing/files/", body)["id"]

    seq_file = register(first, PATTERN, frame_start=1001, frame_end=1002,
                        sha256=sequence_digest(frames), size_bytes=sum((studio / PATTERN.replace("%04d", str(n))).stat().st_size for n in (1001, 1002)))  # fmt: skip
    movie_file = register(second, MOVIE, sha256=sha(movie), size_bytes=movie.stat().st_size)
    sidecar = register(second, "shots/sh020/comp/v001/rpt_sh020_comp_v001.nk", role="sidecar")
    archived = register(second, "shots/sh020/comp/v001/rpt_sh020_plate.mov", storage_root="ARCHIVE")
    escaping = register(third, "shots/sh030/comp/v001/rpt_sh030_comp_v001.mov")

    def process(row_id, expect=ReviewMedia.Status.READY):
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == expect

    flow: dict = {}
    cpath = f"/api/v1/projects/{pid}/review-copies/"

    # C-RP-44: what each file says, and the version's files as the picker reads them.
    flow["file_sequence"] = call(ar, "GET", f"/api/v1/publishing/files/{seq_file}/")
    flow["files_of_version"] = call(ar, "GET", f"/api/v1/publishing/files/?version_id={second.pk}")
    flow["file_sidecar"] = call(ar, "GET", f"/api/v1/publishing/files/{sidecar}/")
    flow["file_root_not_read"] = call(ar, "GET", f"/api/v1/publishing/files/{archived}/")

    # C-RP-44, C-RP-45: a sequence and a movie read where they lie.
    with django_capture_on_commit_callbacks(execute=True):
        flow["copy_sequence_202"] = call(
            pa, "POST", f"/api/v1/publishing/files/{seq_file}/review-copy/", {}
        )
    flow["copy_busy_409"] = call(
        pa, "POST", f"/api/v1/publishing/files/{seq_file}/review-copy/", {}
    )
    process(flow["copy_sequence_202"]["body"]["id"])
    flow["version_from_sequence"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    assert not list((studio / Path(PATTERN).parent).glob("frame.*"))  # nothing written to the root
    flow["copy_by_artist_403"] = call(
        ar, "POST", f"/api/v1/publishing/files/{movie_file}/review-copy/", {}
    )
    flow["copy_sidecar_400"] = call(
        pa, "POST", f"/api/v1/publishing/files/{sidecar}/review-copy/", {}
    )
    flow["copy_root_not_read_400"] = call(
        pa, "POST", f"/api/v1/publishing/files/{archived}/review-copy/", {}
    )
    flow["copy_unknown_field_400"] = call(
        pa, "POST", f"/api/v1/publishing/files/{movie_file}/review-copy/", {"path": "/etc/passwd"}
    )
    with django_capture_on_commit_callbacks(execute=True):
        flow["copy_movie_202"] = call(
            pa, "POST", f"/api/v1/publishing/files/{movie_file}/review-copy/", {"color_space": ""}
        )
    process(flow["copy_movie_202"]["body"]["id"])
    flow["version_from_movie"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")

    # C-RP-45: a registered path that leads out of the root through a link is never read.
    with django_capture_on_commit_callbacks(execute=True):
        flow["copy_escaping_202"] = call(
            pa, "POST", f"/api/v1/publishing/files/{escaping}/review-copy/", {}
        )
    process(flow["copy_escaping_202"]["body"]["id"], expect=ReviewMedia.Status.FAILED)
    flow["version_escaping_failed"] = call(ar, "GET", f"/api/v1/versions/{third.pk}/")

    # C-RP-46: after a settings change, copies from storage are listed and remade by reading the files again.
    call(pa, "PATCH", f"/api/v1/projects/{pid}/", {"review_burn_ins": True})
    flow["copies_switch_on"] = call(pa, "GET", cpath)
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_all_200"] = call(pa, "POST", f"/api/v1/projects/{pid}/review-copies/remake/")
    for row_id in queued[-flow["remake_all_200"]["body"]["queued"] :]:
        process(row_id)
    flow["copies_after_remake"] = call(pa, "GET", cpath)

    # C-RP-46, Q-RP-81: revoking the sequence's file keeps its copy, which can no longer be remade.
    flow["revoke_200"] = call(
        a, "POST", f"/api/v1/publishing/files/{seq_file}/revoke/", {"reason": "Wrong plate"}
    )
    flow["version_after_revoke"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    ready = flow["version_after_revoke"]["body"]["review_media"]["id"]
    flow["remake_revoked_400"] = call(pa, "POST", f"/api/v1/review-media/{ready}/remake/")
    flow["copy_revoked_400"] = call(
        pa, "POST", f"/api/v1/publishing/files/{seq_file}/review-copy/", {}
    )
    call(pa, "PATCH", f"/api/v1/projects/{pid}/", {"review_burn_ins": False})
    flow["copies_after_revoke"] = call(pa, "GET", cpath)
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_after_revoke_200"] = call(
            pa, "POST", f"/api/v1/projects/{pid}/review-copies/remake/"
        )
    for row_id in queued[-flow["remake_after_revoke_200"]["body"]["queued"] :]:
        process(row_id)
    flow["keep_200"] = call(
        pa, "POST", f"/api/v1/projects/{pid}/review-copies/keep/", {"review_media_ids": [ready]}
    )
    flow["copies_after_keep"] = call(pa, "GET", cpath)

    flow["ids"] = {"project": pid, "sequence_file": seq_file, "movie_file": movie_file,
                   "sidecar": sidecar, "archived": archived, "escaping": escaping,
                   "first": str(first.pk), "second": str(second.pk), "third": str(third.pk)}  # fmt: skip
    text = json.dumps(flow, indent=2, sort_keys=True)
    assert str(tmp_path) not in text, "a server path reached a response"

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_review_storage_copies_flow.json").write_text(text + "\n")
