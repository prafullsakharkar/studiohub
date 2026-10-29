"""
Sequence domain + bulk operations tests.

Covers:
  * CRUD with strict project-membership scoping (fail closed);
  * soft-delete (archive) and restore;
  * bulk-create / bulk-update / bulk-archive / bulk-restore;
  * existence-check classification (new/exists/soft_deleted/duplicate/invalid);
  * cross-project isolation for every bulk operation;
  * cross-project isolation for every bulk operation.
"""
import uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.production.models import ProjectMembership, Sequence
from apps.production.tests.factories import ProjectFactory, SequenceFactory


def _member(user, project, **kwargs):
    kwargs.setdefault("status", "active")
    kwargs.setdefault("role", "Artist")
    return ProjectMembership.objects.create(user=user, project=project, **kwargs)


def _list_url():
    return reverse("api:v1:production:sequence-list")


def _detail_url(seq):
    return reverse("api:v1:production:sequence-detail", args=[seq.id])


def _action_url(name):
    return reverse(f"api:v1:production:sequence-{name}")


@pytest.mark.django_db
class TestSequenceCRUD:
    def test_create_in_member_project(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        resp = staff_client.post(
            _list_url(),
            data={"project": str(project.id), "code": "SQ001", "name": "First Shot"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        seq = Sequence.objects.get(code="SQ001")
        assert not hasattr(seq, "organization")
        assert seq.project_id == project.id

    def test_create_without_project_fails_closed(self, staff_client):
        resp = staff_client.post(
            _list_url(),
            data={"code": "SQX99", "name": "No Project"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert not Sequence.objects.filter(code="SQX99").exists()

    def test_create_in_non_member_project_fails_closed(
        self, staff_client, staff_user
    ):
        project = ProjectFactory.create()
        resp = staff_client.post(
            _list_url(),
            data={"project": str(project.id), "code": "SQX98", "name": "No Scope"},
            format="json",
        )
        assert resp.status_code in (
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
        )
        assert not Sequence.objects.filter(code="SQX98").exists()

    def test_list_is_scoped_to_membership(self, staff_client, staff_user):
        in_project = ProjectFactory.create()
        out_project = ProjectFactory.create()
        _member(staff_user, in_project)
        SequenceFactory.create(project=in_project, code="SQA01")
        SequenceFactory.create(project=out_project, code="SQB01")
        resp = staff_client.get(_list_url())
        assert resp.status_code == status.HTTP_200_OK
        codes = {s["code"] for s in resp.data["results"]}
        assert "SQA01" in codes
        assert "SQB01" not in codes

    def test_detail_is_scoped_to_membership(self, staff_client, staff_user):
        in_project = ProjectFactory.create()
        out_project = ProjectFactory.create()
        _member(staff_user, in_project)
        seq = SequenceFactory.create(project=out_project, code="SQC01")
        resp = staff_client.get(_detail_url(seq))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_destroy_soft_deletes(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        seq = SequenceFactory.create(project=project, code="SQD01")
        resp = staff_client.delete(_detail_url(seq))
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        seq.refresh_from_db()
        assert seq.is_deleted is True

    def test_restore_restores_soft_deleted(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        seq = SequenceFactory.create(project=project, code="SQE01")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        seq.refresh_from_db()
        assert seq.is_deleted is True
        resp = staff_client.post(
            reverse("api:v1:production:sequence-restore", args=[seq.id]),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        seq.refresh_from_db()
        assert seq.is_deleted is False


@pytest.mark.django_db
class TestSequenceExistenceCheck:
    def test_classifies_new(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(project.id), "code": "NEW01"}]},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"][0]["status"] == "new"

    def test_classifies_exists(self, staff_client, staff_user):
        seq = SequenceFactory.create(code="EX01")
        _member(staff_user, seq.project)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(seq.project_id), "code": "EX01"}]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "exists"
        assert resp.data["results"][0]["id"] == str(seq.id)

    def test_classifies_soft_deleted(self, staff_client, staff_user):
        seq = SequenceFactory.create(code="SD01")
        _member(staff_user, seq.project)
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(seq.project_id), "code": "SD01"}]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "soft_deleted"
        assert resp.data["results"][0]["id"] == str(seq.id)

    def test_classifies_duplicate_within_batch(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={
                "items": [
                    {"project_id": str(project.id), "code": "DUP01"},
                    {"project_id": str(project.id), "code": "dup01"},
                ]
            },
            format="json",
        )
        statuses = [r["status"] for r in resp.data["results"]]
        assert statuses == ["new", "duplicate"]

    def test_classifies_out_of_scope_project_as_invalid(
        self, staff_client, staff_user
    ):
        ProjectFactory.create()
        other_project = ProjectFactory.create()
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(other_project.id), "code": "INV01"}]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "invalid"


