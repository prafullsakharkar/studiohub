"""
Review pipeline RP-13: notifications beyond reviews (docs/review-pipeline PLAN WP 13.1 to 13.3;
CONTRACTS C-RP-34 to C-RP-36; Q-RP-57 to Q-RP-62 = A).

A delivery reaching a step someone waits for (or leaving one), the client's answer, a publish job
ending, a revoked file and a milestone (completed by someone else, due, overdue) are told to the
people the plan's table names, never to the actor, only while the record is in their reach (what its
own ``GET`` answers), and never in a kind they muted.
"""

# Django adds <fk>_id attributes at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import datetime as dt
from unittest import mock

import pytest
from django.conf import settings
from django.db import transaction
from rest_framework.test import APIClient

from apps.deliveries.events import DeliveryStatusChanged
from apps.deliveries.models import DeliveryPackage
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import published_version
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.notifications import sources
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.services.reminders import ReminderService
from apps.production.models import ProjectMembership
from apps.production.selectors.notification_sources import as_request
from apps.production.tests.factories import ProjectFactory, TaskFactory, VersionFactory
from apps.publishing.events import PublishJobFinished
from apps.publishing.models import PublishedFile, PublishItem
from apps.publishing.services.files import PublishedFileService
from apps.publishing.services.workflow import JobService
from apps.scheduling.events import MilestoneCompleted
from apps.scheduling.models import Milestone, WorkCalendar
from apps.scheduling.services.milestone import MilestoneService

pytestmark = pytest.mark.django_db

DELIVERY_CODES = (
    "delivery.view",
    "delivery.create",
    "delivery.update",
    "delivery.approve",
    "delivery.send",
)
PUBLISHING = ("publishing.view", "publishing.create", "publishing.update", "publishing.revoke")
SCHEDULE = ("schedule.view", "schedule.manage")
#: a producer: deliveries, publishing and the schedule
PRODUCER = (*DELIVERY_CODES, *PUBLISHING, *SCHEDULE, "project.view", "version.view")
#: an artist after CR-53: no delivery.view
ARTIST = ("project.view", "version.view", "task.view", "publishing.view", "schedule.view")

INBOX = "/api/v1/notifications/"


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTHIRTEEN")


def _user(project, codes=PRODUCER, **membership):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    if project is not None:
        membership.setdefault("status", "active")
        membership.setdefault("role", "Producer")
        ProjectMembership.objects.create(user=user, project=project, **membership)
    return user


