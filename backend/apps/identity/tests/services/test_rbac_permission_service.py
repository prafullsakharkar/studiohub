from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

from apps.identity.choices import SecurityEventType
from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Permission,
    Role,
    SecurityEvent,
    UserRole,
)
from apps.identity.services.rbac import (
    GroupService,
    PermissionService,
    RoleService,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import ensure_permission, grant_permissions


def _events(actor, event_type):
    return SecurityEvent.objects.filter(user=actor, event_type=event_type)


@pytest.mark.django_db
class TestPermissionService:
    def test_create_forces_non_system(self):
        actor = UserFactory.create(is_superuser=True)

        permission = PermissionService.create(
            user=actor,
            name="Probe",
            code="probe.created.view",
            module="probe_created",
            action="view",
            category="general",
            is_system=True,
        )

        assert permission.is_system is False
        assert _events(actor, SecurityEventType.PERMISSION_CHANGED).exists()

    def test_system_permission_cannot_be_deleted_even_by_superuser(self):
        actor = UserFactory.create(is_superuser=True)
        permission = ensure_permission("probe.system.delete")
        permission.is_system = True
        permission.save(update_fields=["is_system"])

        with pytest.raises(ValidationError):
            PermissionService.delete(permission, user=actor)

        assert Permission.objects.filter(pk=permission.pk, is_deleted=False).exists()

    def test_system_permission_update_requires_superuser(self):
        actor = UserFactory.create()
        permission = ensure_permission("probe.system.update")
        permission.is_system = True
        permission.save(update_fields=["is_system"])

        with pytest.raises(PermissionDenied):
            PermissionService.update(permission, user=actor, description="x")

    def test_code_immutable(self):
        actor = UserFactory.create(is_superuser=True)
        permission = ensure_permission("probe.code.frozen")

        with pytest.raises(ValidationError):
            PermissionService.update(permission, user=actor, code="probe.code.moved")

    def test_custom_permission_delete_audited(self):
        actor = UserFactory.create(is_superuser=True)
        permission = ensure_permission("probe.custom.delete")

        PermissionService.delete(permission, user=actor)

        assert _events(actor, SecurityEventType.PERMISSION_CHANGED).exists()


@pytest.mark.django_db
class TestNameUniquenessGuard:
    def test_role_create_duplicate_name_rejected_case_insensitively(self):
        actor = UserFactory.create()
        RoleService.create(user=actor, name="Rotos", code="rotos-a")

        with pytest.raises(ValidationError):
            RoleService.create(user=actor, name="rotos", code="rotos-b")

    def test_role_rename_to_existing_name_rejected(self):
        actor = UserFactory.create()
        RoleService.create(user=actor, name="Paint", code="paint-a")
        other = RoleService.create(user=actor, name="Prep", code="prep-a")

        with pytest.raises(ValidationError):
            RoleService.update(other, user=actor, name="PAINT")

    def test_role_rename_to_own_name_allowed(self):
        actor = UserFactory.create()
        role = RoleService.create(user=actor, name="Matchmove", code="mm-a")

        RoleService.update(role, user=actor, name="Matchmove", description="ok")

    def test_group_duplicate_name_rejected(self):
        actor = UserFactory.create()
        GroupService.create(user=actor, name="Pipeline", code="pipe-a")

        with pytest.raises(ValidationError):
            GroupService.create(user=actor, name="pipeline", code="pipe-b")


@pytest.mark.django_db
class TestEveryMutationIsAudited:
    """Each grant/revoke/assign/membership change emits one SecurityEvent."""

    def _setup(self):
        actor = UserFactory.create()
        target = UserFactory.create()
        permission = ensure_permission("shot.probe.audit_matrix")
        grant_permissions(actor, permission.code)
        role = Role.objects.create(name="Audit Matrix", code="audit-matrix")
        group = Group.objects.create(name="Audit Matrix G", code="audit-matrix-g")
        return actor, target, permission, role, group

    def test_each_mutation_emits_an_event(self):
        actor, target, permission, role, group = self._setup()
        seen = SecurityEvent.objects.filter(user=actor).count()

        steps = [
            lambda: RoleService.grant_permission(role=role, permission=permission, actor=actor),
            lambda: RoleService.assign_user(role=role, user=target, actor=actor),
            lambda: RoleService.attach_group(role=role, group=group, actor=actor),
            lambda: GroupService.add_member(group=group, user=target, actor=actor),
            lambda: GroupService.remove_member(group=group, user=target, actor=actor),
            lambda: RoleService.detach_group(role=role, group=group, actor=actor),
            lambda: GroupService.grant_role(group=group, role=role, actor=actor),
            lambda: GroupService.revoke_role(group=group, role=role, actor=actor),
            lambda: RoleService.unassign_user(role=role, user=target, actor=actor),
            lambda: RoleService.revoke_permission(role=role, permission=permission, actor=actor),
        ]
        for index, step in enumerate(steps, start=1):
            step()
            now = SecurityEvent.objects.filter(user=actor).count()
            assert now == seen + 1, f"step {index} emitted {now - seen} events"
            seen = now

    def test_noop_revoke_emits_nothing(self):
        actor, target, _permission, role, _group = self._setup()
        before = SecurityEvent.objects.filter(user=actor).count()

        assert RoleService.unassign_user(role=role, user=target, actor=actor) is None

        assert SecurityEvent.objects.filter(user=actor).count() == before


@pytest.mark.django_db
class TestLastAdministratorGuardIsolated:
    """The guard, not the self-modification rule, must stop the removal."""

    def test_superuser_cannot_remove_sole_role_based_admin(self):
        superuser = UserFactory.create(is_superuser=True)
        admin = UserFactory.create()
        role = grant_permissions(admin, "identity.role.update")

        with pytest.raises(ValidationError, match="last user"):
            RoleService.unassign_user(role=role, user=admin, actor=superuser)

        assert UserRole.objects.filter(user=admin, role=role, is_deleted=False).exists()

    def test_removing_admin_group_membership_blocked_when_last(self):
        superuser = UserFactory.create(is_superuser=True)
        admin = UserFactory.create()
        role = Role.objects.create(name="Group Admin", code="group-admin")
        RoleService.grant_permission(
            role=role,
            permission=ensure_permission("identity.group.update"),
            actor=superuser,
        )
        group = Group.objects.create(name="Admins G", code="admins-g")
        GroupRole.objects.create(group=group, role=role)
        GroupMember.objects.create(group=group, user=admin)

        with pytest.raises(ValidationError, match="last user"):
            GroupService.remove_member(group=group, user=admin, actor=superuser)

        assert GroupMember.objects.get(group=group, user=admin).left_at is None

    def test_revoking_admin_permission_from_role_blocked_when_last(self):
        superuser = UserFactory.create(is_superuser=True)
        admin = UserFactory.create()
        role = grant_permissions(admin, "identity.role.update")
        permission = ensure_permission("identity.role.update")

        with pytest.raises(ValidationError, match="last user"):
            RoleService.revoke_permission(role=role, permission=permission, actor=superuser)
