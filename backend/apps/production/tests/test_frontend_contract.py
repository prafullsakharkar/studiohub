"""
Frontend-contract tests (studiohub-react mock API parity).

Covers the union bulk/check-existence/archive shapes, single archive/restore,
reviews participant-verdict, project statistics, playlist pagination, and the
bare-array attachments compat endpoint. All shapes mirror
``src/mocks/mockRouter.ts`` / ``src/mocks/handlers/*``.
"""

import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import OrganizationFactory
from apps.production.models import Review
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
)


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


@pytest.mark.django_db
class TestCheckExistenceContract:
    def test_react_form_returns_items_with_state(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            reverse("api:v1:production:sequence-check-existence"),
            data={"project_id": str(project.id), "codes": ["NEWSEQ01"]},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["items"][0]["code"] == "NEWSEQ01"
        assert resp.data["items"][0]["state"] == "NEW"
        # Legacy envelope preserved alongside.
        assert resp.data["results"][0]["status"] == "new"

    def test_legacy_path_and_form_still_work(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            reverse("api:v1:production:sequence-existence-check"),
            data={"items": [{"project_id": str(project.id), "code": "NEWSEQ02"}]},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["results"][0]["status"] == "new"
        assert resp.data["items"][0]["state"] == "NEW"

    def test_existing_and_soft_deleted_states(self, staff_client):
        from apps.core.services.soft_delete import SoftDeleteService

        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        SequenceFactory.create(organization=org, project=project, code="EXISTS01")
        deleted = SequenceFactory.create(organization=org, project=project, code="GONE01")
        SoftDeleteService.delete(deleted)
        resp = staff_client.post(
            reverse("api:v1:production:sequence-check-existence"),
            data={"project_id": str(project.id), "codes": ["EXISTS01", "GONE01", "EXISTS01"]},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        states = [item["state"] for item in resp.data["items"]]
        assert states == ["EXISTS", "SOFT_DELETED", "DUPLICATE_IN_REQUEST"]
        assert resp.data["items"][0]["existing_entity"]["code"] == "EXISTS01"
        assert "archived" in resp.data["items"][1]["message"]

    def test_shot_asset_task_check_existence(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        for basename in ("shot", "asset", "task"):
            resp = staff_client.post(
                reverse(f"api:v1:production:{basename}-check-existence"),
                data={"project_id": str(project.id), "codes": ["X01"]},
                **_org_header(org),
                format="json",
            )
            assert resp.status_code == status.HTTP_200_OK, (basename, resp.data)
            assert resp.data["items"][0]["state"] == "NEW"


@pytest.mark.django_db
class TestBulkCreateContract:
    def test_react_form_with_create_and_skip(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            reverse("api:v1:production:sequence-bulk-create"),
            data={
                "project_id": str(project.id),
                "items": [
                    {"code": "BLK01", "action": "create", "data": {"name": "Bulk One"}},
                    {"code": "BLK02", "action": "skip", "data": {"name": "Bulk Two"}},
                ],
            },
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["operation_id"]
        assert resp.data["timestamp"]
        summary = resp.data["summary"]
        assert summary["total"] == 2
        assert summary["createdCount"] == 1
        assert summary["skippedCount"] == 1
        assert resp.data["successful"] == 2
        # Legacy keys preserved.
        assert resp.data["processed"] == 2
        assert resp.data["failed"] == 0
        actions = {item["code"]: item["actionTaken"] for item in resp.data["results"]}
        assert actions == {"BLK01": "created", "BLK02": "skipped"}
        assert resp.data["results"][0]["entity"]["code"] == "BLK01"

    def test_recover_action_restores_soft_deleted(self, staff_client):
        from apps.core.services.soft_delete import SoftDeleteService

        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        seq = SequenceFactory.create(organization=org, project=project, code="REC01")
        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            reverse("api:v1:production:sequence-bulk-create"),
            data={
                "project_id": str(project.id),
                "items": [{"code": "REC01", "action": "recover", "data": {}}],
            },
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["results"][0]["actionTaken"] == "recovered"
        assert resp.data["summary"]["recoveredCount"] == 1
        seq.refresh_from_db()
        assert seq.is_deleted is False

    def test_shot_bulk_create_react_form(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            reverse("api:v1:production:shot-bulk-create"),
            data={
                "project_id": str(project.id),
                "items": [{"code": "SHBLK01", "action": "create", "data": {"name": "S"}}],
            },
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["summary"]["createdCount"] == 1

    def test_task_bulk_create_react_form(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            reverse("api:v1:production:task-bulk-create"),
            data={
                "project_id": str(project.id),
                "items": [
                    {"code": "TSKBLK01", "action": "create", "data": {"title": "T"}}
                ],
            },
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["summary"]["createdCount"] == 1

    def test_asset_bulk_create_react_form(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            reverse("api:v1:production:asset-bulk-create"),
            data={
                "project_id": str(project.id),
                "items": [{"code": "ASTBLK01", "action": "create", "data": {"name": "A"}}],
            },
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["summary"]["createdCount"] == 1


@pytest.mark.django_db
class TestBulkUpdateArchiveContract:
    def test_bulk_update_ids_changes_shape(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="UPD01")
        resp = staff_client.post(
            reverse("api:v1:production:sequence-bulk-update"),
            data={"ids": [str(seq.id)], "changes": {"name": "Renamed"}},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["summary"]["updatedCount"] == 1
        seq.refresh_from_db()
        assert seq.name == "Renamed"

    def test_bulk_archive_union_shape(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="ARC01")
        resp = staff_client.post(
            reverse("api:v1:production:sequence-bulk-archive"),
            data={"ids": [str(seq.id)]},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["summary"]["archivedCount"] == 1
        assert resp.data["success"] is True
        assert resp.data["updated_count"] == 1
        assert resp.data["processed"] == 1
        seq.refresh_from_db()
        assert seq.is_deleted is True

    def test_bulk_restore_union_shape(self, staff_client):
        from apps.core.services.soft_delete import SoftDeleteService

        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="RST01")
        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            reverse("api:v1:production:sequence-bulk-restore"),
            data={"ids": [str(seq.id)]},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["summary"]["restoredCount"] == 1

    def test_single_archive_flips_status(self, staff_client):
        org = OrganizationFactory.create()
        shot = ShotFactory.create(organization=org, code="SHARC01")
        resp = staff_client.post(
            reverse("api:v1:production:shot-archive", args=[shot.id]),
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        shot.refresh_from_db()
        assert shot.is_deleted is True
        assert shot.status == "Archived"
        resp = staff_client.post(
            reverse("api:v1:production:shot-restore", args=[shot.id]),
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        shot.refresh_from_db()
        assert shot.is_deleted is False
        assert shot.status == "In Progress"

    def test_task_archive_sets_flag_and_status(self, staff_client):
        org = OrganizationFactory.create()
        task = TaskFactory.create(organization=org, code="TSKARC01")
        resp = staff_client.post(
            reverse("api:v1:production:task-archive", args=[task.id]),
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        task.refresh_from_db()
        assert task.is_archived is True
        assert task.status == "Archived"
        assert task.is_deleted is True

    def test_asset_archive_restore(self, staff_client):
        org = OrganizationFactory.create()
        asset = AssetFactory.create(organization=org, code="ASTARC01")
        resp = staff_client.post(
            reverse("api:v1:production:asset-archive", args=[asset.id]),
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        asset.refresh_from_db()
        assert asset.is_deleted is True
        resp = staff_client.post(
            reverse("api:v1:production:asset-restore", args=[asset.id]),
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data

    def test_sequence_archive_endpoint_exists(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="SQARC01")
        resp = staff_client.post(
            reverse("api:v1:production:sequence-archive", args=[seq.id]),
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        seq.refresh_from_db()
        assert seq.is_deleted is True
        assert seq.status == "Archived"


@pytest.mark.django_db
class TestReviewAndProjectContract:
    def _make_review(self, org, project):
        return Review.objects.create(
            organization=org,
            project=project,
            code="REV001",
            title="Review One",
            reviewers=[
                {"id": "p1", "user_id": "u1", "name": "Rev A", "verdict": "Pending Review"}
            ],
        )

    def test_participant_verdict(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        review = self._make_review(org, project)
        resp = staff_client.post(
            reverse("api:v1:production:review-participant-verdict", args=[review.id]),
            data={"participant_id": "p1", "verdict": "Approved", "notes": "Good"},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["reviewers"][0]["verdict"] == "Approved"
        assert resp.data["reviewers"][0]["verdict_notes"] == "Good"

    def test_participant_verdict_unknown_participant_404(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        review = self._make_review(org, project)
        resp = staff_client.post(
            reverse("api:v1:production:review-participant-verdict", args=[review.id]),
            data={"participant_id": "nope", "verdict": "Approved"},
            **_org_header(org),
            format="json",
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_project_statistics(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        SequenceFactory.create(organization=org, project=project, code="ST1")
        ShotFactory.create(organization=org, project=project, code="SH1")
        resp = staff_client.get(
            reverse("api:v1:production:project-statistics", args=[project.id]),
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["sequences"] == 1
        assert resp.data["shots"] == 1
        assert "approved_shots" in resp.data

    def test_playlist_list_is_paginated(self, staff_client):
        org = OrganizationFactory.create()
        resp = staff_client.get(
            reverse("api:v1:production:playlist-list"),
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert set(("count", "next", "previous", "results")) <= set(resp.data.keys())

    def test_attachments_compat_is_bare_array(self, staff_client):
        resp = staff_client.get(reverse("api:v1:core-compat:attachment-compat-list"))
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert isinstance(resp.data, list)

    def test_sequence_lead_artist_contract(self, staff_client):
        from apps.identity.tests.factories import UserFactory

        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        user = UserFactory.create()
        seq = SequenceFactory.create(
            organization=org,
            project=project,
            code="LEAD01",
            lead_artist=user,
            lead_artist_name="Lead Artist",
        )
        resp = staff_client.get(
            reverse("api:v1:production:sequence-detail", args=[seq.id]),
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert resp.data["lead_artist_name"] == "Lead Artist"
        assert resp.data["lead_artist_id"] == str(user.id)
        resp = staff_client.get(
            reverse("api:v1:production:sequence-list") + "?search=Lead+Artist",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert {s["code"] for s in resp.data["results"]} == {"LEAD01"}

    def test_media_code_name_search_contract(self, staff_client):
        from apps.production.models import Media

        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        Media.objects.create(
            organization=org,
            project=project,
            entity_type="Shot",
            entity_id="shot-1",
            media_type="video",
            code="MED-001",
            name="Hero Plate",
            title="Hero Plate",
            file_name="hero_plate_v1.exr",
        )
        resp = staff_client.get(
            reverse("api:v1:production:media-list") + "?search=hero_plate",
            **_org_header(org),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert isinstance(resp.data, list)
        assert resp.data[0]["code"] == "MED-001"
        assert resp.data[0]["name"] == "Hero Plate"
        resp = staff_client.get(
            reverse("api:v1:production:media-list") + "?search=MED-001",
            **_org_header(org),
        )
        assert [m["code"] for m in resp.data] == ["MED-001"]

    def test_scheduling_lists_are_bare_arrays(self, staff_client, staff_user):
        from apps.organization.tests.factories import OrganizationMembershipFactory
        from apps.scheduling.models import CalendarEvent, Resource

        org = OrganizationFactory.create()
        OrganizationMembershipFactory.create(user=staff_user, organization=org)
        CalendarEvent.objects.create(
            title="Kickoff",
            start_time="2026-09-10T10:00:00Z",
            end_time="2026-09-10T11:00:00Z",
            organization=org,
        )
        Resource.objects.create(
            name="Room A", code="ROOM-A", resource_type="Room", organization=org
        )
        resp = staff_client.get(
            reverse("api:v1:scheduling:calendar-event-list"), **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert isinstance(resp.data, list)
        assert [e["title"] for e in resp.data] == ["Kickoff"]
        resp = staff_client.get(
            reverse("api:v1:scheduling:resource-list"), **_org_header(org)
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        assert isinstance(resp.data, list)
        assert [r["code"] for r in resp.data] == ["ROOM-A"]


@pytest.mark.django_db
class TestTimelogCreateContract:
    """Timelog create accepts the frontend Timelog payload shape.

    Regression: logging hours posted ``task_id``/``project_id``/``person_id``
    mock-style refs while the serializer required UUID ``task`` → 400
    ``{'task': ['This field is required.']}`` surfaced in the UI as the
    generic "An unexpected server error occurred."
    """

    def _setup(self):
        from apps.identity.tests.factories import UserFactory
        from apps.organization.tests.factories import OrganizationMembershipFactory

        user = UserFactory.create(is_staff=True, is_superuser=True)
        project = ProjectFactory.create()
        OrganizationMembershipFactory.create(
            user=user, organization=project.organization
        )
        task = TaskFactory.create(
            organization=project.organization, project=project
        )
        return user, project, task

    def _payload(self, project, task):
        return {
            "task_id": "task-001",
            "task_code": task.code,
            "task_title": task.title,
            "project_id": "proj-001",
            "project_code": project.code,
            "person_id": "usr-001",
            "department": "FX & Simulation",
            "duration_hours": 4.5,
            "date": "2026-09-08",
            "billable": True,
            "notes": "Comp pass",
            "status": "Submitted",
            "activity_category": "Production",
        }

    def _authed(self, user):
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_create_with_frontend_refs(self):
        user, project, task = self._setup()
        resp = self._authed(user).post(
            "/api/v1/timelogs/",
            self._payload(project, task),
            format="json",
            **_org_header(project.organization),
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert str(resp.data["task"]) == str(task.id)
        assert str(resp.data["project"]) == str(project.id)
        assert str(resp.data["person"]) == str(user.id)

    def test_create_with_uuid_task(self):
        user, project, task = self._setup()
        resp = self._authed(user).post(
            "/api/v1/timelogs/",
            {"task": str(task.id), "duration_hours": 2, "date": "2026-09-08"},
            format="json",
            **_org_header(project.organization),
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data

    def test_create_unknown_task_is_descriptive_400(self):
        user, project, task = self._setup()
        payload = self._payload(project, task)
        payload["task_code"] = "NOPE-000"
        payload.pop("task_id")
        resp = self._authed(user).post(
            "/api/v1/timelogs/",
            payload,
            format="json",
            **_org_header(project.organization),
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST, resp.data
        assert "task" in resp.data
