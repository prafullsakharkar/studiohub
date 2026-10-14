"""Flat entity endpoints never leak across organizations without a header."""

from __future__ import annotations

import pytest

from apps.organization.tests.factories import DepartmentFactory, OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_flat_department_list_without_header_exposes_nothing(staff_client, staff_user):
    org = OrganizationFactory.create()
    grant_all_known_codes(staff_user, org)
    DepartmentFactory.create(organization=org, name="Secret Dept")

    response = staff_client.get("/api/v1/departments/")

    # Fail closed: header-less flat reads scope to .none(), never to
    # another organization's rows.
    assert response.status_code == 200, response.content[:300]
    assert response.json() == []
