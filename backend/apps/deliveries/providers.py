"""
What Deliveries offers to apps that must not import it (docs/delivery-pipeline/CONTRACTS.md X-05).

Production's dashboard, project summary, activity feed and nested deliveries route read delivery
figures through this provider, registered under ``PROJECT_FIGURES`` when the app loads.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from apps.core import providers

PROJECT_FIGURES = "deliveries.project_figures"


class ProjectDeliveryFigures:
    """Delivery figures for one project. Every method takes the project (a model instance)."""

    #: the view permission of the nested route, so Production need not import Deliveries' constants
    view_permission = "delivery.view"

    @property
    def selector_class(self):
        from apps.deliveries.selectors.delivery import DeliverySelector

        return DeliverySelector

    @property
    def filterset_class(self):
        from apps.deliveries.api.filtersets.delivery import DeliveryFilterSet

        return DeliveryFilterSet

    @property
    def list_serializer_class(self):
        from apps.deliveries.api.serializers.delivery import DeliveryListSerializer

        return DeliveryListSerializer

    @staticmethod
    def _packages():
        from apps.deliveries.models import DeliveryPackage

        return DeliveryPackage.objects

    def count(self, project: Any) -> int:
        return self._packages().filter(project=project).count()

    def status_rows(self, project: Any) -> list[dict[str, Any]]:
        """``{"status", "expires_at"}`` of every delivery of the project."""
        return list(self._packages().filter(project=project).values("status", "expires_at"))

    def recent_items(self, project: Any, limit: int = 6) -> list[dict[str, Any]]:
        """The dashboard's delivery cards, newest update first."""
        rows = (
            self._packages()
            .filter(project=project)
            .select_related("client")
            .prefetch_related("versions")
            .order_by("-updated_at")[:limit]
        )
        return [self._card(delivery) for delivery in rows]

    def next_due(self, project: Any, today: date) -> dict[str, Any] | None:
        """The delivery with the nearest due date from ``today``: ``{"title", "due"}`` or ``None``."""
        upcoming = (
            self._packages()
            .filter(project=project, expires_at__date__gte=today)
            .order_by("expires_at")
            .first()
        )
        if upcoming is None or upcoming.expires_at is None:
            return None
        return {"title": upcoming.name, "due": upcoming.expires_at.date()}

    def entity_ids(self, project: Any) -> list[Any]:
        return list(self._packages().filter(project=project).values_list("id", flat=True))

    @staticmethod
    def _card(delivery: Any) -> dict[str, Any]:
        client = getattr(delivery, "client", None)
        try:
            item_count = delivery.version_count
        except Exception:  # noqa: BLE001
            item_count = 0
        card: dict[str, Any] = {
            "id": str(delivery.id),
            "title": delivery.name,
            "package_name": delivery.code or "TURNOVER_PKG",
            "status": delivery.status or "Draft",
            "recipient": getattr(client, "name", "") or "",
        }
        expires_at = getattr(delivery, "expires_at", None)
        # The dashboard contract requires `due_date` (a string); empty when unscheduled.
        card["due_date"] = expires_at.date().isoformat() if expires_at is not None else ""
        if item_count:
            card["item_count"] = item_count
        return card


def register() -> None:
    providers.register(PROJECT_FIGURES, ProjectDeliveryFigures())
