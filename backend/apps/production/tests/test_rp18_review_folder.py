"""
Review pipeline RP-18: review copies before approval, read by path from the project's review folder
(docs/review-pipeline PLAN WP 18.1 to 18.4; CONTRACTS C-RP-47 to C-RP-49; Q-RP-82 to Q-RP-86 = A;
ADR-0043).

A project declares one storage root and one folder on it. A version that is still in review has its
copy made from a render named relative to that folder (``POST versions/{id}/review-media/from-storage/``):
the request checks the folder, the worker resolves the render under the folder as it is when the job
runs, and a remake checks it again. ffmpeg is mocked, as in the RP-17 tests whose helpers these reuse.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from apps.audit.models import AuditLog
from apps.production.models import ReviewMedia
from apps.production.services import review_media as service_module
from apps.production.tests.factories import ProjectFactory
from apps.production.tests.test_rp14_remake import (
    ARTIST,
    EDITOR,
    EXR,
    MOV,
    PRODUCER,
    VIEWER,
    Status,
    _api,
    _probe,
    _user,
    _version,
)
from apps.production.tests.test_rp17_storage_copies import _fake_run, _write
from apps.production.transcode import ffmpeg as commands
from apps.production.validators.review_source import inside_folder

pytestmark = pytest.mark.django_db

ROOT = "STUDIO"
FOLDER = "shows/rpe/renders"
PATTERN = "sh010/comp/v003/sh010_comp_v003.%04d.exr"
MOVIE = "sh010/comp/v003/sh010_comp_v003.mov"


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
    """The studio's storage root as the worker sees it mounted; the project's folder is on it."""
    folder = tmp_path / "studio"
    (folder / FOLDER).mkdir(parents=True)
    settings.PUBLISHING_STORAGE_MOUNTS = {ROOT: str(folder)}
    return folder


@pytest.fixture
def queued(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: calls.append(str(media_id)))
    return calls


@pytest.fixture
def project(studio):
    return ProjectFactory.create(
        code="RPEIGHTEEN", review_source_root=ROOT, review_source_folder=FOLDER
    )


@pytest.fixture
def editor(project):
    return _user(project, *EDITOR)


@pytest.fixture
def producer(project):
    return _user(project, *PRODUCER, role="Producer")


@pytest.fixture
def version(project):
    """A version still in review: not approved, not published (Q-RP-82)."""
    return _version(project, "RPE_SH010_V003", status="Pending Review", is_published=False)


def _render(studio: Path, numbers=(1001, 1002), head: bytes = EXR) -> dict[int, Path]:
    return {
        n: _write(
            studio, f"{FOLDER}/{PATTERN.replace('%04d', str(n))}", head + bytes([n % 256]) * 64
        )
        for n in numbers
    }


def _from_storage(user, version, **body):
    return _api(user).post(
        f"/api/v1/versions/{version.pk}/review-media/from-storage/", body, format="json"
    )


def _opened(user, version, **body) -> ReviewMedia:
    body = body or {"path": PATTERN, "first_frame": 1001, "last_frame": 1002}
    resp = _from_storage(user, version, **body)
    assert resp.status_code == 202, resp.content
    return ReviewMedia.objects.get(pk=resp.json()["id"])


def _process(media, monkeypatch, capture, *, probe=None):
    calls: list[list[str]] = []
    links: list[dict[str, str]] = []
    monkeypatch.setattr(commands, "run", _fake_run(calls, links, probe=probe or _probe(2, "exr")))
    with capture(execute=True):
        result = service_module.ReviewMediaService.process(media.pk)
    media.refresh_from_db()
    return result, calls, links


def _ready(user, version, studio, monkeypatch, capture) -> ReviewMedia:
    _render(studio)
    media = _opened(user, version)
    result, _, _ = _process(media, monkeypatch, capture)
    assert result == Status.READY, media.error_code
    return media


def _patch(user, project, **body):
    return _api(user).patch(f"/api/v1/projects/{project.pk}/", body, format="json")


# ---------------------------------------------------------------------------------------------- WP 18.1 folder


class TestProjectFolder:
    def test_the_folder_is_normalized_and_the_root_upper_cased(self, producer, project):
        resp = _patch(
            producer, project, review_source_root="studio", review_source_folder="/shows/rpe/x/"
        )

        assert resp.status_code == 200, resp.content
        project.refresh_from_db()
        assert (project.review_source_root, project.review_source_folder) == (ROOT, "shows/rpe/x")
        assert resp.json()["review_source_folder"] == "shows/rpe/x"

    @pytest.mark.parametrize(
        ("body", "field"),
        [
            ({"review_source_root": "ARCHIVE"}, "review_source_root"),
            ({"review_source_root": "", "review_source_folder": "shows/x"}, "review_source_root"),
            ({"review_source_folder": ""}, "review_source_folder"),
            ({"review_source_folder": "shows/../other"}, "review_source_folder"),
            ({"review_source_folder": "shows\\x"}, "review_source_folder"),
            ({"review_source_folder": "shows/x.%04d"}, "review_source_folder"),
            ({"review_source_folder": "a" * 513}, "review_source_folder"),
        ],
    )
    def test_refusals(self, producer, project, body, field):
        resp = _patch(producer, project, **body)

        assert resp.status_code == 400, resp.content
        assert field in resp.json()
        project.refresh_from_db()
        assert (project.review_source_root, project.review_source_folder) == (ROOT, FOLDER)

    def test_clearing_both_switches_it_off(self, producer, project):
        resp = _patch(producer, project, review_source_root="", review_source_folder="")

        assert resp.status_code == 200, resp.content
        project.refresh_from_db()
        assert (project.review_source_root, project.review_source_folder) == ("", "")

    def test_a_stored_root_no_longer_listed_survives_other_writes(
        self, producer, project, settings
    ):
        settings.PUBLISHING_STORAGE_MOUNTS = {}
        resp = _patch(producer, project, review_source_folder="shows/rpe/other")

        assert resp.status_code == 200, resp.content
        project.refresh_from_db()
        assert project.review_source_root == ROOT

    def test_only_those_who_may_change_the_project_see_it(self, producer, editor, project):
        assert _api(producer).get(f"/api/v1/projects/{project.pk}/").json()[
            "review_source_folder"
        ] == (FOLDER)
        seen = _api(editor).get(f"/api/v1/projects/{project.pk}/").json()
        assert "review_source_root" not in seen and "review_source_folder" not in seen
        listed = _api(editor).get("/api/v1/projects/").json()["results"]
        assert all("review_source_folder" not in row for row in listed)

    def test_an_editor_cannot_set_it(self, editor, project):
        resp = _patch(editor, project, review_source_folder="shows/elsewhere")

        assert resp.status_code in (403, 404)
        project.refresh_from_db()
        assert project.review_source_folder == FOLDER


# ---------------------------------------------------------------------------------------------- WP 18.2 opening


class TestOpening:
    def test_a_sequence_of_a_version_in_review_is_queued(
        self, editor, version, queued, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            resp = _from_storage(editor, version, path=PATTERN, first_frame=1001, last_frame=1002)

        assert resp.status_code == 202, resp.content
        body = resp.json()
        row = ReviewMedia.objects.get(pk=body["id"])
        assert (row.storage_root, row.storage_path, row.published_file_id) == (
            ROOT,
            f"{FOLDER}/{PATTERN}",
            None,
        )
        assert row.kind == "sequence" and (row.first_frame, row.last_frame) == (1001, 1002)
        # readable as the RP-17 copies are: the render is still in the folder (C-RP-49)
        assert body["source"] == "storage_path" and body["storage_readable"] is True
        assert body["source_name"] == "sh010_comp_v003.%04d.exr [1001-1002]"
        assert FOLDER not in resp.content.decode() and "sh010/comp" not in resp.content.decode()
        assert queued == [str(row.pk)]
        version.refresh_from_db()
        assert version.is_published is False

    def test_a_movie_and_its_colour_space(self, editor, version, queued):
        resp = _from_storage(editor, version, path=MOVIE, color_space="ACEScg")

        assert resp.status_code == 202, resp.content
        row = ReviewMedia.objects.get(pk=resp.json()["id"])
        assert (row.kind, row.color_space, row.first_frame) == ("movie", "ACEScg", None)

    def test_the_audit(self, editor, version, queued):
        row = _opened(editor, version)

        entry = AuditLog.objects.filter(metadata__operation="review_media_from_path").get()
        assert entry.metadata["review_media_id"] == str(row.pk)
        assert FOLDER not in str(entry.metadata) and FOLDER not in entry.description

    @pytest.mark.parametrize(
        ("body", "field"),
        [
            ({"path": "../other/x.mov"}, "path"),
            ({"path": "/etc/passwd.mov"}, "path"),
            ({"path": "sh010//x.mov"}, "path"),
            ({"path": "sh010\\x.mov"}, "path"),
            ({"path": "sh010/x.txt"}, "path"),
            ({"path": PATTERN}, "first_frame"),
            ({"path": PATTERN, "first_frame": 1001}, "first_frame"),
            ({"path": MOVIE, "first_frame": 1, "last_frame": 2}, "path"),
            ({"path": PATTERN, "first_frame": 1002, "last_frame": 1001}, "last_frame"),
            ({"path": PATTERN, "first_frame": 1, "last_frame": 100000}, "path"),
            ({"path": "a/" * 505 + "x.mov"}, "path"),  # fits alone, not with the folder
            ({"path": MOVIE, "storage_root": "OTHER"}, "storage_root"),
        ],
    )
    def test_refusals_name_the_field_never_a_directory(self, editor, version, queued, body, field):
        resp = _from_storage(editor, version, **body)

        assert resp.status_code == 400, resp.content
        assert field in resp.json(), resp.json()
        assert FOLDER not in resp.content.decode() and "studio" not in resp.content.decode()
        assert queued == [] and not ReviewMedia.objects.filter(version=version).exists()

    def test_a_project_without_a_folder(self, editor, version, project, queued):
        project.review_source_root = project.review_source_folder = ""
        project.save(update_fields=["review_source_root", "review_source_folder"])

        resp = _from_storage(editor, version, path=MOVIE)

        assert resp.status_code == 400
        assert resp.json()["path"] == ["This project has no review folder on studio storage."]

    def test_a_root_the_server_no_longer_reads(self, editor, version, settings, queued):
        settings.PUBLISHING_STORAGE_MOUNTS = {}

        resp = _from_storage(editor, version, path=MOVIE)

        assert resp.status_code == 400
        assert resp.json()["path"] == [
            "The server does not read the storage root of this project's review folder."
        ]

    def test_busy_and_switched_off(self, editor, version, settings, queued):
        _opened(editor, version, path=MOVIE)
        resp = _from_storage(editor, version, path=MOVIE)
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_busy"

        settings.REVIEW_MEDIA_ENABLED = False
        resp = _from_storage(editor, version, path=MOVIE)
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_disabled"

    def test_rights_are_the_uploads(self, project, version, queued):
        viewer = _user(project, *VIEWER)
        assert _from_storage(viewer, version, path=MOVIE).status_code == 403
        artist = _user(project, *ARTIST)
        assert _from_storage(artist, version, path=MOVIE).status_code == 403
        version.artist = artist
        version.save(update_fields=["artist"])
        assert _from_storage(artist, version, path=MOVIE).status_code == 202

    def test_a_version_out_of_reach_is_a_404(self, version, queued):
        stranger = _user(ProjectFactory.create(code="RPEOTHER"), *EDITOR)
        assert _from_storage(stranger, version, path=MOVIE).status_code == 404


# ---------------------------------------------------------------------------------------------- WP 18.3 reading


class TestReading:
    def test_the_render_is_read_through_links_under_the_folder(
        self, editor, version, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        frames = _render(studio)
        media = _opened(editor, version)
        result, calls, links = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.READY, media.error_code
        assert links[0] == {f"frame.0000{n}.exr": str(frames[n].resolve()) for n in (1001, 1002)}
        assert not (service_module._media_root() / media.directory / "source").exists()
        assert all(p.exists() for p in frames.values())
        assert media.frames_until is None and media.source_path == ""

    def test_a_movie(
        self, editor, version, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        movie = _write(studio, f"{FOLDER}/{MOVIE}", MOV + b"\x00" * 64)
        media = _opened(editor, version, path=MOVIE)
        result, _, links = _process(
            media, monkeypatch, django_capture_on_commit_callbacks, probe=_probe()
        )

        assert result == Status.READY, media.error_code
        assert links[0] == {"source.mov": str(movie.resolve())}

    def test_a_link_leaving_the_folder_is_never_read_even_on_the_same_root(
        self,
        editor,
        version,
        studio,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        # another project's render, on the same root but outside this project's folder
        other = _write(studio, "shows/other/secret.mov", MOV + b"secret")
        target = studio / FOLDER / MOVIE
        target.parent.mkdir(parents=True)
        os.symlink(other, target)
        media = _opened(editor, version, path=MOVIE)
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED
        assert media.error_code == "render_unreadable"
        assert media.error_message == (
            "The render could not be read from the project's review folder on studio storage."
        )
        assert calls == []

    def test_a_folder_that_is_itself_a_link_off_the_root_is_refused(
        self,
        editor,
        version,
        studio,
        tmp_path,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        elsewhere = tmp_path / "elsewhere"
        _write(elsewhere, MOVIE, MOV + b"\x00" * 64)
        (studio / FOLDER).rmdir()
        os.symlink(elsewhere, studio / FOLDER)
        media = _opened(editor, version, path=MOVIE)
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED and media.error_code == "render_unreadable"
        assert calls == []

    def test_a_folder_changed_after_queuing_fails_the_job(
        self,
        editor,
        version,
        project,
        studio,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        logged: list[dict[str, object]] = []
        monkeypatch.setattr(
            service_module.logger,
            "warning",
            lambda event, **kw: logged.append({"event": event, **kw}),
        )
        _render(studio)
        media = _opened(editor, version)
        project.review_source_folder = "shows/rpe/elsewhere"
        project.save(update_fields=["review_source_folder"])
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED and media.error_code == "render_unreadable"
        assert calls == []
        assert [e for e in logged if e["event"] == "review_media_storage_unreadable"] == [
            {
                "event": "review_media_storage_unreadable",
                "review_media_id": str(media.pk),
                "reason": "outside_folder",
                "frame": None,
            }
        ]

    def test_a_missing_frame_fails_with_the_frame_in_the_log(
        self, editor, version, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        logged: list[dict[str, object]] = []
        monkeypatch.setattr(
            service_module.logger,
            "warning",
            lambda event, **kw: logged.append({"event": event, **kw}),
        )
        frames = _render(studio)
        frames[1002].unlink()
        media = _opened(editor, version)
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED and media.error_code == "render_unreadable"
        events = [e for e in logged if e["event"] == "review_media_storage_unreadable"]
        assert events == [
            {
                "event": "review_media_storage_unreadable",
                "review_media_id": str(media.pk),
                "reason": "missing",
                "frame": 1002,
            }
        ]
        assert FOLDER not in str(logged)

    def test_a_movie_that_is_not_a_movie(
        self, editor, version, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _write(studio, f"{FOLDER}/{MOVIE}", b"#!/bin/sh\n" + b"\x00" * 64)
        media = _opened(editor, version, path=MOVIE)
        result, calls, _ = _process(media, monkeypatch, django_capture_on_commit_callbacks)

        assert result == Status.FAILED and media.error_code == "render_unreadable"
        assert calls == []


# ---------------------------------------------------------------------------------------------- WP 18.4 remaking


class TestRemaking:
    def test_a_path_copy_is_remade_by_reading_the_render_again(
        self, editor, version, studio, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _ready(editor, version, studio, monkeypatch, django_capture_on_commit_callbacks)
        shown = _api(editor).get(f"/api/v1/versions/{version.pk}/review-media/").json()[0]
        assert (shown["source"], shown["storage_readable"]) == ("storage_path", True)

        resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/remake/")

        assert resp.status_code == 202, resp.content
        made = ReviewMedia.objects.get(pk=resp.json()["id"])
        assert (made.storage_root, made.storage_path, made.published_file_id) == (
            ROOT,
            f"{FOLDER}/{PATTERN}",
            None,
        )
        assert made.frames_until is None and made.source_path == ""
        result, _, links = _process(made, monkeypatch, django_capture_on_commit_callbacks)
        assert result == Status.READY
        assert sorted(links[0]) == ["frame.00001001.exr", "frame.00001002.exr"]

    def test_the_project_remake_remakes_it_too(
        self,
        producer,
        project,
        version,
        studio,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        _ready(producer, version, studio, monkeypatch, django_capture_on_commit_callbacks)
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        listed = _api(producer).get(f"/api/v1/projects/{project.pk}/review-copies/").json()
        entry = listed["differing"][0]
        assert (entry["remakable"], entry["source"], entry["published_file_id"]) == (
            True,
            "storage_path",
            None,
        )

        resp = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert resp.json()["queued"] == 1 and resp.json()["skipped_storage"] == 0

    def test_after_the_folder_changes_it_cannot_be_remade_but_can_be_kept(
        self,
        producer,
        project,
        version,
        studio,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        media = _ready(producer, version, studio, monkeypatch, django_capture_on_commit_callbacks)
        resp = _patch(producer, project, review_source_folder="shows/rpe/v2", review_burn_ins=True)
        assert resp.status_code == 200, resp.content

        shown = _api(producer).get(f"/api/v1/versions/{version.pk}/review-media/").json()[0]
        assert (shown["source"], shown["storage_readable"]) == ("storage_path", False)
        resp = _api(producer).post(f"/api/v1/review-media/{media.pk}/remake/")
        assert resp.status_code == 400
        assert resp.json()["detail"] == [
            "The render of this copy can no longer be read: it is not in the project's review "
            "folder any more, or the server no longer reads its storage root."
        ]
        listed = _api(producer).get(f"/api/v1/projects/{project.pk}/review-copies/").json()
        assert listed["differing"][0]["remakable"] is False
        remade = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert remade.json()["queued"] == 0 and remade.json()["skipped_storage"] == 1
        kept = _api(producer).post(
            f"/api/v1/projects/{project.pk}/review-copies/keep/",
            {"review_media_ids": [str(media.pk)]},
            format="json",
        )
        assert kept.status_code == 200, kept.content

    def test_a_root_no_longer_read_makes_it_not_remakable(
        self,
        editor,
        version,
        studio,
        settings,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        media = _ready(editor, version, studio, monkeypatch, django_capture_on_commit_callbacks)
        settings.PUBLISHING_STORAGE_MOUNTS = {}

        resp = _api(editor).post(f"/api/v1/review-media/{media.pk}/remake/")
        assert resp.status_code == 400

    def test_the_three_sources(self, editor, version, queued):
        row = _opened(editor, version, path=MOVIE)
        assert row.source == "storage_path" and row.storage_copy
        assert ReviewMedia(published_file_id=row.pk).source == "published_file"
        assert ReviewMedia().source == "upload" and not ReviewMedia().storage_copy

    def test_inside_folder_works_segment_by_segment(self):
        assert inside_folder("shows/a", "shows/a/x.mov")
        assert not inside_folder("shows/a", "shows/ab/x.mov")
        assert not inside_folder("shows/a", "shows/a")
        assert not inside_folder("", "x.mov")


# ---------------------------------------------------------------------------------------------- WP 18.6 tools


class TestRenderFarmToken:
    """docs/api/review-copies-from-storage.md: a personal access token with the artist's rights."""

    @staticmethod
    def _token_client(owner, scopes):
        from rest_framework.test import APIClient

        from apps.identity.api_keys.hashing import APIKeyHasher
        from apps.identity.models import PersonalAccessToken

        plain = "farmt.secr1234567890abcdef"
        PersonalAccessToken.objects.create(
            user=owner,
            name="render farm",
            prefix=plain.split(".", 1)[0],
            hashed_token=APIKeyHasher.hash(plain),
            scopes=scopes,
            is_active=True,
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {plain}")
        return client

    def _post(self, client, version):
        return client.post(
            f"/api/v1/versions/{version.pk}/review-media/from-storage/",
            {"path": MOVIE},
            format="json",
        )

    def test_the_documented_scopes_are_enough(self, editor, version, queued):
        client = self._token_client(editor, ["version.view", "version.update"])
        resp = self._post(client, version)
        assert resp.status_code == 202, resp.content

    def test_without_the_write_scope_it_is_refused(self, editor, version, queued):
        client = self._token_client(editor, ["version.view"])
        assert self._post(client, version).status_code == 403
