"""
Delivery figures as Production reads them, without importing Deliveries
(docs/delivery-pipeline/CONTRACTS.md X-01, X-05).

Deliveries registers a provider at startup; this module asks for it by name. When no provider is
registered every answer is empty (zero, no rows) and never an error.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from apps.core import providers

PROJECT_FIGURES = "deliveries.project_figures"

#: The permission of the nested ``/projects/{id}/deliveries`` route. A plain string: this app
#: does not import Deliveries' constants either.
DELIVERY_VIEW = "delivery.view"


class _NoDeliveries:
    view_permission = DELIVERY_VIEW
    selector_class = None
    list_serializer_class = None

    def count(self, project: Any) -> int:
        return 0

    def status_rows(self, project: Any) -> list[dict[str, Any]]:
        return []

    def recent_items(self, project: Any, limit: int = 6) -> list[dict[str, Any]]:
        return []

    def next_due(self, project: Any, today: date) -> dict[str, Any] | None:
        return None

    def entity_ids(self, project: Any) -> list[Any]:
        return []


def delivery_figures() -> Any:
    """The registered delivery provider, or one that answers empty."""
    return providers.get(PROJECT_FIGURES) or _NoDeliveries()
