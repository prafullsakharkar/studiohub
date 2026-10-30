"""
CR-15 and CR-16 (frontend sync, Phase 7).

CR-15: ``archive`` on media and reviews was missing from the viewsets' ``permission_map``, so
``HasPermission`` failed closed for everyone. Media is archived with ``media.update`` (like versions and
playlists), reviews with ``review.delete`` (what DELETE already needs).

CR-16: a review starts Pending Review (any other status on create skipped the workflow), a comment needs
text, and a verdict is one of the known values (it was stored as typed).
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Media, ProjectMembership, Review, ReviewParticipant
from apps.production.tests.factories import MediaFactory, ProjectFactory, ReviewFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def project():
    return ProjectFactory.create(code="CR1516")


def _api(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    client = APIClient()
    client.force_authenticate(user=user)
    client.user = user  # type: ignore[attr-defined]
    return client


class TestMediaArchive:
    def test_media_update_archives_it_and_restore_brings_it_back(self, project):
        media = MediaFactory.create(project=project)
        api = _api(project, "media.view", "media.update")

        resp = api.post(f"/api/v1/media/{media.id}/archive/")

        assert resp.status_code == 200, resp.json()
        assert Media.all_objects.get(pk=media.pk).is_deleted is True
        assert api.post(f"/api/v1/media/{media.id}/restore/").status_code == 200
        assert Media.objects.filter(pk=media.pk).exists()

    def test_without_media_update_it_is_refused_and_nothing_changes(self, project):
        media = MediaFactory.create(project=project)

        resp = _api(project, "media.view", "media.create").post(
            f"/api/v1/media/{media.id}/archive/"
        )

        assert resp.status_code == 403
        assert Media.all_objects.get(pk=media.pk).is_deleted is False


class TestReviewArchive:
    def test_review_delete_archives_it(self, project):
        review = ReviewFactory.create(project=project)

        resp = _api(project, "review.view", "review.delete").post(
            f"/api/v1/reviews/{review.id}/archive/"
        )

        assert resp.status_code == 200, resp.json()
        assert Review.all_objects.get(pk=review.pk).is_deleted is True

    def test_review_update_alone_cannot_archive(self, project):
        review = ReviewFactory.create(project=project)

        resp = _api(project, "review.view", "review.update").post(
            f"/api/v1/reviews/{review.id}/archive/"
        )

        assert resp.status_code == 403
        assert Review.all_objects.get(pk=review.pk).is_deleted is False


class TestReviewStatusOnCreate:
    def _create(self, project, **extra):
        return _api(project, "review.view", "review.create").post(
            "/api/v1/reviews/",
            {"project": str(project.id), "title": "Dailies", **extra},
            format="json",
        )

    def test_a_new_review_starts_pending_review(self, project):
        resp = self._create(project)

        assert resp.status_code == 201, resp.json()
        assert resp.json()["status"] == "Pending Review"
        assert self._create(project, title="Two", status="Pending Review").status_code == 201

    @pytest.mark.parametrize("status", ["Bogus", "Approved", "Closed"])
    def test_any_other_status_is_refused(self, project, status):
        resp = self._create(project, status=status)

        assert resp.status_code == 400
        assert "status" in resp.json()
        assert not Review.objects.filter(title="Dailies").exists()


class TestComments:
    @pytest.fixture
    def review(self, project):
        return ReviewFactory.create(project=project, status="In Review")

    @pytest.mark.parametrize(
        "body", [{}, {"text": ""}, {"text": "   "}, {"comment": ""}, {"text": "", "comment": " "}]
    )
    def test_a_comment_needs_text(self, project, review, body):
        api = _api(project, "review.view", "review.update")

        resp = api.post(f"/api/v1/reviews/{review.id}/comments/", body, format="json")

        assert resp.status_code == 400
        assert resp.json()["text"] == ["A comment needs some text."]

    @pytest.mark.parametrize("key", ["text", "comment"])
    def test_either_spelling_is_still_accepted(self, project, review, key):
        api = _api(project, "review.view", "review.update")

        resp = api.post(f"/api/v1/reviews/{review.id}/comments/", {key: "Too dark"}, format="json")

        assert resp.status_code == 201, resp.json()
        assert resp.json()["text"] == "Too dark"


class TestVerdicts:
    @pytest.fixture
    def review(self, project):
        return ReviewFactory.create(project=project, status="In Review")

    def test_the_supervisor_verdict_must_be_a_known_one(self, project, review):
        api = _api(project, "review.view", "review.update", "review.approve")

        resp = api.post(
            f"/api/v1/reviews/{review.id}/verdict/", {"verdict": "Banana"}, format="json"
        )

        assert resp.status_code == 400
        assert "verdict" in resp.json()
        review.refresh_from_db()
        assert review.supervisor_verdict == "Pending Review"
        assert review.status == "In Review"

    def test_a_known_verdict_still_works(self, project, review):
        api = _api(project, "review.view", "review.update", "review.approve")

        resp = api.post(
            f"/api/v1/reviews/{review.id}/verdict/", {"verdict": "Changes Requested"}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        review.refresh_from_db()
        assert review.supervisor_verdict == "Changes Requested"

    def test_a_participant_verdict_must_be_a_known_one(self, project, review):
        api = _api(project, "review.view", "review.update")
        row = ReviewParticipant.objects.create(review=review, user=api.user, role="Observer")

        bad = api.post(
            f"/api/v1/reviews/{review.id}/participant-verdict/",
            {"participant_id": str(row.pk), "verdict": "Banana"},
            format="json",
        )
        good = api.post(
            f"/api/v1/reviews/{review.id}/participant-verdict/",
            {"participant_id": str(row.pk), "verdict": "Changes Requested", "notes": "fix"},
            format="json",
        )

        assert bad.status_code == 400
        assert "verdict" in bad.json()
        assert good.status_code == 200, good.json()
        row.refresh_from_db()
        assert row.verdict == "Changes Requested"
