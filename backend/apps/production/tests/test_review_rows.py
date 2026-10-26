"""
The parts of a review as rows (WP E4, DECISIONS D-30): the JSON shapes the frontend reads are built
from rows, authors come from the request, a verdict belongs to its participant, appends cannot be lost.
"""

from __future__ import annotations

import threading
import uuid

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import (
    ProjectMembership,
    Review,
    ReviewActivity,
    ReviewComment,
    ReviewItem,
    ReviewParticipant,
)
from apps.production.services.review import ReviewService
from apps.production.tests.factories import (
    ProjectFactory,
    ReviewFactory,
    ShotFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

CODES = ("review.view", "review.update")
APPROVER = ("review.view", "review.update", "review.approve")


@pytest.fixture
def project():
    return ProjectFactory.create(code="REVROWS")


@pytest.fixture
def review(project):
    return ReviewFactory.create(project=project, code="R1", status="In Review")


def _user(project, *codes, role="Artist", **fields):
    user = UserFactory.create(**fields)
    if codes:
        grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role=role)
    return user


def _api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _url(review, tail=""):
    return f"/api/v1/reviews/{review.id}/{tail}"


class TestShapes:
    def test_the_detail_rebuilds_every_list_from_rows(self, project, review):
        author = _user(project, *CODES)
        shot = ShotFactory.create(project=project, code="S1")
        version = VersionFactory.create(project=project, shot=shot, code="S1_V1")
        api = _api(author)
        assert (
            api.post(
                _url(review, "versions/"), {"version_id": str(version.id)}, format="json"
            ).status_code
            == 201
        )
        assert (
            api.post(
                _url(review, "comments/"), {"text": "Too dark", "frame_number": 12}, format="json"
            ).status_code
            == 201
        )
        assert (
            api.post(
                _url(review, "notes/"), {"content": "Pin me", "is_pinned": True}, format="json"
            ).status_code
            == 201
        )
        assert (
            api.post(
                _url(review, "annotations/"), {"comment": "Here", "frame_number": 3}, format="json"
            ).status_code
            == 201
        )

        body = api.get(_url(review)).json()

        assert [v["code"] for v in body["versions"]] == ["S1_V1"]
        assert body["versions"][0]["id"] == str(version.id)
        assert body["comments"][0]["text"] == "Too dark" and body["comments"][0]["replies"] == []
        assert body["comments"][0]["is_resolved"] is False
        assert body["notes"][0]["is_pinned"] is True
        assert body["annotations"][0]["frame_number"] == 3
        assert body["reviewers"] == [] and isinstance(body["activity"], list)

    def test_the_json_columns_are_neither_read_nor_written(self, project, review):
        Review.objects.filter(pk=review.pk).update(comments=[{"id": "x", "text": "old"}])
        author = _user(project, *CODES)
        _api(author).post(_url(review, "comments/"), {"text": "new"}, format="json")

        body = _api(author).get(_url(review)).json()

        assert [c["text"] for c in body["comments"]] == ["new"]
        review.refresh_from_db()
        assert review.comments == [{"id": "x", "text": "old"}]  # left for the contract phase

    def test_the_list_endpoint_carries_the_same_lists(self, project, review):
        user = _user(project, *CODES)
        ReviewService.add_note(actor=user, review=review, content="n")

        rows = _api(user).get("/api/v1/reviews/").json()
        rows = rows["results"] if isinstance(rows, dict) and "results" in rows else rows

        assert rows[0]["notes"][0]["content"] == "n"


class TestAuthors:
    def test_a_comment_is_written_by_the_caller_whatever_the_body_says(self, project, review):
        user = _user(project, *CODES)

        resp = _api(user).post(
            _url(review, "comments/"), {"text": "hi", "author": "The Director"}, format="json"
        )

        assert resp.status_code == 201
        row = ReviewComment.objects.get(pk=resp.json()["id"])
        assert row.author_id == user.pk
        assert row.author_name == user.display_name != "The Director"
        assert resp.json()["author"] == row.author_name

    def test_a_note_takes_the_role_from_the_membership(self, project, review):
        user = _user(project, *CODES, role="VFX Supervisor")

        resp = _api(user).post(
            _url(review, "notes/"),
            {"content": "x", "author_name": "Someone Else", "author_role": "Studio Head"},
            format="json",
        )

        assert resp.status_code == 201
        assert resp.json()["author_role"] == "VFX Supervisor"
        assert resp.json()["author_name"] != "Someone Else"

    def test_an_annotation_is_written_by_the_caller(self, project, review):
        user = _user(project, *CODES)
        resp = _api(user).post(
            _url(review, "annotations/"), {"comment": "c", "author_name": "Nobody"}, format="json"
        )
        assert resp.status_code == 201 and resp.json()["author_id"] == str(user.pk)
        assert resp.json()["author_name"] != "Nobody"


