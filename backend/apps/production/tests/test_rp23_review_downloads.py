"""
Review-pipeline RP-23: downloading a review copy (docs/review-pipeline/CONTRACTS.md C-RP-56, C-RP-57;
Q-RP-105 to Q-RP-108).

WP 23.1: the project's ``review_downloads`` (``internal`` by default, ``everyone``, ``nobody``).
WP 23.2: ``download_url`` only for a viewer the switch lets download, and the stream view's output
``download`` re-checking it on every request, as an attachment named after the version.
WP 23.3: one audit row per download, written for a request from byte 0.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog, ChangeLog
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import (
    Project,
    ProjectMembership,
    Review,
    ReviewItem,
    ReviewMedia,
    ReviewParticipant,
)
from apps.production.services import review_media_links
from apps.production.tests.factories import ProjectFactory, ShotFactory, VersionFactory

pytestmark = pytest.mark.django_db

VIEWER = ("project.view", "version.view")
MOVIE = b"0123456789"


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_LINK_TTL_SECONDS = 3600


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWOTHREE")


@pytest.fixture
def version(project):
    shot = ShotFactory.create(project=project, code="RPTWOTHREE_SH010")
    return VersionFactory.create(project=project, shot=shot, code="RPTWOTHREE_SH010_V003")


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


def _copy(version, settings, *, still=False, body=MOVIE):
    """A ready copy of ``version`` with its files on disk, as the job leaves it."""
    folder = f"review_media/{version.pk}"
    name = "proxy.jpg" if still else "proxy.mp4"
    (Path(settings.MEDIA_ROOT) / folder).mkdir(parents=True, exist_ok=True)
    (Path(settings.MEDIA_ROOT) / folder / name).write_bytes(body)
    (Path(settings.MEDIA_ROOT) / folder / "thumbnail.jpg").write_bytes(b"thumb")
    return ReviewMedia.objects.create(
        project=version.project,
        version=version,
        kind=ReviewMedia.Kind.STILL if still else ReviewMedia.Kind.MOVIE,
        status=ReviewMedia.Status.READY,
        source_name="clip.mov",
        queued_at=timezone.now(),
        finished_at=timezone.now(),
        proxy_path=f"{folder}/{name}",
        thumbnail_path=f"{folder}/thumbnail.jpg",
    )


def _shown(user, version):
    return _api(user).get(f"/api/v1/versions/{version.pk}/").json()["review_media"]


def _client_of(project, version):
    """A client member who sees ``version`` through a review they take part in."""
    client_user = _user(project, *VIEWER, client_id="client-1")
    review = Review.objects.create(project=project, title="Client review")
    ReviewItem.objects.create(review=review, version=version)
    ReviewParticipant.objects.create(review=review, user=client_user, name="Client")
    return client_user


def _set(project, value):
    Project.objects.filter(pk=project.pk).update(review_downloads=value)


def _downloads(version):
    return AuditLog.objects.filter(
        target_type=AuditLog.TARGET_VERSION,
        target_id=str(version.pk),
        metadata__operation="download",
    )


class TestSwitch:
    """WP 23.1 (Q-RP-105)."""

    def test_internal_by_default_and_on_the_project(self, project):
        assert Project.objects.get(pk=project.pk).review_downloads == "internal"
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        body = _api(admin).get(f"/api/v1/projects/{project.pk}/").json()
        assert body["review_downloads"] == "internal"

    @pytest.mark.parametrize("value", ["everyone", "nobody", "internal"])
    def test_whoever_may_change_the_project_sets_it(self, project, value):
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        resp = _api(admin).patch(
            f"/api/v1/projects/{project.pk}/", {"review_downloads": value}, format="json"
        )
        assert resp.status_code == 200, resp.content
        assert resp.json()["review_downloads"] == value
        assert Project.objects.get(pk=project.pk).review_downloads == value

    def test_a_change_is_in_the_project_s_change_log(self, project):
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        _api(admin).patch(
            f"/api/v1/projects/{project.pk}/", {"review_downloads": "everyone"}, format="json"
        )
        change = ChangeLog.objects.get(target_id=str(project.pk), change_type="update")
        assert change.changed_fields == ["review_downloads"]
        assert change.before_values["review_downloads"] == "internal"
        assert change.after_values["review_downloads"] == "everyone"
        assert change.user_id == admin.pk

    def test_another_value_is_refused_on_its_field(self, project):
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        resp = _api(admin).patch(
            f"/api/v1/projects/{project.pk}/", {"review_downloads": "clients"}, format="json"
        )
        assert resp.status_code == 400 and "review_downloads" in resp.json()

    def test_a_reader_cannot_change_it(self, project):
        reader = _user(project, *VIEWER)
        resp = _api(reader).patch(
            f"/api/v1/projects/{project.pk}/", {"review_downloads": "everyone"}, format="json"
        )
        assert resp.status_code in (403, 404)
        assert Project.objects.get(pk=project.pk).review_downloads == "internal"


class TestLink:
    """WP 23.2 (Q-RP-105, Q-RP-106): who is given ``download_url``."""

    def test_a_studio_member_gets_a_download_link_of_its_own(self, project, version, settings):
        media = _copy(version, settings)
        viewer = _user(project, *VIEWER)
        shown = _shown(viewer, version)
        link = shown["download_url"]
        assert link.startswith(f"/api/v1/review-media/{media.pk}/download/?token=")
        payload = review_media_links.read_token(link.split("token=")[1])
        assert payload == {"m": str(media.pk), "u": str(viewer.pk), "o": "download"}
        assert shown["proxy_url"] != link

    def test_a_client_has_none_under_internal_and_one_under_everyone(
        self, project, version, settings
    ):
        _copy(version, settings)
        client_user = _client_of(project, version)
        assert _shown(client_user, version)["proxy_url"]  # they still play it
        assert _shown(client_user, version)["download_url"] is None
        _set(project, "everyone")
        assert _shown(client_user, version)["download_url"]

    def test_nobody_has_one_under_nobody(self, project, version, settings):
        _copy(version, settings)
        _set(project, "nobody")
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        for user in (_user(project, *VIEWER), admin, _client_of(project, version)):
            shown = _shown(user, version)
            assert shown["proxy_url"] and shown["download_url"] is None

    def test_a_platform_admin_with_a_client_membership_is_not_external(
        self, project, version, settings
    ):
        _copy(version, settings)
        admin = UserFactory.create(is_superuser=True, is_staff=True)
        ProjectMembership.objects.create(
            user=admin, project=project, status="active", role="Client", client_id="client-1"
        )
        assert _shown(admin, version)["download_url"]

    def test_a_copy_that_is_not_ready_has_none(self, project, version, settings):
        media = _copy(version, settings)
        ReviewMedia.objects.filter(pk=media.pk).update(status=ReviewMedia.Status.FAILED)
        viewer = _user(project, *VIEWER)
        rows = _api(viewer).get(f"/api/v1/versions/{version.pk}/review-media/").json()
        assert [row["download_url"] for row in rows] == [None]

    def test_the_version_list_reads_the_switch_once(
        self, project, settings, django_assert_max_num_queries
    ):
        viewer = _user(project, *VIEWER)
        for index in range(4):
            shot = ShotFactory.create(project=project)
            row = VersionFactory.create(project=project, shot=shot, code=f"RPTWOTHREE_Q{index}")
            _copy(row, settings)
        api = _api(viewer)
        api.get("/api/v1/versions/")  # warm the permission cache
        with django_assert_max_num_queries(14) as captured:
            body = api.get("/api/v1/versions/").json()
        assert sum(1 for row in body["results"] if row["review_media"]["download_url"]) == 4
        reads = [
            q
            for q in captured.captured_queries
            if '"review_downloads"' in q["sql"].split("FROM")[0]
        ]
        assert len(reads) <= 2  # the list's own project join may name it; the switch is read once


class TestDownload:
    """WP 23.2 and 23.3: the stream view's output ``download``."""

    def test_the_copy_is_an_attachment_named_after_the_version(self, project, version, settings):
        _copy(version, settings)
        viewer = _user(project, *VIEWER)
        resp = APIClient().get(_shown(viewer, version)["download_url"])
        assert resp.status_code == 200
        assert b"".join(resp.streaming_content) == MOVIE
        assert resp["Content-Type"] == "video/mp4"
        assert resp["Content-Disposition"] == 'attachment; filename="RPTWOTHREE_SH010_V003.mp4"'
        assert resp["X-Content-Type-Options"] == "nosniff"
        assert resp["Cache-Control"] == "private, no-store"

    def test_a_still_is_its_jpeg(self, project, version, settings):
        _copy(version, settings, still=True)
        viewer = _user(project, *VIEWER)
        resp = APIClient().get(_shown(viewer, version)["download_url"])
        assert resp.status_code == 200 and resp["Content-Type"] == "image/jpeg"
        assert resp["Content-Disposition"] == 'attachment; filename="RPTWOTHREE_SH010_V003.jpg"'

    def test_a_name_that_is_not_ascii_is_given_in_utf_8(self, project, settings):
        shot = ShotFactory.create(project=project, code="RPTWOTHREE_SH020")
        named = VersionFactory.create(project=project, shot=shot, code="RPTWOTHREE_SH020_É01")
        _copy(named, settings)
        viewer = _user(project, *VIEWER)
        disposition = APIClient().get(_shown(viewer, named)["download_url"])["Content-Disposition"]
        assert disposition.startswith("attachment; filename*=utf-8''")
        assert "RPTWOTHREE_SH020_%C3%8901.mp4" in disposition

    def test_playback_stays_inline(self, project, version, settings):
        _copy(version, settings)
        viewer = _user(project, *VIEWER)
        resp = APIClient().get(_shown(viewer, version)["proxy_url"])
        assert resp.status_code == 200
        assert not resp.get("Content-Disposition", "").startswith("attachment")

    def test_a_playback_token_is_not_a_download_token(self, project, version, settings):
        media = _copy(version, settings)
        viewer = _user(project, *VIEWER)
        token = _shown(viewer, version)["proxy_url"].split("token=")[1]
        resp = APIClient().get(f"/api/v1/review-media/{media.pk}/download/?token={token}")
        assert resp.status_code == 404
        assert not _downloads(version).exists()

    def test_the_switch_is_checked_again_on_every_request(self, project, version, settings):
        _copy(version, settings)
        viewer = _user(project, *VIEWER)
        link = _shown(viewer, version)["download_url"]
        _set(project, "nobody")
        assert APIClient().get(link).status_code == 404
        _set(project, "internal")
        assert APIClient().get(link).status_code == 200

    def test_a_client_link_stops_when_the_project_goes_back_to_internal(
        self, project, version, settings
    ):
        _copy(version, settings)
        _set(project, "everyone")
        client_user = _client_of(project, version)
        link = _shown(client_user, version)["download_url"]
        assert APIClient().get(link).status_code == 200
        _set(project, "internal")
        assert APIClient().get(link).status_code == 404
        # a link made for the client while internal is refused just the same
        media = ReviewMedia.objects.get(version=version)
        forged = review_media_links.stream_path(media, client_user, "download")
        assert APIClient().get(forged).status_code == 404

    def test_a_client_removed_from_the_review_loses_it(self, project, version, settings):
        _copy(version, settings)
        _set(project, "everyone")
        client_user = _client_of(project, version)
        link = _shown(client_user, version)["download_url"]
        ReviewParticipant.objects.filter(user=client_user).delete()
        assert APIClient().get(link).status_code == 404

    def test_behind_nginx_the_name_goes_with_the_redirect(self, project, version, settings):
        media = _copy(version, settings)
        settings.MEDIA_ACCEL_PREFIX = "/protected-media"
        viewer = _user(project, *VIEWER)
        resp = APIClient().get(_shown(viewer, version)["download_url"])
        assert resp.status_code == 200
        assert resp["X-Accel-Redirect"] == f"/protected-media/{media.proxy_path}"
        assert resp["Content-Disposition"] == 'attachment; filename="RPTWOTHREE_SH010_V003.mp4"'
        assert _downloads(version).count() == 1


