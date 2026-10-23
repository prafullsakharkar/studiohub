"""
RBAC write services (ADR-0032 D4, SVC-RBAC-01).

Single owner of every mutation to the platform-global authorization model:

    Role --RolePermission--> Permission
    Role <--UserRole--> User
    Group --GroupRole--> Role
    Group --GroupMember--> User

All writes are transactional, fail closed, enforce escalation and system-row
guards, invalidate the permission cache synchronously, and emit a
``SecurityEvent``. Views never touch these tables directly.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.core.services.business import BusinessService
from apps.identity.choices import SecurityEventType
from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)
from apps.identity.resolvers.permission import PermissionResolver
from apps.identity.services.security_event import SecurityEventService

# Codes that can mutate RBAC or user state. Used by the last-administrator
# guard: an operation may never reduce the number of usable administrative
# holders from >=1 to 0.
ADMIN_PERMISSION_PREFIXES = (
    "identity.role.",
    "identity.permission.",
    "identity.group.",
    "identity.user.",
)


# Arbitrary constant naming the advisory lock that serializes admin changes.
ADMIN_GUARD_LOCK_KEY = 0x1D3A7E01


class RbacGuardMixin:
    """Fail-closed guards shared by the RBAC services."""

    @classmethod
    def _resolve_permissions(cls, user):
        if user is None:
            return set()
        return PermissionResolver.resolve(user=user)

    @classmethod
    def _actor_holds(cls, actor, permission_code):
        if actor is None:
            return False
        if getattr(actor, "is_superuser", False):
            return True
        return permission_code in cls._resolve_permissions(actor)

    @classmethod
    def _require_holds(cls, actor, permission_code):
        if not cls._actor_holds(actor, permission_code):
            raise PermissionDenied(f"Actor does not hold the '{permission_code}' permission.")

    @classmethod
    def _require_holds_role(cls, actor, role):
        """Actor must hold every active, unexpired permission the role grants."""
        now = timezone.now()
        granted_codes = set(
            RolePermission.objects.filter(
                role=role,
                granted=True,
                is_deleted=False,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .values_list("permission__code", flat=True)
        )
        if not granted_codes:
            return
        if actor is not None and getattr(actor, "is_superuser", False):
            return
        missing = granted_codes - cls._resolve_permissions(actor)
        if missing:
            raise PermissionDenied(
                "Actor does not hold every permission granted by this role: "
                + ", ".join(sorted(missing))
            )

    @classmethod
    def _require_holds_group(cls, actor, group):
        """Actor must hold every permission granted by the group's roles."""
        now = timezone.now()
        granted_codes = set(
            RolePermission.objects.filter(
                role__role_groups__group=group,
                granted=True,
                is_deleted=False,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .values_list("permission__code", flat=True)
        )
        if not granted_codes:
            return
        if actor is not None and getattr(actor, "is_superuser", False):
            return
        missing = granted_codes - cls._resolve_permissions(actor)
        if missing:
            raise PermissionDenied(
                "Actor does not hold every permission granted by this group's roles: "
                + ", ".join(sorted(missing))
            )

    @classmethod
    def _guard_usable_role(cls, role):
        if role is None or role.is_deleted:
            raise ValidationError("Role is not usable.")
        if not role.is_active:
            raise ValidationError("Role is not active.")

    @classmethod
    def _guard_usable_permission(cls, permission):
        if permission is None or permission.is_deleted:
            raise ValidationError("Permission is not usable.")
        if not permission.is_active:
            raise ValidationError("Permission is not active.")

    @classmethod
    def _guard_system_mutation(cls, instance, actor):
        if getattr(instance, "is_system", False) and not getattr(actor, "is_superuser", False):
            raise PermissionDenied("System records may only be modified by a superuser.")

    @classmethod
    def _guard_unique_name(cls, model, name, *, exclude=None):
        """Names are unique among live rows, case-insensitively (DOM-RBAC-02)."""
        clash = model.objects.filter(name__iexact=name, is_deleted=False)
        if exclude is not None:
            clash = clash.exclude(pk=exclude.pk)
        if clash.exists():
            raise ValidationError(f"A {model._meta.verbose_name} named '{name}' already exists.")

    @classmethod
    def _guard_system_delete(cls, instance):
        if getattr(instance, "is_system", False):
            raise ValidationError("System records cannot be deleted.")

    @classmethod
    def _activate_link(cls, model, *, lookup, **fields):
        """
        Create or revive a soft-deletable link row (UserRole, GroupRole, ...).

        Safe under concurrent writers: the row is locked while it is revived,
        and when two writers race to create it the loser hits the unique
        constraint, retries, and revives the winner's row instead of failing.
        """
        for attempt in range(2):
            try:
                with transaction.atomic():
                    row = model.all_objects.select_for_update().filter(**lookup).first()
                    if row is None:
                        row = model(**lookup)
                    row.is_deleted = False
                    row.deleted_at = None
                    row.deleted_by = None
                    for name, value in fields.items():
                        setattr(row, name, value)
                    row.save()
                    return row
            except IntegrityError:
                if attempt:
                    raise
        raise AssertionError("unreachable")  # pragma: no cover

    # ------------------------------------------------------------------
    # Last-administrator guard (DOM-RBAC-05)
    # ------------------------------------------------------------------

    @classmethod
    def _serialize_admin_changes(cls) -> None:
        """
        Make administrative mutations take turns (PostgreSQL advisory lock,
        held to the end of the transaction).

        The guard compares the set of administrators before and after a change.
        Without serialization two concurrent removals of two different
        administrators each still see the other one and both commit, leaving
        none (write skew). Re-entrant within one transaction, so the "before"
        and "after" reads share a single acquisition.
        """
        if connection.vendor != "postgresql" or not connection.in_atomic_block:
            return

        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [ADMIN_GUARD_LOCK_KEY])

    @classmethod
    def _admin_holder_ids(cls) -> set[object]:
        """
        Usable users currently holding at least one administrative permission.

        Administrative capability is defined by ``ADMIN_PERMISSION_PREFIXES``.
        Mirrors the resolver rules (DOM-RBAC-01) with set-based queries so the
        cost does not grow with the number of role holders, and reads current
        transaction state rather than the cache. Runs only on administrative
        mutations.
        """
        cls._serialize_admin_changes()

        now = timezone.now()

        code_filter = Q()
        for prefix in ADMIN_PERMISSION_PREFIXES:
            code_filter |= Q(permission__code__startswith=prefix)

        admin_role_ids = set(
            RolePermission.objects.filter(
                code_filter,
                granted=True,
                is_deleted=False,
                role__is_deleted=False,
                role__is_active=True,
                permission__is_deleted=False,
                permission__is_active=True,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .values_list("role_id", flat=True)
        )
        if not admin_role_ids:
            return set()

        direct = UserRole.objects.filter(
            role_id__in=admin_role_ids,
            is_deleted=False,
        ).values_list("user_id", flat=True)

        via_groups = GroupMember.objects.filter(
            is_deleted=False,
            left_at__isnull=True,
            group__is_deleted=False,
            group__group_roles__role_id__in=admin_role_ids,
            group__group_roles__is_deleted=False,
        ).values_list("user_id", flat=True)

        candidate_ids = set(direct) | set(via_groups)
        return set(
            User.objects.filter(
                pk__in=candidate_ids,
                is_active=True,
                is_deleted=False,
            ).values_list("pk", flat=True)
        )

    @classmethod
    def _ensure_admins_remain(cls, before: set[object]) -> None:
        """Raise if a non-empty holder set becomes empty after a mutation."""
        after = cls._admin_holder_ids()
        if before and not after:
            raise ValidationError(
                "Operation would remove the last user with administrative permissions."
            )

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------

    @classmethod
    def _audit(cls, *, actor, event_type, description, metadata=None):
        SecurityEventService.create(
            user=actor,
            event_type=event_type,
            description=description,
            metadata=metadata or {},
        )


class RoleService(RbacGuardMixin, BusinessService):
    """Write operations for the platform-global Role."""

    model = Role

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(cls, *, user=None, **validated_data):
        cls._guard_unique_name(Role, validated_data.get("name", ""))
        return super().create(user=user, **validated_data)

    @classmethod
    @transaction.atomic
    def update(cls, instance, *, user=None, **validated_data):
        cls._guard_system_mutation(instance, user)

        new_code = validated_data.get("code")
        if new_code is not None and new_code != instance.code:
            raise ValidationError("Role code is immutable after creation.")

        if "name" in validated_data:
            cls._guard_unique_name(Role, validated_data["name"], exclude=instance)

        return super().update(instance, user=user, **validated_data)

    @classmethod
    @transaction.atomic
    def delete(cls, instance, *, user=None):
        cls._guard_system_delete(instance)

        before = cls._admin_holder_ids()
        result = super().delete(instance, user=user)
        cls._ensure_admins_remain(before)
        return result

    # ------------------------------------------------------------------
    # Permission grants
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def grant_permission(
        cls,
        *,
        role,
        permission,
        actor,
        expires_at=None,
    ):
        cls._guard_usable_role(role)
        cls._guard_usable_permission(permission)
        cls._guard_system_mutation(role, actor)
        cls._require_holds(actor, permission.code)

        role_permission = cls._activate_link(
            RolePermission,
            lookup={"role": role, "permission": permission},
            granted=True,
            granted_by=actor,
            expires_at=expires_at,
        )

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.PERMISSION_CHANGED,
            description=f"Granted {permission.code} to role {role.name}.",
            metadata={
                "action": "grant",
                "role_id": str(role.pk),
                "permission": permission.code,
            },
        )
        return role_permission

    @classmethod
    @transaction.atomic
    def revoke_permission(cls, *, role, permission, actor):
        cls._guard_usable_role(role)
        cls._guard_system_mutation(role, actor)
        cls._require_holds(actor, permission.code)

        role_permission = RolePermission.objects.filter(
            role=role,
            permission=permission,
            is_deleted=False,
        ).first()
        if role_permission is None:
            return None

        before = cls._admin_holder_ids()
        role_permission.is_deleted = True
        role_permission.deleted_at = timezone.now()
        role_permission.deleted_by = actor
        role_permission.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "updated_at",
            ]
        )
        cls._ensure_admins_remain(before)

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.PERMISSION_CHANGED,
            description=f"Revoked {permission.code} from role {role.name}.",
            metadata={
                "action": "revoke",
                "role_id": str(role.pk),
                "permission": permission.code,
            },
        )
        return role_permission

    # ------------------------------------------------------------------
    # User assignment
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def assign_user(cls, *, role, user, actor):
        cls._guard_usable_role(role)
        cls._guard_system_mutation(role, actor)
        cls._require_holds_role(actor, role)

        if actor is not None and actor.pk == user.pk:
            raise ValidationError("You cannot modify your own role assignments.")

        user_role = cls._activate_link(
            UserRole,
            lookup={"user": user, "role": role},
        )

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Assigned role {role.name} to {user.email}.",
            metadata={
                "action": "assign",
                "role_id": str(role.pk),
                "user_id": str(user.pk),
            },
        )
        return user_role

    @classmethod
    @transaction.atomic
    def unassign_user(cls, *, role, user, actor):
        cls._guard_usable_role(role)
        cls._guard_system_mutation(role, actor)

        if actor is not None and actor.pk == user.pk:
            raise ValidationError("You cannot modify your own role assignments.")

        user_role = UserRole.objects.filter(
            user=user,
            role=role,
            is_deleted=False,
        ).first()
        if user_role is None:
            return None

        before = cls._admin_holder_ids()
        user_role.is_deleted = True
        user_role.deleted_at = timezone.now()
        user_role.deleted_by = actor
        user_role.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "updated_at",
            ]
        )
        cls._ensure_admins_remain(before)

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Removed role {role.name} from {user.email}.",
            metadata={
                "action": "unassign",
                "role_id": str(role.pk),
                "user_id": str(user.pk),
            },
        )
        return user_role

    # ------------------------------------------------------------------
    # Group attachment (a role granted to a group)
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def attach_group(cls, *, role, group, actor):
        cls._guard_usable_role(role)
        cls._guard_system_mutation(role, actor)
        cls._require_holds_role(actor, role)

        group_role = cls._activate_link(
            GroupRole,
            lookup={"group": group, "role": role},
        )

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Attached role {role.name} to group {group.name}.",
            metadata={
                "action": "attach",
                "role_id": str(role.pk),
                "group_id": str(group.pk),
            },
        )
        return group_role

    @classmethod
    @transaction.atomic
    def detach_group(cls, *, role, group, actor):
        cls._guard_usable_role(role)
        cls._guard_system_mutation(role, actor)

        group_role = GroupRole.objects.filter(
            group=group,
            role=role,
            is_deleted=False,
        ).first()
        if group_role is None:
            return None

        before = cls._admin_holder_ids()
        group_role.is_deleted = True
        group_role.deleted_at = timezone.now()
        group_role.deleted_by = actor
        group_role.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "updated_at",
            ]
        )
        cls._ensure_admins_remain(before)

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Detached role {role.name} from group {group.name}.",
            metadata={
                "action": "detach",
                "role_id": str(role.pk),
                "group_id": str(group.pk),
            },
        )
        return group_role