class TestComments:
    def test_a_reply_hangs_under_its_comment(self, project, review):
        user = _user(project, *CODES)
        api = _api(user)
        root = api.post(_url(review, "comments/"), {"text": "root"}, format="json").json()
        reply = api.post(
            _url(review, "comments/"), {"text": "re", "parent_id": root["id"]}, format="json"
        )

        assert reply.status_code == 201
        body = api.get(_url(review)).json()
        assert len(body["comments"]) == 1
        assert [r["text"] for r in body["comments"][0]["replies"]] == ["re"]

    def test_a_reply_to_a_reply_and_a_foreign_parent_are_refused(self, project, review):
        user = _user(project, *CODES)
        api = _api(user)
        root = api.post(_url(review, "comments/"), {"text": "root"}, format="json").json()
        reply = api.post(
            _url(review, "comments/"), {"text": "re", "parent_id": root["id"]}, format="json"
        ).json()
        other = ReviewFactory.create(project=project, code="R2")
        foreign = _api(user).post(_url(other, "comments/"), {"text": "x"}, format="json").json()

        deeper = api.post(
            _url(review, "comments/"), {"text": "no", "parent_id": reply["id"]}, format="json"
        )
        crossed = api.post(
            _url(review, "comments/"), {"text": "no", "parent_id": foreign["id"]}, format="json"
        )

        assert deeper.status_code == 400
        assert crossed.status_code == 404
        assert ReviewComment.objects.filter(review=review).count() == 2

    def test_resolve_and_reopen_record_who(self, project, review):
        user = _user(project, *CODES)
        api = _api(user)
        comment = api.post(_url(review, "comments/"), {"text": "c"}, format="json").json()

        done = api.post(_url(review, f"comments/{comment['id']}/resolve/"))
        assert done.status_code == 200
        row = ReviewComment.objects.get(pk=comment["id"])
        assert row.resolved_at is not None and row.resolved_by_id == user.pk
        assert done.json()["comments"][0]["is_resolved"] is True

        again = api.post(_url(review, f"comments/{comment['id']}/reopen/"))
        row.refresh_from_db()
        assert again.status_code == 200 and row.resolved_at is None and row.resolved_by_id is None

    def test_a_comment_of_another_review_is_not_found(self, project, review):
        user = _user(project, *CODES)
        other = ReviewFactory.create(project=project, code="R2")
        comment = ReviewService.add_comment(actor=user, review=other, text="x")

        resp = _api(user).post(_url(review, f"comments/{comment.pk}/resolve/"))

        assert resp.status_code == 404
        assert _api(user).post(_url(review, "comments/not-a-uuid/resolve/")).status_code == 404


class TestParticipants:
    def test_a_member_is_added_once_and_a_stranger_is_refused(self, project, review):
        lead = _user(project, *CODES)
        member = _user(project)
        stranger = UserFactory.create()
        api = _api(lead)

        first = api.post(
            _url(review, "participants/"), {"user_id": str(member.pk), "role": "Sup"}, format="json"
        )
        twice = api.post(_url(review, "participants/"), {"user_id": str(member.pk)}, format="json")
        outside = api.post(
            _url(review, "participants/"), {"user_id": str(stranger.pk)}, format="json"
        )
        unknown = api.post(
            _url(review, "participants/"), {"user_id": str(uuid.uuid4())}, format="json"
        )

        assert first.status_code == 201
        assert first.json()["reviewers"][0]["user_id"] == str(member.pk)
        assert twice.status_code == 400
        assert outside.status_code == 400 and unknown.status_code == 400
        assert outside.json()["user_id"] == unknown.json()["user_id"]  # a stranger looks unknown
        assert ReviewParticipant.objects.filter(review=review).count() == 1

    def test_a_participant_can_be_removed_and_is_then_unknown(self, project, review):
        lead = _user(project, *CODES)
        member = _user(project)
        row = ReviewService.add_participant(actor=lead, review=review, user=member)
        api = _api(lead)

        assert api.delete(_url(review, f"participants/{row.pk}/")).status_code == 200

        assert api.get(_url(review)).json()["reviewers"] == []
        assert api.delete(_url(review, f"participants/{row.pk}/")).status_code == 404
        # the same user can be asked again
        assert ReviewService.add_participant(actor=lead, review=review, user=member).pk != row.pk

    def test_only_the_participant_records_their_verdict(self, project, review):
        owner = _user(project, *CODES)
        other = _user(project, *CODES)
        row = ReviewService.add_participant(actor=owner, review=review, user=owner)
        body = {"participant_id": str(row.pk), "verdict": "Changes Requested", "notes": "fix"}

        assert (
            _api(other).post(_url(review, "participant-verdict/"), body, format="json").status_code
            == 403
        )
        row.refresh_from_db()
        assert row.verdict == "Pending Review"

        resp = _api(owner).post(_url(review, "participant-verdict/"), body, format="json")

        assert resp.status_code == 200
        mine = resp.json()["reviewers"][0]
        assert mine["verdict"] == "Changes Requested" and mine["verdict_notes"] == "fix"
        assert mine["verdict_date"] is not None
        assert (
            ReviewActivity.objects.filter(review=review, action="PARTICIPANT_VERDICT").count() == 1
        )

    def test_the_id_the_old_list_gave_still_works(self, project, review):
        owner = _user(project, *CODES)
        ReviewParticipant.objects.create(review=review, user=owner, name="Me", legacy_id="p1")

        resp = _api(owner).post(
            _url(review, "participant-verdict/"),
            {"participant_id": "p1", "verdict": "Retake"},
            format="json",
        )

        assert resp.status_code == 200

    def test_a_row_without_an_account_is_answered_by_someone_who_can_approve(self, project, review):
        ReviewParticipant.objects.create(review=review, name="Old Entry", legacy_id="p9")
        plain = _user(project, *CODES)
        boss = _user(project, *APPROVER)
        body = {"participant_id": "p9", "verdict": "Retake"}

        assert (
            _api(plain).post(_url(review, "participant-verdict/"), body, format="json").status_code
            == 403
        )
        assert (
            _api(boss).post(_url(review, "participant-verdict/"), body, format="json").status_code
            == 200
        )

    def test_an_unknown_or_other_reviews_participant_is_404(self, project, review):
        user = _user(project, *CODES)
        other = ReviewFactory.create(project=project, code="R2")
        row = ReviewService.add_participant(actor=user, review=other, user=user)

        for ref in ("nope", str(row.pk), str(uuid.uuid4())):
            resp = _api(user).post(
                _url(review, "participant-verdict/"),
                {"participant_id": ref, "verdict": "Retake"},
                format="json",
            )
            assert resp.status_code == 404


