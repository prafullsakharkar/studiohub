# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""Server-made codes, unique in any case, and the links a delivery keeps (DLV-12, DLV-13)."""

from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.deliveries.models import DeliveryCounter, DeliveryPackage
from apps.deliveries.services.numbering import allocate_code, code_in_use
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import make_package
from apps.masterdata.models import Client
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db


def _create(**data):
    return DeliveryService.create(actor=None, data={"name": "Turnover", **data})


@pytest.fixture
def project():
    return ProjectFactory.create(code="NUMD")


class TestCodes:
    def test_a_blank_code_is_numbered_from_the_project(self, project):
        first = _create(project_id=project.pk)
        second = _create(project_id=project.pk, code="")

        assert (first.code, second.code) == ("DLV-NUMD-0001", "DLV-NUMD-0002")
        assert DeliveryCounter.objects.get(project_id=project.pk).last_number == 2

    def test_projects_count_separately(self, project):
        other = ProjectFactory.create(code="NUME")

        assert _create(project_id=project.pk).code == "DLV-NUMD-0001"
        assert _create(project_id=other.pk).code == "DLV-NUME-0001"

    def test_a_blank_code_without_a_project_is_refused(self):
        with pytest.raises(ValidationError) as error:
            _create()
        assert "code" in error.value.detail

    def test_a_code_that_is_sent_is_kept(self, project):
        assert _create(code="MY-CODE-1", project_id=project.pk).code == "MY-CODE-1"
        assert DeliveryCounter.objects.count() == 0

    @pytest.mark.parametrize("again", ["MY-CODE-1", "my-code-1", "My-Code-1"])
    def test_a_used_code_is_refused_in_any_case(self, again):
        _create(code="MY-CODE-1")

        with pytest.raises(ValidationError) as error:
            _create(code=again)
        assert "code" in error.value.detail

    def test_a_soft_deleted_deliverys_code_stays_taken(self):
        gone = _create(code="GONE-1")
        gone.is_deleted = True
        gone.save()

        assert code_in_use("gone-1")
        with pytest.raises(ValidationError):
            _create(code="gone-1")

    def test_a_number_whose_code_is_taken_is_skipped(self, project):
        _create(code="dlv-numd-0001")  # hand-typed, same shape as the first server code

        assert allocate_code(project) == "DLV-NUMD-0002"

    def test_the_database_refuses_a_duplicate_in_any_case(self):
        _create(code="DUP-1")

        with pytest.raises(IntegrityError), transaction.atomic():
            DeliveryPackage.objects.create(name="x", code="dup-1")


class TestLinks:
    def test_an_unknown_project_is_a_400_not_a_500(self):
        for value in ("00000000-0000-0000-0000-000000000000", "NOPE"):
            with pytest.raises(ValidationError) as error:
                _create(code="X-1", project_id=value)
            assert error.value.detail == {"project_id": ["Unknown project."]}

    def test_an_unknown_client_is_a_400(self):
        with pytest.raises(ValidationError) as error:
            _create(code="X-2", client_id="00000000-0000-0000-0000-000000000000")
        assert error.value.detail == {"client_id": ["Unknown client."]}

    def test_a_delivery_keeps_its_project_and_client(self, project):
        client = Client.objects.create(code="ACME", name="Acme Pictures")

        package = _create(project_id=project.pk, client_id=client.pk)

        assert (package.project_id, package.client_id) == (project.pk, client.pk)

    def test_the_project_and_the_client_cannot_be_deleted_for_good_while_deliveries_use_them(
        self, project
    ):
        client = Client.objects.create(code="ACME2", name="Acme Two")
        _create(project_id=project.pk, client_id=client.pk)

        with pytest.raises(ProtectedError):
            type(project).all_objects.filter(pk=project.pk).delete()
        with pytest.raises(ProtectedError):
            Client.all_objects.filter(pk=client.pk).delete()

    def test_creation_is_audited_under_the_delivery_target(self, project):
        package = _create(project_id=project.pk)

        row = AuditLog.objects.get(target_id=str(package.pk))
        assert row.target_type == "delivery" and row.action == "create"


class TestEditing:
    def test_details_change_before_the_send(self):
        package = make_package()

        updated = DeliveryService.update(
            actor=None,
            package=package,
            data={"name": "Renamed", "notes": "n", "delivery_method": "FTP"},
        )

        assert (updated.name, updated.notes, updated.delivery_method) == ("Renamed", "n", "FTP")

    def test_nothing_changes_after_it(self):
        from apps.deliveries.exceptions import DeliveryNotEditable

        package = make_package()
        type(package).objects.filter(pk=package.pk).update(status="Submitted")

        with pytest.raises(DeliveryNotEditable):
            DeliveryService.update(actor=None, package=package, data={"name": "x"})

    def test_an_edit_is_audited_by_field_name_only(self):
        package = make_package()
        DeliveryService.update(actor=None, package=package, data={"notes": "Confidential note"})

        row = AuditLog.objects.filter(target_id=str(package.pk)).latest("created_at")
        assert row.metadata["fields"] == ["notes"]
        assert "Confidential" not in f"{row.description} {row.metadata}"

    def test_an_edit_that_changes_nothing_writes_nothing(self):
        package = make_package()
        before = AuditLog.objects.count()

        DeliveryService.update(actor=None, package=package, data={"name": package.name})

        assert AuditLog.objects.count() == before
