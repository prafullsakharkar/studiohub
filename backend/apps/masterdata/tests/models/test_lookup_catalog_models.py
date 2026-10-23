"""DB-level rules of the managed lookup catalogs (DOM-MD-COM-04/05, DOM-MD-STS-01/04)."""

from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction

from apps.masterdata.models import (
    CatalogStatus,
    MasterAssetType,
    MasterStatus,
    MasterTaskType,
    Software,
)
from apps.masterdata.tests.factories import (
    MasterAssetTypeFactory,
    MasterFileTypeFactory,
    MasterReviewTypeFactory,
    MasterShotTypeFactory,
    MasterStatusFactory,
    MasterTaskTypeFactory,
)

pytestmark = pytest.mark.django_db

SIMPLE = [
    MasterTaskTypeFactory,
    MasterAssetTypeFactory,
    MasterShotTypeFactory,
    MasterReviewTypeFactory,
    MasterFileTypeFactory,
]


@pytest.mark.parametrize("factory_cls", SIMPLE)
class TestSimpleCatalogConstraints:
    def test_code_is_unique_case_insensitively(self, factory_cls):
        factory_cls(code="Anim", name="One")
        with pytest.raises(IntegrityError), transaction.atomic():
            factory_cls(code="ANIM", name="Two")

    def test_name_is_unique_case_insensitively(self, factory_cls):
        factory_cls(code="a1", name="Layout")
        with pytest.raises(IntegrityError), transaction.atomic():
            factory_cls(code="a2", name="LAYOUT")

    def test_soft_deleted_row_does_not_block_its_code(self, factory_cls):
        first = factory_cls(code="reuse", name="Reuse")
        first.delete()
        again = factory_cls(code="reuse", name="Reuse")
        assert again.pk != first.pk

    def test_status_outside_the_enum_is_rejected_by_the_database(self, factory_cls):
        with pytest.raises(IntegrityError), transaction.atomic():
            factory_cls(status="banana")

    def test_defaults(self, factory_cls):
        row = factory_cls()
        assert row.status == CatalogStatus.ACTIVE
        assert row.is_system is False
        assert row.sort_order == 0


class TestStatusConstraints:
    def test_same_code_may_exist_for_two_entity_types(self):
        MasterStatusFactory(code="in_progress", name="In progress", entity_type="Task")
        MasterStatusFactory(code="in_progress", name="In progress", entity_type="Shot")
        assert MasterStatus.objects.filter(code="in_progress").count() == 2

    def test_code_is_unique_within_an_entity_type_case_insensitively(self):
        MasterStatusFactory(code="wip", name="One", entity_type="Shot")
        with pytest.raises(IntegrityError), transaction.atomic():
            MasterStatusFactory(code="WIP", name="Two", entity_type="Shot")

    def test_one_default_per_entity_type(self):
        MasterStatusFactory(entity_type="Asset", is_default=True)
        with pytest.raises(IntegrityError), transaction.atomic():
            MasterStatusFactory(entity_type="Asset", is_default=True)
        MasterStatusFactory(entity_type="Shot", is_default=True)  # other type is fine

    def test_archived_default_does_not_count(self):
        MasterStatusFactory(entity_type="Asset", is_default=True, status="archived")
        MasterStatusFactory(entity_type="Asset", is_default=True)

    def test_statuses_have_no_sort_order_column(self):
        assert "sort_order" not in {f.name for f in MasterStatus._meta.get_fields()}
        assert "order" in {f.name for f in MasterStatus._meta.get_fields()}


class TestScopeOfTheChange:
    def test_software_still_uses_the_legacy_global_code_rule(self):
        """Software moves to the lookup base in Phase 4; it must be unchanged now."""
        Software.objects.create(name="Maya", code="MAYA")
        with pytest.raises(IntegrityError), transaction.atomic():
            Software.objects.create(name="Maya 2", code="MAYA")

    def test_models_carry_no_organization_field(self):
        for model in (MasterStatus, MasterTaskType, MasterAssetType):
            assert "organization" not in {f.name for f in model._meta.get_fields()}


class TestNoOrganizationLeftovers:
    """DB-level proof that the organization dimension is gone from masterdata (Phase 7)."""

    def test_no_masterdata_table_or_column_mentions_organizations_or_scope(self):
        from django.db import connection

        with connection.cursor() as cursor:
            tables = [
                t for t in connection.introspection.table_names() if t.startswith("masterdata_")
            ]
            found = {}
            for table in tables:
                names = {
                    c.name for c in connection.introspection.get_table_description(cursor, table)
                }
                bad = {n for n in names if "organization" in n or n in ("org_id", "scope")}
                if bad:
                    found[table] = bad
        assert not [t for t in tables if "org" in t.removeprefix("masterdata_")], tables
        assert not found, found

    def test_the_scope_enum_has_only_global(self):
        from apps.masterdata.models import MasterDataScope

        assert list(MasterDataScope.values) == ["GLOBAL"]

    def test_the_models_still_report_a_constant_global_scope(self):
        from apps.masterdata.tests.factories import SoftwareFactory

        row = SoftwareFactory()
        assert row.scope == "GLOBAL"
        with pytest.raises(AttributeError):
            row.scope = "ORGANIZATION"  # pyright: ignore[reportAttributeAccessIssue]
