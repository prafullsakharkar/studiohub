"""
Review pipeline RP-14: remaking review copies (docs/review-pipeline PLAN WP 14.1, 14.2; CONTRACTS
C-RP-37, C-RP-38; Q-RP-63 to Q-RP-67 = A).

A ready movie or still is remade from its kept upload as a new row; the copy it remakes stays shown
until the new one is ready. A project offers to remake the copies whose burn-ins differ from its
switch. ffmpeg is mocked, as in the RP-5 and RP-12 tests.
"""

from __future__ import annotations

import json
import os
import subprocess
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.notifications.models import Notification
from apps.production.models import ProjectMembership, ReviewMedia
from apps.production.services import review_media as service_module
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import ProjectFactory, ShotFactory, VersionFactory
from apps.production.transcode import ffmpeg as commands

pytestmark = pytest.mark.django_db

EDITOR = ("project.view", "version.view", "version.update")
VIEWER = ("project.view", "version.view")
ARTIST = ("project.view", "version.view", "version.create")
PRODUCER = ("project.view", "project.update", "version.view", "version.update")
EXR = b"\x76\x2f\x31\x01\x02\x00\x00\x00" + b"\x00" * 8
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
MOV = b"\x00\x00\x00\x18ftypqt  \x00\x00\x02\x00"
Status = ReviewMedia.Status


def _probe(frames_read: int = 24, codec: str = "prores") -> dict[str, Any]:
    return {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": codec,
                "width": 2048,
                "height": 1080,
                "avg_frame_rate": "24/1",
                "r_frame_rate": "24/1",
                "nb_read_packets": str(frames_read),
            }
        ],
        "format": {"duration": str(frames_read / 24)},
    }


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_MAX_BYTES = 10 * 1024 * 1024
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
    return ProjectFactory.create(code="RPFOURTEEN")


def _user(project, *codes, **membership):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    if project is not None:
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
def producer(project):
    return _user(project, *PRODUCER, role="Producer")


def _version(project, code="RPFOURTEEN_SH010_V001", **extra):
    shot = ShotFactory.create(project=project, code=f"{code}_SHOT")
    return VersionFactory.create(project=project, shot=shot, code=code, **extra)


@pytest.fixture
def version(project):
    return _version(project)


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


def _process(media, monkeypatch, *, probe=None, workdirs=None, fail_on=None, capture=None):
    calls: list[list[str]] = []
    monkeypatch.setattr(
        commands,
        "run",
        _fake_run(calls, probe=probe or _probe(), workdirs=workdirs, fail_on=fail_on),
    )
    if capture is None:
        result = ReviewMediaService.process(media.pk)
    else:
        with capture(execute=True):
            result = ReviewMediaService.process(media.pk)
    media.refresh_from_db()
    return result, calls


def _upload(user, version, *, name="clip.mov", head=MOV) -> ReviewMedia:
    upload = SimpleUploadedFile(name, head + b"\x00" * 64)
    resp = _api(user).post(
        f"/api/v1/versions/{version.pk}/review-media/", {"file": upload}, format="multipart"
    )
    assert resp.status_code == 202, resp.content
    return ReviewMedia.objects.get(pk=resp.json()["id"])


def _ready(user, version, monkeypatch, capture, **kind) -> ReviewMedia:
    media = _upload(user, version, **kind)
    probe = _probe(1, "png") if kind.get("head") == PNG else _probe()
    result, _ = _process(media, monkeypatch, probe=probe, capture=capture)
    assert result == Status.READY
    return media


def _counts(body: dict) -> dict:
    """The copies read's counts (C-RP-38, C-RP-40), without RP-16's list of the copies."""
    return {k: v for k, v in body.items() if k not in ("differing", "differing_more")}


