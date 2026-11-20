"""
Review pipeline RP-25 sample capture: slates on downloaded copies (real responses, real ffmpeg).

C-RP-59: the project's ``review_slates`` (off by default) and ``review_slate_note`` (a line with quotes
and ``%`` kept as written; a line break, a tab and 121 characters refused); a movie with audio, a movie
without, an image sequence and a still made with the switch on; what each download holds (its frames,
its first frame black, two seconds in the copy's first frame) beside the copy that plays (unchanged);
the audit row's ``slate``. C-RP-60: a copy made with the switch off counts as differing (``slate``)
once it is on, and remaking it adds the slate. Built-in roles from ``init_platform``. Pytest test
database only, rolled back; MEDIA_ROOT is a temporary folder. Needs ffmpeg with the EXR encoder,
``drawtext`` and ``anullsrc`` (``/usr/bin/ffmpeg`` on this host) and a DejaVu Sans font.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \
      ../docs/sync/tools/test_capture_review_slates.py
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
FFMPEG = os.environ.get("REVIEW_MEDIA_FFMPEG", "/usr/bin/ffmpeg")
FFPROBE = str(Path(FFMPEG).with_name("ffprobe"))
NOTE = 'Confidential: 100% "internal" -- do not forward'


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


def facts(path: Path, tmp: Path) -> dict:
    """What a file holds: video frames, duration, audio, the first frame's and the 2 s frame's brightness."""
    streams = json.loads(
        subprocess.run(
            [FFPROBE, "-v", "error", "-count_packets", "-show_streams", "-show_format", "-of", "json", str(path)],
            capture_output=True, text=True, check=True,
        ).stdout
    )  # fmt: skip

    def mean(at: float) -> float:
        out = tmp / f"{path.parent.name}-{path.stem}-{at}.gray"
        subprocess.run(
            [FFMPEG, "-v", "error", "-ss", f"{at}", "-i", str(path), "-frames:v", "1",
             "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-y", str(out)],
            check=True,
        )  # fmt: skip
        data = out.read_bytes()
        return round(sum(data) / len(data), 1)

    video = next(s for s in streams["streams"] if s["codec_type"] == "video")
    duration = round(float(streams["format"]["duration"]), 2)
    return {
        "frames": int(video["nb_read_packets"]),
        "rate": video["avg_frame_rate"],
        "size": [video["width"], video["height"]],
        "duration_seconds": duration,
        "audio": any(s["codec_type"] == "audio" for s in streams["streams"]),
        "first_frame_brightness": mean(0.0),
        # two seconds in: the copy's first frame in a slated download; none in a file that ends sooner
        "brightness_at_2s": mean(2.0) if duration > 2.1 else None,
    }


@pytest.mark.django_db
def test_capture_review_slates(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Profile, Role, UserRole
    from apps.production.models import ProjectMembership, ReviewMedia
    from apps.production.services import review_media as service_module
    from apps.production.services import review_media_links
    from apps.production.services.review_media import ReviewMediaService

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    devnull = open(os.devnull, "w")  # noqa: SIM115
    call_command("init_platform", stdout=devnull, stderr=devnull)
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_FFMPEG, settings.REVIEW_MEDIA_FFPROBE = FFMPEG, FFPROBE
    settings.REVIEW_MEDIA_BURN_IN_FONT = os.environ.get("REVIEW_MEDIA_BURN_IN_FONT") or next(
        f for f in FONTS if Path(f).is_file()
    )
    queued: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: queued.append(str(media_id)))
    monkeypatch.setattr(service_module, "discard_later", lambda folder: None)
    root = Path(settings.MEDIA_ROOT)

    def call(client, method, path, data=None):
        send = getattr(client, method.lower())
        resp = send(path, data=data, format="json") if data is not None else send(path)
        return {
            "request": {"method": method, "path": path, "body": data},
            "status": resp.status_code,
            "body": clean(resp.json()),
        }

    def fetch(path):
        resp = APIClient().get(path)
        body = b"".join(resp.streaming_content) if resp.streaming else resp.content
        return {
            "request": {"method": "GET", "path": TOKEN.sub("token=SAMPLE", path)},
            "status": resp.status_code,
            "headers": {
                name: resp[name] for name in ("Content-Type", "Content-Disposition") if name in resp
            },
            "bytes": len(body),
        }

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP25-Admin-Pass!9"
    )
    supervisor = django_user_model.objects.create_user(
        email="supervisor@example.test", password="RP25-Pass-Word!9"
    )
    Profile.objects.update_or_create(
        user=supervisor,
        defaults={
            "first_name": "Supervisor",
            "last_name": "Example",
            "display_name": "Sam Supervisor",
        },
    )
    UserRole.objects.create(user=supervisor, role=Role.objects.get(code="vfx-supervisor"))
    a, sup = APIClient(), APIClient()
    a.force_authenticate(user=admin)
    sup.force_authenticate(user=supervisor)

    def make(path, body, fmt="json"):
        resp = a.post(path, body, format=fmt)
        assert resp.status_code in (200, 201, 202), (path, resp.status_code, resp.content[:300])
        return resp.json()

    project = make(
        "/api/v1/projects/",
        {
            "code": "RSL",
            "name": "Review slates",
            "workflow_type": "standard",
            "type": "Feature Film",
        },
    )
    pid = project["id"]
    p = f"/api/v1/projects/{pid}/"
    ProjectMembership.objects.create(
        user=supervisor, project_id=pid, status="active", role="VFX Supervisor"
    )
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RSL_SQ010", "name": "Opening"})
    shot = make(
        "/api/v1/shots/",
        {"project": pid, "sequence_id": seq["id"], "code": "RSL_SH0010", "name": "Hero walk"},
    )
    task = make(
        "/api/v1/tasks/",
        {"project": pid, "entity_type": "Shot", "entity_id": shot["id"], "code": "RSL_SH0010_COMP",
         "title": "Comp", "shot": shot["id"]},
    )  # fmt: skip

    def version(code):
        return make(
            "/api/v1/versions/",
            {"project": pid, "shot": shot["id"], "task": task["id"], "code": code,
             "artist": str(supervisor.pk), "start_frame": 1001},
        )  # fmt: skip

    gen = tmp_path / "gen"
    gen.mkdir()

    def clip(name, audio):
        out = gen / name
        args = [FFMPEG, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24"]
        if audio:
            args += [
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:sample_rate=48000",
                "-shortest",
                "-c:a",
                "aac",
            ]
        subprocess.run(
            [*args, "-frames:v", "48", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", str(out)],
            check=True,
        )
        return out

    with_audio, silent = clip("comp_v001.mov", True), clip("comp_v002.mov", False)
    subprocess.run(
        [FFMPEG, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-frames:v", "1",
         "-y", str(gen / "frame_v001.png")],
        check=True,
    )  # fmt: skip
    subprocess.run(
        [FFMPEG, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "12", "-pix_fmt", "gbrpf32le", "-start_number", "1001",
         str(gen / "rsl_comp.%04d.exr")],
        check=True,
    )  # fmt: skip

    def process(row_id):
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == ReviewMedia.Status.READY

    def upload(v, path):
        with django_capture_on_commit_callbacks(execute=True):
            made = make(
                f"/api/v1/versions/{v['id']}/review-media/",
                {"file": SimpleUploadedFile(path.name, path.read_bytes())},
                fmt="multipart",
            )
        process(made["id"])
        return made["id"]

    def upload_sequence(v):
        sid = make(
            f"/api/v1/versions/{v['id']}/review-media/sequence/",
            {"name": "rsl_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1012},
        )["id"]
        exr = [SimpleUploadedFile(f.name, f.read_bytes()) for f in sorted(gen.glob("*.exr"))]
        a.post(f"/api/v1/review-media/{sid}/frames/", {"frames": exr}, format="multipart")
        with django_capture_on_commit_callbacks(execute=True):
            a.post(f"/api/v1/review-media/{sid}/complete/")
        process(sid)
        return sid

    def files(media_id):
        row = ReviewMedia.objects.get(pk=media_id)
        return {
            "copy": facts(root / row.proxy_path, tmp_path),
            "download": facts(root / review_media_links.download_path(row), tmp_path),
        }

    flow: dict = {}
    cpath = f"{p}review-copies/"

    # C-RP-59: off by default; a copy made now has no slate.
    flow["project_default"] = call(a, "GET", p)
    old = version("RSL_SH0010_COMP_V001")
    old_id = upload(old, with_audio)
    flow["version_without_slate"] = call(sup, "GET", f"/api/v1/versions/{old['id']}/")
    flow["files_without_slate"] = files(old_id)

    # the line: quotes and % kept as written; a line break, a tab and 121 characters refused
    flow["project_slates_on_200"] = call(
        a, "PATCH", p, {"review_slates": True, "review_slate_note": NOTE}
    )
    flow["project_note_newline_400"] = call(a, "PATCH", p, {"review_slate_note": "one\ntwo"})
    flow["project_note_tab_400"] = call(a, "PATCH", p, {"review_slate_note": "one\ttwo"})
    flow["project_note_too_long_400"] = call(a, "PATCH", p, {"review_slate_note": "x" * 121})

    # C-RP-60: the copy made without counts as differing, and is remade with the slate.
    flow["copies_differing_slate"] = call(a, "GET", cpath)
    flow["copies_remake"] = call(a, "POST", f"{cpath}remake/")
    remade = ReviewMedia.objects.filter(
        version_id=old["id"], status=ReviewMedia.Status.QUEUED
    ).get()
    process(remade.pk)
    flow["copies_after_remake"] = call(a, "GET", cpath)
    flow["version_remade_with_slate"] = call(sup, "GET", f"/api/v1/versions/{old['id']}/")
    flow["files_remade"] = files(remade.pk)

    # movies with and without audio, a sequence and a still, made with the switch on
    silent_v, seq_v, still_v = (
        version("RSL_SH0010_COMP_V002"),
        version("RSL_SH0010_COMP_V003"),
        version("RSL_SH0010_FRAME_V001"),
    )
    silent_id = upload(silent_v, silent)
    seq_id = upload_sequence(seq_v)
    upload(still_v, gen / "frame_v001.png")
    flow["version_silent_with_slate"] = call(sup, "GET", f"/api/v1/versions/{silent_v['id']}/")
    flow["files_silent"] = files(silent_id)
    flow["version_sequence_with_slate"] = call(sup, "GET", f"/api/v1/versions/{seq_v['id']}/")
    flow["files_sequence"] = files(seq_id)
    flow["version_still"] = call(sup, "GET", f"/api/v1/versions/{still_v['id']}/")

    # C-RP-59: the download is the slated file, playback the copy; the audit row says which.
    links = sup.get(f"/api/v1/versions/{old['id']}/").json()["review_media"]
    flow["download_with_slate"] = fetch(links["download_url"])
    flow["play_copy"] = fetch(links["proxy_url"])
    flow["audit_of_download"] = call(a, "GET", f"/api/v1/audit/?search={old['id']}&action=EXPORT")

    # turning it off makes the slated copies differ the other way; the line alone never does
    flow["project_note_only_200"] = call(a, "PATCH", p, {"review_slate_note": "Another line"})
    flow["copies_after_note_only"] = call(a, "GET", cpath)
    flow["project_slates_off_200"] = call(a, "PATCH", p, {"review_slates": False})
    flow["copies_after_off"] = call(a, "GET", cpath)

    expected_400 = {"project_note_newline_400", "project_note_tab_400", "project_note_too_long_400"}
    for name, entry in flow.items():
        if "status" in entry:
            want = 400 if name in expected_400 else 200
            assert entry["status"] == want, (name, entry["status"], entry.get("body"))
    assert flow["project_default"]["body"]["review_slates"] is False
    assert flow["project_default"]["body"]["review_slate_note"] == ""
    assert flow["project_slates_on_200"]["body"]["review_slate_note"] == NOTE
    assert flow["files_without_slate"]["download"] == flow["files_without_slate"]["copy"]
    assert [r["why"] for r in flow["copies_differing_slate"]["body"]["differing"]] == [["slate"]]
    assert flow["copies_after_remake"]["body"]["slate_out_of_date"] == 0
    for name, copy_frames, audio in (
        ("files_remade", 48, True),
        ("files_silent", 48, False),
        ("files_sequence", 12, False),
    ):
        made = flow[name]
        assert made["copy"]["frames"] == copy_frames, name
        assert made["download"]["frames"] == copy_frames + 48, name
        assert made["download"]["audio"] is audio and made["copy"]["audio"] is audio, name
        assert (
            made["download"]["first_frame_brightness"] < 30 < made["copy"]["first_frame_brightness"]
        ), name
        assert (
            abs(made["download"]["brightness_at_2s"] - made["copy"]["first_frame_brightness"]) < 8
        ), name
    assert flow["version_still"]["body"]["review_media"]["probe"]["slate"] is False
    assert flow["download_with_slate"]["bytes"] > flow["play_copy"]["bytes"]
    audit = flow["audit_of_download"]["body"]["results"]
    assert (
        len(audit) == 1 and audit[0]["changes_diff"]["slate"] is True
    )  # the list shows metadata as changes_diff
    assert flow["copies_after_note_only"]["body"]["slate_out_of_date"] == 0
    assert flow["copies_after_off"]["body"]["slate_out_of_date"] == 3

    (OUT / "production").mkdir(parents=True, exist_ok=True)
    (OUT / "production" / "_review_slates_flow.json").write_text(
        json.dumps(flow, indent=1, sort_keys=True) + "\n"
    )
