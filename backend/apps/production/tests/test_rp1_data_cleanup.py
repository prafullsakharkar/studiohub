"""
RP-1 data model cleanup (docs/review-pipeline/PLAN.md, CONTRACTS.md C-RP-01 to C-RP-06): a version no
longer serves its stored JSON copies, add-to-playlist writes only the entry row, reviews and playlists
are listed by version through their live rows, and comments and annotations name the version they are on.
"""

from __future__ import annotations

import uuid

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, ReviewComment, Version
from apps.production.services.playlist import PlaylistService
from apps.production.services.review import ReviewService
from apps.production.tests.factories import (
    PlaylistFactory,
    ProjectFactory,
    ReviewFactory,
    ShotFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

CODES = (
    "version.view",
    "version.update",
    "playlist.view",
    "playlist.update",
    "review.view",
    "review.update",
)
CACHE_KEYS = ("media_items", "attachments", "reviews", "playlists", "notes_list", "activity")


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPONE")


@pytest.fixture
def other_project():
    return ProjectFactory.create(code="RPOTHER")


@pytest.fixture
def versions(project):
    shot = ShotFactory.create(project=project, code="RPONE_S1")
    return [
        VersionFactory.create(project=project, shot=shot, code=f"RPONE_V{n}", version_index=n + 1)
        for n in range(3)
    ]


def _user(*projects, codes=CODES):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _api(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _ids(resp):
    assert resp.status_code == 200, resp.content
    return {row["id"] for row in resp.json()["results"]}


def _review_with(project, *shown, code="RPONE_R1"):
    review = ReviewFactory.create(project=project, code=code)
    for version in shown:
        ReviewService.add_version(actor=None, review=review, version_ref=str(version.id))
    return review


class TestVersionResponses:
    """C-RP-01, C-RP-02."""

    def test_the_model_has_no_copies_left(self):
        """WP 1.6: the six columns are dropped (migration 0004)."""
        names = {field.name for field in Version._meta.get_fields()}
        assert not set(CACHE_KEYS) & names
        assert "publishing_info" in names

    def test_list_and_detail_leave_the_lists_out(self, project, versions):
        version = versions[0]
        api = _api(_user(project))

        listed = api.get("/api/v1/versions/", {"project_id": str(project.id)})
        detail = api.get(f"/api/v1/versions/{version.id}/")

        assert listed.status_code == 200 and detail.status_code == 200
        for row in [*listed.json()["results"], detail.json()]:
            assert not set(CACHE_KEYS) & set(row), row.keys()
            assert "publishing_info" in row

    def test_an_update_answer_leaves_them_out_too(self, project, versions):
        resp = _api(_user(project)).patch(
            f"/api/v1/versions/{versions[0].id}/", {"notes": "graded"}, format="json"
        )

        assert resp.status_code == 200, resp.content
        assert not set(CACHE_KEYS) & set(resp.json())
        assert "publishing_info" in resp.json()

    @pytest.mark.parametrize("by", ["id", "name"])
    def test_add_to_playlist_answers_without_the_lists(self, project, versions, by):
        version = versions[0]
        playlist = PlaylistFactory.create(project=project, code="RPONE_PL")
        body = {"playlist_id": str(playlist.id)} if by == "id" else {"playlist_name": "Dailies"}

        resp = _api(_user(project)).post(
            f"/api/v1/versions/{version.id}/add-to-playlist/", body, format="json"
        )

        assert resp.status_code == 200, resp.content
        assert not set(CACHE_KEYS) & set(resp.json())
        assert playlist.entry_rows.filter(version=version).count() == (1 if by == "id" else 0)


class TestListsByVersion:
    """C-RP-03, C-RP-04."""

    def test_reviews_showing_a_version(self, project, versions):
        first, second, _ = versions
        both = _review_with(project, first, second, code="RPONE_R1")
        only_second = _review_with(project, second, code="RPONE_R2")
        _review_with(project, code="RPONE_R3")
        api = _api(_user(project))

        assert _ids(api.get("/api/v1/reviews/", {"version_id": str(first.id)})) == {str(both.id)}
        assert _ids(api.get("/api/v1/reviews/", {"version_id": str(second.id)})) == {
            str(both.id),
            str(only_second.id),
        }

    def test_a_removed_item_no_longer_matches(self, project, versions):
        review = _review_with(project, versions[0])
        ReviewService.remove_version(actor=None, review=review, version_ref=str(versions[0].id))

        resp = _api(_user(project)).get("/api/v1/reviews/", {"version_id": str(versions[0].id)})

        assert _ids(resp) == set()

    def test_playlists_holding_a_version(self, project, versions):
        first, second, _ = versions
        holding = PlaylistFactory.create(project=project, code="RPONE_A")
        PlaylistService.add_entry(user=None, playlist=holding, version_ref=first.id)
        removed = PlaylistFactory.create(project=project, code="RPONE_B")
        entry = PlaylistService.add_entry(user=None, playlist=removed, version_ref=first.id)
        PlaylistService.remove_entry(user=None, playlist=removed, ref=str(entry.pk))
        other = PlaylistFactory.create(project=project, code="RPONE_C")
        PlaylistService.add_entry(user=None, playlist=other, version_ref=second.id)
        api = _api(_user(project))

        assert _ids(api.get("/api/v1/playlists/", {"version_id": str(first.id)})) == {
            str(holding.id)
        }
        assert _ids(api.get("/api/v1/playlists/", {"version_id": str(second.id)})) == {
            str(other.id)
        }

    @pytest.mark.parametrize("route", ["reviews", "playlists"])
    @pytest.mark.parametrize("value", ["not-a-uuid", str(uuid.uuid4())])
    def test_unknown_or_malformed_is_an_empty_list(self, project, versions, route, value):
        _review_with(project, versions[0])
        playlist = PlaylistFactory.create(project=project, code="RPONE_D")
        PlaylistService.add_entry(user=None, playlist=playlist, version_ref=versions[0].id)

        assert _ids(_api(_user(project)).get(f"/api/v1/{route}/", {"version_id": value})) == set()

    @pytest.mark.parametrize("route", ["reviews", "playlists"])
    def test_empty_is_no_filter(self, project, versions, route):
        _review_with(project, versions[0])
        PlaylistFactory.create(project=project, code="RPONE_E")

        assert len(_ids(_api(_user(project)).get(f"/api/v1/{route}/", {"version_id": ""}))) == 1

    def test_it_combines_with_the_other_filters(self, project, versions):
        approved = _review_with(project, versions[0], code="RPONE_R4")
        ReviewFactory._meta.model.objects.filter(pk=approved.pk).update(status="Approved")
        _review_with(project, versions[0], code="RPONE_R5")
        api = _api(_user(project))

        resp = api.get(
            "/api/v1/reviews/", {"version_id": str(versions[0].id), "status": "Approved"}
        )

        assert _ids(resp) == {str(approved.id)}

    def test_playlist_filters_keep_working(self, project, versions):
        client = PlaylistFactory.create(project=project, code="RPONE_F", client_only=True)
        PlaylistFactory.create(project=project, code="RPONE_G", client_only=False)
        PlaylistService.add_entry(user=None, playlist=client, version_ref=versions[0].id)
        api = _api(_user(project))

        assert _ids(api.get("/api/v1/playlists/", {"client_only": "true"})) == {str(client.id)}
        assert (
            _ids(
                api.get(
                    "/api/v1/playlists/",
                    {
                        "version_id": str(versions[0].id),
                        "project": str(project.id),
                        "client_only": "false",
                    },
                )
            )
            == set()
        )

    @pytest.mark.parametrize("route", ["reviews", "playlists"])
    def test_it_does_not_widen_what_the_caller_sees(self, project, other_project, route):
        shot = ShotFactory.create(project=other_project, code="RPOTHER_S1")
        foreign = VersionFactory.create(project=other_project, shot=shot, code="RPOTHER_V1")
        _review_with(other_project, foreign, code="RPOTHER_R1")
        playlist = PlaylistFactory.create(project=other_project, code="RPOTHER_P")
        PlaylistService.add_entry(user=None, playlist=playlist, version_ref=foreign.id)

        resp = _api(_user(project)).get(f"/api/v1/{route}/", {"version_id": str(foreign.id)})

        assert _ids(resp) == set()


class TestCommentsAndAnnotationsOnAVersion:
    """C-RP-05, C-RP-06."""

    @pytest.mark.parametrize(
        "tail,body", [("comments/", {"text": "Too dark"}), ("annotations/", {"comment": "here"})]
    )
    def test_a_version_of_the_review_is_stored_and_returned(self, project, versions, tail, body):
        review = _review_with(project, versions[0], versions[1])
        api = _api(_user(project))

        resp = api.post(
            f"/api/v1/reviews/{review.id}/{tail}",
            {**body, "frame_number": 1012, "version_id": str(versions[1].id)},
            format="json",
        )

        assert resp.status_code == 201, resp.content
        assert resp.json()["version_id"] == str(versions[1].id)
        detail = api.get(f"/api/v1/reviews/{review.id}/").json()
        rows = detail["comments"] if tail == "comments/" else detail["annotations"]
        assert [row["version_id"] for row in rows] == [str(versions[1].id)]

    @pytest.mark.parametrize(
        "tail,body", [("comments/", {"text": "Too dark"}), ("annotations/", {"comment": "here"})]
    )
    def test_leaving_it_out_keeps_it_on_the_whole_review(self, project, versions, tail, body):
        review = _review_with(project, versions[0])

        resp = _api(_user(project)).post(f"/api/v1/reviews/{review.id}/{tail}", body, format="json")
        explicit = _api(_user(project)).post(
            f"/api/v1/reviews/{review.id}/{tail}", {**body, "version_id": None}, format="json"
        )

        assert resp.status_code == explicit.status_code == 201
        assert resp.json()["version_id"] is None and explicit.json()["version_id"] is None

    @pytest.mark.parametrize(
        "tail,body", [("comments/", {"text": "Too dark"}), ("annotations/", {"comment": "here"})]
    )
    def test_a_version_not_shown_in_the_review_is_refused(
        self, project, other_project, versions, tail, body
    ):
        review = _review_with(project, versions[0], versions[1])
        ReviewService.remove_version(actor=None, review=review, version_ref=str(versions[1].id))
        shot = ShotFactory.create(project=other_project, code="RPOTHER_S2")
        foreign = VersionFactory.create(project=other_project, shot=shot, code="RPOTHER_V2")
        api = _api(_user(project))

        for version_id in (versions[2].id, versions[1].id, foreign.id, uuid.uuid4()):
            resp = api.post(
                f"/api/v1/reviews/{review.id}/{tail}",
                {**body, "version_id": str(version_id)},
                format="json",
            )
            assert resp.status_code == 400, version_id
            assert resp.json()["version_id"] == ["This version is not in the review."]
        assert (
            api.post(
                f"/api/v1/reviews/{review.id}/{tail}", {**body, "version_id": "nope"}, format="json"
            ).status_code
            == 400
        )
        assert not review.comment_rows.exists() and not review.annotation_rows.exists()

    def test_a_reply_takes_its_threads_version(self, project, versions):
        review = _review_with(project, versions[0], versions[1])
        api = _api(_user(project))
        thread = api.post(
            f"/api/v1/reviews/{review.id}/comments/",
            {"text": "Edge flicker", "version_id": str(versions[1].id)},
            format="json",
        ).json()

        quiet = api.post(
            f"/api/v1/reviews/{review.id}/comments/",
            {"text": "Agreed", "parent_id": thread["id"]},
            format="json",
        )
        same = api.post(
            f"/api/v1/reviews/{review.id}/comments/",
            {"text": "Fixed", "parent_id": thread["id"], "version_id": str(versions[1].id)},
            format="json",
        )

        assert quiet.status_code == same.status_code == 201
        assert quiet.json()["version_id"] == same.json()["version_id"] == str(versions[1].id)
        replies = api.get(f"/api/v1/reviews/{review.id}/").json()["comments"][0]["replies"]
        assert [r["version_id"] for r in replies] == [str(versions[1].id)] * 2

    @pytest.mark.parametrize("thread_on", ["a version", "the whole review"])
    def test_a_reply_naming_another_version_is_refused(self, project, versions, thread_on):
        review = _review_with(project, versions[0], versions[1])
        api = _api(_user(project))
        body = {"text": "Edge flicker"}
        if thread_on == "a version":
            body["version_id"] = str(versions[1].id)
        thread = api.post(f"/api/v1/reviews/{review.id}/comments/", body, format="json").json()

        resp = api.post(
            f"/api/v1/reviews/{review.id}/comments/",
            {"text": "Here", "parent_id": thread["id"], "version_id": str(versions[0].id)},
            format="json",
        )

        assert resp.status_code == 400
        assert resp.json()["version_id"] == ["A reply is on its thread's version."]
        assert ReviewComment.objects.filter(review=review).count() == 1

    def test_rows_written_before_rp1_are_on_the_whole_review(self, project, versions):
        review = _review_with(project, versions[0])
        ReviewComment.objects.create(review=review, author_name="old", text="from the JSON")

        detail = _api(_user(project)).get(f"/api/v1/reviews/{review.id}/").json()

        assert detail["comments"][0]["version_id"] is None
