"""
What Production offers to apps that must not import it (see ``apps.core.providers``).

Identity decides who must use MFA; whether someone is an external (vendor/client) member of a project
is Production's fact, so Identity asks for it by name.
"""

from __future__ import annotations

from typing import Any

from apps.core import providers

EXTERNAL_MEMBERSHIP = "production.external_membership"


class ExternalMembership:
    def is_external(self, user: Any) -> bool:
        """Whether ``user`` is an active vendor or client member of any project."""
        from apps.production.selectors.base import ProductionBaseSelector

        return bool(ProductionBaseSelector.external_grants(user))


def register() -> None:
    providers.register(EXTERNAL_MEMBERSHIP, ExternalMembership())
