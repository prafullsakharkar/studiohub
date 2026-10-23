from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

from apps.identity.choices import SecurityEventType
from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Role,
    RolePermission,
    SecurityEvent,
    UserRole,
)
from apps.identity.resolvers.permission import PermissionResolver
from apps.identity.services.rbac import GroupService, RoleService
from apps.identity.services.user import UserService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission, grant_permissions


@pytest.mark.django_db
class TestRolePermissionGrants:
    def test_grant_permission_records_actor_and_grants(self):
        actor = UserFactory.create()
        role = Role.objects.create(name="Grant Role", code="grant-role")
        permission = ensure_permission("shot.probe.granted")
        grant_permissions(actor, permission.code)

        rp = RoleService.grant_permission(
            role=role,
            permission=permission,
            actor=actor,
        )

        assert rp.granted_by_id == actor.pk
        assert rp.granted is True
        assert "shot.probe.granted" in PermissionResolver.resolve(user=actor)

    def test_grant_requires_actor_to_hold_permission(self):
        actor = UserFactory.create()
        role = Role.objects.create(name="Escalation Role", code="escalation-role")
        permission = ensure_permission("identity.role.update")

        with pytest.raises(PermissionDenied):
            RoleService.grant_permission(
                role=role,
                permission=permission,
                actor=actor,
            )

    def test_grant_restores_soft_deleted_row(self):
        actor = UserFactory.create()
        role = Role.objects.create(name="Restore Role", code="restore-role")
        permission = ensure_permission("shot.probe.restored")
        grant_permissions(actor, permission.code)
        rp = RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=True,
        )
        rp.is_deleted = True
        rp.save(update_fields=["is_deleted"])

        restored = RoleService.grant_permission(
            role=role,
            permission=permission,
            actor=actor,
        )

        assert restored.pk == rp.pk
        assert restored.is_deleted is False

    def test_revoke_soft_deletes_and_stops_resolving(self):
        actor = UserFactory.create()
        user = UserFactory.create()
        role = Role.objects.create(name="Revoke Role", code="revoke-role")
        permission = ensure_permission("shot.probe.revoked")
        grant_permissions(actor, permission.code)
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=True,
        )
        UserRole.objects.create(user=user, role=role)
        assert "shot.probe.revoked" in PermissionResolver.resolve(user=user)

        RoleService.revoke_permission(
            role=role,
            permission=permission,
            actor=actor,
        )

        assert "shot.probe.revoked" not in PermissionResolver.resolve(user=user)

    def test_mutation_emits_security_event(self):
        actor = UserFactory.create()
        role = Role.objects.create(name="Audit Role", code="audit-role")
        permission = ensure_permission("shot.probe.audited")
        grant_permissions(actor, permission.code)

        RoleService.grant_permission(
            role=role,
            permission=permission,
            actor=actor,
        )

        assert SecurityEvent.objects.filter(
            user=actor,
            event_type=SecurityEventType.PERMISSION_CHANGED,
        ).exists()


@pytest.mark.django_db
class TestRoleUserAssignment:
    def test_assign_grants_role_permissions_to_user(self):
        actor = UserFactory.create()
        user = UserFactory.create()
        role = Role.objects.create(name="Assign Role", code="assign-role")
        permission = ensure_permission("shot.probe.assigned")
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=True,
        )
        grant_permissions(actor, permission.code)

        RoleService.assign_user(role=role, user=user, actor=actor)

        assert "shot.probe.assigned" in PermissionResolver.resolve(user=user)

    def test_assign_requires_actor_to_hold_every_role_permission(self):
        actor = UserFactory.create()
        user = UserFactory.create()
        role = Role.objects.create(name="Escalate Assign", code="escalate-assign")
        RolePermission.objects.create(
            role=role,
            permission=ensure_permission("shot.probe.escalated"),
            granted=True,
        )

        with pytest.raises(PermissionDenied):
            RoleService.assign_user(role=role, user=user, actor=actor)

    def test_assign_blocks_self_assignment(self):
        actor = UserFactory.create()
        grant_permissions(actor, "shot.probe.self")
        role = Role.objects.create(name="Self Role", code="self-role")
        RolePermission.objects.create(
            role=role,
            permission=ensure_permission("shot.probe.self"),
            granted=True,
        )

        with pytest.raises(ValidationError):
            RoleService.assign_user(role=role, user=actor, actor=actor)

    def test_unassign_removes_permissions(self):
        actor = UserFactory.create()
        user = UserFactory.create()
        role = Role.objects.create(name="Unassign Role", code="unassign-role")
        permission = ensure_permission("shot.probe.unassigned")
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=True,
        )
        grant_permissions(actor, permission.code)
        RoleService.assign_user(role=role, user=user, actor=actor)
        assert "shot.probe.unassigned" in PermissionResolver.resolve(user=user)

        RoleService.unassign_user(role=role, user=user, actor=actor)

        assert "shot.probe.unassigned" not in PermissionResolver.resolve(user=user)


