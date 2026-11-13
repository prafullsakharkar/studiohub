"""
Review pipeline RP-6: in-app notifications (docs/review-pipeline PLAN WP 6.1 to 6.4; CONTRACTS
C-RP-23 to C-RP-25; Q-RP-32 to Q-RP-40 = A).

Rows are written after an action commits, for the people the plan's table names, never for the
actor, and only while the target is in the recipient's reach. The inbox answers a person's own rows
whose target they may open now, with labels read from the live records.
"""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from unittest import mock

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.notifications.events import handlers as handlers_module
from apps.notifications.models import Notification
from apps.notifications.services.purge import PurgeService
from apps.production.models import ProjectMembership, ProjectNoteMention, ReviewMedia
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import (
    ProjectFactory,
    ShotFactory,
    ShowFactory,
    TaskFactory,
    VersionFactory,
)
from apps.production.validators.project_note import MENTION_REFUSED

pytestmark = pytest.mark.django_db

#: what a full member reads: the project, its notes, tasks and versions
MEMBER = ("project.view", "note.create", "task.view", "version.view")
#: a lead who may also change tasks and versions
LEAD = (*MEMBER, "task.create", "task.update", "version.update", "version.publish")


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPSIX")


def _user(project, codes=MEMBER, **membership):
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


def _rows(user):
    return list(
        Notification.objects.filter(recipient=user)
        .order_by("created_at")
        .values_list("kind", "target_type", "target_id")
    )


def _kinds(user):
    return [kind for kind, _, _ in _rows(user)]


def _notes(project):
    return f"/api/organizations/projects/{project.id}/notes/"


