from django.db import transaction

from apps.core.exceptions.base import DuplicateException
from apps.core.services.business import BusinessService
from apps.organization.events import (
    RoleCreated,
    RoleDeleted,
    RolePermissionGranted,
    RolePermissionRevoked,
    RoleUpdated,
)
from apps.organization.models import Permission, Role, RolePermission
from apps.organization.validators.role import RoleValidator


class RoleService(BusinessService):
    """
    Service for Role model.
    """

    model = Role
    validator_class = RoleValidator

    event_map = {
        "create": RoleCreated,
        "update": RoleUpdated,
        "delete": RoleDeleted,
        "grant_permission": RolePermissionGranted,
        "revoke_permission": RolePermissionRevoked,
    }

    @classmethod
    @transaction.atomic
    def clone(cls, role, *, name, code, user=None):
        """
        Clone a role (including its granted permissions) under a new name/code.
        """
        if Role.objects.filter(code=code).exists():
            raise DuplicateException(
                model_name="Role",
                field="code",
                value=code,
            )
        cloned = Role.objects.create(
            organization=role.organization,
            name=name,
            code=code,
            description=role.description,
            parent=role.parent,
            role_type=role.role_type,
            scope=role.scope,
            priority=role.priority,
            icon=role.icon,
            color=role.color,
            is_active=role.is_active,
        )
        RolePermission.objects.bulk_create(
            [
                RolePermission(
                    role=cloned,
                    permission_id=rp.permission_id,
                    granted=rp.granted,
                    granted_by=user if user is not None and user.is_authenticated else None,
                )
                for rp in role.role_permissions.select_related("permission").all()
            ]
        )
        cls.publish_event(cls.CREATE, instance=cloned, user=user)
        return cloned

    @classmethod
    @transaction.atomic
    def grant_permissions(cls, role, codes, *, user=None):
        """
        Grant permissions (by dotted code) to a role.

        Returns ``(added, unknown)`` code lists; idempotent.
        """
        codes = list(dict.fromkeys(codes))
        permissions = Permission.objects.filter(code__in=codes)
        found = {p.code for p in permissions}
        unknown = [c for c in codes if c not in found]
        added = []
        for permission in permissions:
            _, created = RolePermission.objects.get_or_create(
                role=role,
                permission=permission,
                defaults={
                    "granted": True,
                    "granted_by": user if user is not None and user.is_authenticated else None,
                },
            )
            added.append(permission.code)
            cls.publish_event(
                "grant_permission",
                instance=role,
                permission=permission,
                user=user,
            )
        return added, unknown

    @classmethod
    @transaction.atomic
    def create(cls, *, user=None, **validated_data):
        """Create a role, syncing any ``permissions`` code list afterwards.

        The write-only ``permissions`` alias never reaches the model layer.
        """
        permission_codes = validated_data.pop("permissions", None)
        instance = super().create(user=user, **validated_data)
        if permission_codes:
            cls.grant_permissions(instance, list(permission_codes), user=user)
        return instance

    @classmethod
    @transaction.atomic
    def update(cls, instance, *, user=None, **validated_data):
        """Update a role; a present ``permissions`` list replaces the grants.

        Absent key = partial update without touching grants (matches the
        frontend sending the full selection only when permissions change).
        Unknown codes are ignored here (the dedicated add/remove actions
        already report them explicitly).
        """
        permission_codes = validated_data.pop("permissions", None)
        instance = super().update(instance, user=user, **validated_data)
        if permission_codes is not None:
            wanted = set(permission_codes)
            current = set(
                instance.role_permissions.select_related("permission").values_list(
                    "permission__code", flat=True
                )
            )
            cls.grant_permissions(instance, list(wanted - current), user=user)
            cls.revoke_permissions(instance, list(current - wanted), user=user)
        return instance

    @classmethod
    @transaction.atomic
    def revoke_permissions(cls, role, codes, *, user=None):
        """
        Remove permissions (by dotted code) from a role.

        Returns ``(removed, unknown)`` code lists; idempotent.
        """
        codes = list(dict.fromkeys(codes))
        permissions = Permission.objects.filter(code__in=codes)
        found = {p.code for p in permissions}
        unknown = [c for c in codes if c not in found]
        removed = []
        for permission in permissions:
            deleted, _ = RolePermission.objects.filter(
                role=role,
                permission=permission,
            ).delete()
            if deleted:
                removed.append(permission.code)
                cls.publish_event(
                    "revoke_permission",
                    instance=role,
                    permission=permission,
                    user=user,
                )
        return removed, unknown

    # --- User role assignments ---
    @classmethod
    @transaction.atomic
    def assign_user(cls, role, user_id, *, user=None):
        """Assign role to a user (create UserRole)."""
        from apps.organization.models import UserRole
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user_obj = User.objects.filter(id=user_id).first()
        if not user_obj:
            return None, "User not found"
        user_role, created = UserRole.objects.get_or_create(
            user=user_obj,
            role=role,
            defaults={"assigned_by": user if user is not None and user.is_authenticated else None},
        )
        if created:
            cls.publish_event("assign_user", instance=role, user=user_obj, assigned_by=user)
        return user_role, None

    @classmethod
    @transaction.atomic
    def unassign_user(cls, role, user_id, *, user=None):
        """Remove role from a user (delete UserRole)."""
        from apps.organization.models import UserRole

        deleted, _ = UserRole.objects.filter(user_id=user_id, role=role).delete()
        if deleted:
            cls.publish_event("unassign_user", instance=role, user_id=user_id, user=user)
        return deleted > 0, None

    # --- Group role assignments ---
    @classmethod
    @transaction.atomic
    def assign_group(cls, role, group_id, *, user=None):
        """Assign role to a group (create GroupRole)."""
        from apps.organization.models import GroupRole

        group_role, created = GroupRole.objects.get_or_create(
            group_id=group_id,
            role=role,
            defaults={"assigned_by": user if user is not None and user.is_authenticated else None},
        )
        if created:
            cls.publish_event("assign_group", instance=role, group_id=group_id, user=user)
        return group_role, None

    @classmethod
    @transaction.atomic
    def unassign_group(cls, role, group_id, *, user=None):
        """Remove role from a group (delete GroupRole)."""
        from apps.organization.models import GroupRole

        deleted, _ = GroupRole.objects.filter(group_id=group_id, role=role).delete()
        if deleted:
            cls.publish_event("unassign_group", instance=role, group_id=group_id, user=user)
        return deleted > 0, None