class GroupService(RbacGuardMixin, BusinessService):
    """Write operations for the platform-global Group."""

    model = Group

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(cls, *, user=None, **validated_data):
        cls._guard_unique_name(Group, validated_data.get("name", ""))
        return super().create(user=user, **validated_data)

    @classmethod
    @transaction.atomic
    def update(cls, instance, *, user=None, **validated_data):
        cls._guard_system_mutation(instance, user)

        new_code = validated_data.get("code")
        if new_code is not None and new_code != instance.code:
            raise ValidationError("Group code is immutable after creation.")

        if "name" in validated_data:
            cls._guard_unique_name(Group, validated_data["name"], exclude=instance)

        return super().update(instance, user=user, **validated_data)

    @classmethod
    @transaction.atomic
    def delete(cls, instance, *, user=None):
        cls._guard_system_delete(instance)
        return super().delete(instance, user=user)

    # ------------------------------------------------------------------
    # Membership
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def add_member(
        cls,
        *,
        group,
        user,
        actor,
        is_owner=False,
        is_manager=False,
    ):
        cls._guard_system_mutation(group, actor)
        cls._require_holds_group(actor, group)

        if actor is not None and actor.pk == user.pk:
            raise ValidationError(
                "You cannot add yourself to a group; an administrator must add you."
            )

        member = cls._activate_link(
            GroupMember,
            lookup={"group": group, "user": user},
            left_at=None,
            is_owner=is_owner,
            is_manager=is_manager,
        )

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Added {user.email} to group {group.name}.",
            metadata={
                "action": "add_member",
                "group_id": str(group.pk),
                "user_id": str(user.pk),
            },
        )
        return member

    @classmethod
    @transaction.atomic
    def remove_member(cls, *, group, user, actor):
        cls._guard_system_mutation(group, actor)

        member = GroupMember.objects.filter(
            group=group,
            user=user,
            is_deleted=False,
            left_at__isnull=True,
        ).first()
        if member is None:
            return None

        before = cls._admin_holder_ids()
        member.left_at = timezone.now()
        member.save(update_fields=["left_at", "updated_at"])

        # ``QuerySet.update``-style saves do not fire the cache signal, so the
        # member's stale grant must be evicted explicitly (DOM-RBAC-06).
        from apps.identity.services.permission_cache import PermissionCacheService

        PermissionCacheService.invalidate(user=user)

        cls._ensure_admins_remain(before)

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Removed {user.email} from group {group.name}.",
            metadata={
                "action": "remove_member",
                "group_id": str(group.pk),
                "user_id": str(user.pk),
            },
        )
        return member

    # ------------------------------------------------------------------
    # Role grants
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def grant_role(cls, *, group, role, actor):
        cls._guard_system_mutation(group, actor)
        cls._require_holds_role(actor, role)

        group_role = cls._activate_link(
            GroupRole,
            lookup={"group": group, "role": role},
        )

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Granted role {role.name} to group {group.name}.",
            metadata={
                "action": "grant_role",
                "group_id": str(group.pk),
                "role_id": str(role.pk),
            },
        )
        return group_role

    @classmethod
    @transaction.atomic
    def revoke_role(cls, *, group, role, actor):
        cls._guard_system_mutation(group, actor)

        group_role = GroupRole.objects.filter(
            group=group,
            role=role,
            is_deleted=False,
        ).first()
        if group_role is None:
            return None

        before = cls._admin_holder_ids()
        group_role.is_deleted = True
        group_role.deleted_at = timezone.now()
        group_role.deleted_by = actor
        group_role.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "updated_at",
            ]
        )
        cls._ensure_admins_remain(before)

        cls._audit(
            actor=actor,
            event_type=SecurityEventType.ROLE_CHANGED,
            description=f"Revoked role {role.name} from group {group.name}.",
            metadata={
                "action": "revoke_role",
                "group_id": str(group.pk),
                "role_id": str(role.pk),
            },
        )
        return group_role


