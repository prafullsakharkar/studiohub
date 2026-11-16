"""
Review pipeline RP-11: review notifications, client-visible comments and preferences (docs/review-pipeline
PLAN WP 11.1 to 11.4; CONTRACTS C-RP-28 to C-RP-30; Q-RP-46 to Q-RP-50 = A).

A review's decision, an invitation to give a verdict, a participant's verdict and a comment on someone's
version are told to the people the plan's table names, never to the actor, only while the review is in
their reach, and never in a kind they muted. A client member is served, and told about, only comments
that are client-visible.
"""

from __future__ import annotations

import uuid
from unittest import mock

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.notifications.events import handlers as handlers_module
from apps.notifications.models import Notification, NotificationPreference
from apps.production.api.serializers.review.detail import ReviewDetailSerializer
from apps.production.models import (
    ProjectMembership,
    Review,
    ReviewComment,
    ReviewItem,
    ReviewParticipant,
)
from apps.production.selectors.review import ReviewSelector
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    TaskFactory,
    VersionFactory,
)

pytestmark = pytest.mark.django_db

#: an artist reads reviews and versions (the seeded artist role holds review.view only)
READER = ("project.view", "version.view", "review.view")
#: a lead or supervisor who works in reviews
WORKER = (*READER, "review.update")
#: a supervisor who decides
APPROVER = (*WORKER, "review.approve")


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPELEVEN")


def _user(project, codes=READER, **membership):
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


def _url(review, tail=""):
    return f"/api/v1/reviews/{review.id}/{tail}"


def _rows(user):
    return list(
        Notification.objects.filter(recipient=user)
        .order_by("created_at")
        .values_list("kind", "target_type", "target_id", "data")
    )


def _kinds(user):
    return [kind for kind, _, _, _ in _rows(user)]


