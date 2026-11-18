"""
Review pipeline RP-17: review copies read from studio storage (docs/review-pipeline PLAN WP 17.1 to
17.5; CONTRACTS C-RP-44 to C-RP-46; Q-RP-77 to Q-RP-81 = A; ADR-0042).

A copy is made from a registered published file (``POST publishing/files/{id}/review-copy/``). The
media worker reads the file where it lies, through symbolic links it checks under the root's
directory in ``PUBLISHING_STORAGE_MOUNTS`` and removes afterwards. Such a copy can be remade at any
time; revoking its file stops that. ffmpeg is mocked, as in the RP-14 tests whose helpers these reuse.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path

import pytest

from apps.audit.models import AuditLog
from apps.core.utils.paths import PathRuleError, resolve_mount
from apps.production.models import ReviewMedia
from apps.production.services import review_media as service_module
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import ProjectFactory
from apps.production.tests.test_rp14_remake import (
    ARTIST,
    EDITOR,
    EXR,
    MOV,
    PRODUCER,
    Status,
    _api,
    _probe,
    _user,
    _version,
)
from apps.production.transcode import ffmpeg as commands
from apps.publishing.models import PublishedFile
from apps.publishing.services.files import PublishedFileService
from apps.publishing.tests.helpers import request_for, storage_root

pytestmark = pytest.mark.django_db

READS = ("publishing.view",)
ROOT = "STUDIO"
PATTERN = "shots/sh010/comp/v001/sh010_comp_v001.%04d.exr"
MOVIE = "shots/sh010/comp/v001/sh010_comp_v001.mov"


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_MAX_BYTES = 10 * 1024 * 1024
    settings.REVIEW_MEDIA_LINK_TTL_SECONDS = 3600
    settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 14
    font = tmp_path / "font.ttf"
    font.write_bytes(b"not really a font")
    settings.REVIEW_MEDIA_BURN_IN_FONT = str(font)
    (tmp_path / "media").mkdir()


@pytest.fixture
def studio(tmp_path, settings):
    """The studio's storage root, as the worker sees it mounted."""
    folder = tmp_path / "studio"
    folder.mkdir()
    settings.PUBLISHING_STORAGE_MOUNTS = {ROOT: str(folder)}
    return folder


@pytest.fixture
def queued(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: calls.append(str(media_id)))
    return calls


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPSEVENTEEN")


@pytest.fixture
def root(db):
    return storage_root(ROOT)


@pytest.fixture
def editor(project):
    return _user(project, *EDITOR, *READS)


@pytest.fixture
def producer(project):
    return _user(project, *PRODUCER, *READS, role="Producer")


@pytest.fixture
def version(project):
    return _version(project, "RPS_SH010_V001", is_published=True, status="Approved")


def _write(studio: Path, relative: str, data: bytes) -> Path:
    target = studio / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def _frames(studio: Path, numbers=(1001, 1002), head: bytes = EXR) -> dict[int, Path]:
    return {
        n: _write(studio, PATTERN.replace("%04d", str(n)), head + bytes([n % 256]) * 64)
        for n in numbers
    }


def _register(version, root, path: str, **over) -> PublishedFile:
    registrar = _user(version.project, "publishing.view", "publishing.create")
    data = {
        "version_id": str(version.pk),
        "storage_root": root.code,
        "relative_path": path,
        "size_bytes": 1024,
        "sha256": hashlib.sha256(path.encode()).hexdigest(),
    }
    data.update(over)
    file, _ = PublishedFileService.register(
        actor=registrar, request=request_for(registrar), version_id=version.pk, data=data
    )
    return file


def _sequence_file(version, root, **over) -> PublishedFile:
    return _register(version, root, PATTERN, frame_start=1001, frame_end=1002, **over)


def _copy(user, file, **body):
    return _api(user).post(f"/api/v1/publishing/files/{file.pk}/review-copy/", body, format="json")


def _opened(user, file) -> ReviewMedia:
    resp = _copy(user, file)
    assert resp.status_code == 202, resp.content
    return ReviewMedia.objects.get(pk=resp.json()["id"])


