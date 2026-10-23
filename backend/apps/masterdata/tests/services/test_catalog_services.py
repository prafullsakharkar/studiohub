"""Catalog service rules (CONTRACTS §3): success, failure, rollback, audit events."""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.api.exceptions.api import ConflictException
from apps.identity.tests.factories import UserFactory
from apps.masterdata.models import CatalogStatus, MasterFileType, MasterStatus, MasterTaskType
from apps.masterdata.services.catalog import (
    MasterAssetTypeService,
    MasterFileTypeService,
    MasterShotTypeService,
    MasterStatusService,
    MasterTaskTypeService,
)
from apps.masterdata.tests.factories import MasterStatusFactory, MasterTaskTypeFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor():
    return UserFactory.create()


def _errors(exc: ValidationError) -> dict[str, list[str]]:
    return exc.message_dict


class TestCreate:
    def test_creates_with_normalized_fields_and_actor(self, actor):
        row = MasterTaskTypeService.create(
            actor=actor, data={"code": "  anim  ", "name": " Animation ", "color": "#ff0000"}
        )
        assert (row.code, row.name, row.color) == ("anim", "Animation", "#ff0000")
        assert row.created_by == actor and row.updated_by == actor
        assert row.status == CatalogStatus.ACTIVE and row.is_system is False

    def test_system_flag_only_through_the_system_argument(self, actor):
        row = MasterTaskTypeService.create(
            actor=actor, data={"code": "x", "name": "X"}, system=True
        )
        assert row.is_system is True

    def test_is_system_in_data_is_refused(self, actor):
        with pytest.raises(ValueError):
            MasterTaskTypeService.create(
                actor=actor, data={"code": "x", "name": "X", "is_system": True}
            )

    def test_anonymous_actor_leaves_audit_fields_empty(self):
        row = MasterTaskTypeService.create(actor=None, data={"code": "x", "name": "X"})
        assert row.created_by is None

    @pytest.mark.parametrize(
        ("data", "field"),
        [
            ({"code": "", "name": "X"}, "code"),
            ({"code": "x", "name": "   "}, "name"),
            ({"code": "x" * 101, "name": "X"}, "code"),
            ({"code": "x", "name": "X", "scope": "ORGANIZATION"}, "scope"),
            ({"code": "x", "name": "X", "metadata": ["not", "an", "object"]}, "metadata"),
            ({"code": "x", "name": "X", "color": "<script>"}, "color"),
            ({"code": "x", "name": "X", "sort_order": -1}, "sort_order"),
        ],
    )
    def test_invalid_input_is_rejected_before_any_write(self, actor, data, field):
        with pytest.raises(ValidationError) as caught:
            MasterTaskTypeService.create(actor=actor, data=data)
        assert field in _errors(caught.value)
        assert MasterTaskType.objects.count() == 0

    def test_duplicate_code_or_name_is_a_validation_error_not_a_crash(self, actor):
        MasterTaskTypeFactory(code="anim", name="Animation")
        with pytest.raises(ValidationError) as caught:
            MasterTaskTypeService.create(actor=actor, data={"code": "ANIM", "name": "animation"})
        assert set(_errors(caught.value)) == {"code", "name"}

    def test_a_soft_deleted_code_can_be_created_again(self, actor):
        MasterTaskTypeFactory(code="anim", name="Animation").delete()
        row = MasterTaskTypeService.create(actor=actor, data={"code": "anim", "name": "Animation"})
        assert row.is_deleted is False


class TestFileTypes:
    def test_code_is_derived_from_the_extension(self, actor):
        row = MasterFileTypeService.create(
            actor=actor, data={"name": "OpenEXR", "extension": ".EXR"}
        )
        assert (row.code, row.extension) == ("exr", "exr")

    def test_many_file_types_can_be_created_without_a_code(self, actor):
        """AUDIT P13: the second code-less create used to fail with 409."""
        for ext in ("exr", "dpx", "tif"):
            MasterFileTypeService.create(actor=actor, data={"name": ext.upper(), "extension": ext})
        assert MasterFileType.objects.count() == 3

    def test_duplicate_extension_is_rejected(self, actor):
        MasterFileTypeService.create(actor=actor, data={"name": "EXR", "extension": "exr"})
        with pytest.raises(ValidationError) as caught:
            MasterFileTypeService.create(
                actor=actor, data={"name": "EXR 2", "code": "exr2", "extension": "EXR"}
            )
        assert "extension" in _errors(caught.value)

    def test_no_code_and_no_extension_is_an_error(self, actor):
        with pytest.raises(ValidationError) as caught:
            MasterFileTypeService.create(actor=actor, data={"name": "Mystery"})
        assert "code" in _errors(caught.value)