class PermissionService(RbacGuardMixin, BusinessService):
    """
    Write operations for the permission catalog.

    System permissions are seeded by code: the API can neither mark a row as
    system nor delete one, and only a superuser may edit one (WP 4.3).
    """

    model = Permission

    @classmethod
    @transaction.atomic
    def create(cls, *, user=None, **validated_data):
        # API-created rows are custom; ``is_system`` is reserved for seeding.
        validated_data["is_system"] = False
        permission = super().create(user=user, **validated_data)

        cls._audit(
            actor=user,
            event_type=SecurityEventType.PERMISSION_CHANGED,
            description=f"Created permission {permission.code}.",
            metadata={"action": "create", "permission": permission.code},
        )
        return permission

    @classmethod
    @transaction.atomic
    def update(cls, instance, *, user=None, **validated_data):
        cls._guard_system_mutation(instance, user)

        new_code = validated_data.get("code")
        if new_code is not None and new_code != instance.code:
            raise ValidationError("Permission code is immutable after creation.")

        before = cls._admin_holder_ids()
        permission = super().update(instance, user=user, **validated_data)
        cls._ensure_admins_remain(before)

        cls._audit(
            actor=user,
            event_type=SecurityEventType.PERMISSION_CHANGED,
            description=f"Updated permission {permission.code}.",
            metadata={"action": "update", "permission": permission.code},
        )
        return permission

    @classmethod
    @transaction.atomic
    def delete(cls, instance, *, user=None):
        cls._guard_system_delete(instance)

        before = cls._admin_holder_ids()
        result = super().delete(instance, user=user)
        cls._ensure_admins_remain(before)

        cls._audit(
            actor=user,
            event_type=SecurityEventType.PERMISSION_CHANGED,
            description=f"Deleted permission {instance.code}.",
            metadata={"action": "delete", "permission": instance.code},
        )
        return result