@pytest.mark.django_db
class TestGroupMembership:
    def test_add_member_grants_group_role_permissions(self):
        actor = UserFactory.create()
        user = UserFactory.create()
        group = Group.objects.create(name="Member Group", code="member-group")
        role = Role.objects.create(name="Member Role", code="member-role")
        permission = ensure_permission("shot.probe.member")
        RolePermission.objects.create(role=role, permission=permission, granted=True)
        GroupRole.objects.create(group=group, role=role)
        grant_permissions(actor, permission.code)

        GroupService.add_member(group=group, user=user, actor=actor)

        assert "shot.probe.member" in PermissionResolver.resolve(user=user)

    def test_add_member_requires_group_role_permissions(self):
        actor = UserFactory.create()
        user = UserFactory.create()
        group = Group.objects.create(name="Escalate Group", code="escalate-group")
        role = Role.objects.create(name="Escalate G Role", code="escalate-g-role")
        RolePermission.objects.create(
            role=role,
            permission=ensure_permission("shot.probe.group-escalated"),
            granted=True,
        )
        GroupRole.objects.create(group=group, role=role)

        with pytest.raises(PermissionDenied):
            GroupService.add_member(group=group, user=user, actor=actor)

    def test_remove_member_sets_left_at_and_revokes_permissions(self):
        actor = UserFactory.create()
        user = UserFactory.create()
        group = Group.objects.create(name="Leave Group", code="leave-group")
        role = Role.objects.create(name="Leave Role", code="leave-role")
        permission = ensure_permission("shot.probe.left")
        RolePermission.objects.create(role=role, permission=permission, granted=True)
        GroupRole.objects.create(group=group, role=role)
        grant_permissions(actor, permission.code)
        GroupService.add_member(group=group, user=user, actor=actor)
        assert "shot.probe.left" in PermissionResolver.resolve(user=user)

        GroupService.remove_member(group=group, user=user, actor=actor)

        membership = GroupMember.objects.get(group=group, user=user)
        assert membership.left_at is not None
        assert "shot.probe.left" not in PermissionResolver.resolve(user=user)

    def test_remove_member_allows_self_leave(self):
        user = UserFactory.create()
        group = Group.objects.create(name="Self Leave", code="self-leave")
        GroupMember.objects.create(group=group, user=user)

        GroupService.remove_member(group=group, user=user, actor=user)

        assert GroupMember.objects.get(group=group, user=user).left_at is not None


@pytest.mark.django_db
class TestLastAdministratorGuard:
    def test_removing_second_admin_allowed(self):
        admin1 = UserFactory.create()
        admin2 = UserFactory.create()
        role = grant_permissions(admin1, "identity.role.update")
        UserRole.objects.get_or_create(user=admin2, role=role)

        RoleService.unassign_user(role=role, user=admin2, actor=admin1)

        assert not UserRole.objects.filter(
            user=admin2,
            role=role,
            is_deleted=False,
        ).exists()

    def test_removing_last_admin_blocked(self):
        admin1 = UserFactory.create()
        role = grant_permissions(admin1, "identity.role.update")

        with pytest.raises(ValidationError):
            RoleService.unassign_user(role=role, user=admin1, actor=admin1)

        assert UserRole.objects.filter(
            user=admin1,
            role=role,
            is_deleted=False,
        ).exists()

    def test_deleting_last_admin_user_blocked(self):
        admin = UserFactory.create()
        grant_permissions(admin, "identity.role.update")

        with pytest.raises(ValidationError):
            UserService.delete(instance=admin)


@pytest.mark.django_db
class TestSystemRecordProtection:
    def test_system_role_cannot_be_deleted(self):
        actor = UserFactory.create()
        grant_permissions(actor, "identity.role.delete")
        role = Role.objects.create(
            name="System Role",
            code="system-role",
            is_system=True,
        )

        with pytest.raises(ValidationError):
            RoleService.delete(instance=role, user=actor)

        assert Role.objects.filter(pk=role.pk).exists()

    def test_system_role_requires_superuser_to_update(self):
        actor = UserFactory.create()
        grant_permissions(actor, "identity.role.update")
        role = Role.objects.create(
            name="System Update",
            code="system-update",
            is_system=True,
        )

        with pytest.raises(PermissionDenied):
            RoleService.update(instance=role, user=actor, name="Renamed")

    def test_role_code_immutable_after_creation(self):
        actor = UserFactory.create()
        grant_permissions(actor, "identity.role.update")
        role = Role.objects.create(name="Immutable Code", code="immutable-code")

        with pytest.raises(ValidationError):
            RoleService.update(instance=role, user=actor, code="renamed-code")