class TestStatuses:
    def test_entity_type_is_required_and_must_be_known(self, actor):
        with pytest.raises(ValidationError) as caught:
            MasterStatusService.create(actor=actor, data={"code": "x", "name": "X"})
        assert "entity_type" in _errors(caught.value)
        with pytest.raises(ValidationError) as caught:
            MasterStatusService.create(
                actor=actor, data={"code": "x", "name": "X", "entity_type": "Banana"}
            )
        assert "entity_type" in _errors(caught.value)

    def test_category_must_be_known_or_blank(self, actor):
        with pytest.raises(ValidationError):
            MasterStatusService.create(
                actor=actor,
                data={"code": "x", "name": "X", "entity_type": "Task", "category": "nope"},
            )

    def test_same_code_for_two_entity_types(self, actor):
        for entity in ("Task", "Shot"):
            MasterStatusService.create(
                actor=actor,
                data={"code": "in_progress", "name": "In progress", "entity_type": entity},
            )
        assert MasterStatus.objects.filter(code="in_progress").count() == 2

    def test_new_default_clears_the_old_one(self, actor):
        first = MasterStatusService.create(
            actor=actor, data={"code": "a", "name": "A", "entity_type": "Task", "is_default": True}
        )
        second = MasterStatusService.create(
            actor=actor, data={"code": "b", "name": "B", "entity_type": "Task", "is_default": True}
        )
        first.refresh_from_db()
        assert first.is_default is False and second.is_default is True

    def test_defaults_are_per_entity_type(self, actor):
        MasterStatusService.create(
            actor=actor, data={"code": "a", "name": "A", "entity_type": "Task", "is_default": True}
        )
        shot = MasterStatusService.create(
            actor=actor, data={"code": "a", "name": "A", "entity_type": "Shot", "is_default": True}
        )
        assert MasterStatus.objects.filter(is_default=True).count() == 2 and shot.is_default

    def test_moving_a_status_rechecks_uniqueness_in_the_new_entity_type(self, actor):
        MasterStatusFactory(code="done", name="Done", entity_type="Shot")
        row = MasterStatusFactory(code="done", name="Done", entity_type="Task")
        with pytest.raises(ValidationError):
            MasterStatusService.update(actor=actor, instance=row, data={"entity_type": "Shot"})

    def test_a_new_default_also_clears_an_archived_old_default(self, actor):
        old = MasterStatusFactory(entity_type="Asset", is_default=True)
        MasterStatusService.archive(actor=actor, instance=old)
        MasterStatusService.create(
            actor=actor, data={"code": "n", "name": "N", "entity_type": "Asset", "is_default": True}
        )
        restored = MasterStatusService.restore(actor=actor, instance=old)
        assert restored.status == CatalogStatus.ACTIVE and restored.is_default is False

    def test_restore_refuses_to_create_a_second_active_default(self, actor):
        """The service never leaves this state, but raw writes can; restore must not worsen it."""
        old = MasterStatusFactory(entity_type="Asset", is_default=True, status="archived")
        MasterStatusFactory(
            entity_type="Asset", is_default=True
        )  # allowed: the old one is archived
        with pytest.raises(ConflictException) as caught:
            MasterStatusService.restore(actor=actor, instance=old)
        assert caught.value.get_codes() == "conflict"


