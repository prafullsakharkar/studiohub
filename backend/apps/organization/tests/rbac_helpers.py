"""
Shared RBAC test helpers.

Grants permission codes to users through the real RBAC rows
(Role -> RolePermission -> Permission, assigned via UserRole for global
grants or OrganizationMembership.role for organization grants) so API tests
exercise the same resolution path as production.

Mirrors the seed convention (apps/core/management/commands/seed_dev.py):
Permission rows are keyed by ``code``; module/action are derived from the
code and are DB-unconstrained (choices apply at validation only).
"""

from __future__ import annotations

import uuid

from django.db import IntegrityError, transaction

from apps.identity.services.permission_cache import PermissionCacheService
from apps.organization.models import (
    OrganizationMembership,
    Permission,
    Role,
    RolePermission,
    UserRole,
)

PERMISSION_CONSTANT_MODULES = (
    "apps.audit.constants.permissions",
    "apps.deliveries.constants.permissions",
    "apps.identity.constants.permissions",
    "apps.organization.constants.permissions",
    "apps.platform.constants.permissions",
    "apps.production.constants.permissions",
    "apps.publishing.constants.permissions",
    "apps.scheduling.constants.permissions",
)


def _split_code(code: str) -> tuple[str, str]:
    """Derive a unique (module, action) pair from a permission code."""
    for sep in (":", "."):
        if sep in code:
            head, _, tail = code.rpartition(sep)
            if head and tail:
                return head[:50], tail[:50]
    return code[:50], "view"


def ensure_permission(code: str) -> Permission:
    """Get-or-create the Permission row for ``code``."""
    module, action = _split_code(code)
    try:
        with transaction.atomic():
            permission, _ = Permission.objects.get_or_create(
                code=code,
                defaults={
                    "name": code,
                    "module": module,
                    "action": action,
                    "category": "general",
                    "is_system": False,
                    "is_active": True,
                },
            )
            return permission
    except IntegrityError:
        # A different code already owns the derived (module, action) pair
        # (unique together); suffix the module to keep this code resolvable.
        with transaction.atomic():
            permission, _ = Permission.objects.get_or_create(
                code=code,
                defaults={
                    "name": code,
                    "module": f"{module}_{uuid.uuid4().hex[:6]}",
                    "action": action,
                    "category": "general",
                    "is_system": False,
                    "is_active": True,
                },
            )
            return permission


def all_known_permission_codes() -> list[str]:
    """Collect every permission code string from the constants modules."""
    import importlib

    codes: list[str] = []
    for module_name in PERMISSION_CONSTANT_MODULES:
        try:
            module = importlib.import_module(module_name)
        except ImportError:
            continue
        for attr_name in dir(module):
            if attr_name.startswith("_"):
                continue
            container = getattr(module, attr_name)
            if not isinstance(container, type):
                continue
            for member_name, value in vars(container).items():
                if member_name.isupper() and isinstance(value, str):
                    codes.append(value)
    return sorted(set(codes))


def grant_all_known_codes(user, organization=None) -> Role:
    """Grant every known permission code to ``user`` (test operator setup)."""
    return grant_permissions(user, *all_known_permission_codes(), organization=organization)


def grant_permissions(user, *codes: str, organization=None) -> Role:
    """
    Grant permission ``codes`` to ``user`` and invalidate cached permissions.

    Without ``organization`` the grant flows through a global Role + UserRole
    (applies in every org context). With ``organization`` the grant flows
    through the user's membership role in that organization (membership is
    created when missing).
    """
    role = Role.objects.create(
        name=f"Test Grants {uuid.uuid4().hex[:8]}",
        code=f"test-grants-{uuid.uuid4().hex[:12]}",
        organization=organization,
        is_system=False,
        is_active=True,
    )
    for code in codes:
        RolePermission.objects.get_or_create(
            role=role,
            permission=ensure_permission(code),
            defaults={"granted": True},
        )
    if organization is None:
        UserRole.objects.get_or_create(user=user, role=role)
    else:
        # NOTE: no update_or_create — the membership manager's select_related
        # outer joins are incompatible with its SELECT FOR UPDATE on Postgres.
        membership = OrganizationMembership.objects.filter(
            user=user, organization=organization
        ).first()
        if membership is None:
            OrganizationMembership.objects.create(
                user=user, organization=organization, role=role, status="active"
            )
        elif membership.role_id != role.id or membership.status != "active":
            membership.role = role
            membership.status = "active"
            membership.save(update_fields=["role", "status", "updated_at"])
    PermissionCacheService.invalidate(user=user)
    return role
