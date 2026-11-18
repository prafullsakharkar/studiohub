"""
Review pipeline RP-19: a copy ready to review (docs/review-pipeline PLAN WP 19.1 and 19.2; CONTRACTS
C-RP-50 and C-RP-51; Q-RP-87 to Q-RP-91 = A).

When a review copy becomes ready, the reviewer of the version's task is told with
``review_media_to_review``, and the version's artist with ``review_media_ready`` when someone else made
the copy. Failures go to whoever made the copy and the artist, never to the reviewer. A remake that
becomes ready tells nobody, and an approved or archived version tells no reviewer. The event is
handled as the worker publishes it, after commit.
"""

from __future__ import annotations

import pytest
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.tests.test_rp6_notifications import MEMBER, _api, _kinds, _user
from apps.production.models import ReviewMedia
from apps.production.services import review_media as service_module
from apps.production.tests.factories import ProjectFactory, ShotFactory, TaskFactory, VersionFactory

pytestmark = pytest.mark.django_db

PREFERENCES = "/api/v1/notifications/preferences/"


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPNINETEEN")


@pytest.fixture
def people(project):
    return {
        "artist": _user(project),
        "reviewer": _user(project, role="Supervisor"),
        "coordinator": _user(project, role="Coordinator"),
    }


@pytest.fixture
def version(project, people):
    shot = ShotFactory.create(project=project, code="RPNINETEEN_SH010")
    task = TaskFactory.create(
        project=project,
        shot=shot,
        code="RPNINETEEN_T1",
        status="In Progress",
        assignee=people["artist"],
        reviewer=people["reviewer"],
    )
    return VersionFactory.create(
        project=project,
        shot=shot,
        task=task,
        artist=people["artist"],
        code="RPNINETEEN_SH010_V003",
        status="Pending Review",
    )


def _row(version, creator, *, remake_of=None, **extra):
    return ReviewMedia.objects.create(
        project=version.project,
        version=version,
        kind=ReviewMedia.Kind.MOVIE,
        status=ReviewMedia.Status.PROCESSING,
        source_name="clip.mov",
        queued_at=timezone.now(),
        started_at=timezone.now(),
        created_by=creator,
        remake_of=remake_of,
        **extra,
    )


def _finish(capture, row, status=ReviewMedia.Status.READY):
    """The worker's end of a job: the row moves, then the event, after commit."""
    with capture(execute=True):
        if status == ReviewMedia.Status.READY:  # as the worker does: one ready copy per version
            ReviewMedia.objects.filter(version=row.version, status=status).exclude(
                pk=row.pk
            ).update(status=ReviewMedia.Status.SUPERSEDED)
        row.status = status
        if status == ReviewMedia.Status.FAILED:
            row.error_code = ReviewMedia.ErrorCode.TRANSCODE_FAILED
        row.save(update_fields=["status", "error_code"])
        service_module._publish_finished(row)


@pytest.fixture
def finish(django_capture_on_commit_callbacks):
    return lambda row, status=ReviewMedia.Status.READY: _finish(
        django_capture_on_commit_callbacks, row, status
    )


# ---------------------------------------------------------------------------------------------- WP 19.2