@pytest.fixture
def run(django_capture_on_commit_callbacks):
    """Make a request (or call) and run what it left for after commit, as a real commit would."""

    def call(fn, *args, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return fn(*args, **kwargs)

    return call


def _thread(run, api, project, **body):
    body.setdefault("subject", "Edge is soft")
    resp = run(api.post, _notes(project), body, format="json")
    assert resp.status_code == 201, resp.content
    return resp.json()


def _reply(run, api, project, thread_id, **body):
    body.setdefault("body", "Fixed in v002")
    resp = run(api.post, f"{_notes(project)}{thread_id}/replies/", body, format="json")
    assert resp.status_code == 201, resp.content
    return resp.json()


@pytest.fixture
def work(project):
    """A shot, a task given to an artist, and the artist's version of it."""
    artist = _user(project)
    shot = ShotFactory.create(project=project, code="RPSIX_SH010")
    task = TaskFactory.create(
        project=project, shot=shot, code="RPSIX_T1", status="In Progress", assignee=artist
    )
    version = VersionFactory.create(
        project=project,
        shot=shot,
        task=task,
        artist=artist,
        code="RPSIX_SH010_V001",
        status="Pending Review",
    )
    return {"artist": artist, "shot": shot, "task": task, "version": version}


def _note(project, run, work, author=None, **body):
    author = author or _user(project)
    note = _thread(
        run,
        _api(author),
        project,
        task_id=str(work["task"].id),
        links=[{"entity_type": "Version", "entity_id": str(work["version"].id)}],
        **body,
    )
    return author, note


# ---------------------------------------------------------------------------------------------- C-RP-24


class TestNotes:
    def test_a_new_thread_tells_its_tasks_assignee_and_the_linked_versions_artist_once(
        self, project, run, work
    ):
        # The artist is both the task's assignee and the version's artist: one row.
        author, note = _note(project, run, work)

        assert _rows(work["artist"]) == [("note_created", "note", uuid.UUID(note["id"]))]
        assert _rows(author) == []

    def test_a_new_thread_tells_a_linked_versions_artist_who_is_not_the_assignee(
        self, project, run, work
    ):
        other = _user(project)
        work["version"].artist = other
        work["version"].save(update_fields=["artist"])

        _, note = _note(project, run, work)

        for person in (work["artist"], other):
            assert _rows(person) == [("note_created", "note", uuid.UUID(note["id"]))], person

    def test_the_author_is_never_told_about_their_own_note(self, project, run, work):
        _note(project, run, work, author=work["artist"])

        assert _rows(work["artist"]) == []

    def test_a_reply_tells_the_author_the_earlier_repliers_and_the_assignee(
        self, project, run, work
    ):
        author, note = _note(project, run, work)
        earlier = _user(project)
        _reply(run, _api(earlier), project, note["id"])
        Notification.objects.all().delete()
        replier = _user(project)

        _reply(run, _api(replier), project, note["id"])

        for person in (author, earlier, work["artist"]):
            assert _kinds(person) == ["note_reply"], person
        assert _rows(replier) == []

    def test_a_status_change_tells_the_author_and_the_assignee_with_the_statuses(
        self, project, run, work
    ):
        author, note = _note(project, run, work)
        Notification.objects.all().delete()
        supervisor = _user(project, (*MEMBER, "note.update"))

        resp = run(
            _api(supervisor).post,
            f"{_notes(project)}{note['id']}/status/",
            {"status": "Addressed"},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        for person in (author, work["artist"]):
            [row] = Notification.objects.filter(recipient=person)
            assert (row.kind, row.data) == (
                "note_status",
                {"from_status": "Open", "to_status": "Addressed"},
            )
        assert _rows(supervisor) == []

    def test_the_assignee_who_closes_the_note_is_not_told(self, project, run, work):
        author, note = _note(project, run, work)
        Notification.objects.all().delete()

        run(
            _api(work["artist"]).post,
            f"{_notes(project)}{note['id']}/status/",
            {"status": "Closed"},
            format="json",
        )

        assert _kinds(author) == ["note_status"]
        assert _rows(work["artist"]) == []

    def test_a_member_bound_to_another_show_hears_nothing_of_a_note(self, project, run):
        show = ShowFactory.create(project=project)
        narrowed = _user(project, show=show)
        shot = ShotFactory.create(project=project, code="RPSIX_SH020")
        task = TaskFactory.create(project=project, shot=shot, code="RPSIX_T2", assignee=narrowed)

        _thread(run, _api(_user(project)), project, task_id=str(task.id))

        assert _rows(narrowed) == []

    def test_an_author_later_bound_to_a_department_hears_nothing_of_their_own_thread(
        self, project, run, work
    ):
        # Narrowed members see only their own notes in the scoping, but every notes route asks
        # for whole-project access (C-RP-10), so the inbox does too.
        author, note = _note(project, run, work)
        ProjectMembership.objects.filter(user=author, project=project).update(department="Comp")

        _reply(run, _api(work["artist"]), project, note["id"])

        assert _rows(author) == []


class TestMentions:
    """C-RP-25."""

    def test_the_mentioned_are_told_and_a_mention_wins_over_the_other_kinds(
        self, project, run, work
    ):
        lead = _user(project)

        _author, note = _note(
            project, run, work, mention_ids=[str(lead.id), str(work["artist"].id)]
        )

        assert _kinds(lead) == ["note_mention"]
        assert _kinds(work["artist"]) == ["note_mention"]
        assert [m["id"] for m in note["mentions"]] == [str(lead.id), str(work["artist"].id)]
        assert all(m["name"] for m in note["mentions"])

    def test_a_repeated_mention_is_kept_once(self, project, run):
        lead = _user(project)

        note = _thread(run, _api(_user(project)), project, mention_ids=[str(lead.id)] * 3)

        assert [m["id"] for m in note["mentions"]] == [str(lead.id)]
        assert _kinds(lead) == ["note_mention"]

    def test_a_reply_can_mention(self, project, run):
        author = _user(project)
        note = _thread(run, _api(author), project)
        lead = _user(project)

        reply = _reply(run, _api(_user(project)), project, note["id"], mention_ids=[str(lead.id)])

        assert _kinds(lead) == ["note_mention"]
        assert _kinds(author) == ["note_reply"]
        assert [m["id"] for m in reply["mentions"]] == [str(lead.id)]

    def test_an_edit_tells_only_the_people_it_adds(self, project, run):
        author = _user(project)
        first, second = _user(project), _user(project)
        note = _thread(run, _api(author), project, mention_ids=[str(first.id)])

        resp = run(
            _api(author).patch,
            f"{_notes(project)}{note['id']}/",
            {"mention_ids": [str(first.id), str(second.id)]},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        assert _kinds(first) == ["note_mention"]
        assert _kinds(second) == ["note_mention"]
        assert [m["id"] for m in resp.json()["mentions"]] == [str(first.id), str(second.id)]

    def test_an_edit_can_drop_mentions_without_telling_anyone(self, project, run):
        author, first = _user(project), _user(project)
        note = _thread(run, _api(author), project, mention_ids=[str(first.id)])

        resp = run(
            _api(author).patch,
            f"{_notes(project)}{note['id']}/",
            {"mention_ids": []},
            format="json",
        )

        assert resp.json()["mentions"] == []
        assert _kinds(first) == ["note_mention"]
        assert not ProjectNoteMention.objects.filter(note_id=note["id"]).exists()

    def test_a_reply_edit_takes_its_body_and_mentions(self, project, run):
        author = _user(project)
        note = _thread(run, _api(author), project)
        reply = _reply(run, _api(author), project, note["id"])
        lead = _user(project)

        resp = run(
            _api(author).patch,
            f"{_notes(project)}{reply['id']}/",
            {"body": "Better", "mention_ids": [str(lead.id)]},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        assert _kinds(lead) == ["note_mention"]

    @pytest.mark.parametrize(
        "who", ["outsider", "inactive_member", "show_bound", "no_view_code", "unknown", "malformed"]
    )
    def test_someone_who_cannot_read_the_thread_cannot_be_mentioned(self, project, run, who):
        people = {
            "outsider": lambda: str(_user(None).id),
            "inactive_member": lambda: str(_user(project, status="inactive").id),
            "show_bound": lambda: str(_user(project, show=ShowFactory.create(project=project)).id),
            "no_view_code": lambda: str(_user(project, ("task.view",)).id),
            "unknown": lambda: str(uuid.uuid4()),
            "malformed": lambda: "not-an-id",
        }

        resp = run(
            _api(_user(project)).post,
            _notes(project),
            {"subject": "S", "mention_ids": [people[who]()]},
            format="json",
        )

        assert resp.status_code == 400
        assert resp.json()["mention_ids"] == [MENTION_REFUSED]
        assert not Notification.objects.exists()

    def test_an_inactive_account_cannot_be_mentioned(self, project, run):
        user = _user(project)
        user.is_active = False
        user.save(update_fields=["is_active"])

        resp = run(
            _api(_user(project)).post,
            _notes(project),
            {"subject": "S", "mention_ids": [str(user.id)]},
            format="json",
        )

        assert resp.status_code == 400

    def test_more_than_twenty_is_refused(self, project, run):
        people = [str(_user(project).id) for _ in range(21)]

        resp = run(
            _api(_user(project)).post,
            _notes(project),
            {"subject": "S", "mention_ids": people},
            format="json",
        )

        assert resp.status_code == 400
        assert resp.json()["mention_ids"] == [MENTION_REFUSED]

    def test_the_list_carries_mentions_in_a_bounded_number_of_queries(self, project, run):
        api = _api(_user(project))
        for _ in range(2):
            _thread(run, api, project, mention_ids=[str(_user(project).id)])
        with CaptureQueriesContext(connection) as two:
            api.get(_notes(project))
        for _ in range(3):
            _thread(run, api, project, mention_ids=[str(_user(project).id)])

        with CaptureQueriesContext(connection) as five:
            body = api.get(_notes(project)).json()

        assert all(len(row["mentions"]) == 1 for row in body["results"])
        assert len(five.captured_queries) == len(two.captured_queries)


class TestTasks:
    def test_assigning_through_patch_tells_the_new_assignee(self, project, run, work):
        lead = _user(project, LEAD)
        newcomer = _user(project)

        resp = run(
            _api(lead).patch,
            f"/api/v1/tasks/{work['task'].id}/",
            {"assignee": str(newcomer.id)},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        assert _rows(newcomer) == [("task_assigned", "task", work["task"].id)]
        assert _rows(work["artist"]) == []

    def test_creating_a_task_with_an_assignee_tells_them(self, project, run):
        lead, artist = _user(project, LEAD), _user(project)

        resp = run(
            _api(lead).post,
            "/api/v1/tasks/",
            {
                "project_id": str(project.id),
                "title": "Roto",
                "code": "RPSIX_T9",
                "assignee": str(artist.id),
            },
            format="json",
        )

        assert resp.status_code == 201, resp.content
        assert _kinds(artist) == ["task_assigned"]

    def test_bulk_assign_tells_the_assignee_once_per_task(self, project, run, work):
        other = TaskFactory.create(project=project, code="RPSIX_T3")
        newcomer = _user(project)

        resp = run(
            _api(_user(project, LEAD)).post,
            "/api/v1/tasks/bulk-assign/",
            {"task_ids": [str(work["task"].id), str(other.id)], "assignee_id": str(newcomer.id)},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        assert sorted(target for _, _, target in _rows(newcomer)) == sorted(
            [work["task"].id, other.id]
        )

    def test_bulk_create_and_bulk_update_tell_the_assignee(self, project, run):
        lead, first, second = _user(project, LEAD), _user(project), _user(project)
        api = _api(lead)

        created = run(
            api.post,
            "/api/v1/tasks/bulk-create/",
            {
                "items": [
                    {
                        "project_id": str(project.id),
                        "title": "Paint",
                        "code": "RPSIX_B1",
                        "assignee": str(first.id),
                    }
                ]
            },
            format="json",
        )
        assert created.status_code in (200, 201), created.content
        task_id = created.json()["results"][0]["id"]
        updated = run(
            api.post,
            "/api/v1/tasks/bulk-update/",
            {"items": [{"id": task_id, "assignee": str(second.id)}]},
            format="json",
        )

        assert updated.status_code in (200, 207), updated.content
        assert _kinds(first) == ["task_assigned"]
        assert _kinds(second) == ["task_assigned"]

    def test_no_row_when_the_assignee_does_not_change_or_assigns_themselves(
        self, project, run, work
    ):
        lead = _user(project, LEAD)

        run(
            _api(lead).patch,
            f"/api/v1/tasks/{work['task'].id}/",
            {"assignee": str(work["artist"].id), "title": "Renamed"},
            format="json",
        )
        run(
            _api(lead).patch,
            f"/api/v1/tasks/{work['task'].id}/",
            {"assignee": str(lead.id)},
            format="json",
        )

        assert not Notification.objects.exists()

    def test_a_status_change_tells_the_assignee(self, project, run, work):
        resp = run(
            _api(_user(project, LEAD)).patch,
            f"/api/v1/tasks/{work['task'].id}/",
            {"status": "Pending Review"},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        [row] = Notification.objects.filter(recipient=work["artist"])
        assert (row.kind, row.target_id, row.data) == (
            "task_status",
            work["task"].id,
            {"from_status": "In Progress", "to_status": "Pending Review"},
        )

    def test_the_roll_up_tells_the_assignee_that_the_task_was_approved(self, project, run, work):
        project.approve_task_on_version_approval = True
        project.save(update_fields=["approve_task_on_version_approval"])

        resp = run(
            _api(_user(project, LEAD)).patch,
            f"/api/v1/versions/{work['version'].id}/",
            {"status": "Approved"},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        rows = {
            (kind, data["to_status"])
            for kind, data in Notification.objects.filter(recipient=work["artist"]).values_list(
                "kind", "data"
            )
        }
        assert rows == {("version_status", "Approved"), ("task_status", "Approved")}


class TestVersions:
    def test_a_status_change_tells_the_artist_and_the_tasks_assignee(self, project, run, work):
        assignee = _user(project)
        work["task"].assignee = assignee
        work["task"].save(update_fields=["assignee"])

        resp = run(
            _api(_user(project, LEAD)).patch,
            f"/api/v1/versions/{work['version'].id}/",
            {"status": "Retake"},
            format="json",
        )

        assert resp.status_code == 200, resp.content
        for person in (work["artist"], assignee):
            assert _rows(person) == [("version_status", "version", work["version"].id)]

    def test_an_artist_without_version_view_hears_nothing(self, project, run, work):
        blind = _user(project, ("project.view", "task.view"))
        work["version"].artist = blind
        work["version"].save(update_fields=["artist"])

        run(
            _api(_user(project, LEAD)).patch,
            f"/api/v1/versions/{work['version'].id}/",
            {"status": "Retake"},
            format="json",
        )

        assert _rows(blind) == []


class TestReviewMedia:
    @pytest.fixture
    def row(self, project, work):
        return ReviewMedia.objects.create(
            project=project,
            version=work["version"],
            kind=ReviewMedia.Kind.MOVIE,
            status=ReviewMedia.Status.PROCESSING,
            source_name="clip.mov",
            queued_at=timezone.now(),
            started_at=timezone.now(),
            created_by=work["artist"],
        )

    def test_a_failure_tells_the_uploader_with_its_code(self, run, row, work):
        run(ReviewMediaService._fail, row, ReviewMedia.ErrorCode.TRANSCODE_FAILED)

        [notification] = Notification.objects.filter(recipient=work["artist"])
        assert (notification.kind, notification.target_id, notification.data) == (
            "review_media_failed",
            work["version"].id,
            {"error_code": "transcode_failed"},
        )
        assert notification.actor is None

    def test_the_sweep_tells_the_uploader_of_a_timeout(self, run, row, work):
        ReviewMedia.objects.filter(pk=row.pk).update(started_at=timezone.now() - timedelta(hours=1))

        assert run(ReviewMediaService.sweep) == 1

        [notification] = Notification.objects.filter(recipient=work["artist"])
        assert (notification.kind, notification.data) == (
            "review_media_failed",
            {"error_code": "timeout"},
        )

    def test_a_ready_movie_tells_the_uploader(self, run, row, work, settings, tmp_path):
        from apps.production.transcode import ffmpeg as commands

        settings.MEDIA_ROOT = tmp_path
        (tmp_path / row.directory).mkdir(parents=True)
        probe = commands.parse_probe(
            json.dumps(
                {
                    "streams": [
                        {
                            "codec_type": "video",
                            "codec_name": "h264",
                            "width": 1920,
                            "height": 1080,
                            "avg_frame_rate": "24/1",
                            "r_frame_rate": "24/1",
                            "duration": "1",
                            "nb_read_packets": "24",
                        }
                    ],
                    "format": {"duration": "1"},
                }
            ),
            kind="movie",
        )

        run(
            ReviewMediaService._finish,
            row,
            probe,
            {"proxy": "proxy.mp4", "thumbnail": "thumbnail.jpg", "filmstrip": "filmstrip.jpg"},
        )

        assert _kinds(work["artist"]) == ["review_media_ready"]


class TestFanoutNeverFailsTheAction:
    def test_an_error_while_writing_rows_is_logged_and_the_note_is_saved(
        self, project, run, work, caplog
    ):
        with (
            mock.patch.object(
                handlers_module.FanoutService, "notify", side_effect=RuntimeError("boom")
            ),
            mock.patch.object(handlers_module.logger, "exception") as logged,
        ):
            author, note = _note(project, run, work)

        assert note["id"]
        assert not Notification.objects.exists()
        logged.assert_called_once_with("notification_fanout_failed", event="NoteCreated")


# ---------------------------------------------------------------------------------------------- C-RP-23


def _inbox(api, **params):
    resp = api.get("/api/v1/notifications/", params)
    assert resp.status_code == 200, resp.content
    return resp.json()


def _count(api):
    resp = api.get("/api/v1/notifications/unread-count/")
    assert resp.status_code == 200, resp.content
    return resp.json()["count"]


class TestInbox:
    def test_a_row_reads_its_labels_from_the_live_records(self, project, run, work):
        author, note = _note(project, run, work, subject="Edge is soft")
        api = _api(work["artist"])

        [row] = _inbox(api)["results"]

        assert row["kind"] == "note_created"
        assert row["read_at"] is None
        assert row["actor"]["id"] == str(author.id) and row["actor"]["name"]
        assert row["project"] == {"id": str(project.id), "code": "RPSIX", "name": project.name}
        assert row["target"] == {
            "type": "note",
            "id": note["id"],
            "code": "",
            "name": "Edge is soft",
        }
        assert row["record"] == {
            "type": "Version",
            "id": str(work["version"].id),
            "code": work["version"].code,
        }
        assert row["data"] == {}

        run(
            _api(author).patch,
            f"{_notes(project)}{note['id']}/",
            {"subject": "Edge is fixed"},
            format="json",
        )

        assert _inbox(api)["results"][0]["target"]["name"] == "Edge is fixed"

    def test_task_and_version_rows_name_their_record(self, project, run, work):
        run(
            _api(_user(project, LEAD)).patch,
            f"/api/v1/versions/{work['version'].id}/",
            {"status": "Retake"},
            format="json",
        )

        [row] = _inbox(_api(work["artist"]))["results"]

        assert row["target"] == {
            "type": "version",
            "id": str(work["version"].id),
            "code": work["version"].code,
            "name": work["version"].version_number,
        }
        assert row["record"]["id"] == str(work["shot"].id)
        assert row["data"] == {"from_status": "Pending Review", "to_status": "Retake"}

    def test_only_ones_own_rows_and_another_persons_id_is_404(self, project, run, work):
        _note(project, run, work)
        [mine] = Notification.objects.filter(recipient=work["artist"])
        stranger = _api(_user(project))

        assert _inbox(stranger)["results"] == []
        assert _count(stranger) == 0
        for action in ("read", "unread"):
            assert stranger.post(f"/api/v1/notifications/{mine.pk}/{action}/").status_code == 404
        mine.refresh_from_db()
        assert mine.read_at is None

    def test_read_and_unread_and_the_count(self, project, run, work):
        _note(project, run, work)
        [mine] = Notification.objects.filter(recipient=work["artist"])
        api = _api(work["artist"])
        assert _count(api) == 1

        read = api.post(f"/api/v1/notifications/{mine.pk}/read/").json()
        first_read = read["read_at"]
        again = api.post(f"/api/v1/notifications/{mine.pk}/read/").json()

        assert first_read and again["read_at"] == first_read
        assert _count(api) == 0
        assert api.post(f"/api/v1/notifications/{mine.pk}/unread/").json()["read_at"] is None
        assert _count(api) == 1

    def test_read_all_leaves_a_row_that_came_after_before_unread(self, project, run, work):
        _note(project, run, work)
        cutoff = timezone.now()
        _note(project, run, work)
        newest = Notification.objects.filter(recipient=work["artist"]).order_by("-created_at")[0]
        Notification.objects.filter(pk=newest.pk).update(created_at=cutoff + timedelta(seconds=5))
        api = _api(work["artist"])

        resp = api.post(
            "/api/v1/notifications/read-all/", {"before": cutoff.isoformat()}, format="json"
        )

        assert resp.json() == {"updated": 1}
        assert [row["id"] for row in _inbox(api, unread="true")["results"]] == [str(newest.pk)]
        # Without ``before`` the cutoff is now: the row dated after now stays unread.
        assert api.post("/api/v1/notifications/read-all/", {}, format="json").json() == {
            "updated": 0
        }
        later = (cutoff + timedelta(seconds=10)).isoformat()
        assert api.post(
            "/api/v1/notifications/read-all/", {"before": later}, format="json"
        ).json() == {"updated": 1}
        assert _count(api) == 0

    def test_filters_and_unknown_values(self, project, run, work):
        _note(project, run, work)
        run(
            _api(_user(project, LEAD)).patch,
            f"/api/v1/versions/{work['version'].id}/",
            {"status": "Retake"},
            format="json",
        )
        api = _api(work["artist"])

        assert {r["kind"] for r in _inbox(api, kind="version_status")["results"]} == {
            "version_status"
        }
        assert len(_inbox(api, project_id=str(project.id))["results"]) == 2
        assert len(_inbox(api, unread="false")["results"]) == 0
        for bad in ({"kind": "nope"}, {"project_id": "nope"}, {"unread": "maybe"}):
            assert _inbox(api, **bad)["results"] == []
        assert _inbox(api, project_id=str(uuid.uuid4()))["results"] == []

    def test_a_deleted_target_drops_out_of_the_list_and_the_count(self, project, run, work):
        run(
            _api(_user(project, LEAD)).patch,
            f"/api/v1/tasks/{work['task'].id}/",
            {"status": "Pending Review"},
            format="json",
        )
        api = _api(work["artist"])
        assert _count(api) == 1

        work["task"].delete()

        assert _inbox(api)["results"] == [] and _count(api) == 0

    @pytest.mark.parametrize(
        "change", ["left_the_project", "bound_to_a_show", "bound_to_a_department", "lost_the_code"]
    )
    def test_losing_reach_hides_old_rows_at_once(self, project, run, work, change):
        _note(project, run, work)
        api = _api(work["artist"])
        assert _count(api) == 1

        membership = ProjectMembership.objects.get(user=work["artist"], project=project)
        if change == "left_the_project":
            membership.status = "inactive"
            membership.save(update_fields=["status"])
        elif change == "bound_to_a_show":
            membership.show = ShowFactory.create(project=project)
            membership.save(update_fields=["show"])
        elif change == "bound_to_a_department":
            # notes need whole-project access (C-RP-10); tasks and versions stay readable
            membership.department = "Comp"
            membership.save(update_fields=["department"])
        else:
            from apps.identity.models import UserRole
            from apps.identity.services.permission_cache import PermissionCacheService

            UserRole.objects.filter(user=work["artist"]).delete()
            PermissionCacheService.invalidate(user=work["artist"])

        assert _inbox(api)["results"] == [] and _count(api) == 0
        [row] = Notification.objects.filter(recipient=work["artist"])
        assert api.post(f"/api/v1/notifications/{row.pk}/read/").status_code == 404

    def test_the_list_takes_a_bounded_number_of_queries(self, project, run, work):
        api = _api(work["artist"])
        lead = _api(_user(project, LEAD))
        _note(project, run, work)
        run(
            lead.patch,
            f"/api/v1/versions/{work['version'].id}/",
            {"status": "Retake"},
            format="json",
        )
        with CaptureQueriesContext(connection) as few:
            _inbox(api)
        for code in ("T4", "T5", "T6"):
            task = TaskFactory.create(project=project, code=f"RPSIX_{code}")
            run(
                lead.patch,
                f"/api/v1/tasks/{task.id}/",
                {"assignee": str(work["artist"].id)},
                format="json",
            )
            _note(project, run, work)

        with CaptureQueriesContext(connection) as many:
            body = _inbox(api)

        assert len(body["results"]) == 8
        assert len(many.captured_queries) <= len(few.captured_queries) + 1

    def test_signed_out_is_401(self):
        assert APIClient().get("/api/v1/notifications/").status_code == 401


class TestRetention:
    def test_the_purge_deletes_rows_older_than_the_retention_only(
        self, project, run, work, settings
    ):
        settings.NOTIFICATIONS_RETENTION_DAYS = 30
        _note(project, run, work)
        _note(project, run, work)
        old, recent = Notification.objects.order_by("created_at")
        Notification.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=31)
        )
        Notification.objects.filter(pk=recent.pk).update(
            created_at=timezone.now() - timedelta(days=29)
        )

        assert PurgeService.purge() == 1

        assert list(Notification.objects.values_list("pk", flat=True)) == [recent.pk]
