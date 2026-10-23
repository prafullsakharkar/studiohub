"""``init_platform`` seeds the system statuses through the service (D10)."""

from __future__ import annotations

import pytest
from django.core.management import call_command

from apps.core.management.commands.init_platform import STATUS_SPECS
from apps.masterdata.models import MasterStatus

pytestmark = pytest.mark.django_db


def test_seeded_statuses_are_system_rows_and_one_default_per_entity_type():
    call_command("init_platform")

    rows = MasterStatus.objects.all()
    assert rows.count() == len(STATUS_SPECS)
    assert all(r.is_system for r in rows)
    defaults = [r for r in rows if r.is_default]
    assert [(r.entity_type, r.code) for r in defaults] == [("Task", "done")]


def test_running_twice_creates_nothing_new():
    call_command("init_platform")
    first = set(MasterStatus.all_objects.values_list("pk", flat=True))
    call_command("init_platform")
    assert set(MasterStatus.all_objects.values_list("pk", flat=True)) == first


def test_an_existing_row_is_flagged_not_overwritten_or_duplicated():
    existing = MasterStatus.objects.create(code="DONE", name="Our own wording", entity_type="Task")

    call_command("init_platform")

    existing.refresh_from_db()
    assert existing.name == "Our own wording"
    assert existing.is_system is True
    assert MasterStatus.all_objects.filter(entity_type="Task", code__iexact="done").count() == 1


def test_a_soft_deleted_system_status_is_not_resurrected_or_duplicated():
    call_command("init_platform")
    todo = MasterStatus.all_objects.get(entity_type="Task", code="todo")
    todo.is_system = False
    todo.save(update_fields=["is_system"])
    todo.delete()
    before = MasterStatus.all_objects.count()

    call_command("init_platform")

    assert MasterStatus.all_objects.count() == before
    assert MasterStatus.objects.filter(entity_type="Task", code="todo").count() == 0
