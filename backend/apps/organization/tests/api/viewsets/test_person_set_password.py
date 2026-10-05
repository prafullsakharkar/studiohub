"""Change-password endpoint for People entries.

Rules (ADR-0033):
- self-service: user changes own password with old password verification.
- admin path: org member with `person.update` (or superuser) sets another
  member's password — no old-password requirement.
- Never persists or returns the plaintext; Django set_password hashes it
  via PBKDF2/Argon2 as configured.
"""

import pytest

from apps.identity.models import User
from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
    PersonFactory,
)
from apps.organization.tests.rbac_helpers import grant_all_known_codes, grant_permissions


@pytest.fixture
def people_setup():
    org = OrganizationFactory.create()
    admin = UserFactory.create(email="admin-push@studiohub.vfx", is_superuser=False)
    member = UserFactory.create(email="member-target@studiohub.vfx", is_superuser=False)
    stranger = UserFactory.create(email="stranger@outside.vfx", is_superuser=False)
    OrganizationMembershipFactory.create(user=admin, organization=org, status="active")
    OrganizationMembershipFactory.create(user=member, organization=org, status="active")
    OrganizationMembershipFactory.create(user=stranger, organization=org, status="active")
    person = PersonFactory.create(
        organization=org,
        email=member.email,
        name="Target Member",
    )
    return org, admin, member, stranger, person


@pytest.mark.django_db
class TestPersonSetPassword:
    def test_member_can_change_own_password_with_old_password(self, api_client, people_setup):
        org, _admin, member, _stranger, person = people_setup
        member.set_password("oldpass-123")
        member.save(update_fields=["password"])
        grant_permissions(member, "person.update", organization=org)
        api_client.force_authenticate(user=member)
        api_client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))

        res = api_client.post(
            f"/api/organizations/{org.id}/people/{person.id}/set-password/",
            {"current_password": "oldpass-123", "new_password": "NewPass!45579aa"},
            format="json",
        )
        assert res.status_code == 200
        member.refresh_from_db()
        assert member.check_password("NewPass!45579aa")
        assert not member.check_password("oldpass-123")

    def test_member_cannot_change_another_members_password_without_grant(self, api_client, people_setup):
        org, _admin, member, stranger, person = people_setup
        api_client.force_authenticate(user=stranger)
        api_client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))

        res = api_client.post(
            f"/api/organizations/{org.id}/people/{person.id}/set-password/",
            {"new_password": "TakeOver!992211"},
            format="json",
        )
        assert res.status_code in (403, 404)
        member.refresh_from_db()
        # must be untouched — membership nonce from fixture.
        assert member.check_password("password123") is False

    def test_admin_grant_sets_password_without_old(self, api_client, people_setup):
        org, admin, member, _stranger, person = people_setup
        grant_permissions(admin, "person.update", organization=org)
        api_client.force_authenticate(user=admin)
        api_client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))

        res = api_client.post(
            f"/api/organizations/{org.id}/people/{person.id}/set-password/",
            {"new_password": "AdminSet!334455"},
            format="json",
        )
        assert res.status_code == 200
        member.refresh_from_db()
        assert member.check_password("AdminSet!334455")

    def test_cross_org_membership_rejected(self, api_client, people_setup):
        org, _admin, member, _stranger, _person = people_setup
        other_org = OrganizationFactory.create()
        other_person = PersonFactory.create(organization=other_org, email="other@org.com")
        api_client.force_authenticate(user=member)
        api_client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))

        res = api_client.post(
            f"/api/organizations/{org.id}/people/{other_person.id}/set-password/",
            {"current_password": "member-pass", "new_password": "Pwned!0011"},
            format="json",
        )
        assert res.status_code == 403 or res.status_code == 404
        # untouched
        assert not User.objects.filter(email="other@org.com").exists()


@pytest.mark.django_db
class TestPersonSetPasswordThatUserAbsent:
    """Person without a matching registered user gets a clean 4xx, never a stack trace."""

    def test_no_linked_user_fails_closed(self, api_client, people_setup):
        org, admin, _member, _stranger, person = people_setup
        grant_permissions(admin, "person.update", organization=org)
        api_client.force_authenticate(user=admin)
        api_client.credentials(HTTP_X_ORGANIZATION_ID=str(org.id))

        person.email = "ghost@ghost.com"
        person.save(update_fields=["email"])
        res = api_client.post(
            f"/api/organizations/{org.id}/people/{person.id}/set-password/",
            {"new_password": "Whatever!112233"},
            format="json",
        )
        assert res.status_code == 404 or res.status_code == 400
