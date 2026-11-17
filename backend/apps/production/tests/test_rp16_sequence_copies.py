"""
Review pipeline RP-16: sequence copies after a settings change (docs/review-pipeline PLAN WP 16.1 to
16.4; CONTRACTS C-RP-41 to C-RP-43; Q-RP-73 to Q-RP-76 = A).

A sequence keeps its frames for ``REVIEW_MEDIA_SEQUENCE_KEEP_DAYS`` once its copy is ready, so the copy
can be remade like a movie; the sweep deletes them afterwards. The project's copies read lists which
copies differ, and copies that cannot be remade can be kept as they are. ffmpeg is mocked, as in the
RP-14 tests whose helpers these reuse.
"""

from __future__ import annotations

import os
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.production.models import ReviewMedia
from apps.production.selectors import review_media as selector_module
from apps.production.services import review_media as service_module
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import ProjectFactory
from apps.production.tests.test_rp14_remake import (
    EDITOR,
    PNG,
    PRODUCER,
    Status,
    _api,
    _counts,
    _probe,
    _process,
    _ready,
    _ready_sequence,
    _remake,
    _user,
    _version,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_MAX_BYTES = 10 * 1024 * 1024
    settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 14
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
    return ProjectFactory.create(code="RPSIXTEEN")


@pytest.fixture
def editor(project):
    return _user(project, *EDITOR)


@pytest.fixture
def producer(project):
    return _user(project, *PRODUCER, role="Producer")


@pytest.fixture
def version(project):
    return _version(project, "RPS_SH010_V001")


def _shown(user, media) -> dict:
    """The ready copy as its version shows it."""
    return _api(user).get(f"/api/v1/versions/{media.version_id}/").json()["review_media"]


def _frames(settings, media) -> list[Path]:
    return sorted((Path(settings.MEDIA_ROOT) / media.directory / "source").iterdir())


def _expire(media) -> None:
    """The frames' time is up, but the sweep has not run yet."""
    ReviewMedia.objects.filter(pk=media.pk).update(
        frames_until=timezone.now() - timedelta(minutes=1)
    )
    media.refresh_from_db()


def _sweep(media, monkeypatch, capture) -> list[str]:
    """Run the sweep; the folders it handed to the media worker."""
    discarded: list[str] = []
    monkeypatch.setattr(service_module, "discard_later", discarded.append)
    with capture(execute=True):
        ReviewMediaService.sweep()
    media.refresh_from_db()
    return discarded


def _switch(project, on=True):
    project.review_burn_ins = on
    project.save(update_fields=["review_burn_ins"])


def _copies(user, project):
    return _api(user).get(f"/api/v1/projects/{project.pk}/review-copies/").json()


def _keep_copies(user, project, *ids):
    return _api(user).post(
        f"/api/v1/projects/{project.pk}/review-copies/keep/",
        {"review_media_ids": [str(i) for i in ids]},
        format="json",
    )


# ---------------------------------------------------------------------------------------------- WP 16.1 keeping


class TestKeepingFrames:
    def test_the_frames_are_kept_once_the_copy_is_ready(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.source_path == f"{media.directory}/source"
        assert len(_frames(settings, media)) == 2
        assert media.finished_at is not None
        assert media.frames_until == media.finished_at + timedelta(days=14)
        body = _shown(editor, media)
        assert body["frames_until"] is not None

    def test_with_zero_days_they_go_at_once(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 0
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.source_path == "" and media.frames_until is None
        assert not (Path(settings.MEDIA_ROOT) / media.directory / "source").exists()

    def test_a_movie_has_no_frames_to_keep(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        movie = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert movie.frames_until is None
        body = _shown(editor, movie)
        assert body["frames_until"] is None

    def test_the_sweep_deletes_them_once_due_and_not_before(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        media = _ready_sequence(editor, version, monkeypatch, cap)
        assert _sweep(media, monkeypatch, cap) == []
        assert media.source_path and media.frames_until is not None

        _expire(media)
        source = media.source_path
        assert _sweep(media, monkeypatch, cap) == [source]
        assert media.source_path == "" and media.frames_until is None
        # the copy stays
        assert media.status == Status.READY and media.proxy_path
        body = _shown(editor, media)
        assert body["frames_until"] is None

    def test_frames_past_their_time_are_not_offered_before_the_sweep(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        _expire(media)
        assert media.source_path  # not swept yet
        body = _shown(editor, media)
        assert body["frames_until"] is None

    def test_a_new_copy_deletes_the_old_one_frames_included(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        old = _ready_sequence(editor, version, monkeypatch, cap)
        _ready(editor, version, monkeypatch, cap)
        old.refresh_from_db()
        assert old.status == Status.SUPERSEDED and old.frames_until is None
        assert not (Path(settings.MEDIA_ROOT) / old.directory).exists()

    def test_a_removed_copy_keeps_no_frames(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        media = _ready_sequence(editor, version, monkeypatch, cap)
        monkeypatch.setattr(service_module, "discard_later", lambda folder: None)
        with cap(execute=True):
            assert _api(editor).delete(f"/api/v1/review-media/{media.pk}/").status_code == 204
        media.refresh_from_db()
        assert media.status == Status.REMOVED and media.frames_until is None


# ---------------------------------------------------------------------------------------------- WP 16.2 remaking


class TestRemakingASequence:
    def test_a_kept_sequence_is_remade_from_links_to_its_frames(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        old = _ready_sequence(editor, version, monkeypatch, cap)
        with cap(execute=True):
            resp = _remake(editor, old)
        assert resp.status_code == 202, resp.content
        body = resp.json()
        assert body["kind"] == "sequence" and body["remake_of"] == str(old.pk)
        assert body["sequence"]["first_frame"] == 1001 and body["sequence"]["last_frame"] == 1002
        made = ReviewMedia.objects.get(pk=body["id"])
        assert made.source_path == f"{made.directory}/source"
        assert made.burn_in_date == old.burn_in_date and made.color_space == old.color_space
        # Q-RP-74: the remake keeps the original's time
        assert made.frames_until == old.frames_until
        olds, news = _frames(settings, old), _frames(settings, made)
        assert [f.name for f in news] == [f.name for f in olds]
        assert all(os.stat(a).st_ino == os.stat(b).st_ino for a, b in zip(olds, news, strict=True))

        result, calls = _process(made, monkeypatch, probe=_probe(2, "exr"), capture=cap)
        assert result == Status.READY
        assert any("file:../source/frame.%08d.exr" in args for args in calls)
        assert made.frames_until == old.frames_until  # not a new window at ready either
        old.refresh_from_db()
        assert old.status == Status.SUPERSEDED
        assert not (Path(settings.MEDIA_ROOT) / old.directory).exists()
        assert len(_frames(settings, made)) == 2

    def test_a_sequence_whose_time_is_up_is_refused(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        media = _ready_sequence(editor, version, monkeypatch, cap)
        _expire(media)
        resp = _remake(editor, media)
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.REMAKE_REFUSALS["sequence"]]
        _sweep(media, monkeypatch, cap)
        assert _remake(editor, media).status_code == 400
        assert not ReviewMedia.objects.filter(remake_of=media).exists()

    def test_a_sequence_whose_frames_were_deleted_by_hand_is_refused(
        self, editor, version, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        for frame in _frames(settings, media):
            frame.unlink()
        (Path(settings.MEDIA_ROOT) / media.source_path).rmdir()
        resp = _remake(editor, media)
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.REMAKE_REFUSALS["sequence"]]

    def test_the_project_remakes_kept_sequences_and_counts_the_others(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        kept = _ready_sequence(editor, _version(project, "RPS_V1"), monkeypatch, cap)
        gone = _ready_sequence(editor, _version(project, "RPS_V2"), monkeypatch, cap)
        _expire(gone)
        _switch(project)
        with cap(execute=True):
            resp = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert resp.json() == {
            "queued": 1,
            "skipped_busy": 0,
            "skipped_sequence": 1,
            "skipped_missing": 0,
        }
        assert ReviewMedia.objects.filter(remake_of=kept).exists()
        assert not ReviewMedia.objects.filter(remake_of=gone).exists()


# ---------------------------------------------------------------------------------------------- WP 16.3 the list


class TestWhichDiffer:
    def test_the_list_says_which_copies_differ_and_why(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        movie = _ready(editor, _version(project, "RPS_V1"), monkeypatch, cap)
        kept = _ready_sequence(editor, _version(project, "RPS_V2"), monkeypatch, cap)
        gone = _ready_sequence(editor, _version(project, "RPS_V3"), monkeypatch, cap)
        _ready(editor, _version(project, "RPS_V4"), monkeypatch, cap, name="f.png", head=PNG)
        _expire(gone)
        body = _copies(producer, project)
        assert body["differing"] == [] and body["differing_more"] == 0

        _switch(project)
        body = _copies(producer, project)
        listed = body["differing"]
        # oldest first; the still carries no burn-ins either way
        assert [row["review_media_id"] for row in listed] == [
            str(movie.pk),
            str(kept.pk),
            str(gone.pk),
        ]
        assert listed[0] == {
            "review_media_id": str(movie.pk),
            "kind": "movie",
            "version": {"id": str(movie.version_id), "code": "RPS_V1"},
            "record_code": "RPS_V1_SHOT",
            "remakable": True,
            "frames_until": None,
            "why": ["burn_ins"],
        }
        assert listed[1]["remakable"] is True and listed[1]["frames_until"] is not None
        assert listed[2]["remakable"] is False and listed[2]["frames_until"] is None
        assert body["differing_more"] == 0
        assert _counts(body) == {
            "review_burn_ins": True,
            "out_of_date": 1,
            "sequences_out_of_date": 2,
            "colour_out_of_date": 0,
        }

    def test_colour_and_burn_ins_are_both_said(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _ready_sequence(
            editor, _version(project, "RPS_V1"), monkeypatch, django_capture_on_commit_callbacks
        )
        project.review_view = "Un-tone-mapped"
        project.save(update_fields=["review_view"])
        assert [r["why"] for r in _copies(producer, project)["differing"]] == [["colour"]]
        _switch(project)
        assert [r["why"] for r in _copies(producer, project)["differing"]] == [
            ["burn_ins", "colour"]
        ]

    def test_a_matching_copy_is_not_listed(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        movie = _ready(
            editor, _version(project, "RPS_V1"), monkeypatch, django_capture_on_commit_callbacks
        )
        ReviewMedia.objects.filter(pk=movie.pk).update(probe={**movie.probe, "burn_ins": True})
        _switch(project)
        assert _copies(producer, project)["differing"] == []

    def test_the_list_stops_at_its_limit_and_says_how_many_more(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        for n in range(3):
            _ready(editor, _version(project, f"RPS_V{n}"), monkeypatch, cap)
        _switch(project)
        monkeypatch.setattr(selector_module, "DIFFERING_LIMIT", 2)
        body = _copies(producer, project)
        assert [r["version"]["code"] for r in body["differing"]] == ["RPS_V0", "RPS_V1"]
        assert body["differing_more"] == 1 and body["out_of_date"] == 3


# ---------------------------------------------------------------------------------------------- WP 16.4 keep as they are


class TestKeepAsTheyAre:
    def _gone(self, editor, project, code, monkeypatch, cap):
        media = _ready_sequence(editor, _version(project, code), monkeypatch, cap)
        _expire(media)
        return media

    def test_a_copy_kept_as_it_is_stops_counting(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        gone = self._gone(
            editor, project, "RPS_V1", monkeypatch, django_capture_on_commit_callbacks
        )
        _switch(project)
        assert _copies(producer, project)["sequences_out_of_date"] == 1
        resp = _keep_copies(producer, project, gone.pk)
        assert resp.status_code == 200, resp.content
        assert resp.json() == {"kept": 1}
        body = _copies(producer, project)
        assert body["sequences_out_of_date"] == 0 and body["differing"] == []
        gone.refresh_from_db()
        assert gone.kept_for is not None and gone.kept_for["burn_ins"] is True
        assert gone.kept_for["ocio"]["view"]  # the transform it would be made with now
        entry = AuditLog.objects.filter(metadata__operation="review_media_kept").get()
        assert entry.metadata["review_media_id"] == str(gone.pk)
        assert entry.actor_id == producer.pk and entry.target_id == str(gone.version_id)

    def test_a_later_change_of_burn_ins_counts_it_again(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        gone = self._gone(
            editor, project, "RPS_V1", monkeypatch, django_capture_on_commit_callbacks
        )
        project.review_view = "Un-tone-mapped"
        project.save(update_fields=["review_view"])
        assert _keep_copies(producer, project, gone.pk).status_code == 200
        assert _copies(producer, project)["sequences_out_of_date"] == 0
        _switch(project)
        listed = _copies(producer, project)["differing"]
        assert [(r["review_media_id"], r["why"]) for r in listed] == [
            (str(gone.pk), ["burn_ins", "colour"])
        ]

    def test_a_later_change_of_view_counts_it_again(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        gone = self._gone(
            editor, project, "RPS_V1", monkeypatch, django_capture_on_commit_callbacks
        )
        _switch(project)
        assert _keep_copies(producer, project, gone.pk).status_code == 200
        project.review_view = "Un-tone-mapped"
        project.save(update_fields=["review_view"])
        listed = _copies(producer, project)["differing"]
        assert [r["review_media_id"] for r in listed] == [str(gone.pk)]

    def test_only_differing_copies_that_cannot_be_remade_all_or_none(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        gone = self._gone(editor, project, "RPS_V1", monkeypatch, cap)
        kept = _ready_sequence(editor, _version(project, "RPS_V2"), monkeypatch, cap)
        movie = _ready(editor, _version(project, "RPS_V3"), monkeypatch, cap)
        other = ProjectFactory.create(code="RPSOTHER")
        stranger = self._gone(_user(other, *EDITOR), other, "OTH_V1", monkeypatch, cap)
        _switch(other)
        for refused in (kept.pk, movie.pk, stranger.pk, uuid.uuid4()):
            resp = _keep_copies(producer, project, refused)
            assert resp.status_code == 400, refused
            assert "review_media_ids" in resp.json()
        # a copy that matches is not one to keep
        assert _keep_copies(producer, project, gone.pk).status_code == 400
        _switch(project)
        resp = _keep_copies(producer, project, gone.pk, movie.pk)
        assert resp.status_code == 400
        gone.refresh_from_db()
        assert gone.kept_for is None
        assert not AuditLog.objects.filter(metadata__operation="review_media_kept").exists()

    def test_nothing_is_kept_while_the_config_cannot_be_read(
        self,
        project,
        producer,
        editor,
        queued,
        monkeypatch,
        settings,
        tmp_path,
        django_capture_on_commit_callbacks,
    ):
        gone = self._gone(
            editor, project, "RPS_V1", monkeypatch, django_capture_on_commit_callbacks
        )
        _switch(project)
        settings.REVIEW_MEDIA_OCIO_CONFIG = str(tmp_path / "nowhere" / "config.ocio")
        resp = _keep_copies(producer, project, gone.pk)
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.KEEP_UNAVAILABLE]
        gone.refresh_from_db()
        assert gone.kept_for is None

    def test_rights(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        gone = self._gone(
            editor, project, "RPS_V1", monkeypatch, django_capture_on_commit_callbacks
        )
        _switch(project)
        assert _keep_copies(editor, project, gone.pk).status_code == 403
        outsider = _user(None, *PRODUCER)
        assert _keep_copies(outsider, project, gone.pk).status_code in (403, 404)
        assert (
            _api(producer)
            .post(f"/api/v1/projects/{project.pk}/review-copies/keep/", {}, format="json")
            .status_code
            == 400
        )
        gone.refresh_from_db()
        assert gone.kept_for is None