class TestVersions:
    def test_versions_are_added_in_order_and_only_from_the_project(self, project, review):
        user = _user(project, *CODES)
        shot = ShotFactory.create(project=project, code="S1")
        first = VersionFactory.create(project=project, shot=shot, code="A_V1")
        second = VersionFactory.create(project=project, shot=shot, code="A_V2", version_index=2)
        foreign_project = ProjectFactory.create(code="OTHER")
        foreign = VersionFactory.create(
            project=foreign_project,
            shot=ShotFactory.create(project=foreign_project, code="S9"),
            code="F_V1",
        )
        api = _api(user)

        assert (
            api.post(
                _url(review, "versions/"), {"version_id": str(second.id)}, format="json"
            ).status_code
            == 201
        )
        assert (
            api.post(_url(review, "versions/"), {"version_id": "a_v1"}, format="json").status_code
            == 201
        )
        assert (
            api.post(
                _url(review, "versions/"), {"version_id": str(first.id)}, format="json"
            ).status_code
            == 400
        )
        assert (
            api.post(
                _url(review, "versions/"), {"version_id": str(foreign.id)}, format="json"
            ).status_code
            == 400
        )

        codes = [v["code"] for v in api.get(_url(review)).json()["versions"]]
        assert codes == ["A_V2", "A_V1"]

    def test_a_version_can_be_taken_off_and_put_back(self, project, review):
        user = _user(project, *CODES)
        version = VersionFactory.create(
            project=project, shot=ShotFactory.create(project=project, code="S1"), code="A_V1"
        )
        api = _api(user)
        api.post(_url(review, "versions/"), {"version_id": str(version.id)}, format="json")

        assert api.delete(_url(review, f"versions/{version.id}/")).status_code == 200
        assert api.get(_url(review)).json()["versions"] == []
        assert api.delete(_url(review, f"versions/{version.id}/")).status_code == 404
        assert (
            api.post(
                _url(review, "versions/"), {"version_id": str(version.id)}, format="json"
            ).status_code
            == 201
        )
        assert ReviewItem.objects.filter(review=review).count() == 1

    def test_the_actions_need_the_update_permission(self, project, review):
        viewer = _user(project, "review.view")
        version = VersionFactory.create(
            project=project, shot=ShotFactory.create(project=project, code="S1"), code="A_V1"
        )
        api = _api(viewer)

        assert (
            api.post(
                _url(review, "versions/"), {"version_id": str(version.id)}, format="json"
            ).status_code
            == 403
        )
        assert (
            api.post(
                _url(review, "participants/"), {"user_id": str(viewer.pk)}, format="json"
            ).status_code
            == 403
        )
        assert api.post(_url(review, "comments/"), {"text": "x"}, format="json").status_code == 403