class TestUpdate:
    def test_changes_only_what_was_sent(self, actor):
        row = MasterTaskTypeFactory(code="anim", name="Animation", description="keep")
        MasterTaskTypeService.update(
            actor=actor, instance=row, data={"name": "Character Animation"}
        )
        row.refresh_from_db()
        assert (row.name, row.code, row.description) == ("Character Animation", "anim", "keep")
        assert row.updated_by == actor

    def test_renaming_to_an_existing_name_is_refused(self, actor):
        MasterTaskTypeFactory(name="Layout")
        row = MasterTaskTypeFactory(name="Animation")
        with pytest.raises(ValidationError) as caught:
            MasterTaskTypeService.update(actor=actor, instance=row, data={"name": "layout"})
        assert "name" in _errors(caught.value)

    def test_saving_a_row_unchanged_is_not_a_duplicate_of_itself(self, actor):
        row = MasterTaskTypeFactory(code="anim", name="Animation")
        MasterTaskTypeService.update(
            actor=actor, instance=row, data={"code": "anim", "name": "Animation"}
        )

    def test_system_row_code_is_immutable_but_name_is_editable(self, actor):
        row = MasterTaskTypeService.create(
            actor=actor, data={"code": "anim", "name": "Animation"}, system=True
        )
        with pytest.raises(ConflictException) as caught:
            MasterTaskTypeService.update(actor=actor, instance=row, data={"code": "other"})
        assert caught.value.get_codes() == "system_row_protected"
        MasterTaskTypeService.update(actor=actor, instance=row, data={"name": "Animation (studio)"})


class TestLifecycle:
    def test_archive_and_restore(self, actor):
        row = MasterTaskTypeFactory()
        assert (
            MasterTaskTypeService.archive(actor=actor, instance=row).status
            == CatalogStatus.ARCHIVED
        )
        assert (
            MasterTaskTypeService.restore(actor=actor, instance=row).status == CatalogStatus.ACTIVE
        )

    def test_archive_and_restore_are_idempotent(self, actor):
        row = MasterTaskTypeFactory()
        MasterTaskTypeService.restore(actor=actor, instance=row)
        MasterTaskTypeService.archive(actor=actor, instance=row)
        MasterTaskTypeService.archive(actor=actor, instance=row)

    def test_system_rows_cannot_be_archived_or_deleted(self, actor):
        row = MasterTaskTypeService.create(
            actor=actor, data={"code": "s", "name": "S"}, system=True
        )
        for operation in (
            MasterTaskTypeService.archive,
            MasterTaskTypeService.soft_delete,
        ):
            with pytest.raises(ConflictException) as caught:
                operation(actor=actor, instance=row)
            assert caught.value.get_codes() == "system_row_protected"

    def test_soft_delete_hides_the_row_and_restore_brings_it_back(self, actor):
        row = MasterTaskTypeFactory()
        MasterTaskTypeService.soft_delete(actor=actor, instance=row)
        assert not MasterTaskType.objects.filter(pk=row.pk).exists()
        deleted = MasterTaskType.all_objects.get(pk=row.pk)
        assert deleted.is_deleted and deleted.deleted_by == actor
        MasterTaskTypeService.restore(actor=actor, instance=deleted)
        assert MasterTaskType.objects.filter(pk=row.pk).exists()

    def test_restore_is_refused_when_a_live_row_took_the_code(self, actor):
        old = MasterTaskTypeFactory(code="anim", name="Animation")
        MasterTaskTypeService.soft_delete(actor=actor, instance=old)
        MasterTaskTypeService.create(actor=actor, data={"code": "anim", "name": "Animation"})
        with pytest.raises(ValidationError):
            MasterTaskTypeService.restore(
                actor=actor, instance=MasterTaskType.all_objects.get(pk=old.pk)
            )

    def test_hard_delete_needs_a_soft_deleted_row(self, actor):
        row = MasterTaskTypeFactory()
        with pytest.raises(ConflictException) as caught:
            MasterTaskTypeService.hard_delete(actor=actor, instance=row)
        assert caught.value.get_codes() == "not_soft_deleted"
        assert MasterTaskType.objects.filter(pk=row.pk).exists()

    def test_hard_delete_removes_a_soft_deleted_row(self, actor):
        row = MasterTaskTypeFactory()
        MasterTaskTypeService.soft_delete(actor=actor, instance=row)
        MasterTaskTypeService.hard_delete(
            actor=actor, instance=MasterTaskType.all_objects.get(pk=row.pk)
        )
        assert not MasterTaskType.all_objects.filter(pk=row.pk).exists()


