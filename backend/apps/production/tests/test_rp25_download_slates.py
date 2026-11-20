"""
Review-pipeline RP-25: slates on downloaded copies (docs/review-pipeline/CONTRACTS.md C-RP-59,
C-RP-60; Q-RP-113 to Q-RP-116).

WP 25.1: the project's ``review_slates`` (off by default) and ``review_slate_note`` (one line).
WP 25.2: a movie or sequence copy made while the switch is on gets ``download.mp4``, a two-second card
encoded as the copy is and joined to it without re-encoding; any failure leaves the copy without one.
WP 25.3: the download serves it; playback never does.
WP 25.4: ``slate`` is a reason a copy differs.
ffmpeg is faked except in ``TestRealFfmpeg``.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog, ChangeLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Project, ProjectMembership, ReviewMedia
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services import review_media as service_module
from apps.production.services import review_media_links
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    TaskFactory,
    VersionFactory,
)
from apps.production.transcode import ffmpeg as commands

pytestmark = pytest.mark.django_db

Status = ReviewMedia.Status
EDITOR = ("project.view", "project.update", "version.view", "version.update")
MOV = b"\x00\x00\x00\x18ftypqt  \x00\x00\x02\x00"
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_LINK_TTL_SECONDS = 3600
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
    return ProjectFactory.create(code="RPTWOFIVE", name="Slates")


def _user(project, *codes, **membership):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    membership.setdefault("status", "active")
    membership.setdefault("role", "Supervisor")
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
def version(project, editor):
    shot = ShotFactory.create(project=project, code="RPTWOFIVE_SH010")
    task = TaskFactory.create(
        project=project, shot=shot, code="RPTWOFIVE_SH010_COMP", title="Comp", entity_type="Shot"
    )
    return VersionFactory.create(
        project=project, shot=shot, task=task, artist=editor, code="RPTWOFIVE_SH010_V003",
        start_frame=1001,
    )  # fmt: skip


def _slates(project, on=True, note=""):
    Project.objects.filter(pk=project.pk).update(review_slates=on, review_slate_note=note)


def _upload(editor, version, *, still=False) -> ReviewMedia:
    upload = (
        SimpleUploadedFile("frame.png", PNG + b"\x00" * 32)
        if still
        else SimpleUploadedFile("clip.mov", MOV + b"\x00" * 64)
    )
    resp = _api(editor).post(
        f"/api/v1/versions/{version.pk}/review-media/", {"file": upload}, format="multipart"
    )
    assert resp.status_code == 202, resp.content
    return ReviewMedia.objects.get(pk=resp.json()["id"])


def _source_probe(frames=24, audio=True) -> dict[str, Any]:
    streams: list[dict[str, Any]] = [
        {
            "codec_type": "video",
            "codec_name": "h264",
            "width": 640,
            "height": 360,
            "avg_frame_rate": "24/1",
            "r_frame_rate": "24/1",
            "nb_read_packets": str(frames),
        }
    ]
    if audio:
        streams.append({"codec_type": "audio", "codec_name": "aac", "sample_rate": "48000"})
    return {"streams": streams, "format": {"duration": str(frames / 24)}}


def _copy_streams(audio=True) -> dict[str, Any]:
    streams: list[dict[str, Any]] = [
        {
            "codec_type": "video",
            "width": 640,
            "height": 360,
            "r_frame_rate": "24/1",
            "avg_frame_rate": "24/1",
            "sample_aspect_ratio": "1:1",
        }
    ]
    if audio:
        streams.append({"codec_type": "audio", "sample_rate": "48000"})
    return {"streams": streams}


def _fake_run(calls, snapshots, *, audio=True, counts=None, fail_on=None):
    counts = counts or {"proxy": 24, "download": 72}

    def run(args, *, cwd, timeout):
        calls.append(args)
        joined = " ".join(args)
        if fail_on and fail_on in joined:
            return subprocess.CompletedProcess(args, 1, stdout="", stderr="boom")
        if "color=c=black" in joined:
            snapshots.update(
                {p.name: p.read_text() for p in Path(cwd).iterdir() if p.name.startswith("slate_")}
            )
        if Path(args[0]).name == "ffprobe":
            if "csv=p=0" in joined:
                which = "download" if args[-1].endswith("download.mp4") else "proxy"
                return subprocess.CompletedProcess(args, 0, stdout=f"{counts[which]}\n", stderr="")
            if args[-1].endswith("proxy.mp4"):
                return subprocess.CompletedProcess(
                    args, 0, stdout=json.dumps(_copy_streams(audio)), stderr=""
                )
            return subprocess.CompletedProcess(
                args, 0, stdout=json.dumps(_source_probe(audio=audio)), stderr=""
            )
        Path(cwd, args[-1]).write_bytes(b"made")
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

    return run


def _process(media, monkeypatch, **fake):
    calls: list[list[str]] = []
    snapshots: dict[str, str] = {}
    monkeypatch.setattr(commands, "run", _fake_run(calls, snapshots, **fake))
    result = ReviewMediaService.process(media.pk)
    media.refresh_from_db()
    return result, calls, snapshots


def _folder(settings, media) -> Path:
    return Path(settings.MEDIA_ROOT) / media.directory


class TestSwitch:
    """WP 25.1 (Q-RP-113, Q-RP-114)."""

    def test_off_and_blank_by_default(self, project):
        fresh = Project.objects.get(pk=project.pk)
        assert fresh.review_slates is False and fresh.review_slate_note == ""

    def test_written_and_read_on_the_project(self, project, editor):
        resp = _api(editor).patch(
            f"/api/v1/projects/{project.pk}/",
            {"review_slates": True, "review_slate_note": 'Confidential: 100% "internal"'},
            format="json",
        )
        assert resp.status_code == 200, resp.content
        body = _api(editor).get(f"/api/v1/projects/{project.pk}/").json()
        assert body["review_slates"] is True
        assert body["review_slate_note"] == 'Confidential: 100% "internal"'

    def test_a_change_is_in_the_project_s_change_log(self, project, editor):
        _api(editor).patch(
            f"/api/v1/projects/{project.pk}/",
            {"review_slates": True, "review_slate_note": "Confidential"},
            format="json",
        )
        change = ChangeLog.objects.get(target_id=str(project.pk), change_type="update")
        assert sorted(change.changed_fields) == ["review_slate_note", "review_slates"]
        assert change.before_values["review_slates"] == "False"  # stored as text
        assert change.after_values["review_slate_note"] == "Confidential"

    @pytest.mark.parametrize("note", ["two\nlines", "a\ttab", "x" * 121])
    def test_one_line_of_at_most_120_characters(self, project, editor, note):
        resp = _api(editor).patch(
            f"/api/v1/projects/{project.pk}/", {"review_slate_note": note}, format="json"
        )
        assert resp.status_code == 400
        assert "review_slate_note" in resp.json()


class TestCommands:
    """WP 25.2: the pure builders."""

    def test_the_line_files_leave_out_empty_lines_and_keep_text_as_written(self):
        texts = commands.slate_texts(["A  B", "", "100% 'q' \\ %{pts}", "line\nbreak"])
        assert texts == {
            "slate_1.txt": "A  B",
            "slate_2.txt": "100% 'q' \\ %{pts}",
            "slate_3.txt": "line break",
        }

    def test_the_card_is_encoded_as_the_copy_is(self):
        made = commands.CopyFormat(1920, 1080, "24000/1001", "1:1", 48000)
        args = commands.slate_command("ffmpeg", made, [10, 20, 30], Path("/w/slate.mp4"))
        joined = " ".join(args)
        assert "color=c=black:s=1920x1080:r=24000/1001" in joined
        assert "anullsrc=r=48000:cl=stereo" in joined
        assert args[args.index("-frames:v") + 1] == "48" and made.card_frames == 48
        for option in ("libx264", "high", "yuv420p", "-crf 20", "-preset medium", "-r 24000/1001"):
            assert option in joined
        vf = args[args.index("-vf") + 1]
        assert vf.count("drawtext=") == 3 and vf.count("expansion=none") == 3
        assert "textfile=slate_1.txt" in vf and ":text=" not in vf

    def test_a_copy_without_audio_gets_a_silent_card_without_audio(self):
        made = commands.CopyFormat(640, 360, "25/1", "1:1", None)
        joined = " ".join(commands.slate_command("ffmpeg", made, [12], Path("/w/slate.mp4")))
        assert "anullsrc" not in joined and "-c:a" not in joined and made.card_frames == 50

    def test_a_long_line_is_drawn_smaller_so_it_fits(self):
        made = commands.CopyFormat(1920, 1080, "24/1", "1:1", None)
        assert commands.slate_font_size(made, 0, 18) == 60  # the first line, h/18
        assert commands.slate_font_size(made, 1, 30) == 36  # the others, h/30
        long = commands.slate_font_size(made, 7, 120)
        assert long < 36 and 120 * long * 0.62 <= 1920 * 0.84
        args = commands.slate_command("ffmpeg", made, [18, 120], Path("/w/slate.mp4"))
        vf = args[args.index("-vf") + 1]
        assert "fontsize=60:" in vf and f"fontsize={long}:" in vf

    def test_the_join_copies_the_frames(self):
        args = commands.join_command("ffmpeg", Path("/w/download.mp4"))
        assert args[args.index("-c") + 1] == "copy" and "libx264" not in args
        assert args[args.index("-f") + 1] == "concat" and "+faststart" in args
        assert commands.slate_list() == "file 'slate.mp4'\nfile 'proxy.mp4'\n"

    def test_the_copy_is_read_back(self):
        made = commands.parse_copy_format(json.dumps(_copy_streams()))
        assert made == commands.CopyFormat(640, 360, "24/1", "1:1", 48000)
        assert commands.parse_copy_format(json.dumps(_copy_streams(audio=False))).audio_rate is None
        with pytest.raises(commands.ProbeError):
            commands.parse_copy_format('{"streams": []}')


class TestJob:
    """WP 25.2 (Q-RP-115)."""

    def test_off_no_slate_and_no_slate_command(
        self, editor, version, queued, monkeypatch, settings
    ):
        media = _upload(editor, version)
        result, calls, _ = _process(media, monkeypatch)
        assert result == Status.READY
        assert media.probe["slate"] is False and media.probe["slate_skipped"] is None
        assert not any("color=c=black" in " ".join(a) or "concat" in a for a in calls)
        assert not (_folder(settings, media) / "download.mp4").exists()
        assert review_media_links.download_path(media) == media.proxy_path

    def test_on_the_download_has_its_slate_and_the_copy_is_unchanged(
        self, editor, version, project, queued, monkeypatch, settings
    ):
        _slates(project, note="Confidential: do not forward")
        media = _upload(editor, version)
        result, calls, lines = _process(media, monkeypatch)
        assert result == Status.READY and media.probe["slate"] is True
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]["probe"]
        assert (shown["slate"], shown["slate_skipped"]) == (True, None)
        assert (_folder(settings, media) / "download.mp4").is_file()
        assert media.proxy_path.endswith("/proxy.mp4")
        assert review_media_links.download_path(media).endswith("/download.mp4")
        proxy = next(a for a in calls if "libx264" in a and "color=c=black" not in " ".join(a))
        assert "drawtext" not in " ".join(proxy)  # playback's copy never carries the slate
        assert lines == {
            "slate_1.txt": "RPTWOFIVE  Slates",
            "slate_2.txt": "RPTWOFIVE_SH010",
            "slate_3.txt": "RPTWOFIVE_SH010_V003",
            "slate_4.txt": "Task: RPTWOFIVE_SH010_COMP  Comp",
            "slate_5.txt": f"Artist: {editor.display_name}",
            "slate_6.txt": "Frames 1001-1024 (24)  24 fps",
            "slate_7.txt": f"Made {timezone.now().date().isoformat()}",
            "slate_8.txt": "Confidential: do not forward",
        }
        order = [" ".join(a) for a in calls]
        card = next(i for i, a in enumerate(order) if "color=c=black" in a)
        join = next(i for i, a in enumerate(order) if "-f concat" in a)
        decode = next(i for i, a in enumerate(order) if "-xerror" in a)
        assert card < join < decode

    def test_a_movie_without_audio_gets_a_card_without_audio(
        self, editor, version, project, queued, monkeypatch
    ):
        _slates(project)
        media = _upload(editor, version)
        result, calls, _ = _process(media, monkeypatch, audio=False)
        card = next(a for a in calls if "color=c=black" in " ".join(a))
        assert result == Status.READY and media.probe["slate"] is True
        assert "anullsrc" not in " ".join(card)

    def test_a_still_never_has_one(self, editor, version, project, queued, monkeypatch):
        _slates(project)
        media = _upload(editor, version, still=True)
        result, calls, _ = _process(media, monkeypatch)
        assert result == Status.READY and media.probe["slate"] is False
        assert not any("color=c=black" in " ".join(a) for a in calls)

    @pytest.mark.parametrize("step", ["color=c=black", "-f concat", "-xerror"])
    def test_a_failed_step_leaves_the_copy_ready_without_a_slate(
        self, editor, version, project, queued, monkeypatch, settings, step
    ):
        _slates(project)
        media = _upload(editor, version)
        result, _, _ = _process(media, monkeypatch, fail_on=step)
        assert result == Status.READY and media.proxy_path
        assert media.probe["slate"] is False and media.probe["slate_skipped"] == "slate_failed"
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]["probe"]
        assert (shown["slate"], shown["slate_skipped"]) == (False, "slate_failed")
        assert not (_folder(settings, media) / "download.mp4").exists()
        assert review_media_links.download_path(media) == media.proxy_path

    def test_a_join_with_the_wrong_frame_count_is_not_kept(
        self, editor, version, project, queued, monkeypatch, settings
    ):
        _slates(project)
        media = _upload(editor, version)
        result, _, _ = _process(media, monkeypatch, counts={"proxy": 24, "download": 70})
        assert result == Status.READY and media.probe["slate_skipped"] == "slate_failed"
        assert not (_folder(settings, media) / "download.mp4").exists()

    def test_a_missing_font_leaves_the_copy_without_one(
        self, editor, version, project, queued, monkeypatch, settings
    ):
        _slates(project)
        settings.REVIEW_MEDIA_BURN_IN_FONT = "/nowhere/font.ttf"
        media = _upload(editor, version)
        result, calls, _ = _process(media, monkeypatch)
        assert result == Status.READY and media.probe["slate_skipped"] == "font_missing"
        assert not any("color=c=black" in " ".join(a) for a in calls)


def _ready(version, settings, *, slate=False, kind=ReviewMedia.Kind.MOVIE, still=False):
    """A ready copy with its files on disk, as the job leaves it."""
    folder = f"review_media/{version.pk}/rp25-{ReviewMedia.objects.count()}"
    root = Path(settings.MEDIA_ROOT) / folder
    root.mkdir(parents=True, exist_ok=True)
    proxy = "proxy.jpg" if still else "proxy.mp4"
    (root / proxy).write_bytes(b"COPY" * 4)
    (root / "thumbnail.jpg").write_bytes(b"thumb")
    if slate:
        (root / "download.mp4").write_bytes(b"SLATE+COPY" * 4)
    return ReviewMedia.objects.create(
        version=version,
        project=version.project,
        kind=ReviewMedia.Kind.STILL if still else kind,
        status=Status.READY,
        source_name="clip.mov",
        source_container="mov",
        proxy_path=f"{folder}/{proxy}",
        thumbnail_path=f"{folder}/thumbnail.jpg",
        probe={"frames": 24, "slate": slate, "burn_ins": False, "ocio": None, "grade": None},
        queued_at=timezone.now(),
        finished_at=timezone.now(),
    )


def _second(project):
    """Another version: a version has one ready copy at a time."""
    shot = ShotFactory.create(project=project, code="RPTWOFIVE_SH020")
    return VersionFactory.create(project=project, shot=shot, code="RPTWOFIVE_SH020_V001")


def _copy_of(editor, version):
    return _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]


def _body(response) -> bytes:
    return b"".join(response.streaming_content) if response.streaming else response.content


class TestDownload:
    """WP 25.3."""

    def test_the_download_serves_the_slated_file_and_playback_the_copy(
        self, editor, version, settings
    ):
        _ready(version, settings, slate=True)
        copy = _copy_of(editor, version)
        download = APIClient().get(copy["download_url"])
        assert download.status_code == 200 and _body(download) == b"SLATE+COPY" * 4
        assert download["Content-Disposition"] == 'attachment; filename="RPTWOFIVE_SH010_V003.mp4"'
        assert _body(APIClient().get(copy["proxy_url"])) == b"COPY" * 4
        row = AuditLog.objects.get(target_id=str(version.pk), metadata__operation="download")
        assert row.metadata["slate"] is True

    def test_without_a_slate_the_download_is_the_copy(self, editor, version, settings):
        _ready(version, settings, slate=False)
        download = APIClient().get(_copy_of(editor, version)["download_url"])
        assert download.status_code == 200 and _body(download) == b"COPY" * 4
        row = AuditLog.objects.get(target_id=str(version.pk), metadata__operation="download")
        assert row.metadata["slate"] is False

    def test_behind_nginx_the_slated_file_is_redirected_to(self, editor, version, settings):
        media = _ready(version, settings, slate=True)
        settings.MEDIA_ACCEL_PREFIX = "/protected-media"
        download = APIClient().get(_copy_of(editor, version)["download_url"])
        folder = media.proxy_path.rsplit("/", 1)[0]
        assert download["X-Accel-Redirect"] == f"/protected-media/{folder}/download.mp4"
        assert download["Content-Disposition"] == 'attachment; filename="RPTWOFIVE_SH010_V003.mp4"'


class TestDiffering:
    """WP 25.4 (Q-RP-116)."""

    def test_slate_is_a_reason_both_ways(self, project, version, settings):
        without = _ready(version, settings, slate=False)
        assert "slate" not in ReviewMediaSelector.differences(project).get(without.pk, [])
        _slates(project)
        project.refresh_from_db()
        assert "slate" in ReviewMediaSelector.differences(project)[without.pk]
        with_one = _ready(_second(project), settings, slate=True)
        assert with_one.pk not in ReviewMediaSelector.differences(project)
        _slates(project, on=False)
        project.refresh_from_db()
        assert "slate" in ReviewMediaSelector.differences(project)[with_one.pk]

    def test_a_copy_made_before_counts_as_without(self, project, version, settings):
        old = _ready(version, settings)
        ReviewMedia.objects.filter(pk=old.pk).update(probe={"frames": 24})
        shown = _api(_user(project, *EDITOR)).get(f"/api/v1/versions/{version.pk}/").json()
        assert shown["review_media"]["probe"]["slate"] is False  # a row made before RP-25
        _slates(project)
        project.refresh_from_db()
        assert "slate" in ReviewMediaSelector.differences(project)[old.pk]

    def test_a_still_never_and_the_line_alone_never(self, project, version, settings):
        still = _ready(version, settings, still=True)
        _slates(project, note="Confidential")
        project.refresh_from_db()
        assert "slate" not in ReviewMediaSelector.differences(project).get(still.pk, [])
        slated = _ready(_second(project), settings, slate=True)
        _slates(project, note="Another line")
        project.refresh_from_db()
        assert slated.pk not in ReviewMediaSelector.differences(project)

    def test_a_kept_copy_is_kept_against_the_slate_too(self, project, version, settings):
        copy = _ready(version, settings)
        ReviewMedia.objects.filter(pk=copy.pk).update(
            kept_for={"burn_ins": False, "ocio": None, "grade": None, "slate": False}
        )
        assert copy.pk not in ReviewMediaSelector.differences(project)
        _slates(project)
        project.refresh_from_db()
        assert "slate" in ReviewMediaSelector.differences(project)[copy.pk]
        copy.refresh_from_db()
        now = ReviewMediaSelector.settings_now(project, copy)
        assert now is not None and now["slate"] is True


class TestRemake:
    """WP 25.4 (Q-RP-116): turning the switch on counts the copies, and remaking adds the slate."""

    def test_the_summary_and_the_remake(self, editor, version, project, queued, monkeypatch):
        old = _upload(editor, version)
        _process(old, monkeypatch)
        ReviewMedia.objects.filter(pk=old.pk).update(burn_in_date=date(2026, 1, 2))
        copies = f"/api/v1/projects/{project.pk}/review-copies/"
        body = _api(editor).get(copies).json()
        assert (body["review_slates"], body["slate_out_of_date"], body["out_of_date"]) == (
            False,
            0,
            0,
        )
        _slates(project)
        body = _api(editor).get(copies).json()
        assert (body["review_slates"], body["slate_out_of_date"], body["out_of_date"]) == (
            True,
            1,
            1,
        )
        assert [row["why"] for row in body["differing"]] == [["slate"]]
        remade = _api(editor).post(f"{copies}remake/")
        assert remade.status_code == 200, remade.content
        assert remade.json()["queued"] == 1
        made = ReviewMedia.objects.exclude(pk=old.pk).get(version=version)
        result, _, lines = _process(made, monkeypatch)
        assert result == Status.READY and made.probe["slate"] is True
        assert lines["slate_7.txt"] == "Made 2026-01-02"  # the original's date, kept (C-RP-37)
        assert _api(editor).get(copies).json()["slate_out_of_date"] == 0


# ---------------------------------------------------------------------------------------------- real ffmpeg


def _font() -> str | None:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).is_file():
            return candidate
    return None


def _ffmpeg_usable() -> bool:
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        return False
    filters = subprocess.run(
        ["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True, check=False
    ).stdout
    return " drawtext " in filters and " anullsrc " in filters


@pytest.mark.skipif(
    not _ffmpeg_usable() or _font() is None,
    reason="needs ffmpeg with drawtext and anullsrc, and DejaVu Sans (the worker image's)",
)
class TestRealFfmpeg:
    def _clip(self, tmp_path, *, audio: bool, frames=36, rate="24") -> bytes:
        out = tmp_path / f"clip-{audio}.mov"
        args = ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=size=640x360:rate={rate}"]
        if audio:
            args += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100"]
        args += ["-frames:v", str(frames), "-c:v", "libx264", "-pix_fmt", "yuv420p"]
        args += ["-shortest", "-c:a", "aac"] if audio else []
        subprocess.run([*args, "-y", str(out)], check=True)
        return out.read_bytes()

    def _streams(self, path: Path) -> list[dict[str, Any]]:
        return json.loads(
            subprocess.run(
                ["ffprobe", "-v", "error", "-count_packets", "-show_streams", "-of", "json", str(path)],
                capture_output=True, text=True, check=True,
            ).stdout
        )["streams"]  # fmt: skip

    def _first_frame_mean(self, path: Path, tmp_path: Path, at: float = 0.0) -> float:
        out = tmp_path / f"{path.parent.name}-{path.stem}-{at}.gray"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{at}", "-i", str(path), "-frames:v", "1",
             "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-y", str(out)],
            check=True,
        )  # fmt: skip
        data = out.read_bytes()
        return sum(data) / len(data)

    @pytest.mark.parametrize("audio", [True, False])
    def test_the_download_is_the_card_then_the_copy(
        self, editor, version, project, queued, settings, tmp_path, audio
    ):
        settings.REVIEW_MEDIA_BURN_IN_FONT = _font()
        _slates(project, note="Confidential: 100% 'internal' %{pts}")
        upload = SimpleUploadedFile("clip.mov", self._clip(tmp_path, audio=audio))
        resp = _api(editor).post(
            f"/api/v1/versions/{version.pk}/review-media/", {"file": upload}, format="multipart"
        )
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert media.probe["slate"] is True, media.probe.get("slate_skipped")
        root = Path(settings.MEDIA_ROOT)
        copy, download = root / media.proxy_path, root / review_media_links.download_path(media)
        copy_video = next(s for s in self._streams(copy) if s["codec_type"] == "video")
        streams = self._streams(download)
        video = next(s for s in streams if s["codec_type"] == "video")
        assert int(copy_video["nb_read_packets"]) == 36
        assert int(video["nb_read_packets"]) == 36 + 48
        assert (video["codec_name"], video["width"], video["height"]) == ("h264", 640, 360)
        assert any(s["codec_type"] == "audio" for s in streams) is audio
        # the card is black with a little text; two seconds in, the copy's first frame
        assert self._first_frame_mean(download, tmp_path) < 30
        assert self._first_frame_mean(copy, tmp_path) > 30
        assert (
            abs(
                self._first_frame_mean(download, tmp_path, at=2.0)
                - self._first_frame_mean(copy, tmp_path)
            )
            < 8
        )
        decoded = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(download), "-f", "null", "-"],
            capture_output=True, text=True, check=False,
        )  # fmt: skip
        assert decoded.returncode == 0 and decoded.stderr == ""
