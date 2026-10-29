"""
Identity-native RBAC test helpers.

Grants permission codes to users through the platform-global RBAC rows
(Role -> RolePermission -> Permission, assigned via UserRole) so API tests
exercise the same resolution path as production.

Mirrors the seed convention: Permission rows are keyed by ``code``;
module/action are derived from the code and are DB-unconstrained (choices
apply at validation only).
"""

from __future__ import annotations

import uuid

from django.db import IntegrityError, transaction

from apps.identity.models import (
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from apps.identity.services.permission_cache import PermissionCacheService


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

    modules = (
        "apps.audit.constants.permissions",
        "apps.deliveries.constants.permissions",
        "apps.identity.constants.permissions",
        "apps.masterdata.constants.permissions",
        "apps.production.constants.permissions",
        "apps.publishing.constants.permissions",
        "apps.scheduling.constants.permissions",
        "apps.settings.constants.permissions",
    )
    codes: list[str] = []
    for module_name in modules:
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


def _ensure_permissions(codes: tuple[str, ...]) -> list[Permission]:
    """Get-or-create the Permission rows for ``codes`` in a few queries.

    ``grant_all_known_codes`` asks for ~130 codes per call and every test
    rolls its rows back, so one ``get_or_create`` per code (plus its signal
    queries) dominated test setup. Same (module, action) collision rule as
    ``ensure_permission``.
    """
    unique = list(dict.fromkeys(codes))
    found = {p.code: p for p in Permission.objects.filter(code__in=unique)}
    missing = [code for code in unique if code not in found]
    if missing:
        derived = {code: _split_code(code) for code in missing}
        taken = set(
            Permission.objects.filter(
                module__in={module for module, _ in derived.values()},
            ).values_list("module", "action"),
        )
        new_rows = []
        for code, (module, action) in derived.items():
            if (module, action) in taken:
                module = f"{module}_{uuid.uuid4().hex[:6]}"
            taken.add((module, action))
            new_rows.append(
                Permission(
                    code=code,
                    name=code,
                    module=module,
                    action=action,
                    category="general",
                    is_system=False,
                    is_active=True,
                ),
            )
        Permission.objects.bulk_create(new_rows)
        found.update({p.code: p for p in new_rows})
    return [found[code] for code in unique]


def grant_permissions(user, *codes: str) -> Role:
    """Grant global permission ``codes`` to ``user`` via UserRole."""
    role = Role.objects.create(
        name=f"Test Grants {uuid.uuid4().hex[:8]}",
        code=f"test-grants-{uuid.uuid4().hex[:12]}",
        is_system=False,
        is_active=True,
    )
    # The role is new and has no holders yet, so the per-row RolePermission
    # signals would only evict nothing; the invalidate below covers ``user``.
    RolePermission.objects.bulk_create(
        [
            RolePermission(role=role, permission=permission, granted=True)
            for permission in _ensure_permissions(codes)
        ],
    )
    UserRole.objects.get_or_create(user=user, role=role)
    PermissionCacheService.invalidate(user=user)
    return role


def grant_all_known_codes(user) -> Role:
    """Grant every known permission code to ``user`` (test operator setup)."""
    return grant_permissions(user, *all_known_permission_codes())