class TestReadyCopies:
    def test_a_coordinators_copy_tells_the_coordinator_the_artist_and_the_reviewer(
        self, people, version, finish
    ):
        finish(_row(version, people["coordinator"]))

        assert _kinds(people["coordinator"]) == ["review_media_ready"]
        assert _kinds(people["artist"]) == ["review_media_ready"]
        assert _kinds(people["reviewer"]) == ["review_media_to_review"]
        to_review = Notification.objects.get(recipient=people["reviewer"])
        assert (to_review.target_type, to_review.target_id, to_review.data, to_review.actor) == (
            "version",
            version.id,
            {},
            None,
        )
        assert to_review.project_id == version.project_id  # pyright: ignore[reportAttributeAccessIssue]

    def test_the_artists_own_upload_tells_the_artist_once_and_the_reviewer(
        self, people, version, finish
    ):
        finish(_row(version, people["artist"]))

        assert _kinds(people["artist"]) == ["review_media_ready"]
        assert _kinds(people["reviewer"]) == ["review_media_to_review"]
        assert Notification.objects.count() == 2

    def test_a_reviewer_who_made_the_copy_is_told_it_is_ready_once(self, people, version, finish):
        finish(_row(version, people["reviewer"]))

        assert _kinds(people["reviewer"]) == ["review_media_ready"]
        assert _kinds(people["artist"]) == ["review_media_ready"]

    def test_a_copy_read_by_path_from_a_farm_account(self, project, people, version, finish):
        farm = _user(project)  # RP-18: a render farm's token belongs to this account
        finish(
            _row(
                version,
                farm,
                storage_root="STUDIO",
                storage_path="shows/x/renders/clip.mov",
            )
        )

        assert [_kinds(p) for p in (farm, people["artist"], people["reviewer"])] == [
            ["review_media_ready"],
            ["review_media_ready"],
            ["review_media_to_review"],
        ]

    def test_the_reviewer_is_read_when_the_copy_is_ready(self, project, people, version, finish):
        row = _row(version, people["artist"])
        newer = _user(project)
        version.task.reviewer = newer
        version.task.save(update_fields=["reviewer"])

        finish(row)

        assert _kinds(newer) == ["review_media_to_review"]
        assert _kinds(people["reviewer"]) == []

    @pytest.mark.parametrize("status", ["Approved", "Archived"])
    def test_a_settled_version_tells_no_reviewer(self, people, version, finish, status):
        version.status = status
        version.save(update_fields=["status"])

        finish(_row(version, people["coordinator"]))

        assert _kinds(people["reviewer"]) == []
        assert _kinds(people["artist"]) == ["review_media_ready"]

    @pytest.mark.parametrize("status", ["In Progress", "Retake", "Not Started"])
    def test_a_version_still_in_work_tells_the_reviewer(self, people, version, finish, status):
        version.status = status
        version.save(update_fields=["status"])

        finish(_row(version, people["artist"]))

        assert _kinds(people["reviewer"]) == ["review_media_to_review"]

    def test_no_task_or_no_reviewer_tells_no_reviewer(self, project, people, version, finish):
        version.task.reviewer = None
        version.task.save(update_fields=["reviewer"])
        finish(_row(version, people["coordinator"]))
        assert Notification.objects.filter(kind="review_media_to_review").count() == 0

        loose = VersionFactory.create(
            project=project,
            shot=version.shot,
            task=None,
            artist=people["artist"],
            code="RPNINETEEN_SH010_V004",
            status="Pending Review",
        )
        finish(_row(loose, people["coordinator"]))
        assert Notification.objects.filter(kind="review_media_to_review").count() == 0

    def test_a_deleted_task_tells_no_reviewer(self, people, version, finish):
        version.task.is_deleted = True
        version.task.save(update_fields=["is_deleted"])

        finish(_row(version, people["coordinator"]))

        assert _kinds(people["reviewer"]) == []

    def test_a_remake_that_becomes_ready_tells_nobody(self, people, version, finish):
        first = _row(version, people["artist"])
        first.status = ReviewMedia.Status.READY
        first.save(update_fields=["status"])

        finish(_row(version, people["coordinator"], remake_of=first))

        assert not Notification.objects.exists()

    def test_a_reviewer_outside_the_versions_reach_is_not_told(
        self, project, people, version, finish
    ):
        outsider = _user(None, MEMBER)  # holds the codes, but is no member of the project
        version.task.reviewer = outsider
        version.task.save(update_fields=["reviewer"])

        finish(_row(version, people["coordinator"]))

        assert _kinds(outsider) == []

    def test_an_inactive_reviewer_is_not_told(self, people, version, finish):
        people["reviewer"].is_active = False
        people["reviewer"].save(update_fields=["is_active"])

        finish(_row(version, people["coordinator"]))

        assert _kinds(people["reviewer"]) == []


class TestFailedCopies:
    def test_a_failure_tells_the_maker_and_the_artist_never_the_reviewer(
        self, people, version, finish
    ):
        finish(_row(version, people["coordinator"]), ReviewMedia.Status.FAILED)

        assert _kinds(people["coordinator"]) == ["review_media_failed"]
        assert _kinds(people["artist"]) == ["review_media_failed"]
        assert _kinds(people["reviewer"]) == []
        assert Notification.objects.get(recipient=people["artist"]).data == {
            "error_code": "transcode_failed"
        }

    def test_a_failed_remake_tells_its_maker_and_the_artist(self, people, version, finish):
        first = _row(version, people["artist"])
        first.status = ReviewMedia.Status.READY
        first.save(update_fields=["status"])

        finish(_row(version, people["coordinator"], remake_of=first), ReviewMedia.Status.FAILED)

        assert _kinds(people["coordinator"]) == ["review_media_failed"]
        assert _kinds(people["artist"]) == ["review_media_failed"]
        assert _kinds(people["reviewer"]) == []


# ---------------------------------------------------------------------------------------------- WP 19.1


class TestMuting:
    def test_the_reviewer_can_mute_the_new_kind(self, people, version, finish):
        api = _api(people["reviewer"])
        listed = api.get(PREFERENCES).json()["mutable_kinds"]
        assert "review_media_to_review" in listed

        resp = api.put(PREFERENCES, {"muted_kinds": ["review_media_to_review"]}, format="json")
        assert resp.status_code == 200, resp.content

        finish(_row(version, people["coordinator"]))

        assert _kinds(people["reviewer"]) == []
        assert _kinds(people["artist"]) == ["review_media_ready"]

    def test_the_inbox_lists_it_with_the_version(self, people, version, finish):
        finish(_row(version, people["coordinator"]))

        resp = _api(people["reviewer"]).get("/api/v1/notifications/")

        assert resp.status_code == 200, resp.content
        [row] = resp.json()["results"]
        assert row["kind"] == "review_media_to_review"
        assert row["target"]["type"] == "version" and row["target"]["code"] == version.code
        assert row["data"] == {} and row["actor"] is None
