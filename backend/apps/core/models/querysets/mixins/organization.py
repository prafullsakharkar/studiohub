from __future__ import annotations

from collections.abc import Callable
from typing import Any, ClassVar


class OrganizationQuerySetMixin:
    # Mixin contract: provided by the QuerySet subclass.
    filter: ClassVar[Callable[..., Any]]

    def organization(self, organization):
        return self.filter(organization=organization)
