"""
Review pipeline RP-20 sample capture: per-shot grades on review copies (real responses, real ffmpeg,
the pinned ACES 2.0 OpenColorIO config).

C-RP-52 a shot's grade typed and refused; C-RP-54 a client's ``.ccc`` file read as a dry run, applied,
read again (unchanged), and the refusals (a document type, another kind of file, no ``shot.update``);
C-RP-53 the project's switch, an EXR sequence made with its shot's grade, a display-ready movie never
graded, a changed grade counted and remade, a config without a grading space. C-RP-55 (RP-22) a cut's
EDL (a dry run and applied: names in turn, a shot twice with one grade, a shot with two grades, two
names for two shots, ungraded events) and a dailies ALE, and their refusals. Pytest test database
only, inside a rolled-back transaction; MEDIA_ROOT is a temporary folder. Needs an ffmpeg that reads
the baked LUT (Debian's or Ubuntu's; ``/usr/bin/ffmpeg``) with the EXR encoder.

    cd backend
    SYNC_SAMPLES_OUT=../docs/sync/samples \\
      uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q \\
      ../docs/sync/tools/test_capture_shot_grades.py
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
NS = "urn:ASC:CDL:v1.2"


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, str):
        return TOKEN.sub("token=SAMPLE", EMAIL.sub("user@example.test", v))
    return v


def cc(cc_id: str, slope: str, offset: str, power: str, sat: str) -> str:
    return (
        f'<ColorCorrection id="{cc_id}"><SOPNode><Slope>{slope}</Slope><Offset>{offset}</Offset>'
        f"<Power>{power}</Power></SOPNode><SatNode><Saturation>{sat}</Saturation></SatNode>"
        "</ColorCorrection>"
    )


def ccc(*corrections: str) -> bytes:
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n<ColorCorrectionCollection xmlns="{NS}">'
        + "".join(corrections)
        + "</ColorCorrectionCollection>\n"
    ).encode()


@pytest.mark.django_db
def test_capture_shot_grades(
    django_user_model, settings, tmp_path, django_capture_on_commit_callbacks, monkeypatch
):
    import PyOpenColorIO as OCIO
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.core.management import call_command
    from django.db import connection

    from apps.identity.models import Role, UserRole
    from apps.production.models import Project, ReviewMedia, Shot, Task
    from apps.production.services import review_media as service_module
    from apps.production.services.review_media import ReviewMediaService
    from apps.production.tests.factories import VersionFactory
    from apps.production.transcode import colour

    assert connection.settings_dict["NAME"].startswith("test_"), "refusing: not a test database"
    call_command("init_platform", stdout=open(os.devnull, "w"), stderr=open(os.devnull, "w"))
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_OCIO_CONFIG = "ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6"
    settings.REVIEW_MEDIA_FFMPEG, settings.REVIEW_MEDIA_FFPROBE = (
        "/usr/bin/ffmpeg",
        "/usr/bin/ffprobe",
    )
    settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 14
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
        u = django_user_model.objects.create_user(email=email, password="RP20-Capture-Pass!9")
        if role:
            UserRole.objects.create(user=u, role=Role.objects.get(code=role))
        return u

    admin = django_user_model.objects.create_superuser(
        email="root@example.test", password="RP20-Admin-Pass!9"
    )
    producer = user("producer@example.test", "production-admin")
    viewer = user("artist@example.test", "artist")  # shot.view only

    def client(u):
        api = APIClient()
        api.force_authenticate(user=u)
        return api

    a, pa, vw = client(admin), client(producer), client(viewer)

    def make(path, body):
        resp = a.post(path, body, format="json")
        assert resp.status_code in (200, 201), (path, resp.status_code, resp.content[:300])
        return resp.json()

    pid = make(
        "/api/v1/projects/",
        {"code": "RPG", "name": "Shot grades", "workflow_type": "standard", "type": "Feature Film"},
    )["id"]
    for who in (producer, viewer):
        make(
            f"/api/organizations/projects/{pid}/members/",
            {"user_id": str(who.id), "role": "Artist"},
        )
    seq = make("/api/v1/sequences/", {"project": pid, "code": "RPG_SQ010", "name": "Opening"})
    project = Project.objects.get(pk=pid)
    shots = {}

    def version(n):
        shot = make(
            "/api/v1/shots/",
            {
                "project": pid,
                "sequence_id": seq["id"],
                "code": f"RPG_SH00{n}0",
                "name": f"Shot {n}",
            },
        )
        shots[n] = shot["id"]
        task = make(
            "/api/v1/tasks/",
            {"project": pid, "shot": shot["id"], "title": "Comp", "code": f"RPG_T_COMP{n}",
             "department": "Comp", "status": "In Progress"},
        )  # fmt: skip
        return VersionFactory.create(
            project=project, code=f"RPG_SH00{n}0_COMP_V001", shot=Shot.objects.get(pk=shot["id"]),
            task=Task.objects.get(pk=task["id"]), version_index=1, status="Pending Review",
            start_frame=1001, end_frame=1004, fps=24,
        )  # fmt: skip

    gen = tmp_path / "gen"
    gen.mkdir()
    ffmpeg = settings.REVIEW_MEDIA_FFMPEG
    subprocess.run(
        [ffmpeg, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "4", "-pix_fmt", "gbrpf32le", "-start_number", "1001",
         str(gen / "rpg_comp.%04d.exr")],
        check=True,
    )  # fmt: skip
    subprocess.run(
        [ffmpeg, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24",
         "-frames:v", "24", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(gen / "graded.mp4")],
        check=True,
    )  # fmt: skip

    def sequence(v):
        opened = pa.post(
            f"/api/v1/versions/{v.pk}/review-media/sequence/",
            {"name": "rpg_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1004},
            format="json",
        ).json()
        exr = [SimpleUploadedFile(p.name, p.read_bytes()) for p in sorted(gen.glob("*.exr"))]
        pa.post(f"/api/v1/review-media/{opened['id']}/frames/", {"frames": exr}, format="multipart")
        with django_capture_on_commit_callbacks(execute=True):
            pa.post(f"/api/v1/review-media/{opened['id']}/complete/")
            assert ReviewMediaService.process(opened["id"]) == ReviewMedia.Status.READY
        return opened["id"]

    flow: dict = {}
    ppath = f"/api/v1/projects/{pid}/"
    cpath = f"/api/v1/projects/{pid}/review-copies/"
    ipath = f"/api/v1/projects/{pid}/grades/import/"
    first, second, third = version(1), version(2), version(3)

    # C-RP-52: a grade typed on the shot, and refused.
    flow["project_default"] = call(pa, "GET", ppath)
    flow["shot_no_grade"] = call(pa, "GET", f"/api/v1/shots/{shots[3]}/")
    flow["shot_grade_200"] = call(
        pa, "PATCH", f"/api/v1/shots/{shots[3]}/",
        {"grade": {"slope": [0.95, 1, 1.08], "offset": [0, 0, 0.005], "power": [1, 1, 1],
                   "saturation": 1.1}},
    )  # fmt: skip
    # the update answers its own shape; the shot's read shape has the source and the date
    flow["shot_typed"] = call(pa, "GET", f"/api/v1/shots/{shots[3]}/")
    flow["shot_grade_bad_400"] = call(
        pa, "PATCH", f"/api/v1/shots/{shots[3]}/",
        {"grade": {"slope": [1, 1], "offset": [0, 0, 0], "power": [0, 1, 1], "saturation": 1}},
    )  # fmt: skip

    # C-RP-54: the client's collection, read as a dry run, applied, and read again.
    reel = ccc(
        cc("SH0010", "1.1 1.0 0.9", "0.01 0.0 -0.01", "1.0 1.0 1.05", "0.9"),
        cc("RPG_SH0020", "1.0 1.0 1.0", "0.0 0.0 0.0", "1.0 1.0 1.0", "0.8"),
        cc("SH0030", "0.95 1 1.08", "0 0 0.005", "1 1 1", "1.1"),
        cc("SH9990", "1 1 1", "0 0 0", "1 1 1", "1"),
        cc("RPG_SH0040", "1 1 1", "0 0 0", "1 1 1", "12"),
    )

    def upload(data, name="reel1.ccc", dry_run=None):
        body = {"file": SimpleUploadedFile(name, data)}
        if dry_run is not None:
            body["dry_run"] = "true" if dry_run else "false"
        return body

    flow["import_dry_run_200"] = call(pa, "POST", ipath, upload(reel), multipart=True)
    flow["import_apply_200"] = call(pa, "POST", ipath, upload(reel, dry_run=False), multipart=True)
    flow["import_again_200"] = call(pa, "POST", ipath, upload(reel), multipart=True)
    flow["import_doctype_400"] = call(
        pa, "POST", ipath,
        upload(b'<!DOCTYPE x [<!ENTITY a "a">]><ColorCorrection id="&a;"/>', "evil.cc"),
        multipart=True,
    )  # fmt: skip
    flow["import_other_file_400"] = call(
        pa, "POST", ipath, upload(reel, "reel1.xml"), multipart=True
    )
    flow["import_artist_403"] = call(vw, "POST", ipath, upload(reel), multipart=True)
    flow["shot_imported"] = call(pa, "GET", f"/api/v1/shots/{shots[1]}/")
    assert flow["import_apply_200"]["body"]["applied"] == 2

    # C-RP-53: the switch, then a graded EXR sequence; a display-ready movie is never graded.
    flow["copies_switch_off"] = call(pa, "GET", cpath)
    flow["project_switch_on_200"] = call(pa, "PATCH", ppath, {"review_grades": True})
    # the update answers its own shape; the project's read shape, with the switch on
    flow["project_grades_on"] = call(pa, "GET", ppath)
    graded_id = sequence(first)
    flow["version_sequence_graded"] = call(pa, "GET", f"/api/v1/versions/{first.pk}/")
    assert flow["version_sequence_graded"]["body"]["review_media"]["probe"]["grade"] is not None
    with django_capture_on_commit_callbacks(execute=True):
        movie_id = pa.post(
            f"/api/v1/versions/{second.pk}/review-media/",
            {"file": SimpleUploadedFile("graded.mp4", (gen / "graded.mp4").read_bytes())},
            format="multipart",
        ).json()["id"]
    with django_capture_on_commit_callbacks(execute=True):
        assert ReviewMediaService.process(movie_id) == ReviewMedia.Status.READY
    flow["version_movie_not_graded"] = call(pa, "GET", f"/api/v1/versions/{second.pk}/")
    flow["copies_matching"] = call(pa, "GET", cpath)

    # Q-RP-96: a changed grade is counted, and the project remake applies the new one.
    flow["shot_regrade_200"] = call(
        pa, "PATCH", f"/api/v1/shots/{shots[1]}/",
        {"grade": {"slope": [1.2, 1.0, 0.85], "offset": [0.02, 0, -0.02], "power": [1, 1, 1.1],
                   "saturation": 0.85}},
    )  # fmt: skip
    flow["copies_other_grade"] = call(pa, "GET", cpath)
    with django_capture_on_commit_callbacks(execute=True):
        flow["remake_all_200"] = call(pa, "POST", f"{cpath}remake/")
    for row_id in queued[-flow["remake_all_200"]["body"]["queued"] :]:
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(row_id) == ReviewMedia.Status.READY
    flow["copies_after_remake"] = call(pa, "GET", cpath)
    flow["version_sequence_regraded"] = call(pa, "GET", f"/api/v1/versions/{first.pk}/")

    # A config without a grading space: the copy is made, without the grade, saying why.
    cfg = OCIO.Config.CreateFromStream(colour.config().serialize())
    cfg.setRole("color_timing", None)
    (tmp_path / "no_timing.ocio").write_text(cfg.serialize(), encoding="utf-8")
    settings.REVIEW_MEDIA_OCIO_CONFIG = str(tmp_path / "no_timing.ocio")
    sequence(third)
    flow["version_sequence_no_grading_space"] = call(pa, "GET", f"/api/v1/versions/{third.pk}/")

    # C-RP-55 (RP-22): a cut's EDL and a dailies ALE, after everything above so it is unchanged.
    tc = "01:00:00:00 01:00:02:00 01:00:00:00 01:00:02:00"
    edl = "\n".join([
        "TITLE: RPG CUT 4", "FCM: NON-DROP FRAME", "",
        f"001  BL       V     C        {tc}",
        f"002  A001     V     C        {tc}",
        "* FROM CLIP NAME: A001C003_220101_R1AB.mov", "* LOC: 01:00:01:12 YELLOW SH0010",
        "*ASC_SOP (0.9 1.0 1.1)(0.0 0.0 0.01)(1.0 1.0 1.0)", "*ASC_SAT 1.0",
        f"003  A002     V     C        {tc}",
        "* FROM CLIP NAME: A002C001.mov", "* LOC: 01:00:03:00 SH0020",
        "*ASC_SOP (1.0 1.0 1.0)(0.0 0.0 0.0)(1.0 1.0 1.0)", "*ASC_SAT 0.8",
        f"004  A001     V     C        {tc}",
        "* LOC: 01:00:05:00 YELLOW SH0010",
        "*ASC_SOP (0.9 1.0 1.1)(0.0 0.0 0.01)(1.0 1.0 1.0)", "*ASC_SAT 1.0",
        f"005  A003     V     C        {tc}", "* LOC: 01:00:07:00 SH0030", "*ASC_SAT 0.7",
        f"006  A003     V     C        {tc}", "* LOC: 01:00:09:00 SH0030", "*ASC_SAT 0.6",
        f"007  A004     V     C        {tc}", "* LOC: 01:00:11:00 SH9990", "*ASC_SAT 0.9",
        f"008  A005     V     C        {tc}",
        "* TO CLIP NAME: RPG_SH0020.exr", "* LOC: 01:00:13:00 SH0010", "*ASC_SAT 0.9",
        f"009  BL       V     C        {tc}", "",
    ]).encode()  # fmt: skip
    flow["import_edl_dry_run_200"] = call(
        pa, "POST", ipath, upload(edl, "cut4.edl"), multipart=True
    )
    flow["import_edl_apply_200"] = call(
        pa, "POST", ipath, upload(edl, "cut4.edl", dry_run=False), multipart=True
    )
    flow["shot_from_edl"] = call(pa, "GET", f"/api/v1/shots/{shots[1]}/")
    assert flow["import_edl_apply_200"]["body"]["applied"] == 1
    ale = "\n".join([
        "Heading", "FIELD_DELIM\tTABS", "VIDEO_FORMAT\t1080", "FPS\t24", "",
        "Column", "Name\tTracks\tStart\tEnd\tASC_SOP\tASC_SAT\tShot", "",
        "Data",
        "A001C003\tV\t01:00:00:00\t01:00:02:00\t(1.05 1.0 0.95)(0.0 0.0 0.0)(1.0 1.0 1.0)\t0.95\tSH0010",
        "A001C004\tV\t01:00:02:00\t01:00:04:00\t\t\t",
        "A005C001\tV\t01:00:04:00\t01:00:06:00\t(1 1 1)(0 0 0)(1 1 1)\t0.9\tSH9990", "",
    ]).encode()  # fmt: skip
    flow["import_ale_dry_run_200"] = call(
        pa, "POST", ipath, upload(ale, "dailies.ale"), multipart=True
    )
    flow["import_edl_no_event_400"] = call(
        pa, "POST", ipath, upload(b"TITLE: empty\n", "empty.edl"), multipart=True
    )
    flow["import_ale_no_grade_column_400"] = call(
        pa, "POST", ipath, upload(b"Heading\n\nColumn\nName\tTracks\n\nData\nA001\tV\n", "log.ale"),
        multipart=True,
    )  # fmt: skip

    flow["ids"] = {"project": pid, "first": str(first.pk), "second": str(second.pk),
                   "third": str(third.pk), "graded": graded_id, "movie": movie_id,
                   "shots": {str(k): v for k, v in shots.items()}}  # fmt: skip

    OUT.joinpath("production").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("production", "_shot_grades_flow.json").write_text(
        json.dumps(flow, indent=2, sort_keys=True) + "\n"
    )
