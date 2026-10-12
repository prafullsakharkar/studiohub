"""Person roster filters (department / department_name)."""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.api.viewsets.test_person_isolation import (
    _member_client,
)
from apps.organization.tests.factories import (
    DepartmentFactory,
    OrganizationFactory,
    PersonFactory,
)


@pytest.mark.django_db
def test_people_filter_by_department_name():
    org = OrganizationFactory.create()
    comp = DepartmentFactory.create(organization=org, name="Compositing")
    light = DepartmentFactory.create(organization=org, name="Lighting")
    PersonFactory.create(organization=org, name="Comp Artist", department=comp)
    PersonFactory.create(organization=org, name="Light Artist", department=light)
    user = UserFactory.create()
    client = _member_client(user, org)

    response = client.get(
        f"/api/organizations/{org.id}/people/?department_name=comp"
    )

    assert response.status_code == 200, response.data
    names = [row["name"] for row in response.data["results"]]
    assert names == ["Comp Artist"]
