"""
Who may administer whom (TPN review TM-022).

The permission to administer users (``identity.user.update``, ``.deactivate``, ``.reset_password`` ...)
says what an actor may do, not to whom. Without a rule on the target, a holder of
``identity.user.reset_password`` could force a reset and revoke every session of a superuser or of
an administrator with far more access than their own.

The rule is the one the RBAC services already apply to grants: you cannot act on someone who holds
more than you do. A superuser may act on anyone; only a superuser may act on a superuser; acting on
yourself is allowed here (the last-administrator guard covers removal).
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import PermissionDenied

from apps.core.logging.logger import get_logger
from apps.identity.services.rbac import RbacGuardMixin

logger = get_logger("authorization")


class UserAdministrationGuard:
    @classmethod
    def require_may_administer(cls, actor: Any, target: Any) -> None:
        """Raise ``PermissionDenied`` unless ``actor`` may administer ``target``."""
        if actor is None or getattr(actor, "is_superuser", False):
            return

        if actor.pk == target.pk:
            return

        if getattr(target, "is_superuser", False):
            cls._deny(actor, target, "superuser")

        missing = RbacGuardMixin._resolve_permissions(target) - RbacGuardMixin._resolve_permissions(
            actor
        )

        if missing:
            cls._deny(actor, target, "more_permissions")

    @staticmethod
    def _deny(actor: Any, target: Any, reason: str) -> None:
        logger.warning(
            "user_administration_denied",
            actor_id=str(actor.pk),
            target_id=str(target.pk),
            reason=reason,
        )
        raise PermissionDenied("You cannot administer a user who holds more access than you do.")