@pytest.fixture
def run(django_capture_on_commit_callbacks):
    """Make a request and run what it left for after commit, as a real commit would."""

    def call(fn, *args, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return fn(*args, **kwargs)

    return call


@pytest.fixture
def scene(project):
    """
    A review in progress, led by a lead, holding two artists' versions, with a participant who was
    asked for a verdict; a supervisor decides.
    """
    lead = _user(project, WORKER, role="Lead")
    artist = _user(project)
    other_artist = _user(project)
    participant = _user(project, WORKER, role="Lead")
    supervisor = _user(project, APPROVER, role="Supervisor")
    shot = ShotFactory.create(project=project, code="RPELEVEN_SH010")
    version = VersionFactory.create(
        project=project, shot=shot, artist=artist, code="SH010_V001", version_index=1
    )
    other = VersionFactory.create(
        project=project, shot=shot, artist=other_artist, code="SH010_V002", version_index=2
    )
    review = Review.objects.create(
        project=project,
        title="Dailies",
        code="DAILIES_01",
        status="In Review",
        entity_type="Shot",
        entity_id=str(shot.pk),
        entity_code=shot.code,
        lead_reviewer=lead,
        created_by=lead,
    )
    for position, item in enumerate((version, other)):
        ReviewItem.objects.create(review=review, version=item, position=position)
    ReviewParticipant.objects.create(review=review, user=participant, name="Participant")
    return {
        "review": review,
        "lead": lead,
        "artist": artist,
        "other_artist": other_artist,
        "participant": participant,
        "supervisor": supervisor,
        "shot": shot,
        "version": version,
        "other": other,
    }


def _comment(run, user, review, **body):
    body.setdefault("text", "Edge flickers at 1012")
    resp = run(_api(user).post, _url(review, "comments/"), body, format="json")
    assert resp.status_code == 201, resp.content
    return resp.json()


# ---------------------------------------------------------------------------------------------- C-RP-29


@pytest.fixture
def threads(project, scene):
    """One client-visible thread with a visible and an internal reply, and one internal thread."""
    review, lead = scene["review"], scene["lead"]
    shown = ReviewComment.objects.create(review=review, author=lead, text="For the client")
    ReviewComment.objects.create(review=review, author=lead, parent=shown, text="Visible reply")
    ReviewComment.objects.create(
        review=review, author=lead, parent=shown, text="Internal reply", is_client_visible=False
    )
    hidden = ReviewComment.objects.create(
        review=review, author=lead, text="Studio only", is_client_visible=False
    )
    return {"shown": shown, "hidden": hidden}


def _client(project, scene, codes=READER):
    client = _user(project, codes, role="Client", client_id="client-1")
    ReviewParticipant.objects.create(review=scene["review"], user=client, name="Client")
    return client


def _texts(comments):
    return [(c["text"], [r["text"] for r in c["replies"]]) for c in comments]


class TestClientVisibleComments:
    def test_a_client_member_is_served_only_client_visible_threads_and_replies(
        self, project, scene, threads
    ):
        client = _client(project, scene)
        api = _api(client)

        detail = api.get(_url(scene["review"])).json()
        listed = api.get("/api/v1/reviews/", {"project_id": str(project.id)}).json()["results"]

        assert _texts(detail["comments"]) == [("For the client", ["Visible reply"])]
        assert [_texts(r["comments"]) for r in listed] == [[("For the client", ["Visible reply"])]]

    def test_an_action_that_answers_the_whole_review_is_filtered_too(self, project, scene, threads):
        client = _client(project, scene, WORKER)

        resp = _api(client).post(_url(scene["review"], f"comments/{threads['shown'].id}/resolve/"))

        assert resp.status_code == 200, resp.content
        assert _texts(resp.json()["comments"]) == [("For the client", ["Visible reply"])]

    @pytest.mark.parametrize("who", ["internal", "vendor", "admin"])
    def test_internal_members_vendors_and_admins_see_every_comment(
        self, project, scene, threads, who
    ):
        if who == "internal":
            reader = scene["artist"]
        elif who == "vendor":
            reader = _user(project, role="Vendor", vendor_id="vendor-1")
            ReviewParticipant.objects.create(review=scene["review"], user=reader, name="Vendor")
            # a vendor reaches a review through their tasks' versions
            scene["version"].task = TaskFactory.create(
                project=project, shot=scene["shot"], code="RPELEVEN_T1", vendor_id="vendor-1"
            )
            scene["version"].save(update_fields=["task"])
        else:
            # a platform administrator is never a client member, even with a client membership
            reader = _client(project, scene)
            reader.is_superuser = True
            reader.save(update_fields=["is_superuser"])

        detail = _api(reader).get(_url(scene["review"])).json()

        assert _texts(detail["comments"]) == [
            ("For the client", ["Visible reply", "Internal reply"]),
            ("Studio only", []),
        ]

    def test_a_client_members_comment_is_client_visible_whatever_they_send(
        self, project, scene, run
    ):
        client = _client(project, scene, WORKER)

        made = _comment(run, client, scene["review"], is_client_visible=False)

        assert made["is_client_visible"] is True
        assert ReviewComment.objects.get(pk=made["id"]).is_client_visible is True

    def test_a_studio_member_can_write_an_internal_comment(self, scene, run):
        made = _comment(run, scene["lead"], scene["review"], is_client_visible=False)

        assert made["is_client_visible"] is False

    @pytest.mark.parametrize("target", ["hidden_thread", "internal_reply"])
    def test_a_comment_hidden_from_the_client_is_unknown_to_them(
        self, project, scene, threads, run, target
    ):
        client = _client(project, scene, WORKER)
        api = _api(client)
        hidden = (
            threads["hidden"]
            if target == "hidden_thread"
            else ReviewComment.objects.get(text="Internal reply")
        )
        unknown = uuid.uuid4()

        for comment_id in (hidden.id, unknown):
            for tail in ("resolve/", "reopen/"):
                resp = api.post(_url(scene["review"], f"comments/{comment_id}/{tail}"))
                assert resp.status_code == 404, (comment_id, tail, resp.content)
        reply = run(
            api.post,
            _url(scene["review"], "comments/"),
            {"text": "Can we see it?", "parent_id": str(threads["hidden"].id)},
            format="json",
        )
        assert reply.status_code == 404, reply.content
        assert ReviewComment.objects.get(pk=hidden.pk).resolved_at is None

    def test_without_a_request_only_client_visible_comments_are_served(self, scene, threads):
        fresh = ReviewSelector.get_queryset().get(pk=scene["review"].pk)

        data = ReviewDetailSerializer(fresh).data

        assert _texts(data["comments"]) == [("For the client", ["Visible reply"])]


# ---------------------------------------------------------------------------------------------- C-RP-28


class TestDecisions:
    @pytest.mark.parametrize(
        ("route", "decision"),
        [
            ("approve/", "Approved"),
            ("reject/", "Rejected"),
            ("request-changes/", "Changes Requested"),
        ],
    )
    def test_a_decision_tells_the_artists_and_the_participants(self, scene, run, route, decision):
        resp = run(_api(scene["supervisor"]).post, _url(scene["review"], route), {}, format="json")

        assert resp.status_code == 200, resp.content
        for person in (scene["artist"], scene["other_artist"], scene["participant"]):
            assert _rows(person) == [
                ("review_decision", "review", scene["review"].id, {"to_status": decision})
            ], person
        assert _rows(scene["supervisor"]) == []
        assert _rows(scene["lead"]) == []

    @pytest.mark.parametrize("verdict", ["Changes Requested", "Rejected", "Retake", "Approved"])
    def test_the_supervisors_verdict_tells_them_once(self, scene, run, verdict):
        resp = run(
            _api(scene["supervisor"]).post,
            _url(scene["review"], "verdict/"),
            {"verdict": verdict},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        assert _rows(scene["artist"]) == [
            ("review_decision", "review", scene["review"].id, {"to_status": verdict})
        ]

    def test_a_verdict_repeating_the_reviews_decision_is_told_again(self, scene, run):
        Review.objects.filter(pk=scene["review"].pk).update(status="Approved")

        run(
            _api(scene["supervisor"]).post,
            _url(scene["review"], "verdict/"),
            {"verdict": "Approved"},
            format="json",
        )

        assert _kinds(scene["artist"]) == ["review_decision"]

    @pytest.mark.parametrize(
        ("start", "route"),
        [("Pending Review", "submit/"), ("Submitted", "start-review/"), ("In Review", "close/")],
    )
    def test_a_status_that_is_not_a_decision_tells_nobody(self, scene, run, start, route):
        Review.objects.filter(pk=scene["review"].pk).update(status=start)

        resp = run(_api(scene["supervisor"]).post, _url(scene["review"], route), {}, format="json")

        assert resp.status_code == 200, resp.content
        assert not Notification.objects.exists()

    def test_a_pending_verdict_tells_nobody(self, scene, run):
        run(
            _api(scene["supervisor"]).post,
            _url(scene["review"], "verdict/"),
            {"verdict": "Pending Review"},
            format="json",
        )

        assert not Notification.objects.exists()

    def test_an_artist_without_review_view_hears_nothing(self, project, scene, run):
        blind = _user(project, ("project.view", "version.view"))
        scene["version"].artist = blind
        scene["version"].save(update_fields=["artist"])

        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")

        assert _rows(blind) == []
        assert _kinds(scene["other_artist"]) == ["review_decision"]

    def test_a_removed_version_and_a_removed_participant_are_not_told(self, scene, run):
        ReviewItem.objects.filter(review=scene["review"], version=scene["other"]).update(
            is_deleted=True
        )
        ReviewParticipant.objects.filter(review=scene["review"]).update(is_deleted=True)

        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")

        assert _kinds(scene["artist"]) == ["review_decision"]
        assert _rows(scene["other_artist"]) == []
        assert _rows(scene["participant"]) == []

    @pytest.mark.parametrize("case", ["no_artist", "both", "same_person", "task_deleted"])
    def test_the_assignee_of_a_versions_task_is_told_like_its_artist(
        self, project, scene, run, case
    ):
        # A version made on the Versions screen names no artist: its task's assignee is whose work it is,
        # as for version_status (RP-6).
        assignee = scene["artist"] if case == "same_person" else _user(project)
        version = scene["version"]
        version.task = TaskFactory.create(
            project=project,
            shot=scene["shot"],
            code="RPELEVEN_T2",
            assignee=assignee,
            is_deleted=case == "task_deleted",
        )
        if case == "no_artist":
            version.artist = None
        version.save(update_fields=["task", "artist"])

        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")

        # once each, even when the artist is also the assignee; a deleted task's assignee is not told
        assert _kinds(assignee) == ([] if case == "task_deleted" else ["review_decision"])
        assert _kinds(scene["artist"]) == ([] if case == "no_artist" else ["review_decision"])

    def test_a_client_participant_is_told_of_a_decision_on_their_review(self, project, scene, run):
        client = _client(project, scene)

        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")

        assert _kinds(client) == ["review_decision"]


class TestParticipants:
    def test_being_added_tells_that_person(self, project, scene, run):
        asked = _user(project, WORKER, role="Lead")

        resp = run(
            _api(scene["lead"]).post,
            _url(scene["review"], "participants/"),
            {"user_id": str(asked.id)},
            format="json",
        )

        assert resp.status_code == 201, resp.content
        assert _rows(asked) == [("review_invited", "review", scene["review"].id, {})]
        assert _rows(scene["lead"]) == []

    def test_adding_yourself_tells_nobody(self, scene, run):
        run(
            _api(scene["supervisor"]).post,
            _url(scene["review"], "participants/"),
            {"user_id": str(scene["supervisor"].id)},
            format="json",
        )

        assert not Notification.objects.exists()

    def test_a_verdict_tells_the_lead_reviewer_and_the_creator(self, project, scene, run):
        creator = _user(project, WORKER, role="Producer")
        Review.objects.filter(pk=scene["review"].pk).update(created_by=creator)
        row = ReviewParticipant.objects.get(review=scene["review"], user=scene["participant"])

        resp = run(
            _api(scene["participant"]).post,
            _url(scene["review"], "participant-verdict/"),
            {"participant_id": str(row.id), "verdict": "Changes Requested"},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        for person in (scene["lead"], creator):
            assert _rows(person) == [
                ("review_verdict", "review", scene["review"].id, {"verdict": "Changes Requested"})
            ], person
        assert _rows(scene["participant"]) == []
        assert _rows(scene["artist"]) == []

    def test_a_pending_participant_verdict_tells_nobody(self, scene, run):
        row = ReviewParticipant.objects.get(review=scene["review"], user=scene["participant"])

        run(
            _api(scene["participant"]).post,
            _url(scene["review"], "participant-verdict/"),
            {"participant_id": str(row.id), "verdict": "Pending Review"},
            format="json",
        )

        assert not Notification.objects.exists()


class TestComments:
    def test_a_comment_on_a_version_tells_its_artist(self, scene, run):
        _comment(run, scene["lead"], scene["review"], version_id=str(scene["version"].id))

        assert _rows(scene["artist"]) == [
            (
                "review_comment",
                "review",
                scene["review"].id,
                {"version_id": str(scene["version"].id)},
            )
        ]
        assert _rows(scene["other_artist"]) == []
        assert _rows(scene["lead"]) == []

    @pytest.mark.parametrize("with_artist", [False, True])
    def test_a_comment_on_a_version_tells_the_assignee_of_its_task(
        self, project, scene, run, with_artist
    ):
        assignee = _user(project)
        version = scene["version"]
        version.task = TaskFactory.create(
            project=project, shot=scene["shot"], code="RPELEVEN_T3", assignee=assignee
        )
        if not with_artist:
            version.artist = None
        version.save(update_fields=["task", "artist"])
        thread = _comment(run, scene["lead"], scene["review"], version_id=str(version.id))
        _comment(run, scene["participant"], scene["review"], parent_id=thread["id"])

        assert _kinds(assignee) == ["review_comment", "review_comment"]
        expected = ["review_comment", "review_comment"] if with_artist else []
        assert _kinds(scene["artist"]) == expected

    def test_a_comment_on_no_version_tells_nobody(self, scene, run):
        _comment(run, scene["lead"], scene["review"])

        assert not Notification.objects.exists()

    def test_a_reply_tells_the_author_the_earlier_repliers_and_the_versions_artist(
        self, project, scene, run
    ):
        thread = _comment(run, scene["lead"], scene["review"], version_id=str(scene["version"].id))
        earlier = _user(project, WORKER, role="Lead")
        _comment(run, earlier, scene["review"], parent_id=thread["id"])
        Notification.objects.all().delete()

        _comment(run, scene["participant"], scene["review"], parent_id=thread["id"])

        for person in (scene["lead"], earlier, scene["artist"]):
            assert _kinds(person) == ["review_comment"], person
        assert _rows(scene["participant"]) == []

    def test_an_internal_comment_tells_no_client_member(self, project, scene, run):
        client = _client(project, scene, WORKER)
        thread = _comment(run, client, scene["review"], version_id=str(scene["version"].id))
        Notification.objects.all().delete()

        _comment(
            run, scene["lead"], scene["review"], parent_id=thread["id"], is_client_visible=False
        )

        assert _rows(client) == []
        assert _kinds(scene["artist"]) == ["review_comment"]

    def test_an_internal_comment_is_told_to_a_platform_admin_with_a_client_membership(
        self, project, scene, run
    ):
        admin = _client(project, scene, WORKER)
        admin.is_superuser = True
        admin.save(update_fields=["is_superuser"])
        thread = _comment(run, admin, scene["review"])
        assert thread["is_client_visible"] is True
        internal = _comment(run, admin, scene["review"], is_client_visible=False)
        assert internal["is_client_visible"] is False  # an admin is not forced client-visible

        _comment(
            run, scene["lead"], scene["review"], parent_id=thread["id"], is_client_visible=False
        )

        assert _kinds(admin) == ["review_comment"]

    def test_a_client_visible_reply_tells_the_client_member(self, project, scene, run):
        client = _client(project, scene, WORKER)
        thread = _comment(run, client, scene["review"])

        _comment(run, scene["lead"], scene["review"], parent_id=thread["id"])

        assert _kinds(client) == ["review_comment"]

    def test_an_error_while_writing_rows_is_logged_and_the_comment_is_saved(self, scene, run):
        with (
            mock.patch.object(
                handlers_module.FanoutService, "notify", side_effect=RuntimeError("boom")
            ),
            mock.patch.object(handlers_module.logger, "exception") as logged,
        ):
            made = _comment(
                run, scene["lead"], scene["review"], version_id=str(scene["version"].id)
            )

        assert ReviewComment.objects.filter(pk=made["id"]).exists()
        assert not Notification.objects.exists()
        logged.assert_called_once_with("notification_fanout_failed", event="ReviewCommentAdded")


class TestReviewRowsInTheInbox:
    def test_a_review_row_names_the_review_and_its_record(self, scene, run):
        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")

        resp = _api(scene["artist"]).get("/api/v1/notifications/", {"kind": "review_decision"})

        assert resp.status_code == 200, resp.content
        [row] = resp.json()["results"]
        assert row["target"] == {
            "type": "review",
            "id": str(scene["review"].id),
            "code": "DAILIES_01",
            "name": "Dailies",
        }
        assert row["record"] == {
            "type": "Shot",
            "id": str(scene["shot"].id),
            "code": "RPELEVEN_SH010",
        }
        assert row["data"] == {"to_status": "Approved"}

    def test_a_deleted_review_drops_out_of_the_list_and_the_count(self, scene, run):
        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")
        api = _api(scene["artist"])
        assert api.get("/api/v1/notifications/unread-count/").json() == {"count": 1}

        Review.objects.filter(pk=scene["review"].pk).update(is_deleted=True)

        assert api.get("/api/v1/notifications/").json()["count"] == 0
        assert api.get("/api/v1/notifications/unread-count/").json() == {"count": 0}

    def test_a_client_who_leaves_the_review_loses_its_rows(self, project, scene, run):
        client = _client(project, scene)
        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")
        api = _api(client)
        assert api.get("/api/v1/notifications/unread-count/").json() == {"count": 1}

        ReviewParticipant.objects.filter(review=scene["review"], user=client).update(
            is_deleted=True
        )

        assert api.get("/api/v1/notifications/unread-count/").json() == {"count": 0}


# ---------------------------------------------------------------------------------------------- C-RP-30

PREFERENCES = "/api/v1/notifications/preferences/"
MUTABLE = [
    "note_created",
    "note_reply",
    "note_status",
    "task_assigned",
    "task_status",
    "version_status",
    "review_media_ready",
    "review_media_failed",
    "review_decision",
    "review_verdict",
    "review_comment",
    # RP-13 (C-RP-35): every new kind can be muted
    "delivery_status",
    "delivery_client_answer",
    "publish_finished",
    "published_file_revoked",
    "milestone_due",
    "milestone_completed",
]


class TestPreferences:
    def test_nobody_mutes_anything_until_they_save(self, project):
        resp = _api(_user(project)).get(PREFERENCES)

        assert resp.status_code == 200, resp.content
        assert resp.json() == {"muted_kinds": [], "mutable_kinds": MUTABLE}

    def test_a_save_replaces_the_list_in_the_kinds_order_and_keeps_a_repeat_once(self, project):
        api = _api(_user(project))

        resp = api.put(
            PREFERENCES,
            {"muted_kinds": ["review_comment", "task_status", "review_comment"]},
            format="json",
        )
        again = api.put(PREFERENCES, {"muted_kinds": ["note_reply"]}, format="json")

        assert resp.status_code == 200, resp.content
        assert resp.json()["muted_kinds"] == ["task_status", "review_comment"]
        assert again.json() == {"muted_kinds": ["note_reply"], "mutable_kinds": MUTABLE}
        assert api.get(PREFERENCES).json()["muted_kinds"] == ["note_reply"]

    @pytest.mark.parametrize(
        ("kind", "message"),
        [
            ("note_mention", "note_mention cannot be muted."),
            ("review_invited", "review_invited cannot be muted."),
            ("not_a_kind", "Unknown kind: not_a_kind."),
        ],
    )
    def test_a_kind_that_cannot_be_muted_or_is_unknown_is_400(self, project, kind, message):
        api = _api(_user(project))

        resp = api.put(PREFERENCES, {"muted_kinds": ["task_status", kind]}, format="json")

        assert resp.status_code == 400, resp.content
        assert resp.json()["muted_kinds"] == [message]
        assert not NotificationPreference.objects.exists()

    def test_each_person_reads_and_writes_only_their_own(self, project):
        first, second = _user(project), _user(project)
        _api(first).put(PREFERENCES, {"muted_kinds": ["review_comment"]}, format="json")

        assert _api(second).get(PREFERENCES).json()["muted_kinds"] == []

    def test_signed_out_is_401(self):
        assert APIClient().get(PREFERENCES).status_code == 401

    def test_a_muted_kind_is_not_written_for_that_person_and_still_is_for_others(self, scene, run):
        _api(scene["artist"]).put(PREFERENCES, {"muted_kinds": ["review_decision"]}, format="json")

        run(_api(scene["supervisor"]).post, _url(scene["review"], "approve/"), {}, format="json")

        assert _rows(scene["artist"]) == []
        assert _kinds(scene["other_artist"]) == ["review_decision"]

    def test_unmuting_brings_back_nothing_and_the_next_event_is_told(self, scene, run):
        api = _api(scene["artist"])
        api.put(PREFERENCES, {"muted_kinds": ["review_comment"]}, format="json")
        _comment(run, scene["lead"], scene["review"], version_id=str(scene["version"].id))

        api.put(PREFERENCES, {"muted_kinds": []}, format="json")
        assert _rows(scene["artist"]) == []
        _comment(run, scene["lead"], scene["review"], version_id=str(scene["version"].id))

        assert _kinds(scene["artist"]) == ["review_comment"]

    def test_a_mention_still_arrives_when_the_other_note_kinds_are_muted(self, project, run):
        writer = _user(project, ("project.view", "note.create"))
        mentioned = _user(project, ("project.view", "note.create"))
        _api(mentioned).put(
            PREFERENCES, {"muted_kinds": ["note_created", "note_reply"]}, format="json"
        )

        resp = run(
            _api(writer).post,
            f"/api/organizations/projects/{project.id}/notes/",
            {"subject": "Look at 1012", "mention_ids": [str(mentioned.id)]},
            format="json",
        )

        assert resp.status_code == 201, resp.content
        assert _kinds(mentioned) == ["note_mention"]
