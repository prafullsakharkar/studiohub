"""
Who may administer whom, and who may read membership lists (TPN review TM-022, TM-018).

The actors hold real role grants (no superuser shortcut) so the checks under test are the ones that
run in production.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.models import Group, Role
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions

ADMIN_CODES = (
    "identity.user.view",
    "identity.user.create",
    "identity.user.update",
    "identity.user.delete",
    "identity.user.activate",
    "identity.user.deactivate",
    "identity.user.archive",
    "identity.user.restore",
    "identity.user.change_password",
    "identity.user.reset_password",
)

PASSWORD = "Correct-horse-battery-9!"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _admin(*extra):
    # is_staff: the directory shows other users only to staff and superusers (UserSelector)
    user = UserFactory.create(is_active=True, is_staff=True)
    grant_permissions(user, *ADMIN_CODES, *extra)
    return user


def _url(user, tail=""):
    return f"/api/v1/identity/users/{user.pk}/{tail}"


@pytest.mark.django_db
class TestTargetsThatOutrankTheActor:
    def test_a_user_administrator_cannot_touch_a_superuser(self):
        actor = _client(_admin())
        target = UserFactory.create(is_superuser=True, is_staff=True)

        assert actor.patch(_url(target), {"display_name": "x"}, format="json").status_code == 403
        assert actor.post(_url(target, "reset-password/")).status_code == 403
        assert actor.post(_url(target, "deactivate/")).status_code == 403
        assert actor.post(_url(target, "suspend/")).status_code == 403
        assert actor.post(_url(target, "revoke-sessions/")).status_code == 403
        assert actor.post(_url(target, "force-password-change/")).status_code == 403
        assert actor.delete(_url(target)).status_code == 403

        target.refresh_from_db()
        assert target.is_active is True

    def test_nor_a_user_who_holds_permissions_the_actor_lacks(self):
        actor = _admin()
        stronger = UserFactory.create(is_active=True)
        grant_permissions(stronger, *ADMIN_CODES, "identity.role.create")

        response = _client(actor).post(_url(stronger, "reset-password/"))

        assert response.status_code == 403

    def test_a_user_with_fewer_permissions_can_be_administered(self):
        actor = _admin()
        weaker = UserFactory.create(is_active=True)
        grant_permissions(weaker, "identity.user.view")

        assert _client(actor).post(_url(weaker, "reset-password/")).status_code == 200

    def test_a_peer_with_the_same_permissions_can_be_administered(self):
        actor, peer = _admin(), _admin()

        assert _client(actor).post(_url(peer, "reset-password/")).status_code == 200

    def test_a_superuser_can_administer_a_superuser(self):
        actor = UserFactory.create(is_superuser=True, is_staff=True)
        other = UserFactory.create(is_superuser=True, is_staff=True)

        assert _client(actor).post(_url(other, "reset-password/")).status_code == 200


@pytest.mark.django_db
class TestStaffStatusIsASuperuserDecision:
    def _payload(self, email, **extra):
        return {"email": email, "password": PASSWORD, "is_active": True, **extra}

    def test_creating_a_staff_user_needs_a_superuser(self):
        response = _client(_admin()).post(
            "/api/v1/identity/users/",
            self._payload("staff-attempt@example.com", is_staff=True),
            format="json",
        )

        assert response.status_code == 403

    def test_creating_an_ordinary_user_is_unaffected(self):
        response = _client(_admin()).post(
            "/api/v1/identity/users/", self._payload("plain@example.com"), format="json"
        )

        assert response.status_code == 201, response.content

    def test_granting_staff_by_update_needs_a_superuser(self):
        target = UserFactory.create(is_active=True)

        response = _client(_admin()).patch(_url(target), {"is_staff": True}, format="json")

        assert response.status_code == 403
        target.refresh_from_db()
        assert target.is_staff is False

    def test_a_superuser_can_grant_and_remove_it(self):
        superuser = UserFactory.create(is_superuser=True, is_staff=True)
        target = UserFactory.create(is_active=True)
        client = _client(superuser)

        assert client.patch(_url(target), {"is_staff": True}, format="json").status_code == 200
        target.refresh_from_db()
        assert target.is_staff is True

        assert client.patch(_url(target), {"is_staff": False}, format="json").status_code == 200

    def test_sending_the_current_value_is_not_a_change(self):
        target = UserFactory.create(is_active=True, is_staff=False)

        response = _client(_admin()).patch(_url(target), {"is_staff": False}, format="json")

        assert response.status_code == 200


@pytest.mark.django_db
class TestActivationHasItsOwnPermissions:
    def test_update_alone_cannot_deactivate_through_a_plain_patch(self):
        actor = UserFactory.create(is_active=True, is_staff=True)
        grant_permissions(actor, "identity.user.view", "identity.user.update")
        target = UserFactory.create(is_active=True)

        response = _client(actor).patch(_url(target), {"is_active": False}, format="json")

        assert response.status_code == 403
        target.refresh_from_db()
        assert target.is_active is True

    def test_with_the_deactivate_permission_the_patch_is_allowed(self):
        actor = UserFactory.create(is_active=True, is_staff=True)
        grant_permissions(
            actor, "identity.user.view", "identity.user.update", "identity.user.deactivate"
        )
        target = UserFactory.create(is_active=True)

        response = _client(actor).patch(_url(target), {"is_active": False}, format="json")

        assert response.status_code == 200

    def test_reactivating_needs_the_activate_permission(self):
        actor = UserFactory.create(is_active=True, is_staff=True)
        grant_permissions(
            actor, "identity.user.view", "identity.user.update", "identity.user.deactivate"
        )
        target = UserFactory.create(is_active=False)

        response = _client(actor).patch(_url(target), {"is_active": True}, format="json")

        assert response.status_code == 403


@pytest.mark.django_db
class TestMembershipListsAreUserData:
    def _role_with_member(self):
        role = Role.objects.create(name="Reviewers", code="reviewers", is_active=True)
        member = UserFactory.create(is_active=True)
        from apps.identity.models import UserRole

        UserRole.objects.create(user=member, role=role)
        return role, member

    def test_listing_a_roles_users_needs_the_role_view_permission(self):
        role, member = self._role_with_member()
        nobody = UserFactory.create(is_active=True)

        response = _client(nobody).get(f"/api/v1/roles/{role.pk}/users/")

        assert response.status_code == 403
        assert member.email not in response.content.decode()

    def test_with_the_permission_it_lists_them(self):
        role, member = self._role_with_member()
        reader = UserFactory.create(is_active=True)
        grant_permissions(reader, "identity.role.view")

        response = _client(reader).get(f"/api/v1/roles/{role.pk}/users/")

        assert response.status_code == 200
        assert member.email in response.content.decode()

    def test_listing_a_groups_members_needs_the_group_view_permission(self):
        group = Group.objects.create(name="Leads", code="leads")
        nobody = UserFactory.create(is_active=True)
        reader = UserFactory.create(is_active=True)
        grant_permissions(reader, "identity.group.view")

        assert _client(nobody).get(f"/api/v1/groups/{group.pk}/members/").status_code == 403
        assert _client(reader).get(f"/api/v1/groups/{group.pk}/members/").status_code == 200

    def test_the_role_and_permission_lists_themselves_stay_shared_reference_data(self):
        role, _ = self._role_with_member()
        nobody = _client(UserFactory.create(is_active=True))

        assert nobody.get("/api/v1/roles/").status_code == 200
        assert nobody.get(f"/api/v1/roles/{role.pk}/").status_code == 200
        assert nobody.get(f"/api/v1/roles/{role.pk}/permissions/").status_code == 200
        assert nobody.get("/api/v1/permissions/").status_code == 200

    def test_a_superuser_can_list_members(self):
        role, _ = self._role_with_member()
        admin = UserFactory.create(is_superuser=True, is_staff=True)

        assert _client(admin).get(f"/api/v1/roles/{role.pk}/users/").status_code == 200
