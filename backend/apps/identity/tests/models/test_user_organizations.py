"""User.organizations excludes soft-deleted memberships."""

import pytest

from apps.identity.tests.factories import UserFactory
from apps.organization.models import OrganizationMembership
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)


@pytest.mark.django_db
def test_organizations_excludes_soft_deleted_memberships():
    user = UserFactory.create()
    kept = OrganizationFactory.create()
    dropped = OrganizationFactory.create()
    OrganizationMembershipFactory.create(user=user, organization=kept)
    OrganizationMembershipFactory.create(user=user, organization=dropped)
    OrganizationMembership.objects.filter(
        user=user, organization=dropped
    ).update(is_deleted=True)

    assert list(user.organizations.values_list("id", flat=True)) == [kept.id]
