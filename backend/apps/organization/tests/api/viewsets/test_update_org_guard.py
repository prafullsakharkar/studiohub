"""Org reassignment via update payloads is rejected."""

from __future__ import annotations

import pytest

from apps.organization.models import Team
from apps.organization.tests.factories import (
    OrganizationFactory,
    TeamFactory,
)
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_team_update_cannot_reassign_organization(staff_client, staff_user):
    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org_a)
    grant_all_known_codes(staff_user, org_b)
    team = TeamFactory.create(organization=org_a, name="Anchor")

    response = staff_client.patch(
        f"/api/organizations/{org_a.id}/teams/{team.id}/",
        {"organization": str(org_b.id)},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org_a.id),
    )

    assert response.status_code == 200, response.content[:500]
    team.refresh_from_db()
    assert team.organization_id == org_a.id


@pytest.mark.django_db
def test_office_update_cannot_reassign_organization(staff_client, staff_user):
    from apps.organization.models import Office
    from apps.organization.tests.factories import OfficeFactory

    org_a = OrganizationFactory.create()
    org_b = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org_a)
    grant_all_known_codes(staff_user, org_b)
    office = OfficeFactory.create(organization=org_a)

    response = staff_client.patch(
        f"/api/organizations/{org_a.id}/offices/{office.id}/",
        {"organization": str(org_b.id), "city": "Still Here"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org_a.id),
    )

    assert response.status_code == 200, response.content[:500]
    office = Office.objects.get(pk=office.pk)
    assert office.organization_id == org_a.id
    assert office.city == "Still Here"


@pytest.mark.django_db
def test_team_partial_update_preserves_unmentioned_relations(staff_client, staff_user):
    from apps.organization.tests.factories import DepartmentFactory

    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)
    dept = DepartmentFactory.create(organization=org, name="Anim")
    team = TeamFactory.create(organization=org, department=dept, name="Anchor")

    response = staff_client.patch(
        f"/api/organizations/{org.id}/teams/{team.id}/",
        {"name": "Renamed"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 200, response.content[:500]
    team = Team.objects.get(pk=team.pk)
    assert team.name == "Renamed"
    assert team.department_id == dept.id
    assert team.organization_id == org.id