def _fake_run(calls, links, *, probe):
    """ffmpeg and ffprobe, recording each run's arguments and the links the job's folder holds."""

    def run(args, *, cwd, timeout):
        calls.append(args)
        folder = Path(cwd).parent
        seen = {}
        for link in [*folder.glob("source.*"), *(folder / "source").glob("*")]:
            if link.is_symlink():
                seen[link.name] = os.readlink(link)
        links.append(seen)
        if Path(args[0]).name == "ffprobe":
            return subprocess.CompletedProcess(args, 0, stdout=json.dumps(probe), stderr="")
        Path(cwd, args[-1]).write_bytes(b"made")
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

    return run


def _process(media, monkeypatch, capture, *, probe=None):
    calls: list[list[str]] = []
    links: list[dict[str, str]] = []
    monkeypatch.setattr(commands, "run", _fake_run(calls, links, probe=probe or _probe(2, "exr")))
    with capture(execute=True):
        result = ReviewMediaService.process(media.pk)
    media.refresh_from_db()
    return result, calls, links


def _tree(folder: Path) -> list[tuple[str, bytes]]:
    return sorted(
        (str(p.relative_to(folder)), p.read_bytes()) for p in folder.rglob("*") if p.is_file()
    )


def _ready_from_storage(user, version, root, studio, monkeypatch, capture) -> ReviewMedia:
    _frames(studio)
    media = _opened(user, _sequence_file(version, root))
    result, _, _ = _process(media, monkeypatch, capture)
    assert result == Status.READY
    return media


# ---------------------------------------------------------------------------------------------- WP 17.1 rules


class TestSharedPathRules:
    def test_publishing_reexports_the_same_functions(self):
        from apps.core.utils import paths as core
        from apps.publishing.domain import paths as publishing

        for name in ("normalize_relative_path", "frame_file_name", "resolve_mount"):
            assert getattr(publishing, name) is getattr(core, name)
        assert publishing.PathRuleError is core.PathRuleError

    def test_a_link_leaving_the_root_is_refused(self, tmp_path):
        (tmp_path / "root").mkdir()
        (tmp_path / "outside").mkdir()
        os.symlink(tmp_path / "outside", tmp_path / "root" / "link")
        with pytest.raises(PathRuleError):
            resolve_mount(str(tmp_path / "root"), "link/secret.exr")


# ---------------------------------------------------------------------------------------------- WP 17.2, 17.3 opening


