"""Membership revocation immediately blocks access to org-scoped resources.

Pins the strict-access rule: when a membership is soft-deleted, detail and
list scopes both stop granting access. Reads that were previously scoped stay
scoped.
"""

import pytest

from apps.identity.tests.factories import UserFactory
from apps.organization.models import OrganizationMembership
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)
from apps.organization.tests.rbac_helpers import grant_all_known_codes  # noqa: F401


@pytest.fixture
def member_user_organization():
    org = OrganizationFactory.create()
    user = UserFactory.create(email="member@studiohub.vfx", is_superuser=False)
    OrganizationMembershipFactory.create(user=user, organization=org, status="active")
    from apps.organization.tests.rbac_helpers import grant_permissions

    grant_permissions(user, "organization.view", organization=org)
    return org, user


@pytest.mark.django_db
class TestMembershipRevocation:
    def test_revoked_membership_removes_org_detail_access(self, api_client, member_user_organization):
        org, user = member_user_organization
        api_client.force_authenticate(user=user)
        api_client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))

        detail_url = f"/api/v1/organizations/{org.id}/"
        assert api_client.get(detail_url).status_code == 200

        OrganizationMembership.objects.filter(user=user, organization=org).update(is_deleted=True)
        assert api_client.get(detail_url).status_code in (403, 404)

    def test_revoked_membership_removed_from_canonical_directory(self, api_client, member_user_organization):
        org, user = member_user_organization
        api_client.force_authenticate(user=user)

        res = api_client.get("/api/v1/auth/me/organizations/")
        assert res.status_code == 200
        ids_before = {str(o.get("id")) for o in res.data}
        assert str(org.id) in ids_before

        OrganizationMembership.objects.filter(user=user, organization=org).delete()
        res = api_client.get("/api/v1/auth/me/organizations/")
        assert res.status_code == 200
        ids_after = {str(o.get("id")) for o in res.data}
        assert str(org.id) not in ids_after

    def test_org_scoped_list_returns_empty_not_forbidden_after_revocation(self, api_client, member_user_organization):
        # Locked decision: scoped list surfaces stay 200 with an empty result
        # set; detail/write paths remain gated. Pin that contract.
        org, user = member_user_organization
        api_client.force_authenticate(user=user)

        OrganizationMembership.objects.filter(user=user, organization=org).delete()
        res = api_client.get("/api/v1/auth/me/organizations/")
        assert res.status_code == 200
        ids = {str(o.get("id")) for o in res.data}
        assert str(org.id) not in ids
