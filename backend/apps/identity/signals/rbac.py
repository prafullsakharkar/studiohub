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
    # Django's Collector fires ``post_delete`` per row even for bulk
    # ``QuerySet.delete()``, so this covers both single-row and bulk removal
    # (DOM-RBAC-08). ``QuerySet.update()`` does NOT fire signals — the
    # GroupService.leave path sets ``left_at`` and invalidates explicitly.
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
    # Invalidate on EVERY save: ``update_fields`` saves of any field can
    # change resolution-relevant state (``is_active``, ``is_deleted``), and
    # distinguishing is fragile. Holder caches are cheap to evict and the
    # next lookup re-resolves.
    PermissionCacheService.invalidate_role_holders(instance)


@receiver(post_save, sender=Permission)
@receiver(post_delete, sender=Permission)
def _permission_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_permission_holders(instance)
