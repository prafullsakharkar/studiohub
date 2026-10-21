from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.identity.models import (
    GroupMember,
    GroupRole,
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from apps.identity.services.permission_cache import PermissionCacheService


@receiver(post_save, sender=UserRole)
@receiver(post_delete, sender=UserRole)
def _user_role_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_role_holders_by_id(
        getattr(instance, "role_id", None),
    )


@receiver(post_save, sender=RolePermission)
@receiver(post_delete, sender=RolePermission)
def _role_permission_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_role_holders_by_id(
        getattr(instance, "role_id", None),
    )


@receiver(post_save, sender=GroupMember)
@receiver(post_delete, sender=GroupMember)
def _group_member_changed(sender, instance, **kwargs):
    # Django does not fire per-row ``post_delete`` for bulk
    # ``QuerySet.delete()`` — the API's serializer-driven single-row writes
    # do fire it, which is the supported path.
    PermissionCacheService.invalidate_group_members(
        getattr(instance, "group_id", None),
    )


@receiver(post_save, sender=GroupRole)
@receiver(post_delete, sender=GroupRole)
def _group_role_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_role_holders_by_id(
        getattr(instance, "role_id", None),
    )


@receiver(post_save, sender=Role)
@receiver(post_delete, sender=Role)
def _role_changed(sender, instance, **kwargs):
    if kwargs.get("update_fields") and "is_deleted" not in kwargs["update_fields"]:
        return
    PermissionCacheService.invalidate_role_holders(instance)


@receiver(post_save, sender=Permission)
@receiver(post_delete, sender=Permission)
def _permission_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_permission_holders(instance)