def _api(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _rows(user):
    return list(
        Notification.objects.filter(recipient=user)
        .order_by("created_at", "id")
        .values_list("kind", "target_type", "data")
    )


def _kinds(user):
    return [kind for kind, _, _ in _rows(user)]


@pytest.fixture
def run(django_capture_on_commit_callbacks):
    """Call a service and run what it left for after commit, as a real commit would."""

    def call(fn, *args, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return fn(*args, **kwargs)

    return call


# ---------------------------------------------------------------------- deliveries


@pytest.fixture
def crew(project):
    """A producer who makes deliveries, a supervisor who signs off, a coordinator who sends."""
    return {
        "producer": _user(project),
        "supervisor": _user(project, role="Supervisor"),
        "coordinator": _user(project, role="Coordinator"),
    }


def _delivery(project, creator):
    package = DeliveryService.create(
        actor=creator, data={"name": "Turnover", "project_id": project.pk}
    )
    DeliveryService.add_version(
        actor=creator, package=package, version_id=published_version(project).pk
    )
    return DeliveryPackage.objects.get(pk=package.pk)


def _prepared(project, creator, run):
    package = _delivery(project, creator)
    package, _ = run(DeliveryService.prepare, actor=creator, package=package)
    return package


def _signed_off(project, crew, run):
    package = _prepared(project, crew["producer"], run)
    return run(DeliveryService.sign_off, actor=crew["supervisor"], package=package)


def _sent(project, crew, run):
    package = _signed_off(project, crew, run)
    return run(DeliveryService.send, actor=crew["coordinator"], package=package)


class TestDeliveryEvent:
    def test_every_move_publishes_once_after_commit_with_ids_and_statuses(self, project, crew):
        package = _delivery(project, crew["producer"])
        published = []
        with mock.patch(
            "apps.deliveries.services.transitions.default_event_bus.publish",
            side_effect=published.append,
        ):
            DeliveryService.prepare(actor=crew["producer"], package=package)

        moves = [event for event in published if isinstance(event, DeliveryStatusChanged)]
        assert len(moves) == 1
        assert moves[0].payload == {
            "delivery_id": str(package.pk),
            "project_id": str(project.pk),
            "from_status": "Draft",
            "to_status": "Prepared",
            "actor_id": str(crew["producer"].pk),
            "system": False,
            "override_kind": "",
            "client_status": "",
        }

    def test_a_rolled_back_move_tells_nobody(
        self, project, crew, run, django_capture_on_commit_callbacks
    ):
        package = _prepared(project, crew["producer"], run)

        with django_capture_on_commit_callbacks(execute=True) as callbacks:
            try:
                with transaction.atomic():
                    DeliveryService.sign_off(actor=crew["supervisor"], package=package)
                    raise RuntimeError("undo")
            except RuntimeError:
                pass

        assert callbacks == []
        assert Notification.objects.count() == 0
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Prepared"


class TestDeliveryStatus:
    def test_working_moves_tell_nobody(self, project, crew, run):
        package = _delivery(project, crew["producer"])
        # someone other than the creator makes every working move, so the actor rule hides nothing
        package, _ = run(DeliveryService.validate, actor=crew["coordinator"], package=package)
        assert package.status == "Validating"
        package, _ = run(DeliveryService.prepare, actor=crew["coordinator"], package=package)

        assert DeliveryPackage.objects.get(pk=package.pk).status == "Prepared"
        assert Notification.objects.count() == 0

    def test_a_sign_off_tells_the_creator_not_the_signer(self, project, crew, run):
        package = _signed_off(project, crew, run)

        assert _rows(crew["producer"]) == [
            ("delivery_status", "delivery", {"from_status": "Prepared", "to_status": "Signed Off"})
        ]
        assert _rows(crew["supervisor"]) == []
        row = Notification.objects.get(recipient=crew["producer"])
        assert row.target_id == package.pk and row.actor_id == crew["supervisor"].pk
        assert row.project_id == project.pk

    def test_a_send_tells_the_creator_and_the_signer(self, project, crew, run):
        _sent(project, crew, run)

        sent = (
            "delivery_status",
            "delivery",
            {"from_status": "Signed Off", "to_status": "Submitted"},
        )
        assert _rows(crew["producer"])[-1] == sent
        assert _rows(crew["supervisor"]) == [sent]
        assert _rows(crew["coordinator"]) == []

    def test_the_clients_answer_is_told_once_as_an_answer(self, project, crew, run):
        package = _sent(project, crew, run)
        before = Notification.objects.count()

        run(
            DeliveryService.record_client_answer,
            actor=crew["producer"],
            package=package,
            accepted=False,
            reason="Grain is wrong",
            notes="Please redo the grain",
        )

        answer = ("delivery_client_answer", "delivery", {"client_status": "Rejected"})
        assert _rows(crew["supervisor"])[-1] == answer
        assert _rows(crew["coordinator"]) == [answer]
        assert Notification.objects.count() == before + 2
        assert "Grain" not in str(list(Notification.objects.values_list("data", flat=True)))

    def test_completing_and_cancelling_tell_the_people(self, project, crew, run):
        package = _sent(project, crew, run)
        package = run(
            DeliveryService.record_client_answer,
            actor=crew["producer"],
            package=package,
            accepted=True,
        )
        run(DeliveryService.complete, actor=crew["producer"], package=package)
        assert _rows(crew["coordinator"])[-1] == (
            "delivery_status",
            "delivery",
            {"from_status": "Approved", "to_status": "Complete"},
        )

        other = _prepared(project, crew["producer"], run)
        run(DeliveryService.cancel, actor=crew["coordinator"], package=other, reason="Not needed")
        assert _rows(crew["producer"])[-1] == (
            "delivery_status",
            "delivery",
            {"from_status": "Prepared", "to_status": "Cancelled"},
        )

    def test_a_reopen_tells_the_creator_and_the_signer_whose_sign_off_was_cleared(
        self, project, crew, run
    ):
        package = _signed_off(project, crew, run)
        reopener = _user(project)

        run(DeliveryService.reopen, actor=reopener, package=package)

        back = (
            "delivery_status",
            "delivery",
            {"from_status": "Signed Off", "to_status": "Prepared"},
        )
        assert _rows(crew["producer"])[-1] == back
        assert _rows(crew["supervisor"]) == [back]
        assert DeliveryPackage.objects.get(pk=package.pk).signed_off_by_id is None

    def test_a_correction_out_of_a_sent_status_tells_the_people(self, project, crew, run):
        package = _sent(project, crew, run)
        fixer = _user(project, (*PRODUCER, "delivery.status.override"))

        run(
            DeliveryService.override_status,
            actor=fixer,
            package=package,
            target="Signed Off",
            override_reason="Sent by mistake",
            request=as_request(fixer),
        )

        assert _rows(crew["coordinator"])[-1] == (
            "delivery_status",
            "delivery",
            {"from_status": "Submitted", "to_status": "Signed Off"},
        )

    def test_an_artist_without_delivery_view_is_told_nothing(self, project, crew, run):
        artist = _user(project, ARTIST, role="Artist")
        package = _prepared(project, artist, run)

        run(DeliveryService.sign_off, actor=crew["supervisor"], package=package)

        assert _rows(artist) == []

    def test_a_creator_who_left_the_project_is_told_nothing(self, project, crew, run):
        package = _prepared(project, crew["producer"], run)
        ProjectMembership.objects.filter(user=crew["producer"]).update(status="inactive")

        run(DeliveryService.sign_off, actor=crew["supervisor"], package=package)

        assert _rows(crew["producer"]) == []

    def test_a_muted_kind_is_not_written(self, project, crew, run):
        NotificationPreference.objects.create(
            user=crew["producer"], muted_kinds=["delivery_status"]
        )

        _sent(project, crew, run)

        assert _rows(crew["producer"]) == []
        assert _kinds(crew["supervisor"]) == ["delivery_status"]

    def test_a_delivery_with_no_project_tells_nobody(self, project, crew):
        from apps.notifications.events.handlers import DeliveryStatusChangedHandler

        package = _delivery(project, crew["producer"])
        DeliveryPackage.objects.filter(pk=package.pk).update(project=None)

        DeliveryStatusChangedHandler().handle(
            DeliveryStatusChanged(
                delivery_id=str(package.pk),
                project_id=None,
                from_status="Prepared",
                to_status="Signed Off",
                actor_id=None,
                system=False,
                override_kind="",
                client_status="",
            )
        )

        assert Notification.objects.count() == 0


# ---------------------------------------------------------------------- publishing


def _job(project, creator, version=None, status="Pending"):
    return PublishItem.objects.create(
        name="Comp export",
        code=f"PUB_{PublishItem.objects.count() + 1:03d}",
        project=project,
        version=version,
        dcc_tool="Nuke",
        status=status,
        created_by=creator,
    )


@pytest.fixture
def job_scene(project):
    td = _user(project, role="TD")
    artist = _user(project, ARTIST, role="Artist")
    assignee = _user(project, ARTIST, role="Artist")
    task = TaskFactory.create(project=project, assignee=assignee)
    version = VersionFactory.create(project=project, artist=artist, task=task, code="SH010_V003")
    pipeline = _user(project, role="Pipeline")
    return {
        "td": td,
        "artist": artist,
        "assignee": assignee,
        "version": version,
        "pipeline": pipeline,
    }


class TestPublishFinished:
    def test_an_export_tells_the_creator_the_artist_and_the_assignee(self, project, job_scene, run):
        job = _job(project, job_scene["td"], job_scene["version"], status="Exporting")

        run(JobService.complete_export, actor=job_scene["pipeline"], job=job)

        exported = ("publish_finished", "publish_job", {"status": "Exported"})
        for who in ("td", "artist", "assignee"):
            assert _rows(job_scene[who]) == [exported], who
        assert _rows(job_scene["pipeline"]) == []

    def test_a_failed_export_and_a_failed_validation_are_told(self, project, job_scene, run):
        job = _job(project, job_scene["td"], job_scene["version"], status="Exporting")
        run(JobService.fail, actor=job_scene["pipeline"], job=job, reason="Disk full on /mnt/x")

        assert _rows(job_scene["td"]) == [("publish_finished", "publish_job", {"status": "Failed"})]
        assert "Disk" not in str(_rows(job_scene["td"]))

        other = _job(project, job_scene["td"])
        with mock.patch(
            "apps.publishing.services.workflow.validation.summarize",
            return_value={"passed": False, "counts": {}},
        ):
            run(JobService.validate, actor=job_scene["pipeline"], job=other)
        assert _kinds(job_scene["td"]) == ["publish_finished", "publish_finished"]

    def test_the_job_event_is_published_only_for_an_end(self, project, job_scene):
        job = _job(project, job_scene["td"], job_scene["version"], status="Validated")
        published = []
        with mock.patch(
            "apps.publishing.services.workflow.default_event_bus.publish",
            side_effect=published.append,
        ):
            JobService.start_export(actor=job_scene["pipeline"], job=job)
            JobService.complete_export(actor=job_scene["pipeline"], job=job)
            JobService.cancel(actor=job_scene["td"], job=_job(project, job_scene["td"]))

        assert [type(e) for e in published] == [PublishJobFinished]
        assert published[0].payload == {
            "job_id": str(job.pk),
            "project_id": str(project.pk),
            "version_id": str(job_scene["version"].pk),
            "status": "Exported",
            "actor_id": str(job_scene["pipeline"].pk),
        }

    def test_a_cancel_tells_nobody(self, project, job_scene, run):
        run(JobService.cancel, actor=job_scene["pipeline"], job=_job(project, job_scene["td"]))

        assert Notification.objects.count() == 0

    def test_a_member_without_publishing_view_is_told_nothing(self, project, job_scene, run):
        reader = _user(project, ("project.view", "version.view"), role="Artist")
        job = _job(project, reader, status="Exporting")

        run(JobService.complete_export, actor=job_scene["pipeline"], job=job)

        assert _rows(reader) == []

    def test_a_job_with_no_project_tells_nobody(self, job_scene, run):
        job = _job(None, job_scene["td"], status="Exporting")

        run(JobService.complete_export, actor=job_scene["pipeline"], job=job)

        assert Notification.objects.count() == 0


# ---------------------------------------------------------------------- revoked files


def _register(project, creator, version, path, upstream_ids=()):
    file, _ = PublishedFileService.register(
        actor=creator,
        request=as_request(creator),
        version_id=version.pk,
        data={
            "version_id": str(version.pk),
            "storage_root": "PROJECTS",
            "relative_path": path,
            "size_bytes": 1000,
            "sha256": f"{PublishedFile.objects.count() + 1:x}" * 64,
            "upstream_ids": [str(pk) for pk in upstream_ids],
        },
    )
    return file


class TestPublishedFileRevoked:
    @pytest.fixture
    def files(self, project, crew, run):
        from apps.publishing.models import StorageRoot

        StorageRoot.objects.get_or_create(code="PROJECTS", defaults={"name": "Projects"})
        registrar = _user(project, role="TD")
        builder = _user(project, role="TD")
        revoker = _user(project, role="Supervisor")
        version = VersionFactory.create(
            project=project, code="SH020_V001", status="Approved", is_published=True
        )
        plate = _register(project, registrar, version, "show/sh020/plate.exr")
        other_version = VersionFactory.create(
            project=project, code="SH020_V002", status="Approved", is_published=True
        )
        comp = _register(project, builder, other_version, "show/sh020/comp.exr", [plate.pk])
        working = DeliveryService.create(
            actor=crew["producer"], data={"name": "Working", "project_id": project.pk}
        )
        DeliveryService.add_version(actor=crew["producer"], package=working, version_id=version.pk)
        return {
            "registrar": registrar,
            "builder": builder,
            "revoker": revoker,
            "plate": plate,
            "comp": comp,
            "working": working,
        }

    def test_the_creator_the_builders_and_the_unsent_deliveries_people_are_told(
        self, project, crew, files, run
    ):
        run(
            PublishedFileService.revoke,
            actor=files["revoker"],
            request=as_request(files["revoker"]),
            file=files["plate"],
            reason="Wrong grade",
        )

        revoked = ("published_file_revoked", "published_file", {})
        for who in (files["registrar"], files["builder"], crew["producer"]):
            assert _rows(who) == [revoked]
        assert _rows(files["revoker"]) == []
        row = Notification.objects.filter(recipient=files["registrar"]).get()
        assert row.target_id == files["plate"].pk

    def test_a_signed_off_delivery_it_reopens_tells_its_people_twice_over_two_records(
        self, project, crew, files, run
    ):
        package = _signed_off(project, crew, run)
        version_id = package.versions.get().version_id
        Notification.objects.all().delete()
        file = PublishedFile.objects.get(version_id=version_id)

        run(
            PublishedFileService.revoke,
            actor=files["revoker"],
            request=as_request(files["revoker"]),
            file=file,
            reason="Wrong grade",
        )

        assert sorted(_kinds(crew["supervisor"])) == ["delivery_status", "published_file_revoked"]
        reopen = Notification.objects.get(recipient=crew["supervisor"], kind="delivery_status")
        assert reopen.actor_id is None
        assert reopen.data == {"from_status": "Signed Off", "to_status": "Prepared"}

    def test_the_people_of_a_sent_delivery_are_not_told_of_the_file(
        self, project, crew, files, run
    ):
        package = _sent(project, crew, run)
        Notification.objects.all().delete()
        file = PublishedFile.objects.get(version_id=package.versions.get().version_id)

        run(
            PublishedFileService.revoke,
            actor=files["revoker"],
            request=as_request(files["revoker"]),
            file=file,
            reason="Wrong grade",
        )

        assert _rows(crew["coordinator"]) == []
        assert _rows(crew["supervisor"]) == []


# ---------------------------------------------------------------------- milestones


def _milestone(project, creator, due, **fields):
    return MilestoneService.create(
        actor=creator,
        project=project,
        data={
            "name": fields.pop("name", f"M{Milestone.objects.count() + 1}"),
            "due_date": due,
            **fields,
        },
    )


NOW = dt.datetime(2026, 11, 16, 9, 0, tzinfo=dt.UTC)
TODAY = NOW.date()


class TestMilestoneCompleted:
    def test_completion_by_someone_else_tells_the_creator(self, project, run):
        creator, other = _user(project), _user(project)
        milestone = _milestone(project, creator, TODAY)

        run(MilestoneService.complete, actor=other, milestone=milestone)

        assert _rows(creator) == [("milestone_completed", "milestone", {})]
        assert _rows(other) == []

    def test_completion_by_the_creator_tells_nobody(self, project, run):
        creator = _user(project)
        milestone = _milestone(project, creator, TODAY)

        run(MilestoneService.complete, actor=creator, milestone=milestone)

        assert Notification.objects.count() == 0

    def test_the_event_carries_ids_only(self, project):
        creator = _user(project)
        milestone = _milestone(project, creator, TODAY, notes="Secret plan")
        published = []
        with mock.patch(
            "apps.scheduling.services.milestone.default_event_bus.publish",
            side_effect=published.append,
        ):
            MilestoneService.complete(actor=creator, milestone=milestone)

        assert [type(e) for e in published] == [MilestoneCompleted]
        assert published[0].payload == {
            "milestone_id": str(milestone.pk),
            "project_id": str(project.pk),
            "actor_id": str(creator.pk),
        }


class TestMilestoneReminders:
    def test_due_tomorrow_and_today_are_due_yesterday_is_overdue(self, project):
        creator = _user(project)
        tomorrow = _milestone(project, creator, TODAY + dt.timedelta(days=1))
        today = _milestone(project, creator, TODAY)
        yesterday = _milestone(project, creator, TODAY - dt.timedelta(days=1))

        assert ReminderService.run(NOW) == 3

        stages = {
            str(row.target_id): row.data
            for row in Notification.objects.filter(recipient=creator, kind="milestone_due")
        }
        assert stages == {
            str(tomorrow.pk): {"stage": "due", "due_date": "2026-11-17"},
            str(today.pk): {"stage": "due", "due_date": "2026-11-16"},
            str(yesterday.pk): {"stage": "overdue", "due_date": "2026-11-15"},
        }
        row = Notification.objects.filter(recipient=creator).first()
        assert row is not None
        assert row.actor_id is None and row.target_type == "milestone"

    def test_each_stage_is_written_once_and_a_moved_date_reminds_again(self, project):
        creator = _user(project)
        milestone = _milestone(project, creator, TODAY + dt.timedelta(days=1))

        ReminderService.run(NOW)
        ReminderService.run(NOW + dt.timedelta(hours=1))
        ReminderService.run(NOW + dt.timedelta(days=1))
        assert _kinds(creator) == ["milestone_due"]

        ReminderService.run(NOW + dt.timedelta(days=2))
        assert [data["stage"] for _, _, data in _rows(creator)] == ["due", "overdue"]
        ReminderService.run(NOW + dt.timedelta(days=3))
        assert len(_rows(creator)) == 2

        MilestoneService.update(
            actor=creator, milestone=milestone, data={"due_date": TODAY + dt.timedelta(days=3)}
        )
        ReminderService.run(NOW + dt.timedelta(days=3))
        assert [data for _, _, data in _rows(creator)][-1] == {
            "stage": "due",
            "due_date": "2026-11-19",
        }

    def test_not_reminded_completed_far_off_or_long_overdue(self, project):
        creator, other = _user(project), _user(project)
        done = _milestone(project, creator, TODAY)
        MilestoneService.complete(actor=other, milestone=done)
        Notification.objects.all().delete()
        _milestone(project, creator, TODAY + dt.timedelta(days=2))
        _milestone(project, creator, TODAY - dt.timedelta(days=8))
        seven = _milestone(project, creator, TODAY - dt.timedelta(days=7))

        ReminderService.run(NOW)

        assert list(Notification.objects.values_list("target_id", flat=True)) == [seven.pk]

    def test_a_delivery_milestone_also_reminds_the_deliverys_creator(self, project, crew):
        planner = _user(project)
        package = _delivery(project, crew["producer"])
        _milestone(
            project,
            planner,
            TODAY + dt.timedelta(days=1),
            kind="delivery",
            delivery_package_id=package.pk,
        )

        ReminderService.run(NOW)

        assert _kinds(planner) == ["milestone_due"]
        assert _kinds(crew["producer"]) == ["milestone_due"]

    def test_the_studios_time_zone_decides_today(self, project):
        creator = _user(project)
        WorkCalendar.objects.filter(is_default=True).update(is_default=False)
        WorkCalendar.objects.create(
            code="KIRI", name="Kiritimati", time_zone="Pacific/Kiritimati", is_default=True
        )
        # 11:00 UTC on the 16th is already the 17th in UTC+14: a milestone due on the 18th is due tomorrow
        _milestone(project, creator, TODAY + dt.timedelta(days=2))

        ReminderService.run(dt.datetime(2026, 11, 16, 11, 0, tzinfo=dt.UTC))

        assert [data for _, _, data in _rows(creator)] == [
            {"stage": "due", "due_date": "2026-11-18"}
        ]

    def test_muted_or_out_of_reach_people_are_not_reminded(self, project):
        muted = _user(project)
        NotificationPreference.objects.create(user=muted, muted_kinds=["milestone_due"])
        no_schedule = _user(project, ("project.view",))
        _milestone(project, muted, TODAY)
        _milestone(project, no_schedule, TODAY)

        assert ReminderService.run(NOW) == 0

    def test_one_failing_milestone_does_not_stop_the_others(self, project):
        creator = _user(project)
        _milestone(project, creator, TODAY)
        _milestone(project, creator, TODAY + dt.timedelta(days=1))
        real = ReminderService._remind
        calls = []

        def flaky(milestone):
            calls.append(milestone["id"])
            if len(calls) == 1:
                raise RuntimeError("boom")
            return real(milestone)

        with mock.patch.object(ReminderService, "_remind", side_effect=flaky):
            assert ReminderService.run(NOW) == 1

    def test_the_beat_runs_it_hourly(self):
        entry = settings.CELERY_BEAT_SCHEDULE["notifications-milestone-reminders"]

        assert entry["task"] == "notifications.milestone_reminders"
        assert entry["schedule"].minute == {20}
        assert len(entry["schedule"].hour) == 24


# ---------------------------------------------------------------------- the inbox


class TestInbox:
    def test_rows_of_the_new_types_carry_live_labels_and_their_data(
        self, project, crew, job_scene, run
    ):
        from apps.publishing.models import StorageRoot

        producer = crew["producer"]
        package = _signed_off(project, crew, run)
        job = _job(project, producer, job_scene["version"], status="Exporting")
        run(JobService.complete_export, actor=job_scene["pipeline"], job=job)
        StorageRoot.objects.get_or_create(code="PROJECTS", defaults={"name": "Projects"})
        version = VersionFactory.create(
            project=project, code="SH030_V001", status="Approved", is_published=True
        )
        file = _register(project, producer, version, "show/sh030/plate_main.exr")
        revoker = _user(project, role="Supervisor")
        run(
            PublishedFileService.revoke,
            actor=revoker,
            request=as_request(revoker),
            file=file,
            reason="x",
        )
        milestone = _milestone(project, producer, TODAY, name="Final turnover")
        run(MilestoneService.complete, actor=revoker, milestone=milestone)
        ReminderService.run(NOW)  # completed: not reminded

        rows = _api(producer).get(INBOX).json()["results"]
        by_type = {row["target"]["type"]: row for row in rows}

        assert set(by_type) == {"delivery", "publish_job", "published_file", "milestone"}
        assert by_type["delivery"]["target"] == {
            "type": "delivery",
            "id": str(package.pk),
            "code": package.code,
            "name": "Turnover",
        }
        assert by_type["delivery"]["data"] == {"from_status": "Prepared", "to_status": "Signed Off"}
        assert by_type["delivery"]["record"] is None
        assert by_type["publish_job"]["target"]["code"] == job.code
        assert by_type["publish_job"]["target"]["name"] == "Comp export"
        assert by_type["publish_job"]["data"] == {"status": "Exported"}
        assert by_type["published_file"]["target"]["code"] == "SH030_V001"
        assert by_type["published_file"]["target"]["name"] == "plate_main.exr"
        assert by_type["published_file"]["data"] == {}
        assert by_type["milestone"]["target"]["code"] == ""
        assert by_type["milestone"]["target"]["name"] == "Final turnover"
        assert by_type["milestone"]["project"]["code"] == "RPTHIRTEEN"

    def test_a_reminder_and_a_client_answer_show_their_data(self, project, crew, run):
        producer = crew["producer"]
        _milestone(project, producer, TODAY - dt.timedelta(days=1))
        ReminderService.run(NOW)
        package = _sent(project, crew, run)
        run(
            DeliveryService.record_client_answer,
            actor=crew["coordinator"],
            package=package,
            accepted=True,
        )

        rows = _api(producer).get(INBOX, {"kind": "milestone_due"}).json()["results"]
        assert [row["data"] for row in rows] == [{"stage": "overdue", "due_date": "2026-11-15"}]
        rows = _api(producer).get(INBOX, {"kind": "delivery_client_answer"}).json()["results"]
        assert [row["data"] for row in rows] == [{"client_status": "Approved"}]

    def test_a_row_leaves_the_inbox_and_the_count_when_its_record_leaves_reach(
        self, project, crew, run
    ):
        producer = crew["producer"]
        _signed_off(project, crew, run)
        api = _api(producer)
        assert api.get("/api/v1/notifications/unread-count/").json() == {"count": 1}

        ProjectMembership.objects.filter(user=producer).update(status="inactive")

        assert api.get(INBOX).json()["results"] == []
        assert api.get("/api/v1/notifications/unread-count/").json() == {"count": 0}

    def test_a_deleted_milestone_drops_its_row(self, project, run):
        creator, other = _user(project), _user(project)
        milestone = _milestone(project, creator, TODAY)
        run(MilestoneService.complete, actor=other, milestone=milestone)

        Milestone.objects.get(pk=milestone.pk).delete()

        assert _api(creator).get(INBOX).json()["results"] == []


class TestReachIsTheRecordsGet:
    """``sources.readable`` answers what the record's own ``GET`` answers, for each new type."""

    @pytest.fixture
    def records(self, project, crew, run):
        from apps.publishing.models import StorageRoot

        StorageRoot.objects.get_or_create(code="PROJECTS", defaults={"name": "Projects"})
        producer = crew["producer"]
        version = VersionFactory.create(
            project=project, code="SH040_V001", status="Approved", is_published=True
        )
        return {
            "delivery": ("/api/v1/deliveries/{}/", _delivery(project, producer)),
            "publish_job": ("/api/v1/publishing/{}/", _job(project, producer)),
            "published_file": (
                "/api/v1/publishing/files/{}/",
                _register(project, producer, version, "show/sh040/plate.exr"),
            ),
            "milestone": (
                "/api/v1/scheduling/milestones/{}/",
                _milestone(project, producer, TODAY),
            ),
        }

    @pytest.mark.parametrize(
        "who",
        ["producer", "artist", "outsider", "vendor", "admin", "inactive_member"],
    )
    def test_reach_matches_the_get(self, project, records, who):
        other = ProjectFactory.create(code="ELSEWHERE")
        users = {
            "producer": lambda: _user(project),
            "artist": lambda: _user(project, ARTIST, role="Artist"),
            "outsider": lambda: _user(other),
            "vendor": lambda: _user(project, vendor_id="ACME"),
            "admin": lambda: UserFactory.create(is_superuser=True),
            "inactive_member": lambda: _user(project, status="inactive"),
        }
        user = users[who]()
        api = _api(user)
        for target_type, (path, record) in records.items():
            opened = api.get(path.format(record.pk)).status_code == 200
            told = bool(sources.readable(as_request(user), target_type, [record.pk]))
            assert told == opened, (who, target_type)

    def test_the_artist_reads_files_and_milestones_but_not_deliveries(self, project, records):
        artist = _user(project, ARTIST, role="Artist")
        reach = {
            target_type: bool(sources.readable(as_request(artist), target_type, [record.pk]))
            for target_type, (_, record) in records.items()
        }

        assert reach == {
            "delivery": False,
            "publish_job": True,
            "published_file": True,
            "milestone": True,
        }

    def test_an_unknown_type_reaches_nothing(self, project):
        assert sources.readable(as_request(_user(project)), "leave", ["0" * 32]) == set()
        assert sources.labels("leave", ["0" * 32]) == {}
