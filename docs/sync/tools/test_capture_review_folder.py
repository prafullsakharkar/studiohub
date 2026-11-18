"""
Review pipeline RP-18 sample capture: review copies before approval, read by path from the project's
review folder (real responses, real ffmpeg).

C-RP-47 a project names one storage root and one folder on it, read and written with ``project.update``;
C-RP-48 a version still in review has its copy made from a render named relative to that folder
(``POST versions/{id}/review-media/from-storage/``), which the worker reads under the folder as it is then;
C-RP-49 the copy is remade while the render is still in the folder. Pytest test database only, inside a
rolled-back transaction; MEDIA_ROOT and the studio root are temporary folders. Needs ffmpeg with the EXR
encoder and ``drawtext`` (``/usr/bin/ffmpeg`` on this host) and a DejaVu Sans font.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \\
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \\
      ../docs/sync/tools/test_capture_review_folder.py
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
FOLDER = "shows/rpf/renders"
PATTERN = "sh010/comp/v003/rpf_sh010_comp_v003.%04d.exr"
MOVIE = "sh020/comp/v002/rpf_sh020_comp_v002.mov"
ESCAPING = "sh030/comp/v001/rpf_sh030_comp_v001.mov"


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


@pytest.mark.django_db
def test_capture_review_folder(
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
        u = django_user_model.objects.create_user(email=email, password="RP18-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP18-Admin-Pass!9"
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
            "code": "RPF",
            "name": "Review folder",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )["id"]
    for who in (producer, artist):
        make(
            f"/api/organizations/projects/{pid}/members/",
            {"user_id": str(who.id), "role": "Artist"},
        )
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPF_SQ010", "name": "Opening"})
    project = Project.objects.get(pk=pid)

    def version(n):
        shot = make(
            "/api/v1/shots/",
            {"project": pid, "sequence_id": seq["id"], "code": f"RPF_SH0{n}0", "name": f"Shot {n}"},
        )
        task = make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"RPF_T_COMP{n}",
             "department": "Comp", "status": "In Progress"},
        )  # fmt: skip
        return VersionFactory.create(
            project=project, code=f"RPF_SH0{n}0_COMP_V003", shot=Shot.objects.get(pk=shot["id"]),
            task=Task.objects.get(pk=task["id"]), version_index=3, status="Pending Review",
            is_published=False, start_frame=1001, end_frame=1002, fps=24, artist=artist,
        )  # fmt: skip

    def ffmpeg(*args):
        subprocess.run([FFMPEG, "-v", "error", *args], check=True)  # noqa: S603 (fixed arguments)

    renders = studio / FOLDER
    (renders / PATTERN).parent.mkdir(parents=True)
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-frames:v", "2",
           "-pix_fmt", "gbrpf32le", "-start_number", "1001", str(renders / PATTERN))  # fmt: skip
    (renders / MOVIE).parent.mkdir(parents=True)
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-frames:v", "24",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-f", "mov", str(renders / MOVIE))  # fmt: skip
    # another show's render, on the same root but outside this project's folder, reached by a link
    other = studio / "shows/other/renders/secret.mov"
    other.parent.mkdir(parents=True)
    other.write_bytes((renders / MOVIE).read_bytes())
    (renders / ESCAPING).parent.mkdir(parents=True)
    os.symlink(other, renders / ESCAPING)

    first, second, third = version(1), version(2), version(3)

    def process(row_id, expect=ReviewMedia.Status.READY):
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == expect

    flow: dict = {}
    ppath = f"/api/v1/projects/{pid}/"
    cpath = f"/api/v1/projects/{pid}/review-copies/"

    def from_storage(client_, v, body):
        return call(client_, "POST", f"/api/v1/versions/{v.pk}/review-media/from-storage/", body)

    # C-RP-48: without a folder there is nothing to read from.
    flow["from_storage_no_folder_400"] = from_storage(ar, first, {"path": MOVIE})

    # C-RP-47: the folder, set and read by those who may change the project; refusals on its fields.
    flow["folder_unlisted_root_400"] = call(
        pa, "PATCH", ppath, {"review_source_root": "ARCHIVE", "review_source_folder": FOLDER}
    )
    flow["folder_unsafe_400"] = call(
        pa, "PATCH", ppath, {"review_source_root": "STUDIO", "review_source_folder": "shows/../x"}
    )
    flow["folder_set_200"] = call(
        pa, "PATCH", ppath, {"review_source_root": "studio", "review_source_folder": f"/{FOLDER}/"}
    )
    flow["project_as_producer"] = call(pa, "GET", ppath)
    flow["project_as_artist"] = call(ar, "GET", ppath)

    # C-RP-48: a sequence and a movie of versions still in review, read by path by their artist.
    with django_capture_on_commit_callbacks(execute=True):
        flow["from_storage_sequence_202"] = from_storage(
            ar, first, {"path": PATTERN, "first_frame": 1001, "last_frame": 1002}
        )
    flow["from_storage_busy_409"] = from_storage(ar, first, {"path": MOVIE})
    process(flow["from_storage_sequence_202"]["body"]["id"])
    flow["version_from_path"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    flow["review_media_list"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/review-media/")
    assert not list((renders / PATTERN).parent.glob("frame.*"))  # nothing written to the root
    flow["from_storage_pattern_no_range_400"] = from_storage(ar, second, {"path": PATTERN})
    flow["from_storage_range_on_movie_400"] = from_storage(
        ar, second, {"path": MOVIE, "first_frame": 1, "last_frame": 2}
    )
    flow["from_storage_leaves_folder_400"] = from_storage(ar, second, {"path": "../other/x.mov"})
    flow["from_storage_not_media_400"] = from_storage(ar, second, {"path": "sh020/notes.txt"})
    flow["from_storage_unknown_field_400"] = from_storage(
        ar, second, {"path": MOVIE, "storage_root": "ARCHIVE"}
    )
    with django_capture_on_commit_callbacks(execute=True):
        flow["from_storage_movie_202"] = from_storage(
            ar, second, {"path": MOVIE, "color_space": ""}
        )
    process(flow["from_storage_movie_202"]["body"]["id"])
    flow["version_from_movie"] = call(ar, "GET", f"/api/v1/versions/{second.pk}/")

    # C-RP-48: a link that leaves the folder is never read, even on the same root.
    with django_capture_on_commit_callbacks(execute=True):
        flow["from_storage_escaping_202"] = from_storage(ar, third, {"path": ESCAPING})
    process(flow["from_storage_escaping_202"]["body"]["id"], expect=ReviewMedia.Status.FAILED)
    flow["version_escaping_failed"] = call(ar, "GET", f"/api/v1/versions/{third.pk}/")

    # C-RP-49: after a settings change, path copies are listed and remade by reading the renders again.
    call(pa, "PATCH", ppath, {"review_burn_ins": True})
    flow["copies_switch_on"] = call(pa, "GET", cpath)
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_all_200"] = call(pa, "POST", f"/api/v1/projects/{pid}/review-copies/remake/")
    for row_id in queued[-flow["remake_all_200"]["body"]["queued"] :]:
        process(row_id)

    # C-RP-49: once the folder moves, the older copies stay but can no longer be remade.
    flow["folder_moved_200"] = call(
        pa,
        "PATCH",
        ppath,
        {"review_source_folder": "shows/rpf/renders_v2", "review_burn_ins": False},
    )
    flow["version_after_move"] = call(ar, "GET", f"/api/v1/versions/{first.pk}/")
    ready = flow["version_after_move"]["body"]["review_media"]["id"]
    flow["remake_moved_400"] = call(ar, "POST", f"/api/v1/review-media/{ready}/remake/")
    flow["copies_after_move"] = call(pa, "GET", cpath)
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_after_move_200"] = call(
            pa, "POST", f"/api/v1/projects/{pid}/review-copies/remake/"
        )
    flow["folder_cleared_200"] = call(
        pa, "PATCH", ppath, {"review_source_root": "", "review_source_folder": ""}
    )

    flow["ids"] = {"project": pid, "first": str(first.pk), "second": str(second.pk),
                   "third": str(third.pk)}  # fmt: skip
    text = json.dumps(flow, indent=2, sort_keys=True)
    assert str(tmp_path) not in text, "a server path reached a response"
    assert "secret" not in text, "a path outside the folder reached a response"

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_review_folder_flow.json").write_text(text + "\n")
