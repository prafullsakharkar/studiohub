"""
Review pipeline RP-10: loose ends of RP-5 and RP-6 (docs/review-pipeline PLAN WP 10.4 and 10.5;
CONTRACTS C-RP-26, C-RP-27; Q-RP-41 to Q-RP-45 = A).

C-RP-26: a version's artist who holds ``version.create`` uploads, retries and removes the review
movie of their own version; holders of ``version.update`` keep every right; anyone else who reads
the version gets a 403, and a version out of reach stays a 404.
"""

from __future__ import annotations

import pytest

from apps.production.models import ReviewMedia
from apps.production.services import review_media as service_module
from apps.production.tests.factories import ProjectFactory, ShotFactory, VersionFactory
from apps.production.tests.test_rp5_review_media import (
    EDITOR,
    VIEWER,
    _api,
    _movie,
    _process,
    _upload,
    _user,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_MAX_BYTES = 10 * 1024 * 1024


@pytest.fixture
def queued(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: calls.append(str(media_id)))
    return calls


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTEN")


@pytest.fixture
def version(project):
    shot = ShotFactory.create(project=project, code="RPTEN_SH010")
    return VersionFactory.create(project=project, shot=shot, code="RPTEN_SH010_V001")


#: the seeded artist role's version codes (``init_platform``: version view and create)
ARTIST = ("project.view", "version.view", "version.create")
Status = ReviewMedia.Status


def _owned_by(version, user):
    version.artist = user
    version.save(update_fields=["artist"])
    return version


def _row(api, version, capture):
    resp = _upload(api, version, _movie(), capture)
    assert resp.status_code == 202, resp.content
    return ReviewMedia.objects.get(pk=resp.json()["id"])


def _retry(api, media):
    return api.post(f"/api/v1/review-media/{media.pk}/retry/")


def _remove(api, media, capture):
    with capture(execute=True):
        return api.delete(f"/api/v1/review-media/{media.pk}/")


# ---------------------------------------------------------------------------------------------- C-RP-26


class TestTheVersionsArtist:
    def test_uploads_retries_and_removes_on_their_own_version(
        self, project, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        artist = _user(project, *ARTIST)
        _owned_by(version, artist)
        api = _api(artist)

        failed = _row(api, version, django_capture_on_commit_callbacks)
        _process(failed, monkeypatch, fail_on="libx264")
        with django_capture_on_commit_callbacks(execute=True):
            assert _retry(api, failed).status_code == 202
        _process(failed, monkeypatch)
        assert failed.status == Status.READY

        assert _remove(api, failed, django_capture_on_commit_callbacks).status_code == 204
        failed.refresh_from_db()
        assert failed.status == Status.REMOVED

    def test_another_artist_on_the_project_may_not(
        self, project, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        owner = _user(project, *ARTIST)
        _owned_by(version, owner)
        failed = _row(_api(owner), version, django_capture_on_commit_callbacks)
        _process(failed, monkeypatch, fail_on="libx264")
        other = _api(_user(project, *ARTIST))

        assert _upload(other, version, _movie()).status_code == 403
        assert _retry(other, failed).status_code == 403
        failed.refresh_from_db()
        assert (failed.status, failed.attempts) == (Status.FAILED, 1)
        ready = _row(_api(owner), version, django_capture_on_commit_callbacks)
        _process(ready, monkeypatch)
        assert _remove(other, ready, django_capture_on_commit_callbacks).status_code == 403
        ready.refresh_from_db()
        assert ready.status == Status.READY

    def test_the_artist_without_version_create_may_not(self, project, version, queued):
        artist = _user(project, *VIEWER)
        _owned_by(version, artist)
        assert _upload(_api(artist), version, _movie()).status_code == 403

    def test_the_right_follows_the_field(
        self, project, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        former = _user(project, *ARTIST)
        _owned_by(version, former)
        media = _row(_api(former), version, django_capture_on_commit_callbacks)
        _process(media, monkeypatch)
        _owned_by(version, _user(project, *ARTIST))

        assert _upload(_api(former), version, _movie()).status_code == 403
        assert _remove(_api(former), media, django_capture_on_commit_callbacks).status_code == 403

    def test_an_artist_out_of_reach_still_gets_a_404(self, version, queued):
        stranger = _user(ProjectFactory.create(code="OTHER"), *ARTIST)
        _owned_by(version, stranger)
        assert _upload(_api(stranger), version, _movie()).status_code == 404

    def test_when_off_the_artist_gets_the_409_and_anyone_else_the_403(
        self, project, version, queued, settings
    ):
        settings.REVIEW_MEDIA_ENABLED = False
        artist = _user(project, *ARTIST)
        _owned_by(version, artist)
        resp = _upload(_api(artist), version, _movie())
        assert resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_disabled"
        assert _upload(_api(_user(project, *ARTIST)), version, _movie()).status_code == 403


class TestEditorsKeepEveryRight:
    def test_version_update_on_someone_elses_version(
        self, project, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _owned_by(version, _user(project, *ARTIST))
        editor = _api(_user(project, *EDITOR))
        media = _row(editor, version, django_capture_on_commit_callbacks)
        _process(media, monkeypatch)
        assert _remove(editor, media, django_capture_on_commit_callbacks).status_code == 204


# ---------------------------------------------------------------------------------------------- C-RP-27


class TestNotesSchema:
    @pytest.fixture(scope="class")
    def paths(self):
        from drf_spectacular.generators import SchemaGenerator

        return SchemaGenerator().get_schema(request=None, public=True)["paths"]

    @staticmethod
    def _ref(body):
        schema = body["content"]["application/json"]["schema"]
        return schema.get("$ref", "").rsplit("/", 1)[-1]

    def test_every_notes_route_names_its_request_and_response(self, paths):
        base = "/api/organizations/projects/{project_id}/notes/"
        detail = base + "{note_id}/"
        expected = {
            (base, "get"): (None, "200", "PaginatedProjectNoteList"),
            (base, "post"): ("ProjectNoteCreate", "201", "ProjectNote"),
            (detail, "get"): (None, "200", "ProjectNoteDetail"),
            (detail, "patch"): ("PatchedProjectNoteUpdate", "200", "ProjectNote"),
            (detail + "replies/", "post"): ("ProjectNoteReply", "201", "ProjectNote"),
            (detail + "status/", "post"): ("ProjectNoteStatus", "200", "ProjectNote"),
        }
        for (path, method), (request, code, response) in expected.items():
            operation = paths[path][method]
            if request:
                assert self._ref(operation["requestBody"]) == request, (path, method)
            assert self._ref(operation["responses"][code]) == response, (path, method)
        assert set(paths[detail]["delete"]["responses"]) == {"204"}
        assert "requestBody" not in paths[detail]["delete"]

    def test_the_list_is_the_paginated_shape(self):
        from drf_spectacular.generators import SchemaGenerator

        schemas = SchemaGenerator().get_schema(request=None, public=True)["components"]["schemas"]
        page = schemas["PaginatedProjectNoteList"]["properties"]
        assert set(page) == {"count", "next", "previous", "results"}
        assert page["results"]["items"]["$ref"].endswith("/ProjectNote")
