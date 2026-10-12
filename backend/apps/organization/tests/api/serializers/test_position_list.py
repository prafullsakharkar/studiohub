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


@pytest.mark.django_db
def test_position_update_persists_band_fields(staff_client, staff_user):
    from apps.organization.models import Position
    from apps.organization.tests.factories import OrganizationFactory, PositionFactory
    from apps.organization.tests.rbac_helpers import grant_all_known_codes

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)
    pos = PositionFactory.create(organization=org, name="Band Test")

    response = staff_client.patch(
        f"/api/organizations/{org.id}/positions/{pos.id}/",
        {"band_level": "L6 - Principal", "salary_range": "$1 - $2"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 200, response.content[:500]
    pos.refresh_from_db()
    assert pos.band_level == "L6 - Principal"
    assert pos.salary_range == "$1 - $2"


@pytest.mark.django_db
def test_position_list_headcount_scales_without_n_plus_one():
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    from apps.organization.api.serializers.position import PositionListSerializer
    from apps.organization.selectors.position import PositionSelector
    from apps.organization.tests.factories import PositionFactory

    positions = [PositionFactory.create(name=f"Scale {i}") for i in range(4)]
    queryset = PositionSelector.get_queryset().filter(
        pk__in=[p.pk for p in positions]
    )

    with CaptureQueriesContext(connection) as ctx:
        data = PositionListSerializer(instance=queryset, many=True).data

    assert [d["headcount"] for d in data] == [0, 0, 0, 0]
    assert len(ctx) <= 2, [q["sql"][:120] for q in ctx.captured_queries]


@pytest.mark.django_db
def test_position_list_headcount_ignores_soft_deleted_people():
    from apps.organization.api.serializers.position import PositionListSerializer
    from apps.organization.models import Person
    from apps.organization.tests.factories import PersonFactory, PositionFactory

    pos = PositionFactory.create(name="Attrition Lead")
    PersonFactory.create(role=pos)
    gone = PersonFactory.create(role=pos)
    Person.objects.filter(pk=gone.pk).update(is_deleted=True)

    data = PositionListSerializer(instance=pos).data

    assert data["headcount"] == 1


@pytest.mark.django_db
def test_position_list_field_set_matches_workspace_columns():
    # The Positions workspace table renders title/code/department_name/
    # level/band_level/salary_range/employment_type/headcount — every one
    # must come from the real serializer, never guessed client-side.
    from apps.organization.api.serializers.position import PositionListSerializer
    from apps.organization.tests.factories import PositionFactory

    pos = PositionFactory.create(name="Aligned Lead")

    assert set(PositionListSerializer(instance=pos).data.keys()) == {
        "id",
        "uuid",
        "code",
        "name",
        "title",
        "organization",
        "scope",
        "department",
        "department_name",
        "level",
        "is_managerial",
        "band_level",
        "salary_range",
        "employment_type",
        "headcount",
    }
