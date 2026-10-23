from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Role,
    RolePermission,
    UserRole,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission, grant_permissions


@pytest.mark.django_db
class TestRoleCrudViaApi:
    def test_create_role(self, staff_client):
        response = staff_client.post(
            reverse("api:v1:identity-rbac:role-list"),
            {"name": "Api Role", "code": "api-role"},
            format="json",
        )

        assert response.status_code == 201
        assert Role.objects.filter(code="api-role").exists()

    def test_update_role_code_immutable(self, staff_client):
        role = Role.objects.create(name="Immutable Api", code="immutable-api")

        response = staff_client.patch(
            reverse("api:v1:identity-rbac:role-detail", kwargs={"pk": role.id}),
            {"code": "renamed-api"},
            format="json",
        )

        assert response.status_code == 400
        role.refresh_from_db()
        assert role.code == "immutable-api"

    def test_is_system_not_writable_via_api(self, staff_client):
        role = Role.objects.create(name="Sys Api", code="sys-api")

        response = staff_client.patch(
            reverse("api:v1:identity-rbac:role-detail", kwargs={"pk": role.id}),
            {"is_system": True},
            format="json",
        )

        assert response.status_code == 200
        role.refresh_from_db()
        assert role.is_system is False

    def test_system_role_delete_rejected(self, staff_client):
        role = Role.objects.create(name="Sys Del Api", code="sys-del-api", is_system=True)

        response = staff_client.delete(
            reverse("api:v1:identity-rbac:role-detail", kwargs={"pk": role.id}),
        )

        assert response.status_code == 400
        assert Role.objects.filter(pk=role.pk).exists()

    def test_regular_user_cannot_write_roles(self, authenticated_client):
        response = authenticated_client.post(
            reverse("api:v1:identity-rbac:role-list"),
            {"name": "Nope", "code": "nope"},
            format="json",
        )

        assert response.status_code == 403


@pytest.mark.django_db
class TestRolePermissionApi:
    def test_grant_and_revoke_permission(self, staff_client, staff_user):
        role = Role.objects.create(name="Perm Api", code="perm-api")
        permission = ensure_permission("shot.api.granted")
        grant_permissions(staff_user, permission.code)

        grant = staff_client.post(
            reverse("api:v1:identity-rbac:role-permissions", kwargs={"pk": role.id}),
            {"permission_id": permission.id},
            format="json",
        )
        assert grant.status_code == 201

        rp = RolePermission.objects.get(role=role, permission=permission)
        assert rp.granted_by_id == staff_user.pk

        revoke = staff_client.delete(
            reverse("api:v1:identity-rbac:role-permissions", kwargs={"pk": role.id}),
            {"permission_id": permission.id},
            format="json",
        )
        assert revoke.status_code == 200

        rp.refresh_from_db()
        assert rp.is_deleted is True

    def test_grant_requires_holding_permission(self, authenticated_client):
        role = Role.objects.create(name="Esc Api", code="esc-api")
        permission = ensure_permission("identity.role.update")

        response = authenticated_client.post(
            reverse("api:v1:identity-rbac:role-permissions", kwargs={"pk": role.id}),
            {"permission_id": permission.id},
            format="json",
        )

        assert response.status_code == 403

    def test_permissions_list(self, staff_client):
        role = Role.objects.create(name="List Api", code="list-api")
        permission = ensure_permission("shot.api.listed")
        RolePermission.objects.create(role=role, permission=permission, granted=True)

        response = staff_client.get(
            reverse("api:v1:identity-rbac:role-permissions", kwargs={"pk": role.id}),
        )

        assert response.status_code == 200
        assert response.data[0]["permission"]["code"] == "shot.api.listed"


@pytest.mark.django_db
class TestRoleUserApi:
    def test_assign_and_unassign_user(self, staff_client, staff_user):
        role = Role.objects.create(name="User Api", code="user-api")
        permission = ensure_permission("shot.api.assigned")
        RolePermission.objects.create(role=role, permission=permission, granted=True)
        user = UserFactory.create()
        grant_permissions(staff_user, permission.code)

        assign = staff_client.post(
            reverse("api:v1:identity-rbac:role-users", kwargs={"pk": role.id}),
            {"user_id": user.id},
            format="json",
        )
        assert assign.status_code == 201
        assert UserRole.objects.filter(user=user, role=role).exists()

        unassign = staff_client.delete(
            reverse("api:v1:identity-rbac:role-users", kwargs={"pk": role.id}),
            {"user_id": user.id},
            format="json",
        )
        assert unassign.status_code == 200
        assert (
            UserRole.objects.filter(
                user=user,
                role=role,
                is_deleted=False,
            ).exists()
            is False
        )


@pytest.mark.django_db
class TestGroupMemberApi:
    def test_add_and_remove_member(self, staff_client):
        group = Group.objects.create(name="Member Api", code="member-api")
        user = UserFactory.create()

        add = staff_client.post(
            reverse("api:v1:identity-rbac:group-members", kwargs={"pk": group.id}),
            {"user_id": user.id},
            format="json",
        )
        assert add.status_code == 201
        assert GroupMember.objects.filter(group=group, user=user).exists()

        remove = staff_client.delete(
            reverse("api:v1:identity-rbac:group-members", kwargs={"pk": group.id}),
            {"user_id": user.id},
            format="json",
        )
        assert remove.status_code == 200
        assert GroupMember.objects.get(group=group, user=user).left_at is not None

    def test_group_role_grant_and_revoke(self, staff_client):
        group = Group.objects.create(name="G Role Api", code="g-role-api")
        role = Role.objects.create(name="R Api", code="r-api")

        grant = staff_client.post(
            reverse("api:v1:identity-rbac:group-roles", kwargs={"pk": group.id}),
            {"role_id": role.id},
            format="json",
        )
        assert grant.status_code == 201
        assert GroupRole.objects.filter(group=group, role=role).exists()

        revoke = staff_client.delete(
            reverse("api:v1:identity-rbac:group-roles", kwargs={"pk": group.id}),
            {"role_id": role.id},
            format="json",
        )
        assert revoke.status_code == 200
        assert (
            GroupRole.objects.filter(
                group=group,
                role=role,
                is_deleted=False,
            ).exists()
            is False
        )

    def test_add_member_requires_group_role_permissions(self, authenticated_client):
        group = Group.objects.create(name="Esc Member", code="esc-member")
        role = Role.objects.create(name="Esc M Role", code="esc-m-role")
        RolePermission.objects.create(
            role=role,
            permission=ensure_permission("shot.api.group-escalated"),
            granted=True,
        )
        GroupRole.objects.create(group=group, role=role)
        user = UserFactory.create()

        response = authenticated_client.post(
            reverse("api:v1:identity-rbac:group-members", kwargs={"pk": group.id}),
            {"user_id": user.id},
            format="json",
        )

        assert response.status_code == 403
