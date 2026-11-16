"""
What the in-app notifications read from deliveries (docs/review-pipeline RP-13, C-RP-34, C-RP-35).

The notifications app never queries this app's models: it asks here who the people of a delivery
are, whether a person may open one ("in reach"), and what to call it. Reach is what
``GET deliveries/{id}/`` answers: ``delivery.view`` and the projects ``DeliverySelector`` narrows
to (full internal access; every project for a platform administrator). An old delivery that names
no project is never told: a notification belongs to a project.

``request`` is the caller's request when the inbox is read, or a stand-in holding only the
recipient when a row is written (``production.selectors.notification_sources.as_request``).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from apps.deliveries.constants import workflow as wf
from apps.deliveries.constants.permissions import DeliveryPermissions
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange, DeliveryVersionRef
from apps.deliveries.selectors.delivery import DeliverySelector
from apps.production.permissions.checks import has_permission_code

DELIVERY = "delivery"

#: the statuses before a delivery is sent: what a revoked file still changes (C-RP-35)
UNSENT = wf.WORKING_STATES | {wf.SIGNED_OFF}


def _uuids(values: Iterable[Any]) -> list[UUID]:
    found = []
    for value in values:
        try:
            found.append(UUID(str(value)))
        except (TypeError, ValueError):
            continue
    return found


def _people(*ids: Any) -> list[str]:
    """``ids`` as strings, each once, in order, without the empty ones."""
    return list(dict.fromkeys(str(pk) for pk in ids if pk))


class DeliveryNotificationSources:
    @staticmethod
    def _last_signers(delivery_ids: Iterable[Any]) -> dict[str, str]:
        """
        ``{delivery_id: user_id}``: the person of each delivery's latest move into Signed Off. A
        reopen clears ``signed_off_by``, and the person who signed off is still one of its people.
        """
        rows = (
            DeliveryStatusChange.objects.filter(
                delivery_id__in=_uuids(delivery_ids),
                to_status=wf.SIGNED_OFF,
                actor__isnull=False,
            )
            .order_by("delivery_id", "-at", "-id")
            .values_list("delivery_id", "actor_id")
        )
        found: dict[str, str] = {}
        for delivery_id, actor_id in rows:
            found.setdefault(str(delivery_id), str(actor_id))
        return found

    @classmethod
    def delivery(cls, delivery_id: Any) -> dict[str, Any] | None:
        """
        The live delivery ``delivery_id``: ``project_id`` and its people (its creator, whoever
        signed it off, whoever sent it); ``None`` if it is gone or names no project.
        """
        ids = _uuids([delivery_id])
        row = (
            DeliveryPackage.objects.filter(pk=ids[0], project__isnull=False)
            .values("project_id", "created_by_id", "signed_off_by_id", "sent_by_id")
            .first()
            if ids
            else None
        )
        if row is None:
            return None
        signer = row["signed_off_by_id"] or cls._last_signers(ids).get(str(ids[0]))
        return {
            "project_id": str(row["project_id"]),
            "people": _people(row["created_by_id"], signer, row["sent_by_id"]),
        }

    @classmethod
    def unsent_people(cls, version_id: Any) -> list[str]:
        """
        The people (creator, whoever signed it off) of every live, unsent delivery holding the
        version ``version_id``: the deliveries a revoked file of that version changes.
        """
        ids = _uuids([version_id])
        if not ids:
            return []
        rows = list(
            DeliveryPackage.objects.filter(
                pk__in=DeliveryVersionRef.objects.filter(version_id=ids[0]).values("delivery_id"),
                status__in=UNSENT,
                project__isnull=False,
            ).values_list("pk", "created_by_id", "signed_off_by_id")
        )
        signers = cls._last_signers(pk for pk, _, _ in rows)
        found: list[Any] = []
        for pk, creator, signer in rows:
            found += [creator, signer or signers.get(str(pk))]
        return _people(*found)

    @staticmethod
    def creator(delivery_id: Any) -> str | None:
        """Who created the live delivery ``delivery_id`` (a delivery milestone's delivery)."""
        ids = _uuids([delivery_id])
        if not ids:
            return None
        found = DeliveryPackage.objects.filter(pk=ids[0]).values_list("created_by_id", flat=True)
        first = found.first()
        return str(first) if first else None

    @staticmethod
    def readable_query(request: Any) -> QuerySet[Any]:
        """The ids of every live delivery the person of ``request`` may open, as a subquery."""
        user = getattr(request, "user", None)
        if (
            user is None
            or not getattr(user, "is_authenticated", False)
            or not getattr(user, "is_active", False)
            or not has_permission_code(request, DeliveryPermissions.VIEW)
        ):
            return DeliveryPackage.objects.none().values_list("pk", flat=True)
        return (
            DeliverySelector.get_queryset(request=request)
            .filter(project__isnull=False)
            .values_list("pk", flat=True)
        )

    @staticmethod
    def labels(ids: Iterable[Any]) -> dict[str, dict[str, Any]]:
        """``{id: {"code", "name", "record"}}`` of the live deliveries ``ids``, read now."""
        wanted = _uuids(ids)
        if not wanted:
            return {}
        rows = DeliveryPackage.objects.filter(pk__in=wanted).values_list("pk", "code", "name")
        return {str(pk): {"code": code, "name": name, "record": None} for pk, code, name in rows}
