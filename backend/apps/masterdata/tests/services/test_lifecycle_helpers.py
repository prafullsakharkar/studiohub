"""Generic dependants check reused by every masterdata service (DOM-MD-COM-08)."""

from __future__ import annotations

import pytest

from apps.core.api.exceptions.api import ConflictException
from apps.masterdata.models import Department, Team
from apps.masterdata.services.lifecycle import live_dependants, refuse_dependants

pytestmark = pytest.mark.django_db


def _department_with_team():
    department = Department.objects.create(name="Comp", code="COMP", department_type="creative")
    team = Team.objects.create(name="Nuke", code="NUKE", department=department)
    return department, team


def test_no_dependants_means_empty_result():
    department = Department.objects.create(name="Comp", code="COMP", department_type="creative")
    assert live_dependants(department) == {}
    refuse_dependants(department)


def test_a_live_dependant_is_reported_and_refused():
    department, _ = _department_with_team()
    assert live_dependants(department) == {"masterdata.Team.department": 1}
    with pytest.raises(ConflictException) as caught:
        refuse_dependants(department)
    assert caught.value.get_codes() == "has_dependants"
    assert "masterdata.Team.department" in str(caught.value.detail)


def test_soft_deleted_dependants_do_not_block_a_soft_delete_but_do_block_a_hard_delete():
    department, team = _department_with_team()
    team.delete()
    assert live_dependants(department) == {}
    assert live_dependants(department, include_deleted=True) == {"masterdata.Team.department": 1}
    with pytest.raises(ConflictException):
        refuse_dependants(department, include_deleted=True)