class TestReorder:
    def test_rewrites_sort_order_by_position(self, actor):
        a, b, c = (MasterTaskTypeFactory() for _ in range(3))
        rows = MasterTaskTypeService.reorder(actor=actor, ordered_ids=[c.pk, a.pk, b.pk])
        assert [r.pk for r in rows] == [c.pk, a.pk, b.pk]
        assert list(MasterTaskType.objects.order_by("sort_order").values_list("pk", flat=True)) == [
            c.pk,
            a.pk,
            b.pk,
        ]

    def test_statuses_reorder_the_order_column(self, actor):
        a, b = MasterStatusFactory(), MasterStatusFactory()
        MasterStatusService.reorder(actor=actor, ordered_ids=[b.pk, a.pk])
        b.refresh_from_db(), a.refresh_from_db()
        assert (b.order, a.order) == (10, 20)

    def test_unknown_id_changes_nothing(self, actor):
        a, b = MasterTaskTypeFactory(sort_order=7), MasterTaskTypeFactory(sort_order=9)
        with pytest.raises(ValidationError):
            MasterTaskTypeService.reorder(
                actor=actor, ordered_ids=[b.pk, "00000000-0000-0000-0000-000000000000", a.pk]
            )
        a.refresh_from_db(), b.refresh_from_db()
        assert (a.sort_order, b.sort_order) == (7, 9)

    def test_duplicate_ids_are_refused(self, actor):
        a = MasterTaskTypeFactory()
        with pytest.raises(ValidationError):
            MasterTaskTypeService.reorder(actor=actor, ordered_ids=[a.pk, a.pk])

    def test_deleted_rows_cannot_be_reordered(self, actor):
        a = MasterTaskTypeFactory()
        a.delete()
        with pytest.raises(ValidationError):
            MasterTaskTypeService.reorder(actor=actor, ordered_ids=[a.pk])


class TestAuditEvents:
    def _logs(self):
        return list(AuditLog.objects.filter(target_type="masterdata").order_by("created_at"))

    def test_every_operation_writes_one_audit_row(self, actor, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            row = MasterShotTypeService.create(actor=actor, data={"code": "cu", "name": "Close up"})
            MasterShotTypeService.update(actor=actor, instance=row, data={"name": "Close-up"})
            MasterShotTypeService.archive(actor=actor, instance=row)
            MasterShotTypeService.restore(actor=actor, instance=row)
            MasterShotTypeService.soft_delete(actor=actor, instance=row)
            MasterShotTypeService.hard_delete(
                actor=actor, instance=MasterShotTypeService.model.all_objects.get(pk=row.pk)
            )
        kinds = [log.metadata["event"] for log in self._logs()]
        assert kinds == [
            "MasterdataRecordCreated",
            "MasterdataRecordUpdated",
            "MasterdataRecordArchived",
            "MasterdataRecordRestored",
            "MasterdataRecordDeleted",
            "MasterdataRecordHardDeleted",
        ]
        assert all(str(log.actor_id) == str(actor.pk) for log in self._logs())

    def test_update_records_field_names_not_values(self, actor, django_capture_on_commit_callbacks):
        row = MasterAssetTypeService.create(actor=actor, data={"code": "prop", "name": "Prop"})
        with django_capture_on_commit_callbacks(execute=True):
            MasterAssetTypeService.update(
                actor=actor, instance=row, data={"description": "secret-ish text"}
            )
        log = self._logs()[-1]
        assert log.metadata["changed"] == ["description"]
        assert "secret-ish text" not in str(log.metadata) + log.description

    def test_nothing_is_audited_when_the_transaction_rolls_back(
        self, actor, django_capture_on_commit_callbacks
    ):
        a = MasterTaskTypeFactory()
        with django_capture_on_commit_callbacks(execute=True), pytest.raises(ValidationError):
            MasterTaskTypeService.reorder(
                actor=actor, ordered_ids=[a.pk, "00000000-0000-0000-0000-000000000000"]
            )
        assert self._logs() == []

    def test_a_failing_audit_handler_does_not_fail_the_write(
        self, actor, monkeypatch, django_capture_on_commit_callbacks
    ):
        def boom(*args, **kwargs):
            raise RuntimeError("audit down")

        monkeypatch.setattr(AuditLog.objects, "create", boom)
        with django_capture_on_commit_callbacks(execute=True):
            row = MasterShotTypeService.create(actor=actor, data={"code": "ms", "name": "Medium"})
        assert MasterShotTypeService.model.objects.filter(pk=row.pk).exists()
