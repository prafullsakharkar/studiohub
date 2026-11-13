"""
Review pipeline RP-5: review media (docs/review-pipeline PLAN WP 5.1 to 5.3; CONTRACTS C-RP-19 to
C-RP-22; Q-RP-24 to Q-RP-31 = A; ADR-0040).

A movie or still uploaded to a version is stored under MEDIA_ROOT, processed by the media worker
(ffmpeg, mocked here except in ``TestRealFfmpeg``) and played through signed, per-user links.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from datetime import timedelta
from pathlib import Path
from unittest import mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import (
    ProjectMembership,
    Review,
    ReviewItem,
    ReviewMedia,
    ReviewParticipant,
)
from apps.production.services import review_media as service_module
from apps.production.services import review_media_links
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import ProjectFactory, ShotFactory, VersionFactory
from apps.production.transcode import detect
from apps.production.transcode import ffmpeg as commands

pytestmark = pytest.mark.django_db

EDITOR = ("project.view", "version.view", "version.update")
VIEWER = ("project.view", "version.view")
MOV_HEAD = b"\x00\x00\x00\x18ftypqt  \x00\x00\x02\x00"
PNG_HEAD = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
PROBE = {
    "streams": [
        {
            "codec_type": "video",
            "codec_name": "prores",
            "width": 3840,
            "height": 2160,
            "avg_frame_rate": "24000/1001",
            "r_frame_rate": "24000/1001",
            "duration": "4.004",
            "nb_read_packets": "96",
        },
        {"codec_type": "audio", "codec_name": "pcm_s24le"},
    ],
    "format": {"duration": "4.004"},
}
Status = ReviewMedia.Status


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_MAX_BYTES = 10 * 1024 * 1024
    settings.REVIEW_MEDIA_LINK_TTL_SECONDS = 3600


@pytest.fixture
def queued(monkeypatch):
    """The ids queued for processing (the real ``enqueue`` would run the job eagerly)."""
    calls: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: calls.append(str(media_id)))
    return calls


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPFIVE")


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
    shot = ShotFactory.create(project=project, code="RPFIVE_SH010")
    return VersionFactory.create(project=project, shot=shot, code="RPFIVE_SH010_V001")


def _movie(name="clip.mov", body=b"", head=MOV_HEAD):
    return SimpleUploadedFile(name, head + (body or b"\x00" * 64), content_type="video/quicktime")


def _upload(api, version, upload, capture=None):
    url = f"/api/v1/versions/{version.pk}/review-media/"
    if capture is None:
        return api.post(url, {"file": upload}, format="multipart")
    with capture(execute=True):
        return api.post(url, {"file": upload}, format="multipart")


def _fake_run(calls, *, probe=PROBE, fail_on=None, timeout_on=None, write=True):
    """A stand-in for ``commands.run``: answers the probe and writes each output file."""

    def run(args, *, cwd, timeout):
        calls.append(args)
        program = Path(args[0]).name
        if timeout_on and timeout_on in " ".join(args):
            raise subprocess.TimeoutExpired(args, timeout)
        if fail_on and fail_on in " ".join(args):
            return subprocess.CompletedProcess(args, 1, stdout="", stderr="boom /secret/path")
        if program == "ffprobe":
            return subprocess.CompletedProcess(args, 0, stdout=json.dumps(probe), stderr="")
        if write:
            Path(args[-1]).write_bytes(b"made")
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

    return run


def _uploaded(api, version, capture, queued, upload=None):
    resp = _upload(api, version, upload or _movie(), capture)
    assert resp.status_code == 202, resp.content
    return ReviewMedia.objects.get(pk=resp.json()["id"])


def _process(media, monkeypatch, **fake):
    calls: list[list[str]] = []
    monkeypatch.setattr(commands, "run", _fake_run(calls, **fake))
    result = ReviewMediaService.process(media.pk)
    media.refresh_from_db()
    return result, calls


# ---------------------------------------------------------------------------------------------- C-RP-19


class TestUpload:
    def test_an_editor_uploads_a_movie_and_the_job_is_queued_after_commit(
        self, editor, version, queued, django_capture_on_commit_callbacks, settings
    ):
        body = b"\x01" * 4096
        resp = _upload(
            _api(editor), version, _movie("Hero Shot.MOV", body), django_capture_on_commit_callbacks
        )
        assert resp.status_code == 202, resp.content
        data = resp.json()
        media = ReviewMedia.objects.get(pk=data["id"])
        assert queued == [str(media.pk)]
        assert data["status"] == "queued" and data["kind"] == "movie"
        assert data["source_name"] == "Hero Shot.MOV"
        assert data["source_size"] == len(MOV_HEAD) + len(body)
        assert (
            data["proxy_url"] is None and data["links_expire_at"] is None and data["probe"] is None
        )
        assert data["created_by"]["id"] == str(editor.pk)
        # stored under our own name, hashed while written
        assert (
            media.source_path
            == f"review_media/{version.project_id}/{version.pk}/{media.pk}/source.mov"
        )
        stored = Path(settings.MEDIA_ROOT) / media.source_path
        assert stored.read_bytes() == MOV_HEAD + body
        import hashlib

        assert media.source_sha256 == hashlib.sha256(MOV_HEAD + body).hexdigest()
        assert media.source_container == "mov"

    def test_nothing_is_queued_before_commit(self, editor, version, queued):
        assert _upload(_api(editor), version, _movie()).status_code == 202
        assert queued == []

    def test_a_still_is_a_still(self, editor, version, queued):
        upload = SimpleUploadedFile("frame.png", PNG_HEAD + b"\x00" * 32, content_type="image/png")
        resp = _upload(_api(editor), version, upload)
        assert resp.status_code == 202 and resp.json()["kind"] == "still"

    def test_the_upload_is_audited_without_the_file_name(self, editor, version, queued):
        resp = _upload(_api(editor), version, _movie("private-name.mov"))
        row = AuditLog.objects.get(
            target_type=AuditLog.TARGET_VERSION, metadata__operation="review_media_upload"
        )
        assert row.target_id == str(version.pk) and row.actor_id == editor.pk
        assert row.metadata["review_media_id"] == resp.json()["id"]
        assert "private-name" not in json.dumps(row.metadata) + row.description

    def test_off_is_a_409_before_anything_is_read(self, editor, version, queued, settings):
        settings.REVIEW_MEDIA_ENABLED = False
        resp = _upload(_api(editor), version, _movie())
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "review_media_disabled"
        assert not ReviewMedia.objects.exists()

    def test_off_never_parses_the_body(self, editor, version, queued, settings):
        """The switch is read before ``request.data``: a 2 GB body is not spooled to be refused."""
        settings.REVIEW_MEDIA_ENABLED = False
        with mock.patch("apps.production.api.viewsets.version.ReviewMediaUploadSerializer") as body:
            assert _upload(_api(editor), version, _movie()).status_code == 409
        body.assert_not_called()

    def test_a_second_upload_while_one_is_in_flight_is_a_409(self, editor, version, queued):
        api = _api(editor)
        assert _upload(api, version, _movie()).status_code == 202
        resp = _upload(api, version, _movie())
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_busy"
        assert ReviewMedia.objects.count() == 1

    @pytest.mark.parametrize(
        ("upload", "message"),
        [
            (SimpleUploadedFile("empty.mov", b""), "The file is empty."),
            (
                SimpleUploadedFile("plate.exr", b"v/1\x01" + b"\x00" * 32),
                "Upload a movie or a still",
            ),
            (SimpleUploadedFile("plate.dpx", b"SDPX" + b"\x00" * 32), "Upload a movie or a still"),
            (SimpleUploadedFile("noext", MOV_HEAD), "Upload a movie or a still"),
            (
                SimpleUploadedFile("frame.jpg", MOV_HEAD + b"\x00" * 32),
                "does not match its extension",
            ),
            (
                SimpleUploadedFile("clip.mov", PNG_HEAD + b"\x00" * 32),
                "does not match its extension",
            ),
            (
                SimpleUploadedFile("evil.mp4", b"#EXTM3U\n#EXTINF:1,\nfile:///etc/passwd\n"),
                "does not match its extension",
            ),
        ],
    )
    def test_refused_files_are_a_400_on_file_and_store_nothing(
        self, editor, version, queued, settings, upload, message
    ):
        resp = _upload(_api(editor), version, upload)
        assert resp.status_code == 400, resp.content
        assert message in json.dumps(resp.json())
        assert "file" in json.dumps(resp.json())
        assert not ReviewMedia.objects.exists()
        assert not any(Path(settings.MEDIA_ROOT).rglob("source.*"))

    def test_a_file_over_the_limit_is_a_400(self, editor, version, queued, settings):
        settings.REVIEW_MEDIA_MAX_BYTES = 100
        resp = _upload(_api(editor), version, _movie(body=b"\x00" * 200))
        assert resp.status_code == 400 and "larger than" in json.dumps(resp.json())

    def test_no_file_is_a_400(self, editor, version, queued):
        resp = _api(editor).post(
            f"/api/v1/versions/{version.pk}/review-media/", {}, format="multipart"
        )
        assert resp.status_code == 400 and "file" in json.dumps(resp.json())

    def test_version_update_is_needed(self, project, version, queued):
        viewer = _user(project, *VIEWER)
        assert _upload(_api(viewer), version, _movie()).status_code == 403

    def test_a_version_out_of_reach_is_a_404(self, version, queued):
        stranger = _user(ProjectFactory.create(code="OTHER"), *EDITOR)
        assert _upload(_api(stranger), version, _movie()).status_code == 404

    def test_a_failure_while_storing_leaves_no_row_and_no_folder(
        self, editor, version, queued, settings, monkeypatch
    ):
        def broken(upload, relative):
            (Path(settings.MEDIA_ROOT) / relative).parent.mkdir(parents=True, exist_ok=True)
            (Path(settings.MEDIA_ROOT) / relative).write_bytes(b"partial")
            raise OSError("disk full")

        monkeypatch.setattr(ReviewMediaService, "_store", staticmethod(broken))
        with pytest.raises(OSError):
            ReviewMediaService.upload(actor=editor, version=version, upload=_movie())
        assert not ReviewMedia.objects.exists()
        assert not any(Path(settings.MEDIA_ROOT).rglob("partial*")) and not any(
            Path(settings.MEDIA_ROOT).rglob("source.*")
        )

    def test_the_list_answers_every_row_newest_first(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        api = _api(editor)
        first = _uploaded(api, version, django_capture_on_commit_callbacks, queued)
        _process(first, monkeypatch)
        second = _uploaded(api, version, django_capture_on_commit_callbacks, queued)
        resp = api.get(f"/api/v1/versions/{version.pk}/review-media/")
        assert resp.status_code == 200
        assert [row["id"] for row in resp.json()] == [str(second.pk), str(first.pk)]
        viewer = _user(version.project, *VIEWER)
        assert _api(viewer).get(f"/api/v1/versions/{version.pk}/review-media/").status_code == 200


# ---------------------------------------------------------------------------------------------- C-RP-20


class TestProcessing:
    def test_a_movie_becomes_ready_with_its_probe_and_three_files(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        result, calls = _process(media, monkeypatch)
        assert result == Status.READY and media.status == Status.READY
        assert media.attempts == 1 and media.started_at and media.finished_at
        assert media.probe == {
            "width": 3840,
            "height": 2160,
            "fps": 23.976,
            "frame_rate": "24000/1001",
            "frames": 96,
            "duration_seconds": 4.004,
            "video_codec": "prores",
            "has_audio": True,
        }
        folder = media.directory
        assert (media.proxy_path, media.thumbnail_path, media.filmstrip_path) == (
            f"{folder}/proxy.mp4",
            f"{folder}/thumbnail.jpg",
            f"{folder}/filmstrip.jpg",
        )
        assert media.filmstrip_tiles == 48  # 96 frames, every 2nd
        root = Path(settings.MEDIA_ROOT)
        assert all(
            (root / p).is_file()
            for p in (media.proxy_path, media.thumbnail_path, media.filmstrip_path)
        )
        assert not any(root.rglob("work-*"))
        assert [Path(c[0]).name for c in calls] == ["ffprobe", "ffmpeg", "ffmpeg", "ffmpeg"]

    def test_every_command_forces_the_demuxer_and_reads_only_local_files(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        _, calls = _process(media, monkeypatch)
        source = str(Path(settings.MEDIA_ROOT) / media.source_path)
        for args in calls:
            assert isinstance(args, list)
            joined = " ".join(args)
            assert args[args.index("-f") + 1] == "mov"
            assert args[args.index("-format_whitelist") + 1] == "mov"
            assert args[args.index("-protocol_whitelist") + 1] == "file"
            assert args[args.index("-i") + 1] == f"file:{source}"
            # the input options come before the input
            assert args.index("-protocol_whitelist") < args.index("-i") and args.index(
                "-f"
            ) < args.index("-i")
            assert "sh -c" not in joined
        proxy = calls[1]
        assert proxy[proxy.index("-r") + 1] == "24000/1001"
        assert proxy[proxy.index("-g") + 1] == "24"
        assert "+faststart" in proxy and "libx264" in proxy

    def test_commands_run_without_a_shell(self, monkeypatch, tmp_path):
        seen = {}

        def fake(args, **kwargs):
            seen.update(kwargs, args=args)
            return subprocess.CompletedProcess(args, 0, "", "")

        monkeypatch.setattr(subprocess, "run", fake)
        commands.run(["ffprobe", "-v", "error"], cwd=tmp_path, timeout=5)
        assert seen["args"] == ["ffprobe", "-v", "error"]
        assert (
            not seen.get("shell") and seen["stdin"] == subprocess.DEVNULL and seen["timeout"] == 5
        )

    def test_a_still_gets_a_proxy_and_a_thumbnail_and_no_filmstrip(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        upload = SimpleUploadedFile("frame.png", PNG_HEAD + b"\x00" * 32)
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued, upload)
        probe = {
            "streams": [{"codec_type": "video", "codec_name": "png", "width": 2048, "height": 858}]
        }
        result, calls = _process(media, monkeypatch, probe=probe)
        assert result == Status.READY
        assert (
            media.proxy_path.endswith("/proxy.jpg")
            and media.filmstrip_path == ""
            and media.filmstrip_tiles == 0
        )
        assert media.probe["frames"] == 1 and media.probe["width"] == 2048
        assert all(c[c.index("-f") + 1] == "png_pipe" for c in calls)

    def test_ready_supersedes_the_previous_ready_row_and_deletes_its_files(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        api = _api(editor)
        first = _uploaded(api, version, django_capture_on_commit_callbacks, queued)
        _process(first, monkeypatch)
        second = _uploaded(api, version, django_capture_on_commit_callbacks, queued)
        with django_capture_on_commit_callbacks(execute=True):
            _process(second, monkeypatch)
        first.refresh_from_db()
        assert (
            first.status == Status.SUPERSEDED
            and first.proxy_path == ""
            and first.filmstrip_tiles == 0
        )
        assert second.status == Status.READY
        assert not (Path(settings.MEDIA_ROOT) / first.directory).exists()
        assert (Path(settings.MEDIA_ROOT) / second.proxy_path).is_file()

    def test_until_then_the_old_movie_keeps_playing(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        api = _api(editor)
        first = _uploaded(api, version, django_capture_on_commit_callbacks, queued)
        _process(first, monkeypatch)
        second = _uploaded(api, version, django_capture_on_commit_callbacks, queued)
        body = api.get(f"/api/v1/versions/{version.pk}/").json()
        assert body["review_media"]["id"] == str(first.pk) and body["review_media"]["proxy_url"]
        assert (
            body["review_media_job"]["id"] == str(second.pk)
            and body["review_media_job"]["status"] == "queued"
        )

    @pytest.mark.parametrize(
        ("fake", "code"),
        [
            ({"fail_on": "ffprobe"}, "probe_failed"),
            ({"probe": {"streams": [{"codec_type": "audio"}]}}, "unsupported_stream"),
            (
                {
                    "probe": {
                        "streams": [
                            {
                                "codec_type": "video",
                                "width": 20000,
                                "height": 10,
                                "avg_frame_rate": "24/1",
                                "nb_read_packets": "5",
                            }
                        ]
                    }
                },
                "unsupported_stream",
            ),
            (
                {
                    "probe": {
                        "streams": [
                            {
                                "codec_type": "video",
                                "width": 10,
                                "height": 10,
                                "avg_frame_rate": "0/0",
                                "r_frame_rate": "0/0",
                                "nb_read_packets": "5",
                            }
                        ]
                    }
                },
                "unsupported_stream",
            ),
            ({"fail_on": "libx264"}, "transcode_failed"),
            ({"fail_on": "tile="}, "transcode_failed"),
            ({"write": False}, "transcode_failed"),
            ({"timeout_on": "libx264"}, "timeout"),
        ],
    )
    def test_each_failure_has_its_code_and_a_fixed_message(
        self,
        editor,
        version,
        queued,
        monkeypatch,
        settings,
        django_capture_on_commit_callbacks,
        fake,
        code,
    ):
        api = _api(editor)
        media = _uploaded(api, version, django_capture_on_commit_callbacks, queued)
        result, _ = _process(media, monkeypatch, **fake)
        assert (
            result == Status.FAILED and media.status == Status.FAILED and media.error_code == code
        )
        assert media.proxy_path == "" and media.finished_at is not None
        assert not any(Path(settings.MEDIA_ROOT).rglob("work-*"))
        # the source stays for a retry
        assert (Path(settings.MEDIA_ROOT) / media.source_path).is_file()
        job = api.get(f"/api/v1/versions/{version.pk}/").json()["review_media_job"]
        assert (
            job["error_code"] == code and job["error_message"] == ReviewMedia.ErrorCode(code).label
        )
        assert "boom" not in json.dumps(job) and "/secret/path" not in json.dumps(job)

    def test_ffmpeg_output_goes_to_the_log(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        with mock.patch.object(service_module, "logger") as logger:
            _process(media, monkeypatch, fail_on="libx264")
        logged = logger.warning.call_args_list[0]
        assert logged.args[0] == "review_media_command_failed" and "boom" in logged.kwargs["stderr"]

    def test_a_missing_source_fails_with_source_missing(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        (Path(settings.MEDIA_ROOT) / media.source_path).unlink()
        result, calls = _process(media, monkeypatch)
        assert result == Status.FAILED and media.error_code == "source_missing" and calls == []

    def test_a_redelivered_or_finished_job_does_nothing(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        _process(media, monkeypatch)
        result, calls = _process(media, monkeypatch)
        assert result is None and calls == [] and media.attempts == 1
        assert ReviewMediaService.process("00000000-0000-4000-8000-000000000000") is None

    def test_a_job_swept_while_it_ran_keeps_nothing(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        real_make = ReviewMediaService._make

        def make_then_swept(m, container, source, work):
            made = real_make(m, container, source, work)
            ReviewMedia.objects.filter(pk=m.pk).update(status=Status.FAILED, error_code="timeout")
            return made

        monkeypatch.setattr(ReviewMediaService, "_make", staticmethod(make_then_swept))
        result, _ = _process(media, monkeypatch)
        assert result == Status.FAILED and media.status == Status.FAILED and media.proxy_path == ""
        assert not (Path(settings.MEDIA_ROOT) / media.directory / "proxy.mp4").exists()

    def test_a_soft_time_limit_fails_with_timeout(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        from celery.exceptions import SoftTimeLimitExceeded

        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)

        def stop(*args, **kwargs):
            raise SoftTimeLimitExceeded()

        monkeypatch.setattr(ReviewMediaService, "_make", staticmethod(stop))
        assert ReviewMediaService.process(media.pk) == Status.FAILED
        media.refresh_from_db()
        assert media.error_code == "timeout"


class TestRetryAndSweep:
    def _failed(self, editor, version, queued, monkeypatch, capture):
        media = _uploaded(_api(editor), version, capture, queued)
        _process(media, monkeypatch, fail_on="libx264")
        return media

    def test_a_failed_row_is_queued_again_after_commit(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = self._failed(
            editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
        )
        queued.clear()
        with django_capture_on_commit_callbacks(execute=True):
            resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/retry/")
        assert resp.status_code == 202, resp.content
        assert resp.json()["status"] == "queued" and resp.json()["error_code"] == ""
        assert queued == [str(media.pk)]
        assert AuditLog.objects.filter(metadata__operation="review_media_retry").count() == 1
        result, _ = _process(media, monkeypatch)
        assert result == Status.READY and media.attempts == 2

    def test_at_most_three_attempts(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = self._failed(
            editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
        )
        api = _api(editor)
        for _ in range(2):
            assert api.post(f"/api/v1/review-media/{media.pk}/retry/").status_code == 202
            _process(media, monkeypatch, fail_on="libx264")
        assert media.attempts == 3
        resp = api.post(f"/api/v1/review-media/{media.pk}/retry/")
        assert resp.status_code == 400 and "Upload the file again" in json.dumps(resp.json())

    def test_only_a_failed_row_can_be_retried(
        self, editor, version, queued, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/retry/")
        assert resp.status_code == 400 and "Only a failed upload" in json.dumps(resp.json())

    def test_retry_needs_version_update_and_reach(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = self._failed(
            editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
        )
        viewer = _user(project, *VIEWER)
        assert _api(viewer).post(f"/api/v1/review-media/{media.pk}/retry/").status_code == 403
        stranger = _user(ProjectFactory.create(code="OTHER"), *EDITOR)
        assert _api(stranger).post(f"/api/v1/review-media/{media.pk}/retry/").status_code == 404
        assert _api(editor).post("/api/v1/review-media/not-an-id/retry/").status_code == 404

    def test_retry_while_another_upload_is_in_flight_is_a_409(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = self._failed(
            editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
        )
        _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/retry/")
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_busy"

    def test_retry_when_off_is_a_409(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = self._failed(
            editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
        )
        settings.REVIEW_MEDIA_ENABLED = False
        resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/retry/")
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_disabled"

    def test_a_later_success_supersedes_older_failed_rows(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        failed = self._failed(
            editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
        )
        later = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        with django_capture_on_commit_callbacks(execute=True):
            _process(later, monkeypatch)
        failed.refresh_from_db()
        assert failed.status == Status.SUPERSEDED
        assert not (Path(settings.MEDIA_ROOT) / failed.directory).exists()
        assert (
            _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media_job"] is None
        )

    def test_the_sweep_fails_stale_jobs_only(
        self, editor, project, queued, django_capture_on_commit_callbacks
    ):
        def row(status, **times):
            shot = ShotFactory.create(project=project)
            version = VersionFactory.create(project=project, shot=shot)
            return ReviewMedia.objects.create(
                project=project,
                version=version,
                kind="movie",
                status=status,
                source_name="x.mov",
                **times,
            )

        now = timezone.now()
        stale = row(
            Status.PROCESSING,
            queued_at=now - timedelta(hours=2),
            started_at=now - timedelta(minutes=46),
        )
        fresh = row(Status.PROCESSING, queued_at=now, started_at=now - timedelta(minutes=10))
        lost = row(Status.QUEUED, queued_at=now - timedelta(hours=25))
        waiting = row(Status.QUEUED, queued_at=now - timedelta(hours=2))
        assert ReviewMediaService.sweep() == 2
        for media, expected in (
            (stale, Status.FAILED),
            (fresh, Status.PROCESSING),
            (lost, Status.FAILED),
            (waiting, Status.QUEUED),
        ):
            media.refresh_from_db()
            assert media.status == expected
        assert stale.error_code == "timeout" and lost.error_code == "timeout"

    def test_the_tasks_are_named_and_routed(self, settings):
        from apps.production.tasks import process_review_media, sweep_review_media

        assert process_review_media.name == "production.process_review_media"
        assert sweep_review_media.name == "production.sweep_review_media"
        assert settings.CELERY_TASK_ROUTES["production.process_review_media"] == {"queue": "media"}
        assert (
            settings.CELERY_BEAT_SCHEDULE["production-review-media-sweep"]["task"]
            == "production.sweep_review_media"
        )
        assert process_review_media.acks_late

    def test_enqueue_reaches_the_media_queue_through_the_project_celery_app(self):
        """A request has only Celery's default app (no broker, no routes) unless it names ours."""
        from kombu import Connection

        from core.celery import app

        previous = app.conf.broker_url
        previous_pool = app._pool  # noqa: SLF001 - rebuilt lazily from broker_url
        app.conf.broker_url, app._pool = "memory://", None  # noqa: SLF001
        try:
            service_module.enqueue("0b0e5a8e-0000-4000-8000-000000000001")
            with Connection("memory://") as connection:
                message = connection.SimpleQueue("media").get(timeout=2)
                assert message.headers["task"] == "production.process_review_media"
                assert message.headers["argsrepr"] == "['0b0e5a8e-0000-4000-8000-000000000001']"
                message.ack()
        finally:
            app.pool.force_close_all()
            app.conf.broker_url, app._pool = previous, previous_pool  # noqa: SLF001


