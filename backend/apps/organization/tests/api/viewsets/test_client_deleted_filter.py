"""Client/vendor lists exclude soft-deleted rows (parity with entity lists)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import ClientFactory, OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_client_list_excludes_soft_deleted():
    from apps.organization.models import Client

    org = OrganizationFactory.create()
    ClientFactory.create(organization=org, name="Keep Co")
    gone = ClientFactory.create(organization=org, name="Gone Co")
    Client.objects.filter(pk=gone.pk).update(is_deleted=True)

    user = UserFactory.create(is_staff=True)
    grant_all_known_codes(user, org)
    api = APIClient()
    api.force_authenticate(user=user)

    response = api.get(
        f"/api/organizations/{org.id}/clients/",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 200, response.content[:300]
    rows = response.data["results"] if isinstance(response.data, dict) else response.data
    names = [row["name"] for row in rows]
    assert names == ["Keep Co"]