class TestScoping:
    def test_a_non_member_cannot_touch_the_parts(self, project, review):
        outsider = UserFactory.create()
        grant_permissions(outsider, *APPROVER)
        api = _api(outsider)

        for tail, body in (
            ("comments/", {"text": "x"}),
            ("notes/", {"content": "x"}),
            ("annotations/", {"comment": "x"}),
            ("participants/", {"user_id": str(outsider.pk)}),
            ("versions/", {"version_id": str(uuid.uuid4())}),
        ):
            assert api.post(_url(review, tail), body, format="json").status_code == 404, tail
        assert not ReviewComment.objects.exists()


class TestProjectNotes:
    def test_a_project_note_is_written_by_the_caller(self, project):
        from apps.production.models import ProjectNote

        user = _user(project, "project.view", "note.create", role="Coordinator")

        resp = _api(user).post(
            f"/api/organizations/projects/{project.id}/notes/",
            {
                "subject": "Heads up",
                "author_name": "The Director",
                "author_role": "Studio Head",
                "author_avatar": "https://example.com/x.png",
            },
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        note = ProjectNote.objects.get(pk=resp.json()["id"])
        assert note.author_id == user.pk
        assert (note.author_name, note.author_role, note.author_avatar) == (
            user.display_name,
            "Coordinator",
            "",
        )


class TestSeedsAndLegacyImport:
    def test_the_import_fills_empty_kinds_once(self, project):
        version = VersionFactory.create(
            project=project, shot=ShotFactory.create(project=project, code="S1"), code="A_V1"
        )
        review = ReviewFactory.create(
            project=project,
            code="SEED",
            versions=[str(version.id)],
            comments=[{"author": "Ann", "text": "one"}],
        )

        assert ReviewService.import_legacy_json(review) == []
        assert ReviewService.import_legacy_json(review) == []  # a second run adds nothing

        assert ReviewItem.objects.filter(review=review).count() == 1
        assert ReviewComment.objects.filter(review=review).count() == 1


class TestActivity:
    def test_a_status_change_with_notes_adds_a_row_and_leaves_the_json_alone(self, project):
        review = ReviewFactory.create(project=project, code="R5", status="Pending Review")
        user = _user(project, *CODES)

        resp = _api(user).post(_url(review, "submit/"), {"notes": "ready"}, format="json")

        assert resp.status_code == 200
        entry = resp.json()["activity"][-1]
        assert entry["action"] == "SUBMITTED" and entry["notes"] == "ready"
        assert entry["user"] == user.email
        review.refresh_from_db()
        assert review.activity == []

    def test_a_verdict_with_notes_is_logged_with_the_verdict(self, project, review):
        boss = _user(project, *APPROVER)

        resp = _api(boss).post(
            _url(review, "verdict/"), {"verdict": "Retake", "notes": "again"}, format="json"
        )

        assert resp.status_code == 200
        entry = resp.json()["activity"][-1]
        assert entry["action"] == "VERDICT" and entry["verdict"] == "Retake"


@pytest.mark.django_db(transaction=True)
def test_parallel_appends_are_all_kept():
    """With the JSON list this was read, append, write: eight comments at once left one or two."""
    project = ProjectFactory.create(code="REVRACE")
    review = ReviewFactory.create(project=project, code="RR")
    user = UserFactory.create()
    start = threading.Barrier(8)
    outcomes: list[str] = []

    def comment(n):
        try:
            start.wait()
            ReviewService.add_comment(actor=user, review=review, text=f"c{n}")
            ReviewService.add_note(actor=user, review=review, content=f"n{n}")
            outcomes.append("ok")
        except Exception as exc:  # noqa: BLE001
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [threading.Thread(target=comment, args=(n,)) for n in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert outcomes == ["ok"] * 8, outcomes
    assert ReviewComment.objects.filter(review=review).count() == 8
    assert review.note_rows.count() == 8


@pytest.mark.django_db(transaction=True)
def test_parallel_version_adds_get_distinct_positions():
    project = ProjectFactory.create(code="REVPOS")
    review = ReviewFactory.create(project=project, code="RP")
    user = UserFactory.create()
    shot = ShotFactory.create(project=project, code="S1")
    versions = [
        VersionFactory.create(project=project, shot=shot, code=f"V{n}", version_index=n + 1)
        for n in range(6)
    ]
    start = threading.Barrier(6)
    outcomes: list[str] = []

    def add(version):
        try:
            start.wait()
            ReviewService.add_version(actor=user, review=review, version_ref=str(version.id))
            outcomes.append("ok")
        except Exception as exc:  # noqa: BLE001
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [threading.Thread(target=add, args=(v,)) for v in versions]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert outcomes == ["ok"] * 6, outcomes
    assert sorted(
        ReviewItem.objects.filter(review=review).values_list("position", flat=True)
    ) == list(range(6))
