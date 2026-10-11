"""Position list shape carries UI display names."""

import pytest

from apps.organization.api.serializers.position import PositionListSerializer
from apps.organization.tests.factories import DepartmentFactory, PositionFactory


@pytest.mark.django_db
def test_position_list_exposes_title_and_department_name():
    dept = DepartmentFactory.create(name="Animation", code="ANIM")
    pos = PositionFactory.create(name="Creature Lead", department=dept, level=4)

    data = PositionListSerializer(instance=pos).data

    assert data["title"] == "Creature Lead"
    assert data["department_name"] == "Animation"


@pytest.mark.django_db
def test_position_list_exposes_band_comp_and_headcount():
    from apps.organization.api.serializers.position import PositionListSerializer
    from apps.organization.tests.factories import PersonFactory, PositionFactory

    pos = PositionFactory.create(
        name="Comp Lead",
        band_level="L5 - Lead Artist",
        salary_range="$130,000 - $160,000",
        employment_type="Full-Time Staff",
    )
    PersonFactory.create(role=pos)
    PersonFactory.create(role=pos)

    data = PositionListSerializer(instance=pos).data

    assert data["band_level"] == "L5 - Lead Artist"
    assert data["salary_range"] == "$130,000 - $160,000"
    assert data["employment_type"] == "Full-Time Staff"
    assert data["headcount"] == 2
