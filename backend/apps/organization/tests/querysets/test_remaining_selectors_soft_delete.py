"""Remaining entity selectors exclude soft-deleted rows (parity fix)."""

from __future__ import annotations

import pytest

from apps.organization.models import Office, Position, Team
from apps.organization.selectors.office import OfficeSelector
from apps.organization.selectors.position import PositionSelector
from apps.organization.selectors.team import TeamSelector
from apps.organization.tests.factories import (
    DepartmentFactory,
    OfficeFactory,
    OrganizationFactory,
    PositionFactory,
    TeamFactory,
)


@pytest.mark.django_db
def test_team_selector_excludes_soft_deleted():
    team = TeamFactory.create()
    Team.objects.filter(pk=team.pk).update(is_deleted=True)
    assert not TeamSelector.get_queryset().filter(pk=team.pk).exists()


@pytest.mark.django_db
def test_office_selector_excludes_soft_deleted():
    office = OfficeFactory.create()
    Office.objects.filter(pk=office.pk).update(is_deleted=True)
    assert not OfficeSelector.get_queryset().filter(pk=office.pk).exists()


@pytest.mark.django_db
def test_position_selector_excludes_soft_deleted():
    position = PositionFactory.create()
    Position.objects.filter(pk=position.pk).update(is_deleted=True)
    assert not PositionSelector.get_queryset().filter(pk=position.pk).exists()