class TestOpening:
    def test_a_sequence_is_queued_from_its_registered_frames(
        self, editor, version, root, studio, queued, django_capture_on_commit_callbacks
    ):
        file = _sequence_file(version, root)
        with django_capture_on_commit_callbacks(execute=True):
            resp = _copy(editor, file)

        assert resp.status_code == 202, resp.content
        body = resp.json()
        assert body["kind"] == "sequence" and body["status"] == "queued"
        assert body["source_name"] == "sh010_comp_v001.%04d.exr [1001-1002]"
        assert body["published_file_id"] == str(file.pk)
        assert body["storage_readable"] is True and body["frames_until"] is None
        assert "shots/" not in resp.content.decode()  # the path is not on the row (C-RP-44)
        media = ReviewMedia.objects.get(pk=body["id"])
        assert (media.storage_root, media.storage_path) == (ROOT, PATTERN)
        assert (media.first_frame, media.last_frame, media.source_path) == (1001, 1002, "")
        assert queued == [str(media.pk)]
        entry = AuditLog.objects.get(metadata__review_media_id=str(media.pk))
        assert entry.metadata["operation"] == "review_media_from_storage"
        assert "shots/" not in entry.description

    def test_a_movie_and_its_colour_space(self, editor, version, root, studio, queued):
        file = _register(version, root, MOVIE)
        resp = _copy(editor, file, color_space="ACEScg")

        assert resp.status_code == 202, resp.content
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        assert (media.kind, media.source_container, media.source_name) == (
            "movie",
            "mov",
            "sh010_comp_v001.mov",
        )
        assert media.color_space == "ACEScg"

    def test_a_proxy_and_a_deprecated_file_can_be_used(self, editor, version, root, studio, queued):
        file = _register(version, root, MOVIE, role="proxy")
        PublishedFile.objects.filter(pk=file.pk).update(status=PublishedFile.Status.DEPRECATED)
        assert _copy(editor, file).status_code == 202

    @pytest.mark.parametrize(
        ("change", "sentence"),
        [
            (
                {"status": "Revoked", "revoke_reason": "wrong plate"},
                "This file was revoked; a review copy cannot be made from it.",
            ),
            ({"role": "sidecar"}, "A review copy is made from a main or proxy file"),
            ({"checksum_state": "mismatch"}, "This file does not match its checksum"),
            ({"checksum_state": "missing"}, "This file was not found on its storage root"),
        ],
    )
    def test_what_the_file_says_refuses_it(
        self, editor, version, root, studio, queued, change, sentence
    ):
        role = change.pop("role", "main")
        file = _register(version, root, MOVIE, role=role)
        if change:
            PublishedFile.objects.filter(pk=file.pk).update(**change)
        resp = _copy(editor, file)

        assert resp.status_code == 400
        assert resp.json()["detail"][0].startswith(sentence)
        assert not ReviewMedia.objects.exists()
        listed = _api(editor).get(f"/api/v1/publishing/files/{file.pk}/").json()
        assert listed["review_copy_refusal"].startswith(sentence)

    def test_a_root_the_server_does_not_read(self, editor, version, root, settings, queued):
        settings.PUBLISHING_STORAGE_MOUNTS = {}
        file = _register(version, root, MOVIE)
        resp = _copy(editor, file)

        assert resp.status_code == 400
        assert resp.json()["detail"] == ["The server does not read the storage root STUDIO."]
        assert "studio" not in resp.content.decode().replace("STUDIO", "")

    @pytest.mark.parametrize(
        ("path", "frames", "sentence"),
        [
            ("assets/hero/model.abc", {}, "A review copy is made from a movie, a still"),
            ("plates/sh010.%04d.cin", {"frame_start": 1, "frame_end": 2}, "Frames can be"),
            (PATTERN, {"frame_start": 1, "frame_end": 3000}, "A sequence has at most 2000 frames."),
        ],
    )
    def test_what_the_worker_cannot_read(
        self, editor, version, root, studio, queued, path, frames, sentence
    ):
        file = _register(version, root, path, **frames)
        resp = _copy(editor, file)

        assert resp.status_code == 400
        assert resp.json()["detail"][0].startswith(sentence)
        assert (
            _api(editor)
            .get(f"/api/v1/publishing/files/{file.pk}/")
            .json()["review_copy_refusal"]
            .startswith(sentence)
        )

    def test_a_usable_file_has_no_refusal(self, editor, version, root, studio):
        file = _sequence_file(version, root)
        assert (
            _api(editor).get(f"/api/v1/publishing/files/{file.pk}/").json()["review_copy_refusal"]
            is None
        )

    def test_busy_is_a_409(self, editor, version, root, studio, queued):
        file = _register(version, root, MOVIE)
        assert _copy(editor, file).status_code == 202
        assert _copy(editor, file).status_code == 409

    def test_switched_off_is_a_409(self, editor, version, root, studio, settings):
        settings.REVIEW_MEDIA_ENABLED = False
        resp = _copy(editor, _register(version, root, MOVIE))
        assert resp.status_code == 409

    def test_a_file_out_of_reach_is_the_same_404_as_an_unknown_id(
        self, version, root, studio, queued
    ):
        stranger = _user(ProjectFactory.create(code="OTHERPROJ"), *EDITOR, *READS)
        file = _register(version, root, MOVIE)
        out_of_reach = _copy(stranger, file)
        unknown = _api(stranger).post(
            "/api/v1/publishing/files/00000000-0000-0000-0000-000000000000/review-copy/",
            {},
            format="json",
        )
        assert out_of_reach.status_code == unknown.status_code == 404
        for body in (out_of_reach.json(), unknown.json()):
            body["error"].pop("request_id")
        assert out_of_reach.json()["detail"] == unknown.json()["detail"]

    def test_rights(self, project, version, root, studio, queued):
        file = _register(version, root, MOVIE)
        viewer = _user(project, "project.view", "version.view", *READS)
        no_reads = _user(project, *EDITOR)
        artist = _user(project, *ARTIST, *READS)
        assert _copy(viewer, file).status_code == 403
        assert _copy(no_reads, file).status_code == 403
        assert _copy(artist, file).status_code == 403  # not the version's artist
        own = _version(project, "RPS_SH020_V001", is_published=True, artist=artist)
        assert (
            _copy(artist, _register(own, root, MOVIE.replace("sh010", "sh020"))).status_code == 202
        )

    def test_an_unknown_field_is_refused(self, editor, version, root, studio, queued):
        resp = _copy(editor, _register(version, root, MOVIE), path="/etc/passwd")
        assert resp.status_code == 400
        assert resp.json()["path"] == ["Unknown field."]


