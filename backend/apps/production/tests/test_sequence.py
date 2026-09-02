"""
Sequence domain + bulk operations tests.

Covers:
  * CRUD with strict organization scoping (fail closed);
  * soft-delete (archive) and restore;
  * bulk-create / bulk-update / bulk-archive / bulk-restore;
  * existence-check classification (new/exists/soft_deleted/duplicate/invalid);
  * organization isolation for every bulk operation.
"""
import uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import OrganizationFactory
from apps.production.models import Sequence
from apps.production.tests.factories import ProjectFactory, SequenceFactory


def _list_url():
    return reverse("api:v1:production:sequence-list")


def _detail_url(seq):
    return reverse("api:v1:production:sequence-detail", args=[seq.id])


def _action_url(name):
    return reverse(f"api:v1:production:sequence-{name}")


@pytest.mark.django_db
class TestSequenceCRUD:
    def test_create_auto_assigns_organization(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            _list_url(),
            data={"project": str(project.id), "code": "SQ001", "name": "Sq One"},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        seq = Sequence.objects.get(code="SQ001")
        assert seq.organization_id == org.id
        assert seq.project_id == project.id

    def test_create_without_org_context_fails_closed(self, staff_client):
        resp = staff_client.post(
            _list_url(),
            data={"code": "SQX99", "name": "No Org"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert not Sequence.objects.filter(code="SQX99").exists()

    def test_list_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        SequenceFactory.create(organization=org_a, code="SQA01")
        SequenceFactory.create(organization=org_b, code="SQB01")
        resp = staff_client.get(_list_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id))
        assert resp.status_code == status.HTTP_200_OK
        codes = {s["code"] for s in resp.data["results"]}
        assert "SQA01" in codes
        assert "SQB01" not in codes

    def test_detail_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org_a, code="SQC01")
        resp = staff_client.get(
            _detail_url(seq),
            HTTP_X_ORGANIZATION_ID=str(org_b.id),
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_destroy_soft_deletes(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="SQD01")
        resp = staff_client.delete(
            _detail_url(seq),
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        seq.refresh_from_db()
        assert seq.is_deleted is True

    def test_restore_restores_soft_deleted(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="SQE01")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        seq.refresh_from_db()
        assert seq.is_deleted is True
        resp = staff_client.post(
            reverse("api:v1:production:sequence-restore", args=[seq.id]),
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        seq.refresh_from_db()
        assert seq.is_deleted is False


@pytest.mark.django_db
class TestSequenceExistenceCheck:
    def test_classifies_new(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(project.id), "code": "NEW01"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"][0]["status"] == "new"

    def test_classifies_exists(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="EX01")
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(seq.project_id), "code": "EX01"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "exists"
        assert resp.data["results"][0]["id"] == str(seq.id)

    def test_classifies_soft_deleted(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="SD01")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(seq.project_id), "code": "SD01"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "soft_deleted"
        assert resp.data["results"][0]["id"] == str(seq.id)

    def test_classifies_duplicate_within_batch(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={
                "items": [
                    {"project_id": str(project.id), "code": "DUP01"},
                    {"project_id": str(project.id), "code": "dup01"},
                ]
            },
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        statuses = [r["status"] for r in resp.data["results"]]
        assert statuses == ["new", "duplicate"]

    def test_classifies_cross_org_project_as_invalid(self, staff_client):
        org = OrganizationFactory.create()
        other_org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=other_org)
        resp = staff_client.post(
            _action_url("existence-check"),
            data={"items": [{"project_id": str(project.id), "code": "INV01"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "invalid"


@pytest.mark.django_db
class TestSequenceBulkCreate:
    def test_creates_valid_rows(self, staff_client):
        org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=org)
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={
                "items": [
                    {"project_id": str(project.id), "code": "BC01", "name": "A"},
                    {"project_id": str(project.id), "code": "BC02", "name": "B"},
                ]
            },
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["processed"] == 2
        assert resp.data["successful"] == 2
        assert resp.data["failed"] == 0
        assert Sequence.objects.filter(organization=org).count() == 2

    def test_reports_existing_and_duplicate(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="BEX01")
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
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["processed"] == 3
        assert resp.data["successful"] == 1
        assert resp.data["failed"] == 2
        statuses = {r["status"] for r in resp.data["results"]}
        assert statuses == {"exists", "created", "duplicate"}

    def test_reports_soft_deleted_and_does_not_create(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="BSD01")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={"items": [{"project_id": str(seq.project_id), "code": "BSD01"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "soft_deleted"
        assert resp.data["failed"] == 1
        assert Sequence.all_objects.filter(organization=org).count() == 1

    def test_rejects_cross_org_project(self, staff_client):
        org = OrganizationFactory.create()
        other_org = OrganizationFactory.create()
        project = ProjectFactory.create(organization=other_org)
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={"items": [{"project_id": str(project.id), "code": "BX01"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "invalid"
        assert not Sequence.objects.filter(code="BX01").exists()


@pytest.mark.django_db
class TestSequenceBulkUpdateArchiveRestore:
    def test_bulk_update(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="BU01", name="Old")
        resp = staff_client.patch(
            _action_url("bulk-update"),
            data={"items": [{"id": str(seq.id), "name": "New"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "updated"
        seq.refresh_from_db()
        assert seq.name == "New"

    def test_bulk_update_cannot_touch_other_org(self, staff_client):
        org = OrganizationFactory.create()
        other_org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=other_org, code="BU02")
        resp = staff_client.patch(
            _action_url("bulk-update"),
            data={"items": [{"id": str(seq.id), "name": "Nope"}]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "not_found"
        seq.refresh_from_db()
        assert seq.name != "Nope"

    def test_bulk_archive_soft_deletes(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="BAR01")
        resp = staff_client.post(
            _action_url("bulk-archive"),
            data={"ids": [str(seq.id)]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "archived"
        seq.refresh_from_db()
        assert seq.is_deleted is True

    def test_bulk_archive_cannot_touch_other_org(self, staff_client):
        org = OrganizationFactory.create()
        other_org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=other_org, code="BAR02")
        resp = staff_client.post(
            _action_url("bulk-archive"),
            data={"ids": [str(seq.id)]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "not_found"
        seq.refresh_from_db()
        assert seq.is_deleted is False

    def test_bulk_restore_restores(self, staff_client):
        org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=org, code="BR01")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        seq.refresh_from_db()
        assert seq.is_deleted is True
        resp = staff_client.post(
            _action_url("bulk-restore"),
            data={"ids": [str(seq.id)]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "restored"
        seq.refresh_from_db()
        assert seq.is_deleted is False

    def test_bulk_restore_cannot_touch_other_org(self, staff_client):
        org = OrganizationFactory.create()
        other_org = OrganizationFactory.create()
        seq = SequenceFactory.create(organization=other_org, code="BR02")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(seq)
        resp = staff_client.post(
            _action_url("bulk-restore"),
            data={"ids": [str(seq.id)]},
            HTTP_X_ORGANIZATION_ID=str(org.id),
            format="json",
        )
        assert resp.data["results"][0]["status"] == "not_found"
        seq.refresh_from_db()
        assert seq.is_deleted is True

    def test_bulk_operations_without_org_context_fail_closed(self, staff_client):
        resp = staff_client.post(
            _action_url("bulk-create"),
            data={"items": [{"project_id": str(uuid.uuid4()), "code": "X1"}]},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_archived_lists_only_soft_deleted_scoped_to_org(self, staff_client):
        org = OrganizationFactory.create()
        other_org = OrganizationFactory.create()
        active = SequenceFactory.create(organization=org, code="ACT01")
        archived = SequenceFactory.create(organization=org, code="ARC01")
        other = SequenceFactory.create(organization=other_org, code="OTH01")
        from apps.core.services.soft_delete import SoftDeleteService

        SoftDeleteService.delete(archived)
        archived.refresh_from_db()
        assert archived.is_deleted is True

        resp = staff_client.get(
            reverse("api:v1:production:sequence-archived"),
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert resp.status_code == status.HTTP_200_OK
        codes = [item["code"] for item in resp.data["results"]]
        assert "ARC01" in codes
        assert "ACT01" not in codes
        assert "OTH01" not in codes