@pytest.mark.django_db
class TestSequenceBulkCreate:
    def test_creates_valid_rows(self, staff_client, staff_user):
        project = ProjectFactory.create()
        _member(staff_user, project)
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={
                "items": [
                    {"project_id": str(project.id), "code": "BC01", "name": "A"},
                    {"project_id": str(project.id), "code": "BC02", "name": "B"},
                ]
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["processed"] == 2
        assert resp.data["successful"] == 2
        assert resp.data["failed"] == 0
        assert Sequence.objects.filter(project=project).count() == 2

    def test_reports_existing_and_duplicate(self, staff_client, staff_user):
        seq = SequenceFactory.create(code="BEX01")
        _member(staff_user, seq.project)
        project = seq.project
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={
                "items": [
                    {"project_id": str(project.id), "code": "BEX01"},
                    {"project_id": str(project.id), "code": "BNEW1"},
                    {"project_id": str(project.id), "code": "BNEW1"},
                ]
            },
            format="json",
        )
        assert resp.data["processed"] == 3
        assert resp.data["successful"] == 1
        assert resp.data["failed"] == 2
        statuses = {r["status"] for r in resp.data["results"]}
        assert statuses == {"exists", "created", "duplicate"}

    def test_reports_soft_deleted_and_does_not_create(
        self, staff_client, staff_user
    ):
        seq = SequenceFactory.create(code="BSD01")
        _member(staff_user, seq.project)
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={"items": [{"project_id": str(seq.project_id), "code": "BSD01"}]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "soft_deleted"
        assert resp.data["failed"] == 1
        assert Sequence.all_objects.filter(project=seq.project).count() == 1

    def test_rejects_out_of_scope_project(self, staff_client, staff_user):
        ProjectFactory.create()
        other_project = ProjectFactory.create()
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={"items": [{"project_id": str(other_project.id), "code": "BX01"}]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "invalid"
        assert not Sequence.objects.filter(code="BX01").exists()


@pytest.mark.django_db
class TestSequenceBulkUpdateArchiveRestore:
    def test_bulk_update(self, staff_client, staff_user):
        seq = SequenceFactory.create(code="BU01", name="Old")
        _member(staff_user, seq.project)
        resp = staff_client.patch(
            _action_url("bulk-update"),
            data={"items": [{"id": str(seq.id), "name": "New"}]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "updated"
        seq.refresh_from_db()
        assert seq.name == "New"

    def test_bulk_update_cannot_touch_other_project(
        self, staff_client, staff_user
    ):
        in_project = ProjectFactory.create()
        _member(staff_user, in_project)
        out_project = ProjectFactory.create()
        seq = SequenceFactory.create(project=out_project, code="BU02")
        resp = staff_client.patch(
            _action_url("bulk-update"),
            data={"items": [{"id": str(seq.id), "name": "Nope"}]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "not_found"
        seq.refresh_from_db()
        assert seq.name != "Nope"

    def test_bulk_archive_soft_deletes(self, staff_client, staff_user):
        seq = SequenceFactory.create(code="BAR01")
        _member(staff_user, seq.project)
        resp = staff_client.post(
            _action_url("bulk-archive"),
            data={"ids": [str(seq.id)]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "archived"
        seq.refresh_from_db()
        assert seq.is_deleted is True

    def test_bulk_archive_cannot_touch_other_project(
        self, staff_client, staff_user
    ):
        in_project = ProjectFactory.create()
        _member(staff_user, in_project)
        out_project = ProjectFactory.create()
        seq = SequenceFactory.create(project=out_project, code="BAR02")
        resp = staff_client.post(
            _action_url("bulk-archive"),
            data={"ids": [str(seq.id)]},
            format="json",
        )
        # Out-of-scope ids report per-item ``not_found`` (no leak):
        # nothing is deleted.
        assert resp.data["results"][0]["status"] == "not_found"
        assert resp.data["successful"] == 0
        assert resp.data["failed"] == 1
        seq.refresh_from_db()
        assert seq.is_deleted is False

    def test_bulk_restore_restores(self, staff_client, staff_user):
        seq = SequenceFactory.create(code="BR01")
        _member(staff_user, seq.project)
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        seq.refresh_from_db()
        assert seq.is_deleted is True
        resp = staff_client.post(
            _action_url("bulk-restore"),
            data={"ids": [str(seq.id)]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "restored"
        seq.refresh_from_db()
        assert seq.is_deleted is False

    def test_bulk_restore_cannot_touch_other_project(
        self, staff_client, staff_user
    ):
        in_project = ProjectFactory.create()
        _member(staff_user, in_project)
        out_project = ProjectFactory.create()
        seq = SequenceFactory.create(project=out_project, code="BR02")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            _action_url("bulk-restore"),
            data={"ids": [str(seq.id)]},
            format="json",
        )
        assert resp.data["results"][0]["status"] == "not_found"
        assert resp.data["successful"] == 0
        assert resp.data["failed"] == 1
        seq.refresh_from_db()
        assert seq.is_deleted is True

    def test_bulk_operations_with_unknown_project_fail_closed(self, staff_client):
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={"items": [{"project_id": str(uuid.uuid4()), "code": "X1"}]},
            format="json",
        )
        # Fail closed per item (no row created, no existence leak).
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"][0]["status"] == "invalid"
        assert resp.data["successful"] == 0
        assert not Sequence.objects.filter(code="X1").exists()

    def test_archived_lists_only_soft_deleted_scoped_to_membership(
        self, staff_client, staff_user
    ):
        in_project = ProjectFactory.create()
        out_project = ProjectFactory.create()
        _member(staff_user, in_project)
        _member(staff_user, out_project)
        SequenceFactory.create(project=in_project, code="ACT01")
        archived = SequenceFactory.create(project=in_project, code="ARC01")
        other_archived = SequenceFactory.create(project=out_project, code="OTH01")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(archived)
        SoftDeleteService.delete(other_archived)
        archived.refresh_from_db()
        assert archived.is_deleted is True

        # Membership on both projects: both archived rows visible, live hidden.
        resp = staff_client.get(reverse("api:v1:production:sequence-archived"))
        assert resp.status_code == status.HTTP_200_OK
        codes = [item["code"] for item in resp.data["results"]]
        assert "ARC01" in codes
        assert "OTH01" in codes
        assert "ACT01" not in codes

        # Revoke membership on the second project: its rows disappear.
        ProjectMembership.objects.filter(
            user=staff_user, project=out_project
        ).delete()
        resp = staff_client.get(reverse("api:v1:production:sequence-archived"))
        codes = [item["code"] for item in resp.data["results"]]
        assert "ARC01" in codes
        assert "OTH01" not in codes