# ---------------------------------------------------------------------------------------------- WP 17.4 reading


class TestReading:
    def test_a_sequence_is_read_through_links_to_its_frames(
        self, editor, version, root, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        frames = _frames(studio)
        before = _tree(studio)
        media = _opened(editor, _sequence_file(version, root))
        result, calls, links = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.READY, media.error_code
        assert links[0] == {
            "frame.00001001.exr": str(frames[1001].resolve()),
            "frame.00001002.exr": str(frames[1002].resolve()),
        }
        assert "file:../source/frame.%08d.exr" in calls[0]
        # the links are gone, the studio's files are as they were, nothing was written there
        assert not (Path(media.directory) / "source").exists()
        assert not (Path(service_module._media_root()) / media.directory / "source").exists()
        assert _tree(studio) == before
        assert media.frames_until is None and media.source_path == ""
        assert media.storage_path == PATTERN  # still readable, so it can be remade

    def test_a_movie_is_read_through_one_link(
        self, editor, version, root, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        movie = _write(studio, MOVIE, MOV + b"\x00" * 64)
        media = _opened(editor, _register(version, root, MOVIE))
        result, calls, links = _process(
            media, monkeypatch, django_capture_on_commit_callbacks, probe=_probe()
        )

        assert result == Status.READY, media.error_code
        assert links[0] == {"source.mov": str(movie.resolve())}
        assert not list((service_module._media_root() / media.directory).glob("source*"))
        assert movie.read_bytes().startswith(MOV)

    def test_a_movie_whose_content_is_not_a_movie_is_never_read(
        self, editor, version, root, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        # registered as a movie, replaced on disk by something else (C-RP-45: the leading bytes decide)
        _write(studio, MOVIE, MOV + b"\x00" * 64)
        media = _opened(editor, _register(version, root, MOVIE))
        _write(studio, MOVIE, b"#!/bin/sh\n" + b"\x00" * 64)
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED
        assert media.error_code == "storage_unreadable"
        assert calls == []
        assert not list((service_module._media_root() / media.directory).glob("source*"))

    def test_a_frame_leaving_the_root_through_a_link_is_never_read(
        self,
        editor,
        version,
        root,
        studio,
        tmp_path,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        frames = _frames(studio, numbers=(1001,))
        outside = tmp_path / "outside"
        outside.mkdir()
        (outside / "secret.exr").write_bytes(EXR + b"secret")
        os.symlink(outside / "secret.exr", studio / PATTERN.replace("%04d", "1002"))
        media = _opened(editor, _sequence_file(version, root))
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED
        assert media.error_code == "storage_unreadable"
        assert calls == []  # ffmpeg never ran
        assert not (service_module._media_root() / media.directory / "source").exists()
        assert frames[1001].exists()

    @pytest.mark.parametrize("problem", ["missing", "content", "unlisted"])
    def test_a_frame_that_cannot_be_used_fails_the_job(
        self,
        editor,
        version,
        root,
        studio,
        settings,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
        problem,
    ):
        frames = _frames(studio)
        media = _opened(editor, _sequence_file(version, root))
        if problem == "missing":
            frames[1002].unlink()
        elif problem == "content":
            frames[1002].write_bytes(MOV + b"\x00" * 64)
        else:
            settings.PUBLISHING_STORAGE_MOUNTS = {}
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED
        assert media.error_code == "storage_unreadable"
        assert media.error_message == "The published file could not be read from studio storage."
        assert calls == []
        assert not (service_module._media_root() / media.directory / "source").exists()

    def test_the_log_names_the_frame_never_the_path(
        self, editor, version, root, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        logged: list[dict] = []
        monkeypatch.setattr(
            service_module.logger,
            "warning",
            lambda event, **kw: logged.append({"event": event, **kw}),
        )
        frames = _frames(studio)
        frames[1002].unlink()
        media = _opened(editor, _sequence_file(version, root))
        _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert [e for e in logged if e["event"] == "review_media_storage_unreadable"] == [
            {
                "event": "review_media_storage_unreadable",
                "review_media_id": str(media.pk),
                "reason": "missing",
                "frame": 1002,
            }
        ]

    def test_an_empty_folder_is_never_deleted(self, settings):
        keep = Path(settings.MEDIA_ROOT) / "keep.txt"
        keep.write_text("x")
        service_module._delete_folder("")
        service_module._delete_folder("elsewhere")
        assert keep.exists()


# ---------------------------------------------------------------------------------------------- WP 17.5 remake, revoke


class TestRemakeAndRevoke:
    def test_a_copy_from_storage_is_remade_by_reading_the_file_again(
        self, editor, version, root, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready_from_storage(
            editor, version, root, studio, monkeypatch, django_capture_on_commit_callbacks
        )
        resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/remake/")

        assert resp.status_code == 202, resp.content
        made = ReviewMedia.objects.get(pk=resp.json()["id"])
        assert (made.storage_root, made.storage_path, made.published_file_id) == (
            ROOT,
            PATTERN,
            media.published_file_id,
        )
        assert made.source_path == "" and made.frames_until is None
        result, _, links = _process(made, monkeypatch, django_capture_on_commit_callbacks)
        assert result == Status.READY
        assert sorted(links[0]) == ["frame.00001001.exr", "frame.00001002.exr"]

    def test_the_project_remake_remakes_it_too(
        self,
        producer,
        project,
        version,
        root,
        studio,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        _ready_from_storage(
            producer, version, root, studio, monkeypatch, django_capture_on_commit_callbacks
        )
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        listed = _api(producer).get(f"/api/v1/projects/{project.pk}/review-copies/").json()
        assert listed["differing"][0]["remakable"] is True
        assert listed["differing"][0]["published_file_id"] is not None

        resp = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert resp.json() == {
            "queued": 1,
            "skipped_busy": 0,
            "skipped_sequence": 0,
            "skipped_missing": 0,
            "skipped_storage": 0,
        }

    def test_revoking_the_file_keeps_the_copy_but_it_cannot_be_remade(
        self,
        producer,
        project,
        version,
        root,
        studio,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        media = _ready_from_storage(
            producer, version, root, studio, monkeypatch, django_capture_on_commit_callbacks
        )
        revoker = _user(project, "publishing.view", "publishing.revoke")
        file = PublishedFile.objects.get(pk=media.published_file_id)
        PublishedFileService.revoke(
            actor=revoker, request=request_for(revoker), file=file, reason="wrong plate"
        )
        media.refresh_from_db()

        assert media.status == Status.READY and media.proxy_path
        assert (media.storage_root, media.storage_path) == ("", "")
        assert media.published_file_id == file.pk
        shown = _api(producer).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]
        assert shown["storage_readable"] is False
        resp = _api(producer).post(f"/api/v1/review-media/{media.pk}/remake/")
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.REMAKE_REFUSALS["storage"]]

        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        listed = _api(producer).get(f"/api/v1/projects/{project.pk}/review-copies/").json()
        assert listed["differing"][0]["remakable"] is False
        remade = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert remade.json()["skipped_storage"] == 1 and remade.json()["queued"] == 0
        kept = _api(producer).post(
            f"/api/v1/projects/{project.pk}/review-copies/keep/",
            {"review_media_ids": [str(media.pk)]},
            format="json",
        )
        assert kept.status_code == 200 and kept.json() == {"kept": 1}

    def test_a_copy_still_to_be_made_when_its_file_is_revoked_fails(
        self,
        editor,
        project,
        version,
        root,
        studio,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        _frames(studio)
        media = _opened(editor, _sequence_file(version, root))
        revoker = _user(project, "publishing.view", "publishing.revoke")
        PublishedFileService.revoke(
            actor=revoker,
            request=request_for(revoker),
            file=PublishedFile.objects.get(pk=media.published_file_id),
            reason="wrong plate",
        )
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED and media.error_code == "storage_unreadable"
        assert calls == []

    def test_a_root_no_longer_read_makes_it_not_remakable(
        self,
        editor,
        version,
        root,
        studio,
        settings,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        media = _ready_from_storage(
            editor, version, root, studio, monkeypatch, django_capture_on_commit_callbacks
        )
        settings.PUBLISHING_STORAGE_MOUNTS = {}
        resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/remake/")
        assert resp.status_code == 400
        assert resp.json()["detail"] == [service_module.REMAKE_REFUSALS["storage"]]
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]
        assert shown["storage_readable"] is False

    def test_an_uploaded_copy_says_it_is_not_from_storage(
        self, editor, version, root, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        from apps.production.tests.test_rp14_remake import _ready

        media = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]
        assert shown["published_file_id"] is None and shown["storage_readable"] is False
        assert media.storage_root == ""