# ---------------------------------------------------------------------------------------------- C-RP-21, C-RP-22


def _ready(editor, version, queued, monkeypatch, capture):
    media = _uploaded(_api(editor), version, capture, queued)
    _process(media, monkeypatch)
    return media


class TestServing:
    def test_the_version_shape_carries_signed_links_for_the_caller(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        viewer = _user(project, *VIEWER)
        for path in (f"/api/v1/versions/{version.pk}/", "/api/v1/versions/"):
            body = _api(viewer).get(path).json()
            shape = (
                body
                if "review_media" in body
                else next(r for r in body["results"] if r["id"] == str(version.pk))
            )
            current = shape["review_media"]
            assert current["id"] == str(media.pk) and current["status"] == "ready"
            assert shape["review_media_job"] is None
            for output in ("proxy", "thumbnail", "filmstrip"):
                link = current[f"{output}_url"]
                assert link.startswith(f"/api/v1/review-media/{media.pk}/{output}/?token=")
                payload = review_media_links.read_token(link.split("token=")[1])
                assert payload == {"m": str(media.pk), "u": str(viewer.pk), "o": output}
            assert current["links_expire_at"]
            assert set(current["probe"]) == {
                "width",
                "height",
                "fps",
                "frames",
                "duration_seconds",
                "video_codec",
                "has_audio",
            }
            assert current["filmstrip_tiles"] == 48

    def test_the_project_scoped_version_list_carries_the_links_too(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        body = _api(editor).get(f"/api/organizations/projects/{project.pk}/versions/").json()
        rows = body["results"] if isinstance(body, dict) else body
        row = next(r for r in rows if r["id"] == str(version.pk))
        assert row["review_media"]["id"] == str(media.pk)
        assert row["review_media"]["proxy_url"].startswith(
            f"/api/v1/review-media/{media.pk}/proxy/"
        )
        assert row["review_media_job"] is None

    def test_a_version_without_review_media_has_nulls(self, editor, version):
        body = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()
        assert body["review_media"] is None and body["review_media_job"] is None

    def test_the_version_list_does_not_query_per_row(
        self,
        editor,
        project,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
        django_assert_max_num_queries,
    ):
        for index in range(4):
            shot = ShotFactory.create(project=project)
            version = VersionFactory.create(project=project, shot=shot, code=f"RPFIVE_Q{index}")
            _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        api = _api(editor)
        api.get("/api/v1/versions/")  # warm the permission cache
        with django_assert_max_num_queries(12) as captured:
            body = api.get("/api/v1/versions/").json()
        assert sum(1 for row in body["results"] if row["review_media"]) == 4
        assert sum("production_review_media" in q["sql"] for q in captured.captured_queries) == 1

    def test_a_good_link_serves_the_file_with_fixed_headers(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        (Path(settings.MEDIA_ROOT) / media.proxy_path).write_bytes(b"0123456789")
        links = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]
        anonymous = APIClient()
        resp = anonymous.get(links["proxy_url"])
        assert resp.status_code == 200
        assert b"".join(resp.streaming_content) == b"0123456789"
        assert resp["Content-Type"] == "video/mp4"
        assert resp["X-Content-Type-Options"] == "nosniff"
        assert resp["Content-Security-Policy"] == "default-src 'none'; sandbox"
        assert resp["Cache-Control"] == "private, no-store"
        assert resp["Accept-Ranges"] == "bytes"
        thumb = anonymous.get(links["thumbnail_url"])
        assert thumb.status_code == 200 and thumb["Content-Type"] == "image/jpeg"

    @pytest.mark.parametrize(
        ("header", "status", "body", "content_range"),
        [
            ("bytes=2-5", 206, b"2345", "bytes 2-5/10"),
            ("bytes=7-", 206, b"789", "bytes 7-9/10"),
            ("bytes=-3", 206, b"789", "bytes 7-9/10"),
            ("bytes=8-100", 206, b"89", "bytes 8-9/10"),
            ("bytes=10-12", 416, b"", "bytes */10"),
            ("bytes=5-2", 416, b"", "bytes */10"),
            ("bytes=0-1,4-5", 200, b"0123456789", None),
            ("items=0-1", 200, b"0123456789", None),
        ],
    )
    def test_ranges(
        self,
        editor,
        version,
        queued,
        monkeypatch,
        settings,
        django_capture_on_commit_callbacks,
        header,
        status,
        body,
        content_range,
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        (Path(settings.MEDIA_ROOT) / media.proxy_path).write_bytes(b"0123456789")
        link = (
            _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]["proxy_url"]
        )
        resp = APIClient().get(link, HTTP_RANGE=header)
        assert resp.status_code == status
        content = b"".join(resp.streaming_content) if resp.streaming else resp.content
        assert content == body
        assert resp.get("Content-Range") == content_range
        if status == 206:
            assert resp["Content-Length"] == str(len(body))

    def test_behind_nginx_the_file_leaves_through_x_accel(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        settings.MEDIA_ACCEL_PREFIX = "/_protected_media"
        link = (
            _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]["proxy_url"]
        )
        resp = APIClient().get(link)
        assert resp.status_code == 200 and resp.content == b""
        assert resp["X-Accel-Redirect"] == f"/_protected_media/{media.proxy_path}"
        assert (
            resp["Content-Type"] == "video/mp4"
            and resp["Content-Security-Policy"] == "default-src 'none'; sandbox"
        )

    def _link(self, editor, version, output="proxy"):
        return (
            _api(editor)
            .get(f"/api/v1/versions/{version.pk}/")
            .json()["review_media"][f"{output}_url"]
        )

    def test_an_expired_link_is_a_404(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        link = self._link(editor, version)
        settings.REVIEW_MEDIA_LINK_TTL_SECONDS = 1
        future = timezone.now() + timedelta(seconds=5)
        with mock.patch("django.core.signing.time.time", return_value=future.timestamp()):
            assert APIClient().get(link).status_code == 404
        settings.REVIEW_MEDIA_LINK_TTL_SECONDS = 3600
        assert APIClient().get(link).status_code == 200

    def test_a_tampered_or_mismatched_token_is_a_404(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        link = self._link(editor, version)
        token = link.split("token=")[1]
        client = APIClient()
        assert client.get(link[:-2] + "xx").status_code == 404
        assert (
            client.get(f"/api/v1/review-media/{media.pk}/thumbnail/?token={token}").status_code
            == 404
        )
        assert (
            client.get(f"/api/v1/review-media/{media.pk}/source/?token={token}").status_code == 404
        )
        assert client.get(f"/api/v1/review-media/{media.pk}/proxy/").status_code == 404
        other = "00000000-0000-4000-8000-000000000000"
        assert client.get(f"/api/v1/review-media/{other}/proxy/?token={token}").status_code == 404
        # an attachment token is not a review media token
        from apps.core.services import attachment_links

        forged = attachment_links.make_token(media, editor)
        assert (
            client.get(f"/api/v1/review-media/{media.pk}/proxy/?token={forged}").status_code == 404
        )

    def test_an_inactive_user_or_one_who_lost_access_gets_a_404(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        viewer = _user(project, *VIEWER)
        link = self._link(viewer, version)
        assert APIClient().get(link).status_code == 200
        ProjectMembership.objects.filter(user=viewer, project=project).update(status="inactive")
        assert APIClient().get(link).status_code == 404
        ProjectMembership.objects.filter(user=viewer, project=project).update(status="active")
        assert APIClient().get(link).status_code == 200
        viewer.is_active = False
        viewer.save(update_fields=["is_active"])
        assert APIClient().get(link).status_code == 404

    def test_a_user_who_lost_version_view_gets_a_404(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        viewer = _user(project, *VIEWER)
        link = self._link(viewer, version)
        with mock.patch(
            "apps.identity.services.permission_cache.PermissionCacheService.has_permission",
            return_value=False,
        ):
            assert APIClient().get(link).status_code == 404

    def test_a_removed_or_superseded_row_is_not_served(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        old_link = self._link(editor, version)
        newer = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        with django_capture_on_commit_callbacks(execute=True):
            _process(newer, monkeypatch)
        assert APIClient().get(old_link).status_code == 404
        new_link = self._link(editor, version)
        assert APIClient().get(new_link).status_code == 200
        with django_capture_on_commit_callbacks(execute=True):
            assert _api(editor).delete(f"/api/v1/review-media/{newer.pk}/").status_code == 204
        assert APIClient().get(new_link).status_code == 404

    @pytest.mark.parametrize("status", ["failed", "superseded", "removed", "processing"])
    def test_only_a_ready_row_is_served_or_linked_even_with_its_files_still_there(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks, status
    ):
        """Between a status change and its on-commit cleanup the paths and files still exist."""
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        link = self._link(editor, version)
        ReviewMedia.objects.filter(pk=media.pk).update(status=status)
        assert APIClient().get(link).status_code == 404
        body = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()
        assert body["review_media"] is None
        job = body["review_media_job"]
        if job is not None:
            assert job["proxy_url"] is job["thumbnail_url"] is job["filmstrip_url"] is None
            assert job["links_expire_at"] is None

    def test_the_view_sets_its_own_headers_without_the_security_middleware(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        """``SecurityMiddleware`` adds ``nosniff`` too; the view does not rely on it."""
        from django.test import RequestFactory

        from apps.production.api.views.review_media_stream import ReviewMediaStreamView

        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        link = self._link(editor, version)
        request = RequestFactory().get(link)
        resp = ReviewMediaStreamView.as_view()(request, pk=media.pk, output="proxy")
        assert resp.status_code == 200
        assert resp["X-Content-Type-Options"] == "nosniff"
        assert resp["Content-Security-Policy"] == "default-src 'none'; sandbox"
        assert resp["Cache-Control"] == "private, no-store"

    def test_a_client_reads_the_movie_of_a_version_in_their_review_only(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        other_shot = ShotFactory.create(project=project)
        other = VersionFactory.create(project=project, shot=other_shot, code="RPFIVE_OTHER_V001")
        _ready(editor, other, queued, monkeypatch, django_capture_on_commit_callbacks)
        client_user = _user(project, *VIEWER, client_id="client-1")
        review = Review.objects.create(project=project, title="Client review")
        ReviewItem.objects.create(review=review, version=version)
        ReviewParticipant.objects.create(review=review, user=client_user, name="Client")
        api = _api(client_user)
        link = api.get(f"/api/v1/versions/{version.pk}/").json()["review_media"]["proxy_url"]
        assert APIClient().get(link).status_code == 200
        assert api.get(f"/api/v1/versions/{other.pk}/").status_code == 404
        # a link made for the client to the other version's movie is refused all the same
        other_row = ReviewMedia.objects.get(version=other, status=Status.READY)
        forged = review_media_links.stream_path(other_row, client_user, "proxy")
        assert APIClient().get(forged).status_code == 404

    def test_the_source_is_never_served(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        token = review_media_links.make_token(media, editor, "source")
        assert (
            APIClient().get(f"/api/v1/review-media/{media.pk}/source/?token={token}").status_code
            == 404
        )

    def test_a_still_has_no_filmstrip_link(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        upload = SimpleUploadedFile("frame.png", PNG_HEAD + b"\x00" * 32)
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued, upload)
        _process(
            media,
            monkeypatch,
            probe={"streams": [{"codec_type": "video", "width": 10, "height": 10}]},
        )
        current = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]
        assert current["filmstrip_url"] is None and current["proxy_url"]
        assert APIClient().get(current["proxy_url"])["Content-Type"] == "image/jpeg"


class TestRemove:
    def test_an_editor_removes_a_ready_movie(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        with django_capture_on_commit_callbacks(execute=True):
            resp = _api(editor).delete(f"/api/v1/review-media/{media.pk}/")
        assert resp.status_code == 204
        media.refresh_from_db()
        assert media.status == Status.REMOVED and media.proxy_path == ""
        assert not (Path(settings.MEDIA_ROOT) / media.directory).exists()
        assert _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"] is None
        assert AuditLog.objects.filter(
            metadata__operation="review_media_remove", action=AuditLog.ACTION_DELETE
        ).exists()

    def test_only_a_ready_row_can_be_removed(
        self, editor, version, queued, django_capture_on_commit_callbacks
    ):
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued)
        assert _api(editor).delete(f"/api/v1/review-media/{media.pk}/").status_code == 400

    def test_remove_needs_version_update_and_reach(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        assert (
            _api(_user(project, *VIEWER)).delete(f"/api/v1/review-media/{media.pk}/").status_code
            == 403
        )
        stranger = _user(ProjectFactory.create(code="OTHER"), *EDITOR)
        assert _api(stranger).delete(f"/api/v1/review-media/{media.pk}/").status_code == 404
        media.refresh_from_db()
        assert media.status == Status.READY

    def test_no_get_put_or_patch_on_a_row(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, queued, monkeypatch, django_capture_on_commit_callbacks)
        api = _api(editor)
        assert api.get(f"/api/v1/review-media/{media.pk}/").status_code in (403, 404, 405)
        assert api.patch(f"/api/v1/review-media/{media.pk}/", {}, format="json").status_code in (
            403,
            404,
            405,
        )


# ---------------------------------------------------------------------------------------------- pure parts


class TestDetect:
    @pytest.mark.parametrize(
        ("name", "head", "key"),
        [
            ("a.mov", MOV_HEAD, "mov"),
            ("a.MP4", b"\x00\x00\x00\x20ftypisom", "mov"),
            ("a.m4v", b"\x00\x00\x00\x08wide\x00\x00", "mov"),
            ("a.mkv", b"\x1a\x45\xdf\xa3\x01\x00", "matroska"),
            ("a.webm", b"\x1a\x45\xdf\xa3\x01\x00", "matroska"),
            ("a.mxf", bytes.fromhex("060e2b34020501010d01020101020400"), "mxf"),
            ("a.avi", b"RIFF\x00\x00\x00\x00AVI LIST", "avi"),
            ("a.jpeg", b"\xff\xd8\xff\xe0\x00\x10JFIF", "jpeg"),
            ("a.png", PNG_HEAD, "png"),
            ("a.tif", b"II*\x00\x08\x00\x00\x00", "tiff"),
            ("a.tiff", b"MM\x00*\x00\x00\x00\x08", "tiff"),
        ],
    )
    def test_each_signature(self, name, head, key):
        assert detect.detect(name, head).key == key

    @pytest.mark.parametrize(
        ("name", "head", "reason"),
        [
            ("a.exr", b"v/1\x01\x02\x00\x00\x00", "extension"),
            ("a.dpx", b"SDPX", "extension"),
            ("a.m3u8", b"#EXTM3U", "extension"),
            ("a", MOV_HEAD, "extension"),
            ("a.mp4", b"#EXTM3U\n#EXT-X", "content"),
            ("a.mov", b"ffconcat version 1.0", "content"),
            ("a.avi", b"RIFF\x00\x00\x00\x00WAVE", "content"),
            ("a.mov", b"\x00\x00", "content"),
            ("a.mkv", PNG_HEAD, "content"),
            ("a.png", b"", "content"),
        ],
    )
    def test_refusals(self, name, head, reason):
        with pytest.raises(detect.UnknownContainer, match=reason):
            detect.detect(name, head)

    def test_the_extension_comes_from_the_last_segment(self):
        assert detect.extension_of("dir.mov/clip") == ""
        assert detect.extension_of("C:\\x\\clip.MOV") == "mov"


class TestProbeParsing:
    def test_frames_come_from_packets_then_frames_then_duration(self):
        base = {"codec_type": "video", "width": 10, "height": 10, "avg_frame_rate": "25/1"}
        assert (
            commands.parse_probe(
                json.dumps({"streams": [{**base, "nb_read_packets": "7", "nb_frames": "9"}]}),
                kind="movie",
            ).frames
            == 7
        )
        assert (
            commands.parse_probe(
                json.dumps({"streams": [{**base, "nb_frames": "9"}]}), kind="movie"
            ).frames
            == 9
        )
        assert (
            commands.parse_probe(
                json.dumps({"streams": [{**base, "duration": "2.0"}]}), kind="movie"
            ).frames
            == 50
        )
        with pytest.raises(commands.ProbeError):
            commands.parse_probe(json.dumps({"streams": [base]}), kind="movie")

    def test_the_rate_falls_back_to_r_frame_rate(self):
        stream = {
            "codec_type": "video",
            "width": 10,
            "height": 10,
            "avg_frame_rate": "0/0",
            "r_frame_rate": "30000/1001",
            "nb_frames": "3",
        }
        probe = commands.parse_probe(json.dumps({"streams": [stream]}), kind="movie")
        assert probe.frame_rate == "30000/1001" and probe.fps == 29.97

    def test_garbage_is_a_probe_error(self):
        for raw in (
            "",
            "not json",
            "{}",
            json.dumps({"streams": [{"codec_type": "video", "width": 0, "height": 5}]}),
        ):
            with pytest.raises(commands.ProbeError):
                commands.parse_probe(raw, kind="still")

    def test_filmstrip_layout(self):
        assert commands.filmstrip_layout(1) == (1, 1)
        assert commands.filmstrip_layout(60) == (1, 60)
        assert commands.filmstrip_layout(61) == (2, 31)
        assert commands.filmstrip_layout(96) == (2, 48)
        assert commands.filmstrip_layout(10_000) == (167, 60)


class TestDeployCheck:
    def test_warns_when_on_without_nginx(self, settings):
        from apps.production.checks import review_media_needs_nginx_ranges

        settings.REVIEW_MEDIA_ENABLED = True
        settings.MEDIA_ACCEL_PREFIX = ""
        assert [w.id for w in review_media_needs_nginx_ranges(None)] == ["production.W001"]
        settings.MEDIA_ACCEL_PREFIX = "/_protected_media"
        assert review_media_needs_nginx_ranges(None) == []
        settings.REVIEW_MEDIA_ENABLED = False
        settings.MEDIA_ACCEL_PREFIX = ""
        assert review_media_needs_nginx_ranges(None) == []


# ---------------------------------------------------------------------------------------------- real ffmpeg


def _ffmpeg_usable() -> bool:
    """ffmpeg and ffprobe on PATH that take the input options the worker uses (Debian's ffmpeg does)."""
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        return False
    probe = subprocess.run(
        ["ffmpeg", "-hide_banner", "-v", "error", "-protocol_whitelist", "file", "-f", "lavfi",
         "-i", "nullsrc=s=16x16:d=0.04", "-frames:v", "1", "-f", "null", "-"],
        capture_output=True, check=False,
    )  # fmt: skip
    return probe.returncode == 0


@pytest.mark.skipif(
    not _ffmpeg_usable(),
    reason="needs ffmpeg that accepts -protocol_whitelist (the worker image's)",
)
class TestRealFfmpeg:
    def _clip(self, tmp_path, name="clip.mov", frames=36, rate="24"):
        (tmp_path / "gen").mkdir(exist_ok=True)
        out = tmp_path / "gen" / name
        subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"testsrc=size=640x360:rate={rate}",
             "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
             "-frames:v", str(frames), "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", str(out)],
            check=True,
        )  # fmt: skip
        return out

    def test_a_movie_becomes_a_playable_proxy_a_thumbnail_and_a_filmstrip(
        self, editor, version, queued, settings, tmp_path, django_capture_on_commit_callbacks
    ):
        clip = self._clip(tmp_path, frames=36)
        upload = SimpleUploadedFile("clip.mov", clip.read_bytes())
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued, upload)
        assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert (
            media.probe["frames"] == 36
            and media.probe["fps"] == 24.0
            and media.probe["has_audio"] is True
        )
        root = Path(settings.MEDIA_ROOT)
        proxy = json.loads(
            subprocess.run(
                ["ffprobe", "-v", "error", "-count_packets", "-show_streams", "-of", "json", str(root / media.proxy_path)],
                capture_output=True, text=True, check=True,
            ).stdout
        )  # fmt: skip
        video = next(s for s in proxy["streams"] if s["codec_type"] == "video")
        assert video["codec_name"] == "h264" and video["pix_fmt"] == "yuv420p"
        assert int(video["nb_read_packets"]) == 36 and video["avg_frame_rate"] == "24/1"
        assert (video["width"], video["height"]) == (640, 360)
        assert any(s["codec_type"] == "audio" for s in proxy["streams"])

        def size(path):
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)],
                capture_output=True, text=True, check=True,
            ).stdout.strip()  # fmt: skip
            return tuple(int(v) for v in out.split(","))

        assert size(root / media.thumbnail_path) == (480, 270)
        assert size(root / media.filmstrip_path) == (240 * 36, 136)

    def test_a_still(
        self, editor, version, queued, settings, tmp_path, django_capture_on_commit_callbacks
    ):
        png = tmp_path / "frame.png"
        subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "testsrc=size=2400x1000",
                "-frames:v",
                "1",
                "-y",
                str(png),
            ],
            check=True,
        )
        upload = SimpleUploadedFile("frame.png", png.read_bytes())
        media = _uploaded(_api(editor), version, django_capture_on_commit_callbacks, queued, upload)
        assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert media.probe["width"] == 2400 and media.filmstrip_path == ""

    def test_a_playlist_named_mp4_never_reaches_ffmpeg(self, editor, version, queued):
        playlist = (
            b"#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1.0,\nfile:///etc/passwd\n#EXT-X-ENDLIST\n"
        )
        resp = _upload(_api(editor), version, SimpleUploadedFile("evil.mp4", playlist))
        assert resp.status_code == 400

    def test_a_forged_movie_fails_in_ffprobe_not_in_a_playlist(
        self, editor, version, queued, django_capture_on_commit_callbacks
    ):
        # The right first bytes, then a playlist: the forced mov demuxer cannot read it.
        forged = MOV_HEAD + b"\n#EXTM3U\n#EXTINF:1.0,\nfile:///etc/passwd\n"
        media = _uploaded(
            _api(editor),
            version,
            django_capture_on_commit_callbacks,
            queued,
            SimpleUploadedFile("evil.mov", forged),
        )
        assert ReviewMediaService.process(media.pk) == Status.FAILED
        media.refresh_from_db()
        assert media.error_code in ("probe_failed", "unsupported_stream")