class TestRecord:
    """WP 23.3 (Q-RP-107)."""

    def test_a_download_is_one_audit_row(self, project, version, settings):
        media = _copy(version, settings)
        viewer = _user(project, *VIEWER)
        APIClient().get(_shown(viewer, version)["download_url"], REMOTE_ADDR="10.1.2.3")
        row = _downloads(version).get()
        assert row.action == AuditLog.ACTION_EXPORT
        assert row.actor_id == viewer.pk
        assert row.project_id == project.pk
        assert row.ip_address == "10.1.2.3"
        assert row.description == "Downloaded the review copy RPTWOTHREE_SH010_V003.mp4."
        assert row.metadata == {
            "operation": "download",
            "review_media_id": str(media.pk),
            "kind": "movie",
            "file_name": "RPTWOTHREE_SH010_V003.mp4",
            # RP-25 (C-RP-59): the project has no slates
            "slate": False,
        }

    @pytest.mark.parametrize(
        ("header", "status", "counted"),
        [
            ("bytes=0-", 206, 1),
            ("bytes=0-3", 206, 1),
            ("bytes=4-", 206, 0),
            ("bytes=-3", 206, 0),
            ("bytes=10-12", 416, 0),
        ],
    )
    def test_a_resumed_download_is_not_counted_again(
        self, project, version, settings, header, status, counted
    ):
        _copy(version, settings)
        viewer = _user(project, *VIEWER)
        resp = APIClient().get(_shown(viewer, version)["download_url"], HTTP_RANGE=header)
        assert resp.status_code == status
        assert _downloads(version).count() == counted

    def test_playing_and_refused_requests_are_not_recorded(self, project, version, settings):
        _copy(version, settings)
        viewer = _user(project, *VIEWER)
        shown = _shown(viewer, version)
        APIClient().get(shown["proxy_url"])
        _set(project, "nobody")
        APIClient().get(shown["download_url"])
        assert not _downloads(version).exists()
