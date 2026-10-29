# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
The delivery pipeline across the three apps (docs/delivery-pipeline/CONTRACTS.md X-10).

Publish a version's files, put the version in a delivery, sign it off as a second person, send it,
schedule the delivery as a milestone and read the project schedule through Production's route;
then revoke a file after the send and archive attempts on a shot that carries published work.
Everything goes through the HTTP API except the publishing registration, which the DCC tooling
does through the service.
"""

from __future__ import annotations

from datetime import date

import pytest

from apps.deliveries.models import DeliveryItemFile, DeliveryPackage
from apps.deliveries.tests.helpers import _Request, client_for, published_version
from apps.identity.tests.factories import UserFactory
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory, ShotFactory
from apps.publishing.models import PublishedFile
from apps.publishing.services.files import PublishedFileService
from apps.scheduling.models import Milestone

pytestmark = pytest.mark.django_db

DELIVERIES = "/api/v1/deliveries/"
MILESTONES = "/api/v1/scheduling/milestones/"


def _admin(project):
    """A platform admin who is also a member of ``project`` (holds every code but the overrides)."""
    user = UserFactory.create(is_superuser=True)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user, client_for(user)


@pytest.fixture
def project():
    return ProjectFactory.create(
        code="FLOW", start_date=date(2026, 1, 5), delivery_date=date(2026, 9, 30)
    )


def _deliver(project, version):
    """Create a delivery, add the version, prepare it, sign it off by a second person and send it."""
    preparer, prep_api = _admin(project)
    signer, sign_api = _admin(project)

    created = prep_api.post(
        DELIVERIES, {"name": "Final turnover", "project_id": str(project.pk)}, format="json"
    )
    assert created.status_code == 201, created.content
    uid = created.json()["id"]
    assert (
        prep_api.post(
            f"{DELIVERIES}{uid}/add-version/", {"version_id": str(version.pk)}, format="json"
        ).status_code
        == 201
    )
    assert prep_api.post(f"{DELIVERIES}{uid}/prepare/", {}, format="json").status_code == 200
    assert sign_api.post(f"{DELIVERIES}{uid}/sign-off/", {}, format="json").status_code == 200
    sent = sign_api.post(
        f"{DELIVERIES}{uid}/submit/", {"transfer_reference": "aspera-4411"}, format="json"
    )
    assert sent.status_code == 200, sent.content
    return uid, prep_api, sign_api


class TestPublishDeliverSchedule:
    def test_the_whole_flow(self, project):
        version = published_version(project, files=2)
        uid, api, _ = _deliver(project, version)

        sent = api.get(f"{DELIVERIES}{uid}/").json()
        assert sent["status"] == "Submitted"
        assert DeliveryPackage.objects.get(pk=uid).sent_at is not None

        # schedule the delivery as a milestone of the project: Scheduling asks Deliveries, by
        # provider, whether that delivery is the project's
        created = api.post(
            MILESTONES,
            {
                "project_id": str(project.pk),
                "name": "Final turnover",
                "due_date": "2026-09-30",
                "kind": "delivery",
                "delivery_package_id": uid,
            },
            format="json",
        )
        assert created.status_code == 201, created.content

        schedule = api.get(f"/api/organizations/projects/{project.pk}/schedule").json()
        assert [m["name"] for m in schedule["milestones"]] == ["Final turnover"]
        assert schedule["milestones"][0]["date"] == "2026-09-30"
        assert schedule["delivery_date"] == "2026-09-30"

        done = api.post(f"{MILESTONES}{created.json()['id']}/complete/")
        assert done.status_code == 200 and done.json()["status"] == "Completed"
        after = api.get(f"/api/organizations/projects/{project.pk}/schedule").json()
        assert after["milestones"][0]["status"] == "Completed"

    def test_the_pipeline_shows_in_the_project_figures_production_reads(self, project):
        version = published_version(project)
        uid, api, _ = _deliver(project, version)

        rows = api.get(f"/api/organizations/projects/{project.pk}/deliveries").json()
        rows = rows["results"] if isinstance(rows, dict) else rows

        assert [row["id"] for row in rows] == [uid]

    def test_a_milestone_cannot_name_another_projects_delivery(self, project):
        other = ProjectFactory.create(code="OTHR")
        other_version = published_version(other)
        other_uid, _, _ = _deliver(other, other_version)
        _, api = _admin(project)

        response = api.post(
            MILESTONES,
            {
                "project_id": str(project.pk),
                "name": "Borrowed",
                "due_date": "2026-09-30",
                "kind": "delivery",
                "delivery_package_id": other_uid,
            },
            format="json",
        )

        assert response.status_code == 400 and "Unknown delivery" in response.content.decode()
        assert Milestone.objects.count() == 0

    def test_the_signer_cannot_be_the_preparer(self, project):
        version = published_version(project)
        user, api = _admin(project)
        created = api.post(
            DELIVERIES, {"name": "Solo", "project_id": str(project.pk)}, format="json"
        )
        uid = created.json()["id"]
        api.post(f"{DELIVERIES}{uid}/add-version/", {"version_id": str(version.pk)}, format="json")
        api.post(f"{DELIVERIES}{uid}/prepare/", {}, format="json")

        response = api.post(f"{DELIVERIES}{uid}/sign-off/", {}, format="json")

        assert response.status_code == 403
        assert DeliveryPackage.objects.get(pk=uid).status == "Prepared"


class TestRevokeAfterSend:
    def test_the_sent_delivery_is_unchanged_and_says_so_while_an_unsent_one_loses_approval(
        self, project, django_capture_on_commit_callbacks
    ):
        version = published_version(project, files=2)
        sent_uid, api, _ = _deliver(project, version)
        before = sorted(
            DeliveryItemFile.objects.filter(item__delivery_id=sent_uid).values_list(
                "relative_path", "sha256", "size_bytes"
            )
        )

        # a second delivery of the same version, signed off but not yet sent
        preparer, prep_api = _admin(project)
        signer, sign_api = _admin(project)
        pending = prep_api.post(
            DELIVERIES, {"name": "Second", "project_id": str(project.pk)}, format="json"
        ).json()["id"]
        prep_api.post(
            f"{DELIVERIES}{pending}/add-version/", {"version_id": str(version.pk)}, format="json"
        )
        prep_api.post(f"{DELIVERIES}{pending}/prepare/", {}, format="json")
        sign_api.post(f"{DELIVERIES}{pending}/sign-off/", {}, format="json")
        assert DeliveryPackage.objects.get(pk=pending).status == "Signed Off"

        admin = UserFactory.create(is_superuser=True)
        main = PublishedFile.objects.filter(version=version).order_by("created_at").first()
        # the delivery apps react to a revoke when the transaction commits
        with django_capture_on_commit_callbacks(execute=True):
            PublishedFileService.revoke(
                actor=admin, request=_Request(admin), file=main, reason="Wrong grade"
            )

        sent = api.get(f"{DELIVERIES}{sent_uid}/").json()
        assert sent["status"] == "Submitted" and sent["has_revoked_content"] is True
        after = sorted(
            DeliveryItemFile.objects.filter(item__delivery_id=sent_uid).values_list(
                "relative_path", "sha256", "size_bytes"
            )
        )
        assert after == before  # the snapshot of what was sent does not move

        unsent = DeliveryPackage.objects.get(pk=pending)
        assert unsent.status == "Prepared"  # lost its sign-off; needs QC and a new signature


class TestArchivingPublishedWork:
    """
    What Production does when work that was published and delivered is archived (D-13, D-29).

    A published version cannot be archived or deleted. A shot can be archived (a soft delete) and
    its versions stay live and published; nothing the three apps recorded becomes unreadable. The
    contract's first reading, that archiving the shot would be refused, is not what Production does
    (decision Q41 asks whether it should).
    """

    def test_the_published_version_itself_cannot_be_archived_or_deleted(self, project):
        shot = ShotFactory.create(project=project, code="SH010", name="Opening")
        version = published_version(project, shot=shot)
        _deliver(project, version)
        _, api = _admin(project)

        archived = api.post(f"/api/v1/versions/{version.pk}/archive/")
        deleted = api.delete(f"/api/v1/versions/{version.pk}/")

        assert archived.status_code == deleted.status_code == 400
        version.refresh_from_db()
        assert version.is_deleted is False and version.is_published is True

    def test_archiving_the_shot_leaves_the_published_work_and_the_delivery_readable(self, project):
        shot = ShotFactory.create(project=project, code="SH020", name="Closing")
        version = published_version(project, shot=shot)
        uid, api, _ = _deliver(project, version)

        archived = api.delete(f"/api/v1/shots/{shot.pk}/")

        assert archived.status_code == 204
        shot.refresh_from_db()
        version.refresh_from_db()
        assert shot.is_deleted is True
        assert version.is_deleted is False and version.is_published is True
        assert PublishedFile.objects.filter(version=version).exists()
        detail = api.get(f"{DELIVERIES}{uid}/")
        assert detail.status_code == 200 and detail.json()["status"] == "Submitted"
        assert api.get(f"{DELIVERIES}{uid}/history/").json()