def _ready_sequence(user, version, monkeypatch, capture) -> ReviewMedia:
    api = _api(user)
    resp = api.post(
        f"/api/v1/versions/{version.pk}/review-media/sequence/",
        {"name": "sh010_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1002},
        format="json",
    )
    media = ReviewMedia.objects.get(pk=resp.json()["id"])
    files = [SimpleUploadedFile(f"sh010_comp.{n}.exr", EXR + b"\x00" * 64) for n in (1001, 1002)]
    api.post(f"/api/v1/review-media/{media.pk}/frames/", {"frames": files}, format="multipart")
    assert api.post(f"/api/v1/review-media/{media.pk}/complete/").status_code == 202
    result, _ = _process(media, monkeypatch, probe=_probe(2, "exr"), capture=capture)
    assert result == Status.READY
    return media


def _remake(user, media):
    return _api(user).post(f"/api/v1/review-media/{media.pk}/remake/")


def _source(settings, media) -> Path:
    return Path(settings.MEDIA_ROOT) / media.source_path


# ---------------------------------------------------------------------------------------------- C-RP-37 one copy


class TestRemakeOne:
    def test_a_new_row_is_queued_and_the_copy_stays_shown(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        asker = _user(version.project, *EDITOR)
        with django_capture_on_commit_callbacks(execute=True):
            resp = _remake(asker, old)
        assert resp.status_code == 202, resp.content
        body = resp.json()
        assert body["status"] == "queued" and body["remake_of"] == str(old.pk)
        assert body["kind"] == "movie" and body["source_name"] == old.source_name
        assert body["source_size"] == old.source_size
        assert body["created_by"]["id"] == str(asker.pk)
        assert queued[-1] == body["id"]
        old.refresh_from_db()
        assert old.status == Status.READY
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()
        assert shown["review_media"]["id"] == str(old.pk)
        assert shown["review_media_job"]["id"] == body["id"]
        made = ReviewMedia.objects.get(pk=body["id"])
        assert made.source_path.startswith(made.directory + "/source")
        assert os.stat(_source(settings, made)).st_ino == os.stat(_source(settings, old)).st_ino

    def test_when_ready_the_old_copy_goes_and_the_upload_survives(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        made = ReviewMedia.objects.get(pk=_remake(editor, old).json()["id"])
        result, _ = _process(made, monkeypatch, capture=django_capture_on_commit_callbacks)
        assert result == Status.READY
        old.refresh_from_db()
        assert old.status == Status.SUPERSEDED
        assert not (Path(settings.MEDIA_ROOT) / old.directory).exists()
        assert _source(settings, made).read_bytes().startswith(MOV)
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()
        assert shown["review_media"]["id"] == str(made.pk) and shown["review_media_job"] is None

    def test_a_failed_remake_leaves_the_copy_and_can_be_retried(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        made = ReviewMedia.objects.get(pk=_remake(editor, old).json()["id"])
        result, _ = _process(made, monkeypatch, fail_on="libx264")
        assert result == Status.FAILED
        old.refresh_from_db()
        assert old.status == Status.READY
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()
        assert shown["review_media"]["id"] == str(old.pk)
        assert shown["review_media_job"]["status"] == "failed"
        assert _api(editor).post(f"/api/v1/review-media/{made.pk}/retry/").status_code == 202
        result, _ = _process(made, monkeypatch, capture=django_capture_on_commit_callbacks)
        assert result == Status.READY
        old.refresh_from_db()
        assert old.status == Status.SUPERSEDED

    def test_a_still_can_be_remade(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(
            editor,
            version,
            monkeypatch,
            django_capture_on_commit_callbacks,
            name="f.png",
            head=PNG,
        )
        resp = _remake(editor, old)
        assert resp.status_code == 202 and resp.json()["kind"] == "still"

    def test_busy_is_a_409(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        _upload(editor, version)  # queued, not processed
        resp = _remake(editor, old)
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_busy"

    def test_a_second_remake_while_the_first_runs_is_a_409(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert _remake(editor, old).status_code == 202
        assert _remake(editor, old).status_code == 409
        assert ReviewMedia.objects.filter(version=version, status=Status.QUEUED).count() == 1

    def test_a_sequence_is_told_to_upload_its_frames_again(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 0  # RP-12's rule, which RP-16 keeps for 0
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        resp = _remake(editor, media)
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.REMAKE_REFUSALS["sequence"]]
        assert not ReviewMedia.objects.filter(remake_of=media).exists()

    def test_only_a_ready_copy(self, editor, version, queued, monkeypatch):
        media = _upload(editor, version)
        _process(media, monkeypatch, fail_on="libx264")
        resp = _remake(editor, media)
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.REMAKE_REFUSALS["not_ready"]]

    def test_an_upload_that_is_gone(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        _source(settings, old).unlink()
        resp = _remake(editor, old)
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.REMAKE_REFUSALS["missing"]]
        assert ReviewMedia.objects.filter(version=version).count() == 1
        assert sorted(
            p.name for p in (Path(settings.MEDIA_ROOT) / old.directory).parent.iterdir()
        ) == [str(old.pk)]

    def test_rights(
        self, project, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert _remake(_user(project, *VIEWER), old).status_code == 403
        assert _remake(_user(ProjectFactory.create(), *EDITOR), old).status_code == 404
        assert _remake(_user(project, *ARTIST), old).status_code == 403
        artist = _user(project, *ARTIST)
        version.artist = artist
        version.save(update_fields=["artist"])
        assert _remake(artist, old).status_code == 202

    def test_switched_off_is_a_409(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        settings.REVIEW_MEDIA_ENABLED = False
        resp = _remake(editor, old)
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_disabled"

    def test_the_audit_entry(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        made = _remake(editor, old).json()
        entry = AuditLog.objects.filter(metadata__operation="review_media_remake").get()
        assert entry.metadata["review_media_id"] == made["id"]
        assert entry.actor_id == editor.pk and entry.target_id == str(version.pk)


# ---------------------------------------------------------------------------------------------- Q-RP-66 the date


class TestBurnInDate:
    def test_the_first_processing_fixes_it_and_a_retry_keeps_it(
        self, editor, version, queued, monkeypatch
    ):
        media = _upload(editor, version)
        assert media.burn_in_date is None
        _process(media, monkeypatch, fail_on="libx264")
        first = media.burn_in_date
        assert first == media.started_at.date()
        media.burn_in_date = date(2026, 1, 2)  # as if the first attempt ran that day
        media.save(update_fields=["burn_in_date"])
        _api(editor).post(f"/api/v1/review-media/{media.pk}/retry/")
        _process(media, monkeypatch)
        assert media.status == Status.READY and media.burn_in_date == date(2026, 1, 2)

    def test_a_remake_carries_the_originals_date_into_its_burn_ins(
        self, project, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        old.burn_in_date = date(2026, 1, 2)
        old.save(update_fields=["burn_in_date"])
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        made = ReviewMedia.objects.get(pk=_remake(editor, old).json()["id"])
        assert made.burn_in_date == date(2026, 1, 2)
        workdirs: list[dict[str, bytes]] = []
        result, _ = _process(made, monkeypatch, workdirs=workdirs)
        assert result == Status.READY and made.probe["burn_ins"] is True
        assert workdirs[1]["burn_bl.txt"].decode() == "2026-01-02"
        assert made.burn_in_date == date(2026, 1, 2)

    def test_a_copy_made_before_rp14_dates_from_its_row(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        ReviewMedia.objects.filter(pk=old.pk).update(
            burn_in_date=None, queued_at=datetime(2025, 12, 31, 23, 30, tzinfo=UTC)
        )
        made = ReviewMedia.objects.get(pk=_remake(editor, old).json()["id"])
        assert made.burn_in_date == date(2025, 12, 31)


# ---------------------------------------------------------------------------------------------- Q-RP-67 notifications


class TestNotifications:
    def test_an_upload_tells_its_uploader_and_a_remake_tells_nobody(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert list(Notification.objects.values_list("recipient_id", "kind")) == [
            (editor.pk, "review_media_ready")
        ]
        Notification.objects.all().delete()
        asker = _user(version.project, *EDITOR)
        made = ReviewMedia.objects.get(pk=_remake(asker, old).json()["id"])
        result, _ = _process(made, monkeypatch, capture=django_capture_on_commit_callbacks)
        assert result == Status.READY
        assert Notification.objects.count() == 0

    def test_a_failed_remake_tells_whoever_asked(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        old = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        Notification.objects.all().delete()
        asker = _user(version.project, *EDITOR)
        made = ReviewMedia.objects.get(pk=_remake(asker, old).json()["id"])
        with django_capture_on_commit_callbacks(execute=True):
            result, _ = _process(made, monkeypatch, fail_on="libx264")
        assert result == Status.FAILED
        assert list(Notification.objects.values_list("recipient_id", "kind")) == [
            (asker.pk, "review_media_failed")
        ]


# ---------------------------------------------------------------------------------------------- C-RP-38 a project's copies


class TestProjectCopies:
    def _copies(self, user, project):
        return _api(user).get(f"/api/v1/projects/{project.pk}/review-copies/")

    def _remake_all(self, user, project):
        return _api(user).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")

    def _switch(self, project, on=True):
        project.review_burn_ins = on
        project.save(update_fields=["review_burn_ins"])

    def test_what_differs(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        movie = _ready(editor, _version(project, "RPF_V1"), monkeypatch, cap)
        _ready_sequence(editor, _version(project, "RPF_V2"), monkeypatch, cap)
        _ready(editor, _version(project, "RPF_V3"), monkeypatch, cap, name="f.png", head=PNG)
        gone = _ready(editor, _version(project, "RPF_V4"), monkeypatch, cap)
        old = _ready(editor, _version(project, "RPF_V5"), monkeypatch, cap)
        ReviewMedia.objects.filter(pk=old.pk).update(
            probe={k: v for k, v in old.probe.items() if k != "burn_ins"}  # made before RP-12
        )
        gone.version.is_deleted = True
        gone.version.save(update_fields=["is_deleted"])
        other = ProjectFactory.create(code="OTHERP")
        _ready(_user(other, *EDITOR), _version(other, "OTH_V1"), monkeypatch, cap)
        self._switch(other)

        body = _counts(self._copies(producer, project).json())
        assert body == {
            "review_burn_ins": False,
            "out_of_date": 0,
            "sequences_out_of_date": 0,
            "colour_out_of_date": 0,
        }
        self._switch(project)
        body = _counts(self._copies(producer, project).json())
        assert body == {
            "review_burn_ins": True,
            "out_of_date": 2,
            "sequences_out_of_date": 1,
            "colour_out_of_date": 0,
        }
        ReviewMedia.objects.filter(pk=movie.pk).update(probe={**movie.probe, "burn_ins": True})
        assert self._copies(producer, project).json()["out_of_date"] == 1
        self._switch(project, on=False)
        body = _counts(self._copies(producer, project).json())
        assert body == {
            "review_burn_ins": False,
            "out_of_date": 1,
            "sequences_out_of_date": 0,
            "colour_out_of_date": 0,
        }

    def test_remake_the_ones_that_differ(
        self,
        project,
        producer,
        editor,
        queued,
        monkeypatch,
        settings,
        django_capture_on_commit_callbacks,
    ):
        cap = django_capture_on_commit_callbacks
        settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 0  # RP-12's rule, which RP-16 keeps for 0
        first = _ready(editor, _version(project, "RPF_V1"), monkeypatch, cap)
        busy_version = _version(project, "RPF_V2")
        busy = _ready(editor, busy_version, monkeypatch, cap)
        _upload(editor, busy_version)
        _ready_sequence(editor, _version(project, "RPF_V3"), monkeypatch, cap)
        missing = _ready(editor, _version(project, "RPF_V4"), monkeypatch, cap)
        _source(settings, missing).unlink()
        matching = _ready(editor, _version(project, "RPF_V5"), monkeypatch, cap)
        ReviewMedia.objects.filter(pk=matching.pk).update(
            probe={**matching.probe, "burn_ins": True}
        )
        self._switch(project)

        with cap(execute=True):
            resp = self._remake_all(producer, project)
        assert resp.status_code == 200, resp.content
        assert resp.json() == {
            "queued": 1,
            "skipped_busy": 1,
            "skipped_sequence": 1,
            "skipped_missing": 1,
        }
        made = ReviewMedia.objects.get(remake_of__isnull=False)
        assert made.remake_of == first and made.created_by == producer
        assert queued[-1] == str(made.pk)
        assert not ReviewMedia.objects.filter(remake_of__in=[busy, matching, missing]).exists()
        assert AuditLog.objects.filter(metadata__operation="review_media_remake").count() == 1

    def test_rights(self, project, producer, queued):
        viewer = _user(project, *VIEWER)
        assert self._copies(viewer, project).status_code == 200
        assert self._remake_all(viewer, project).status_code == 403
        outsider = _user(ProjectFactory.create(), *PRODUCER)
        assert self._copies(outsider, project).status_code == 404
        assert self._remake_all(outsider, project).status_code == 404
        vendor = _user(project, *PRODUCER, vendor_id="ACME")
        assert self._copies(vendor, project).status_code == 404
        assert self._remake_all(vendor, project).status_code == 404
        assert self._remake_all(producer, project).status_code == 200

    def test_switched_off_is_a_409(self, project, producer, settings):
        settings.REVIEW_MEDIA_ENABLED = False
        resp = self._remake_all(producer, project)
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_disabled"
