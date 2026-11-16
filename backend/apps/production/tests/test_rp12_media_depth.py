"""
Review pipeline RP-12: image sequences and burn-ins (docs/review-pipeline PLAN WP 12.1 to 12.4;
CONTRACTS C-RP-31 to C-RP-33; Q-RP-51 to Q-RP-56 = A; ADR-0040 as amended).

A sequence is opened, sent in parts and completed; the worker reads its stored frames through
``image2`` with the decoder forced (ffmpeg mocked here except in ``TestRealFfmpeg``). A project can
burn its codes, the version and the frame number into its review copies.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, ReviewMedia
from apps.production.services import review_media as service_module
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    ShotFactory,
    VersionFactory,
)
from apps.production.transcode import ffmpeg as commands
from apps.production.transcode import sequence as frames

pytestmark = pytest.mark.django_db

EDITOR = ("project.view", "version.view", "version.update")
VIEWER = ("project.view", "version.view")
ARTIST = ("project.view", "version.view", "version.create")
EXR = b"\x76\x2f\x31\x01\x02\x00\x00\x00" + b"\x00" * 8
DPX = b"SDPX" + b"\x00" * 12
DPX_LE = b"XPDS" + b"\x00" * 12
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
TIFF = b"II*\x00" + b"\x00" * 12
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 12
MOV = b"\x00\x00\x00\x18ftypqt  \x00\x00\x02\x00"
Status = ReviewMedia.Status


def _sequence_probe(frames_read: int, rate: str = "24/1") -> dict[str, Any]:
    return {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "exr",
                "width": 2048,
                "height": 1080,
                "avg_frame_rate": rate,
                "r_frame_rate": rate,
                "nb_read_packets": str(frames_read),
            }
        ],
        "format": {"duration": str(frames_read / 24)},
    }


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_MAX_BYTES = 10 * 1024 * 1024
    settings.REVIEW_MEDIA_MAX_FRAMES = 2000
    settings.REVIEW_MEDIA_SEQUENCE_MAX_BYTES = 50 * 1024 * 1024
    font = tmp_path / "font.ttf"
    font.write_bytes(b"not really a font")
    settings.REVIEW_MEDIA_BURN_IN_FONT = str(font)


@pytest.fixture
def queued(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: calls.append(str(media_id)))
    return calls


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWELVE")


def _user(project, *codes, **membership):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    membership.setdefault("status", "active")
    membership.setdefault("role", "Artist")
    ProjectMembership.objects.create(user=user, project=project, **membership)
    return user


def _api(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def editor(project):
    return _user(project, *EDITOR)


@pytest.fixture
def version(project):
    shot = ShotFactory.create(project=project, code="RPTWELVE_SH010")
    return VersionFactory.create(
        project=project, shot=shot, code="RPTWELVE_SH010_V003", start_frame=None, end_frame=None
    )


def _open(api, version, **body):
    payload = {"name": "sh010_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1004}
    payload.update(body)
    return api.post(f"/api/v1/versions/{version.pk}/review-media/sequence/", payload, format="json")


def _opened(api, version, **body) -> ReviewMedia:
    resp = _open(api, version, **body)
    assert resp.status_code == 201, resp.content
    return ReviewMedia.objects.get(pk=resp.json()["id"])


def _frame(number, *, name="sh010_comp", ext="exr", head=EXR, sep=".", body=b"\x00" * 64):
    return SimpleUploadedFile(f"{name}{sep}{number}.{ext}", head + body)


def _send(api, media, files):
    return api.post(
        f"/api/v1/review-media/{media.pk}/frames/", {"frames": files}, format="multipart"
    )


def _complete(api, media, capture=None):
    url = f"/api/v1/review-media/{media.pk}/complete/"
    if capture is None:
        return api.post(url)
    with capture(execute=True):
        return api.post(url)


def _stored(settings, media) -> list[str]:
    folder = Path(settings.MEDIA_ROOT) / f"{media.directory}/source"
    return sorted(p.name for p in folder.iterdir()) if folder.is_dir() else []


def _whole(api, version, capture, *, first=1001, last=1004, ext="exr", head=EXR, **body):
    media = _opened(api, version, first_frame=first, last_frame=last, extension=ext, **body)
    resp = _send(api, media, [_frame(n, ext=ext, head=head) for n in range(first, last + 1)])
    assert resp.status_code == 200, resp.content
    resp = _complete(api, media, capture)
    assert resp.status_code == 202, resp.content
    media.refresh_from_db()
    return media


def _fake_run(calls, *, probe, workdirs=None, fail_on=None):
    def run(args, *, cwd, timeout):
        calls.append(args)
        if workdirs is not None:
            workdirs.append({p.name: p.read_bytes() for p in Path(cwd).iterdir()})
        if fail_on and fail_on in " ".join(args):
            return subprocess.CompletedProcess(args, 1, stdout="", stderr="boom")
        if Path(args[0]).name == "ffprobe":
            return subprocess.CompletedProcess(args, 0, stdout=json.dumps(probe), stderr="")
        Path(cwd, args[-1]).write_bytes(b"made")
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

    return run


def _process(media, monkeypatch, *, probe=None, workdirs=None, fail_on=None):
    calls: list[list[str]] = []
    probe = probe if probe is not None else _sequence_probe(media.frames_expected or 1)
    monkeypatch.setattr(
        commands, "run", _fake_run(calls, probe=probe, workdirs=workdirs, fail_on=fail_on)
    )
    result = ReviewMediaService.process(media.pk)
    media.refresh_from_db()
    return result, calls


# ---------------------------------------------------------------------------------------------- pure parts


class TestFrameNames:
    @pytest.mark.parametrize(
        ("filename", "number"),
        [
            ("sh010_comp.1001.exr", 1001),
            ("sh010_comp_1001.exr", 1001),
            ("sh010_comp-0042.exr", 42),
            ("sh010_comp.0.exr", 0),
            ("sh010_comp.1001.EXR", 1001),
            ("renders/v3/sh010_comp.1001.exr", 1001),
            ("C:\\renders\\sh010_comp.1001.exr", 1001),
            ("sh010_comp.99999999.exr", 99_999_999),
        ],
    )
    def test_a_frame_is_named_after_its_sequence(self, filename, number):
        assert frames.frame_number(filename, name="sh010_comp", extension="exr") == number

    @pytest.mark.parametrize(
        "filename",
        [
            "sh010_comp1001.exr",  # no separator
            "sh010_plate.1001.exr",  # another name
            "SH010_COMP.1001.exr",  # names are exact
            "sh010_comp.1001.dpx",  # another extension
            "sh010_comp.123456789.exr",  # nine digits
            "sh010_comp..exr",
            "sh010_comp.exr",
            "../sh010_comp.1001",
        ],
    )
    def test_anything_else_is_not_a_frame(self, filename):
        assert frames.frame_number(filename, name="sh010_comp", extension="exr") is None

    @pytest.mark.parametrize(
        ("head", "key"),
        [(EXR, "exr"), (DPX, "dpx"), (DPX_LE, "dpx"), (PNG, "png"), (TIFF, "tiff"), (JPEG, "jpeg")],
    )
    def test_the_first_bytes_tell_the_format(self, head, key):
        found = frames.sniff(head)
        assert found is not None and found.key == key

    @pytest.mark.parametrize("head", [MOV, b"#EXTM3U\n#EXT-X", b"", b"\x76\x2f\x31"])
    def test_a_movie_a_playlist_or_too_little_is_no_frame(self, head):
        assert frames.sniff(head) is None

    def test_only_exr_is_linear(self):
        assert [f.key for f in frames.FORMATS.values() if f.linear] == ["exr"]

    def test_missing_lists_the_first_gaps(self):
        assert frames.missing({1, 2, 4}, 1, 6) == [3, 5, 6]
        assert frames.missing(set(), 1, 100, limit=3) == [1, 2, 3]
        assert frames.missing(range(1, 7), 1, 6) == []

    def test_stored_names_are_ours(self):
        assert frames.stored_name(1001, "exr") == "frame.00001001.exr"
        assert frames.stored_pattern("dpx") == "frame.%08d.dpx"
        names = [
            "frame.00001001.exr",
            "frame.00001002.exr",
            "frame.00001003.dpx",
            "x.exr",
            "proxy.mp4",
        ]
        assert frames.stored_numbers(names, "exr") == {1001, 1002}

    @pytest.mark.parametrize(
        ("name", "valid"),
        [
            ("sh010_comp", True),
            ("a" * 200, True),
            ("", False),
            ("a" * 201, False),
            ("renders/sh010", False),
            ("renders\\sh010", False),
            ("sh010\ncomp", False),
            ("sh010\x00", False),
        ],
    )
    def test_a_sequence_name(self, name, valid):
        assert frames.valid_name(name) is valid


class TestCommands:
    def test_a_sequence_is_read_through_image2_with_its_decoder_forced(self):
        source = commands.SequenceInput(
            codec="exr",
            pattern="../source/frame.%08d.exr",
            first=1001,
            frame_rate="24/1",
            linear=True,
        )
        args = source.args()
        assert args[:6] == [
            "-protocol_whitelist", "file", "-format_whitelist", "image2", "-codec_whitelist", "exr",
        ]  # fmt: skip
        assert args[args.index("-f") + 1] == "image2"
        assert args[args.index("-pattern_type") + 1] == "sequence"
        assert args[args.index("-start_number") + 1] == "1001"
        assert args[args.index("-framerate") + 1] == "24/1"
        assert args[args.index("-c:v") + 1] == "exr"
        assert args[args.index("-apply_trc") + 1] == "iec61966_2_1"
        assert args[-2:] == ["-i", "file:../source/frame.%08d.exr"]

    def test_only_a_linear_format_is_turned_to_srgb(self):
        source = commands.SequenceInput(
            codec="dpx", pattern="../source/frame.%08d.dpx", first=1, frame_rate="25/1"
        )
        assert "-apply_trc" not in source.args()

    def test_the_probe_does_not_decode(self):
        source = commands.SequenceInput(
            codec="exr", pattern="p", first=1, frame_rate="24/1", linear=True
        )
        args = commands.probe_command("ffprobe", source)
        assert "-c:v" not in args and "-apply_trc" not in args and "-codec_whitelist" in args

    def test_a_movie_reads_as_before(self, tmp_path):
        source = commands.MovieInput("mov", tmp_path / "source.mov")
        assert source.args(seek=1.5) == [
            "-protocol_whitelist", "file", "-format_whitelist", "mov", "-ss", "1.500",
            "-f", "mov", "-i", f"file:{tmp_path / 'source.mov'}",
        ]  # fmt: skip

    @pytest.mark.parametrize(
        ("fps", "rate"),
        [
            (24, "24/1"),
            ("23.976", "24000/1001"),
            ("29.970", "30000/1001"),
            ("59.94", "60000/1001"),
            ("25.000", "25/1"),
            ("12.5", "25/2"),
            (0, "24/1"),
            (-5, "24/1"),
            (5000, "24/1"),
            ("nonsense", "24/1"),
        ],
    )
    def test_the_version_rate(self, fps, rate):
        assert commands.rate_of(fps) == rate

    def test_burn_in_text_is_kept_out_of_the_filter(self):
        hostile = "SHOW %{pts} 'x' : \\ ,drawtext=text=evil"
        texts = commands.burn_in_texts(
            commands.BurnIn(
                top_left=hostile, top_right="V\nnext", bottom_left="2026-11-16", first_frame=1001
            )
        )
        assert texts == {
            "burn_tl.txt": hostile,
            "burn_tr.txt": "V next",
            "burn_bl.txt": "2026-11-16",
            "burn_br.txt": "%{eif:n+1001:d}",
        }
        graph = commands.burn_in_filter()
        assert "evil" not in graph and "pts" not in graph
        expansions = [part.split("expansion=")[1].split(":")[0] for part in graph.split(",")]
        assert expansions == ["none", "none", "none", "normal"]
        assert graph.count(f"fontfile={commands.BURN_IN_FONT}") == 4

    def test_the_counter_starts_where_it_is_told(self):
        texts = commands.burn_in_texts(commands.BurnIn("a", "b", "c", first_frame=-3))
        assert texts["burn_br.txt"] == "%{eif:n+-3:d}"

    def test_a_proxy_has_burn_ins_only_when_asked(self, tmp_path):
        source = commands.MovieInput("mov", tmp_path / "s.mov")
        probe = commands.Probe(640, 360, "24/1", 24, 1.0, "h264", False)
        plain = commands.proxy_command("ffmpeg", source, probe, tmp_path / "p.mp4")
        burnt = commands.proxy_command("ffmpeg", source, probe, tmp_path / "p.mp4", burn_in=True)
        vf = lambda args: args[args.index("-vf") + 1]  # noqa: E731
        assert "drawtext" not in vf(plain)
        assert "drawtext" in vf(burnt) and vf(burnt).endswith(",format=yuv420p")


# ---------------------------------------------------------------------------------------------- C-RP-31 open


class TestOpen:
    def test_an_editor_opens_a_sequence(self, editor, version, settings):
        resp = _open(_api(editor), version)
        assert resp.status_code == 201, resp.content
        data = resp.json()
        media = ReviewMedia.objects.get(pk=data["id"])
        assert data["kind"] == "sequence" and data["status"] == "uploading"
        assert data["source_name"] == "sh010_comp.[1001-1004].exr"
        assert data["sequence"] == {
            "name": "sh010_comp",
            "extension": "exr",
            "first_frame": 1001,
            "last_frame": 1004,
            "frames_received": 0,
        }
        assert media.source_path == f"{media.directory}/source"
        assert media.source_container == "exr"

    def test_the_extension_is_read_in_lower_case(self, editor, version):
        resp = _open(_api(editor), version, extension="DPX")
        assert resp.status_code == 201 and resp.json()["sequence"]["extension"] == "dpx"

    def test_the_version_shows_the_upload_as_its_job(self, editor, version):
        media = _opened(_api(editor), version)
        shape = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()
        assert shape["review_media_job"]["id"] == str(media.pk)
        assert shape["review_media_job"]["status"] == "uploading"
        assert shape["review_media"] is None

    @pytest.mark.parametrize(
        ("body", "field"),
        [
            ({"name": "renders/sh010"}, "name"),
            ({"name": ""}, "name"),
            ({"name": "sh010\tcomp"}, "name"),
            ({"extension": "mov"}, "extension"),
            ({"extension": "exr2"}, "extension"),
            ({"first_frame": -1}, "first_frame"),
            ({"last_frame": 100_000_000}, "last_frame"),
            ({"first_frame": 1010, "last_frame": 1001}, "last_frame"),
            ({"first_frame": 1, "last_frame": 2001}, "last_frame"),
            ({"first_frame": "one"}, "first_frame"),
        ],
    )
    def test_a_bad_opening_is_a_field_error(self, editor, version, body, field):
        resp = _open(_api(editor), version, **body)
        assert resp.status_code == 400, resp.content
        assert field in resp.json()
        assert not ReviewMedia.objects.filter(version=version).exists()

    def test_the_frame_cap_is_a_setting(self, editor, version, settings):
        settings.REVIEW_MEDIA_MAX_FRAMES = 3
        assert _open(_api(editor), version, first_frame=1, last_frame=3).status_code == 201
        ReviewMedia.objects.all().delete()
        assert _open(_api(editor), version, first_frame=1, last_frame=4).status_code == 400

    def test_one_job_at_a_time(self, editor, version):
        _opened(_api(editor), version)
        resp = _open(_api(editor), version)
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_busy"

    def test_a_movie_cannot_be_uploaded_while_a_sequence_arrives(self, editor, version):
        _opened(_api(editor), version)
        movie = SimpleUploadedFile("clip.mov", MOV + b"\x00" * 64)
        resp = _api(editor).post(
            f"/api/v1/versions/{version.pk}/review-media/", {"file": movie}, format="multipart"
        )
        assert resp.status_code == 409

    def test_off_is_a_409(self, editor, version, settings):
        settings.REVIEW_MEDIA_ENABLED = False
        resp = _open(_api(editor), version)
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_disabled"

    def test_a_reader_may_not(self, project, version):
        assert _open(_api(_user(project, *VIEWER)), version).status_code == 403

    def test_the_versions_artist_with_version_create_may(self, project, version):
        artist = _user(project, *ARTIST)
        version.artist = artist
        version.save(update_fields=["artist"])
        assert _open(_api(artist), version).status_code == 201

    def test_another_artist_may_not(self, project, version):
        assert _open(_api(_user(project, *ARTIST)), version).status_code == 403

    def test_out_of_reach_is_a_404(self, version):
        stranger = _user(ProjectFactory.create(code="ELSEWHERE"), *EDITOR)
        assert _open(_api(stranger), version).status_code == 404


# ---------------------------------------------------------------------------------------------- C-RP-31 frames


class TestFrames:
    def test_a_part_is_stored_under_our_names(self, editor, version, settings):
        api = _api(editor)
        media = _opened(api, version)
        resp = _send(api, media, [_frame(1001), _frame(1003, sep="_")])
        assert resp.status_code == 200, resp.content
        assert resp.json() == {
            "frames_received": 2,
            "frames_expected": 4,
            "missing_frames": [1002, 1004],
        }
        assert _stored(settings, media) == ["frame.00001001.exr", "frame.00001003.exr"]
        media.refresh_from_db()
        assert media.frames_received == 2 and media.source_size == 2 * (len(EXR) + 64)
        stored = Path(settings.MEDIA_ROOT) / media.source_path / "frame.00001001.exr"
        assert stored.read_bytes() == EXR + b"\x00" * 64

    def test_parts_add_up(self, editor, version):
        api = _api(editor)
        media = _opened(api, version)
        _send(api, media, [_frame(1001), _frame(1002)])
        resp = _send(api, media, [_frame(1003), _frame(1004)])
        assert resp.json() == {"frames_received": 4, "frames_expected": 4, "missing_frames": []}

    def test_a_frame_named_with_a_path_keeps_only_its_name(self, editor, version, settings):
        api = _api(editor)
        media = _opened(api, version)
        upload = SimpleUploadedFile("../../etc/sh010_comp.1001.exr", EXR + b"\x00" * 8)
        assert _send(api, media, [upload]).status_code == 200
        assert _stored(settings, media) == ["frame.00001001.exr"]
        assert not (Path(settings.MEDIA_ROOT).parent / "etc").exists()

    @pytest.mark.parametrize(
        ("bad", "message"),
        [
            (lambda: _frame(1002, name="sh020_comp"), "not a frame of sh010_comp.[1001-1004].exr"),
            (lambda: _frame(1002, ext="dpx", head=DPX), "not a frame of"),
            (lambda: _frame(1000), "outside 1001-1004"),
            (lambda: _frame(1005), "outside 1001-1004"),
            (lambda: _frame(1002, head=DPX), "the content is not EXR"),
            (lambda: _frame(1002, head=MOV), "the content is not EXR"),
            (lambda: SimpleUploadedFile("sh010_comp.1002.exr", b""), "the file is empty"),
        ],
    )
    def test_one_bad_frame_refuses_the_whole_part(self, editor, version, settings, bad, message):
        api = _api(editor)
        media = _opened(api, version)
        resp = _send(api, media, [_frame(1001), bad()])
        assert resp.status_code == 400, resp.content
        assert any(message in line for line in resp.json()["frames"])
        assert _stored(settings, media) == []
        media.refresh_from_db()
        assert media.frames_received == 0 and media.source_size == 0

    def test_a_frame_sent_twice_in_one_part(self, editor, version, settings):
        api = _api(editor)
        media = _opened(api, version)
        resp = _send(api, media, [_frame(1001), _frame(1001, sep="_")])
        assert resp.status_code == 400
        assert resp.json()["frames"] == ["sh010_comp_1001.exr: frame 1001 was already sent."]
        assert _stored(settings, media) == []

    def test_a_frame_already_received(self, editor, version, settings):
        api = _api(editor)
        media = _opened(api, version)
        _send(api, media, [_frame(1001)])
        resp = _send(api, media, [_frame(1002), _frame(1001)])
        assert resp.status_code == 400
        assert resp.json()["frames"] == ["sh010_comp.1001.exr: frame 1001 was already sent."]
        assert _stored(settings, media) == ["frame.00001001.exr"]

    def test_at_most_fifty_frames_a_part(self, editor, version):
        api = _api(editor)
        media = _opened(api, version, first_frame=1, last_frame=60)
        resp = _send(api, media, [_frame(n) for n in range(1, 52)])
        assert resp.status_code == 400 and "1 to 50" in resp.json()["frames"][0]
        assert _send(api, media, [_frame(n) for n in range(1, 51)]).status_code == 200

    def test_a_part_without_frames(self, editor, version):
        api = _api(editor)
        media = _opened(api, version)
        resp = api.post(f"/api/v1/review-media/{media.pk}/frames/", {}, format="multipart")
        assert resp.status_code == 400

    def test_one_frame_over_the_upload_limit(self, editor, version, settings):
        settings.REVIEW_MEDIA_MAX_BYTES = 100
        api = _api(editor)
        media = _opened(api, version)
        resp = _send(api, media, [_frame(1001, body=b"\x00" * 200)])
        assert resp.status_code == 400 and "larger than" in resp.json()["frames"][0]

    def test_the_sequence_total_is_capped(self, editor, version, settings, monkeypatch):
        settings.REVIEW_MEDIA_SEQUENCE_MAX_BYTES = 3 * (len(EXR) + 64)
        api = _api(editor)
        media = _opened(api, version)
        assert _send(api, media, [_frame(1001), _frame(1002), _frame(1003)]).status_code == 200
        named: list[int] = []
        real_name = frames.stored_name
        monkeypatch.setattr(
            frames, "stored_name", lambda n, ext: named.append(n) or real_name(n, ext)
        )
        resp = _send(api, media, [_frame(1004)])
        assert resp.status_code == 400 and "would be larger" in resp.json()["frames"][0]
        assert named == []  # refused before anything is written
        assert len(_stored(settings, media)) == 3

    def test_a_closed_upload_takes_no_frames(self, editor, version, queued):
        api = _api(editor)
        media = _whole(api, version, None)
        resp = _send(api, media, [_frame(1001)])
        assert resp.status_code == 400 and "not taking frames" in resp.json()["detail"][0]

    def test_a_movie_row_takes_no_frames(self, editor, version, queued):
        api = _api(editor)
        movie = SimpleUploadedFile("clip.mov", MOV + b"\x00" * 64)
        row = api.post(
            f"/api/v1/versions/{version.pk}/review-media/", {"file": movie}, format="multipart"
        ).json()
        resp = api.post(
            f"/api/v1/review-media/{row['id']}/frames/", {"frames": [_frame(1)]}, format="multipart"
        )
        assert resp.status_code == 400

    def test_off_is_a_409(self, editor, version, settings):
        api = _api(editor)
        media = _opened(api, version)
        settings.REVIEW_MEDIA_ENABLED = False
        assert _send(api, media, [_frame(1001)]).status_code == 409

    def test_a_reader_may_not_and_a_stranger_gets_a_404(self, project, editor, version):
        media = _opened(_api(editor), version)
        assert _send(_api(_user(project, *VIEWER)), media, [_frame(1001)]).status_code == 403
        stranger = _user(ProjectFactory.create(code="ELSEWHERE"), *EDITOR)
        assert _send(_api(stranger), media, [_frame(1001)]).status_code == 404

    def test_a_part_cancelled_while_written_keeps_nothing(
        self, editor, version, settings, monkeypatch
    ):
        api = _api(editor)
        media = _opened(api, version)
        real_name = frames.stored_name

        def cancel_while_writing(number, extension):
            ReviewMedia.objects.filter(pk=media.pk).update(status=Status.REMOVED)
            return real_name(number, extension)

        monkeypatch.setattr(frames, "stored_name", cancel_while_writing)
        resp = _send(api, media, [_frame(1001), _frame(1002)])
        assert resp.status_code == 400 and "not taking frames" in resp.json()["detail"][0]
        assert _stored(settings, media) == []


# ---------------------------------------------------------------------------------------------- complete


class TestComplete:
    def test_a_whole_sequence_is_queued_after_commit(
        self, editor, version, queued, django_capture_on_commit_callbacks
    ):
        api = _api(editor)
        media = _opened(api, version)
        _send(api, media, [_frame(n) for n in range(1001, 1005)])
        assert queued == []
        resp = _complete(api, media, django_capture_on_commit_callbacks)
        assert resp.status_code == 202, resp.content
        data = resp.json()
        assert data["status"] == "queued" and data["sequence"]["frames_received"] == 4
        assert queued == [str(media.pk)]
        log = AuditLog.objects.get(
            target_id=str(version.pk), metadata__operation="review_media_upload"
        )
        assert log.metadata["kind"] == "sequence" and "4 frames" in log.description
        assert "sh010_comp" not in log.description  # the upload's name is not recorded

    def test_a_gap_names_the_missing_frames(self, editor, version, queued):
        api = _api(editor)
        media = _opened(api, version, first_frame=1, last_frame=20)
        _send(api, media, [_frame(n) for n in (1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)])
        resp = _complete(api, media)
        assert resp.status_code == 400
        body = resp.json()
        assert body["missing_frames"] == ["3", "16", "17", "18", "19", "20"]
        assert body["detail"] == ["6 frames are missing: 3, 16, 17, 18, 19, 20."]
        media.refresh_from_db()
        assert media.status == Status.UPLOADING and queued == []

    def test_a_long_gap_is_summed_up(self, editor, version):
        api = _api(editor)
        media = _opened(api, version, first_frame=1, last_frame=100)
        resp = _complete(api, media)
        assert resp.json()["detail"] == [
            "100 frames are missing: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 and 90 more."
        ]
        assert len(resp.json()["missing_frames"]) == frames.MISSING_LISTED

    def test_complete_twice(self, editor, version, queued):
        api = _api(editor)
        media = _whole(api, version, None)
        assert _complete(api, media).status_code == 400

    def test_off_is_a_409(self, editor, version, settings):
        api = _api(editor)
        media = _opened(api, version)
        settings.REVIEW_MEDIA_ENABLED = False
        assert _complete(api, media).status_code == 409

    def test_a_reader_may_not(self, project, editor, version):
        media = _opened(_api(editor), version)
        assert _complete(_api(_user(project, *VIEWER)), media).status_code == 403


# ---------------------------------------------------------------------------------------------- cancel, sweep


class TestCancel:
    def test_an_upload_in_progress_is_cancelled(
        self, editor, version, settings, django_capture_on_commit_callbacks
    ):
        api = _api(editor)
        media = _opened(api, version)
        _send(api, media, [_frame(1001)])
        with django_capture_on_commit_callbacks(execute=True):
            resp = api.delete(f"/api/v1/review-media/{media.pk}/")
        assert resp.status_code == 204
        media.refresh_from_db()
        assert media.status == Status.REMOVED
        assert not (Path(settings.MEDIA_ROOT) / media.directory).exists()
        assert api.get(f"/api/v1/versions/{version.pk}/").json()["review_media_job"] is None
        log = AuditLog.objects.get(
            target_id=str(version.pk), metadata__operation="review_media_remove"
        )
        assert "cancelled" in log.description
        assert _open(api, version).status_code == 201  # the version is free again

    def test_cancel_needs_the_right_not_the_switch(self, project, editor, version, settings):
        media = _opened(_api(editor), version)
        assert (
            _api(_user(project, *VIEWER)).delete(f"/api/v1/review-media/{media.pk}/").status_code
            == 403
        )
        settings.REVIEW_MEDIA_ENABLED = False
        assert _api(editor).delete(f"/api/v1/review-media/{media.pk}/").status_code == 204

    def test_a_queued_sequence_cannot_be_removed(self, editor, version, queued):
        api = _api(editor)
        media = _whole(api, version, None)
        assert api.delete(f"/api/v1/review-media/{media.pk}/").status_code == 400


class TestSweep:
    def test_an_abandoned_upload_is_removed_and_its_folder_discarded(
        self, editor, version, monkeypatch, django_capture_on_commit_callbacks
    ):
        discarded: list[str] = []
        monkeypatch.setattr(service_module, "discard_later", discarded.append)
        api = _api(editor)
        stale = _opened(api, version)
        other = VersionFactory.create(project=version.project, code="RPTWELVE_SH020_V001")
        fresh = _opened(api, other)
        ReviewMedia.objects.filter(pk=stale.pk).update(
            queued_at=timezone.now() - timedelta(hours=25)
        )
        ReviewMedia.objects.filter(pk=fresh.pk).update(
            queued_at=timezone.now() - timedelta(hours=23)
        )
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.sweep() == 1
        stale.refresh_from_db()
        fresh.refresh_from_db()
        assert stale.status == Status.REMOVED and stale.finished_at is not None
        assert fresh.status == Status.UPLOADING
        assert discarded == [stale.directory]

    def test_each_part_keeps_an_upload_alive(self, editor, version, monkeypatch):
        monkeypatch.setattr(service_module, "discard_later", lambda folder: None)
        api = _api(editor)
        media = _opened(api, version)
        ReviewMedia.objects.filter(pk=media.pk).update(
            queued_at=timezone.now() - timedelta(hours=25)
        )
        assert _send(api, media, [_frame(1001)]).status_code == 200
        assert ReviewMediaService.sweep() == 0

    def test_the_new_settings_reach_django(self):
        # The fixture above sets them; the settings module itself must define them (base imports by name).
        from config.settings import base

        assert base.REVIEW_MEDIA_MAX_FRAMES == 2000
        assert base.REVIEW_MEDIA_SEQUENCE_MAX_BYTES == 20 * 1024**3
        assert base.REVIEW_MEDIA_BURN_IN_FONT == "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

    def test_the_discard_task_runs_on_the_media_queue(self, settings):
        from apps.production.tasks import discard_review_media

        assert discard_review_media.name == service_module.DISCARD_TASK
        assert settings.CELERY_TASK_ROUTES[service_module.DISCARD_TASK] == {"queue": "media"}

    def test_discard_only_deletes_review_media_folders(self, settings):
        root = Path(settings.MEDIA_ROOT)
        keep = root / "attachments" / "x"
        keep.mkdir(parents=True)
        mine = root / "review_media" / "p" / "v" / "r"
        mine.mkdir(parents=True)
        for refused in (
            "attachments/x",
            "review_media",
            "review_media/../attachments/x",
            str(keep),
        ):
            service_module.discard_folder(refused)
        assert keep.exists()
        service_module.discard_folder("review_media/p/v/r")
        assert not mine.exists()


# ---------------------------------------------------------------------------------------------- C-RP-32 processing


class TestSequenceProcessing:
    def test_an_exr_sequence_becomes_ready(
        self, editor, version, queued, settings, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _whole(_api(editor), version, django_capture_on_commit_callbacks)
        with django_capture_on_commit_callbacks(execute=True):
            result, calls = _process(media, monkeypatch)
        assert result == Status.READY
        probe_args, proxy_args = calls[0], calls[1]
        assert probe_args[0] == "ffprobe" and proxy_args[0] == "ffmpeg"
        for args in calls:
            assert args[args.index("-codec_whitelist") + 1] == "exr"
            assert args[args.index("-format_whitelist") + 1] == "image2"
            assert args[args.index("-start_number") + 1] == "1001"
            assert args[args.index("-framerate") + 1] == "24/1"
            assert "file:../source/frame.%08d.exr" in args
        assert all(args[args.index("-apply_trc") + 1] == "iec61966_2_1" for args in calls[1:])
        assert media.probe["first_frame"] == 1001 and media.probe["last_frame"] == 1004
        assert media.probe["colour"] == "srgb_from_linear" and media.probe["burn_ins"] is False
        assert media.probe["frames"] == 4 and media.filmstrip_tiles == 4
        # Q-RP-56: the frames are gone once the copy is ready
        assert media.source_path == ""
        assert not (Path(settings.MEDIA_ROOT) / media.directory / "source").exists()
        assert (Path(settings.MEDIA_ROOT) / media.proxy_path).is_file()

    def test_the_serialized_row(self, editor, version, queued, monkeypatch):
        media = _whole(_api(editor), version, None)
        _process(media, monkeypatch)
        current = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]
        assert current["kind"] == "sequence" and current["status"] == "ready"
        assert (
            current["probe"]["first_frame"] == 1001
            and current["probe"]["colour"] == "srgb_from_linear"
        )
        assert current["sequence"]["frames_received"] == 4
        assert current["proxy_url"].startswith(f"/api/v1/review-media/{media.pk}/proxy/?token=")

    def test_a_dpx_sequence_is_shown_as_stored_at_the_versions_rate(
        self, editor, version, queued, monkeypatch
    ):
        version.fps = "23.976"
        version.save(update_fields=["fps"])
        media = _whole(_api(editor), version, None, ext="dpx", head=DPX)
        result, calls = _process(media, monkeypatch, probe=_sequence_probe(4, "24000/1001"))
        assert result == Status.READY
        assert all("-apply_trc" not in args for args in calls)
        assert all(args[args.index("-framerate") + 1] == "24000/1001" for args in calls)
        assert all(args[args.index("-codec_whitelist") + 1] == "dpx" for args in calls)
        assert media.probe["colour"] == "as_stored"

    @pytest.mark.parametrize(
        ("ext", "head", "codec"),
        [("png", PNG, "png"), ("jpg", JPEG, "mjpeg"), ("tif", TIFF, "tiff")],
    )
    def test_other_frame_formats_force_their_decoder(
        self, editor, version, queued, monkeypatch, ext, head, codec
    ):
        media = _whole(_api(editor), version, None, ext=ext, head=head)
        result, calls = _process(media, monkeypatch)
        assert result == Status.READY
        assert all(args[args.index("-codec_whitelist") + 1] == codec for args in calls)

    def test_a_frame_lost_before_processing_fails_the_job_and_keeps_the_rest(
        self, editor, version, queued, settings, monkeypatch
    ):
        media = _whole(_api(editor), version, None)
        result, _ = _process(media, monkeypatch, probe=_sequence_probe(2))
        assert result == Status.FAILED and media.error_code == "unsupported_stream"
        assert len(_stored(settings, media)) == 4  # kept for a retry

    def test_a_frame_that_will_not_decode(self, editor, version, queued, settings, monkeypatch):
        media = _whole(_api(editor), version, None)
        result, _ = _process(media, monkeypatch, fail_on="libx264")
        assert result == Status.FAILED and media.error_code == "transcode_failed"
        assert len(_stored(settings, media)) == 4

    def test_a_failed_sequence_is_retried_with_its_frames(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        api = _api(editor)
        media = _whole(api, version, None)
        _process(media, monkeypatch, fail_on="libx264")
        with django_capture_on_commit_callbacks(execute=True):
            assert api.post(f"/api/v1/review-media/{media.pk}/retry/").status_code == 202
        result, _ = _process(media, monkeypatch)
        assert result == Status.READY

    def test_the_frames_folder_gone_is_source_missing(
        self, editor, version, queued, settings, monkeypatch
    ):
        media = _whole(_api(editor), version, None)
        shutil.rmtree(Path(settings.MEDIA_ROOT) / media.source_path)
        result, calls = _process(media, monkeypatch)
        assert result == Status.FAILED and media.error_code == "source_missing" and calls == []

    def test_an_empty_range_is_filled_from_the_sequence(self, editor, version, queued, monkeypatch):
        media = _whole(_api(editor), version, None)
        _process(media, monkeypatch)
        version.refresh_from_db()
        assert (version.start_frame, version.end_frame) == (1001, 1004)

    @pytest.mark.parametrize(("start", "end"), [(1, None), (None, 50), (1, 50)])
    def test_a_range_already_set_is_kept(self, editor, version, queued, monkeypatch, start, end):
        version.start_frame, version.end_frame = start, end
        version.save(update_fields=["start_frame", "end_frame"])
        media = _whole(_api(editor), version, None)
        _process(media, monkeypatch)
        version.refresh_from_db()
        assert (version.start_frame, version.end_frame) == (start, end)

    def test_a_movie_never_sets_the_range(self, editor, version, queued, monkeypatch):
        movie = SimpleUploadedFile("clip.mov", MOV + b"\x00" * 64)
        row = (
            _api(editor)
            .post(
                f"/api/v1/versions/{version.pk}/review-media/", {"file": movie}, format="multipart"
            )
            .json()
        )
        media = ReviewMedia.objects.get(pk=row["id"])
        probe = _sequence_probe(24)
        probe["streams"][0]["codec_name"] = "prores"
        result, _ = _process(media, monkeypatch, probe=probe)
        assert result == Status.READY
        version.refresh_from_db()
        assert (version.start_frame, version.end_frame) == (None, None)
        assert media.source_path != ""  # a movie's source stays (RP-5)


# ---------------------------------------------------------------------------------------------- C-RP-33 burn-ins


class TestBurnIns:
    def _movie(self, editor, version):
        movie = SimpleUploadedFile("clip.mov", MOV + b"\x00" * 64)
        row = (
            _api(editor)
            .post(
                f"/api/v1/versions/{version.pk}/review-media/", {"file": movie}, format="multipart"
            )
            .json()
        )
        return ReviewMedia.objects.get(pk=row["id"])

    def test_off_by_default(self, editor, version, queued, monkeypatch):
        media = _whole(_api(editor), version, None)
        result, calls = _process(media, monkeypatch)
        assert result == Status.READY and all("drawtext" not in " ".join(a) for a in calls)
        assert media.probe["burn_ins"] is False

    def test_a_sequence_carries_the_codes_and_its_own_frame_numbers(
        self, editor, version, project, queued, monkeypatch, settings
    ):
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        media = _whole(_api(editor), version, None)
        workdirs: list[dict[str, bytes]] = []
        result, calls = _process(media, monkeypatch, workdirs=workdirs)
        assert result == Status.READY and media.probe["burn_ins"] is True
        proxy = next(a for a in calls if "libx264" in a)
        assert "drawtext" in proxy[proxy.index("-vf") + 1]
        assert all("drawtext" not in " ".join(a) for a in calls if a is not proxy)
        seen = workdirs[1]  # the folder the proxy command ran in
        assert seen["burn_tl.txt"].decode() == "RPTWELVE  RPTWELVE_SH010"
        assert seen["burn_tr.txt"].decode() == "RPTWELVE_SH010_V003"
        assert seen["burn_bl.txt"].decode() == timezone.now().date().isoformat()
        assert seen["burn_br.txt"].decode() == "%{eif:n+1001:d}"
        assert seen[commands.BURN_IN_FONT] == Path(settings.REVIEW_MEDIA_BURN_IN_FONT).read_bytes()

    @pytest.mark.parametrize(("start", "counter"), [(None, "%{eif:n+1:d}"), (86, "%{eif:n+86:d}")])
    def test_a_movie_counts_from_the_versions_start_frame(
        self, editor, version, project, queued, monkeypatch, start, counter
    ):
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        version.start_frame = start
        version.save(update_fields=["start_frame"])
        media = self._movie(editor, version)
        workdirs: list[dict[str, bytes]] = []
        probe = _sequence_probe(24)
        result, _ = _process(media, monkeypatch, probe=probe, workdirs=workdirs)
        assert result == Status.READY and workdirs[1]["burn_br.txt"].decode() == counter

    def test_an_asset_version_names_the_asset(self, editor, project, queued, monkeypatch):
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        asset = AssetFactory.create(project=project, code="CHAR_HERO")
        version = VersionFactory.create(
            project=project, asset=asset, shot=None, code="CHAR_HERO_V001"
        )
        media = self._movie(editor, version)
        workdirs: list[dict[str, bytes]] = []
        _process(media, monkeypatch, probe=_sequence_probe(24), workdirs=workdirs)
        assert workdirs[1]["burn_tl.txt"].decode() == "RPTWELVE  CHAR_HERO"

    def test_a_still_never_has_burn_ins(self, editor, version, project, queued, monkeypatch):
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        still = SimpleUploadedFile("frame.png", PNG + b"\x00" * 32)
        row = (
            _api(editor)
            .post(
                f"/api/v1/versions/{version.pk}/review-media/", {"file": still}, format="multipart"
            )
            .json()
        )
        media = ReviewMedia.objects.get(pk=row["id"])
        result, calls = _process(media, monkeypatch, probe=_sequence_probe(1))
        assert result == Status.READY and all("drawtext" not in " ".join(a) for a in calls)
        assert media.probe["burn_ins"] is False

    def test_a_missing_font_makes_a_copy_without_them(
        self, editor, version, project, queued, monkeypatch, settings
    ):
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        settings.REVIEW_MEDIA_BURN_IN_FONT = "/nowhere/font.ttf"
        media = _whole(_api(editor), version, None)
        result, calls = _process(media, monkeypatch)
        assert result == Status.READY and media.probe["burn_ins"] is False
        assert all("drawtext" not in " ".join(a) for a in calls)


class TestProjectSwitch:
    def test_read_with_the_project_and_off_by_default(self, project):
        api = _api(_user(project, "project.view"))
        assert api.get(f"/api/v1/projects/{project.pk}/").json()["review_burn_ins"] is False

    def test_written_with_project_update(self, project):
        api = _api(_user(project, "project.view", "project.update"))
        resp = api.patch(
            f"/api/v1/projects/{project.pk}/", {"review_burn_ins": True}, format="json"
        )
        assert resp.status_code == 200 and resp.json()["review_burn_ins"] is True
        project.refresh_from_db()
        assert project.review_burn_ins is True

    def test_refused_without_project_update(self, project):
        api = _api(_user(project, "project.view"))
        resp = api.patch(
            f"/api/v1/projects/{project.pk}/", {"review_burn_ins": True}, format="json"
        )
        assert resp.status_code == 403
        project.refresh_from_db()
        assert project.review_burn_ins is False


# ---------------------------------------------------------------------------------------------- real ffmpeg


def _ffmpeg_with_exr() -> bool:
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        return False
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True, check=False
    ).stdout
    has_exr = " exr " in out
    has_drawtext = (
        " drawtext "
        in subprocess.run(
            ["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True, check=False
        ).stdout
    )
    return has_exr and has_drawtext


def _font() -> str | None:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).is_file():
            return candidate
    return None


@pytest.mark.skipif(
    not _ffmpeg_with_exr() or _font() is None,
    reason="needs ffmpeg with the EXR encoder and drawtext, and DejaVu Sans (the worker image's)",
)
class TestRealFfmpeg:
    def _frames(self, tmp_path, ext, pix_fmt, count=10, first=1001):
        out = tmp_path / f"gen-{ext}"
        out.mkdir()
        subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24",
             "-frames:v", str(count), "-pix_fmt", pix_fmt, "-start_number", str(first),
             str(out / f"plate.%04d.{ext}")],
            check=True,
        )  # fmt: skip
        return sorted(out.iterdir())

    def _upload(self, api, version, files, *, ext, first, last):
        media = _opened(
            api, version, name="plate", extension=ext, first_frame=first, last_frame=last
        )
        uploads = [SimpleUploadedFile(p.name, p.read_bytes()) for p in files]
        assert _send(api, media, uploads).status_code == 200
        assert _complete(api, media).status_code == 202
        return media

    def _streams(self, path):
        return json.loads(
            subprocess.run(
                ["ffprobe", "-v", "error", "-count_packets", "-show_streams", "-of", "json", str(path)],
                capture_output=True, text=True, check=True,
            ).stdout
        )["streams"]  # fmt: skip

    def test_an_exr_sequence_becomes_a_playable_proxy(
        self, editor, version, queued, settings, tmp_path, django_capture_on_commit_callbacks
    ):
        files = self._frames(tmp_path, "exr", "gbrpf32le")
        media = self._upload(_api(editor), version, files, ext="exr", first=1001, last=1010)
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert media.probe["frames"] == 10 and media.probe["colour"] == "srgb_from_linear"
        root = Path(settings.MEDIA_ROOT)
        video = self._streams(root / media.proxy_path)[0]
        assert video["codec_name"] == "h264" and int(video["nb_read_packets"]) == 10
        assert (video["width"], video["height"]) == (320, 180)
        assert (root / media.thumbnail_path).stat().st_size > 0
        assert (root / media.filmstrip_path).stat().st_size > 0
        assert not (root / media.directory / "source").exists()

    def test_a_dpx_sequence(self, editor, version, queued, tmp_path):
        files = self._frames(tmp_path, "dpx", "gbrp10le", count=6, first=1)
        media = self._upload(_api(editor), version, files, ext="dpx", first=1, last=6)
        assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert media.probe["frames"] == 6 and media.probe["colour"] == "as_stored"

    def test_hostile_burn_in_text_is_drawn_not_obeyed(
        self, editor, project, queued, settings, tmp_path
    ):
        settings.REVIEW_MEDIA_BURN_IN_FONT = _font()
        project.code = "P%{pts}'x:\\"
        project.review_burn_ins = True
        project.save(update_fields=["code", "review_burn_ins"])
        shot = ShotFactory.create(project=project, code="SH,drawtext=text=evil")
        version = VersionFactory.create(project=project, shot=shot, code="V'%{n}", start_frame=None)
        files = self._frames(tmp_path, "exr", "gbrpf32le", count=4, first=86)
        media = self._upload(_api(editor), version, files, ext="exr", first=86, last=89)
        assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert media.probe["burn_ins"] is True
        proxy = Path(settings.MEDIA_ROOT) / media.proxy_path
        assert int(self._streams(proxy)[0]["nb_read_packets"]) == 4

    def test_burn_ins_change_the_picture(
        self, editor, project, version, queued, settings, tmp_path
    ):
        settings.REVIEW_MEDIA_BURN_IN_FONT = _font()
        files = self._frames(tmp_path, "png", "rgb24", count=2, first=1)

        def frame_of(media):
            out = tmp_path / f"{media.pk}.png"
            subprocess.run(
                ["ffmpeg", "-v", "error", "-i", str(Path(settings.MEDIA_ROOT) / media.proxy_path),
                 "-frames:v", "1", "-f", "image2", "-y", str(out)],
                check=True,
            )  # fmt: skip
            return out.read_bytes()

        plain = self._upload(_api(editor), version, files, ext="png", first=1, last=2)
        assert ReviewMediaService.process(plain.pk) == Status.READY
        plain.refresh_from_db()
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        burnt = self._upload(_api(editor), version, files, ext="png", first=1, last=2)
        assert ReviewMediaService.process(burnt.pk) == Status.READY
        burnt.refresh_from_db()
        assert burnt.probe["burn_ins"] is True and frame_of(burnt) != frame_of(plain)

    def test_a_gap_on_disk_fails_rather_than_making_a_short_copy(
        self, editor, version, queued, settings, tmp_path
    ):
        files = self._frames(tmp_path, "exr", "gbrpf32le", count=5, first=1)
        media = self._upload(_api(editor), version, files, ext="exr", first=1, last=5)
        (Path(settings.MEDIA_ROOT) / media.source_path / "frame.00000003.exr").unlink()
        assert ReviewMediaService.process(media.pk) == Status.FAILED
        media.refresh_from_db()
        assert media.error_code == "unsupported_stream"
