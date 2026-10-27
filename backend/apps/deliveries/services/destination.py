"""
Delivery destinations (docs/deliveries/CONTRACTS.md DOM-DLV-10, API-DLV-18).

A destination name is unique in any case among live destinations and at most one live destination
is the default; choosing a new default clears the old one in the same transaction. The database
holds both rules as constraints too, so two requests that race cannot both win.
"""

from __future__ import annotations

from typing import Any

from django.db import IntegrityError, transaction
from django.db.models.functions import Upper
from rest_framework.exceptions import ValidationError

from apps.core.api.exceptions.api import NotFoundException
from apps.deliveries.models import DeliveryDestination


def address(destination: Any) -> str:
    """The address a destination shows for a delivery: its target directory, else its endpoint."""
    return destination.target_directory or destination.endpoint


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def name_taken(name: str, *, exclude: Any = None) -> bool:
    """Whether a live destination already has ``name``, ignoring case and surrounding spaces."""
    taken = DeliveryDestination.objects.annotate(uname=Upper("name")).filter(
        uname=(name or "").strip().upper()
    )
    if exclude is not None:
        taken = taken.exclude(pk=exclude)
    return taken.exists()


def _check_name(name: str, *, exclude: Any = None) -> None:
    if name_taken(name, exclude=exclude):
        raise ValidationError({"name": ["A destination with this name already exists."]})


def clear_other_defaults(keep: Any = None) -> None:
    """Make every live destination but ``keep`` a non-default (call inside a transaction)."""
    others = DeliveryDestination.objects.select_for_update().filter(is_default=True)
    if keep is not None:
        others = others.exclude(pk=keep)
    for destination in others:
        destination.is_default = False
        destination.save(update_fields=["is_default", "updated_at"])


class DestinationService:
    @classmethod
    @transaction.atomic
    def create(cls, *, actor: Any, data: dict[str, Any]) -> DeliveryDestination:
        data = dict(data)
        data["name"] = (data.get("name") or "").strip()
        _check_name(data["name"])
        if data.get("is_default"):
            clear_other_defaults()
        try:
            with transaction.atomic():
                return DeliveryDestination.objects.create(created_by=_actor_or_none(actor), **data)
        except IntegrityError as error:
            raise ValidationError(
                {"name": ["This name, or the default, was changed by someone else just now."]}
            ) from error

    @classmethod
    @transaction.atomic
    def update(cls, *, actor: Any, destination: Any, data: dict[str, Any]) -> DeliveryDestination:
        pk = getattr(destination, "pk", destination)
        try:
            locked = DeliveryDestination.objects.select_for_update().get(pk=pk)
        except DeliveryDestination.DoesNotExist as error:
            raise NotFoundException() from error
        data = dict(data)
        if "name" in data:
            data["name"] = (data["name"] or "").strip()
            _check_name(data["name"], exclude=locked.pk)
        if data.get("is_default") and not locked.is_default:
            clear_other_defaults(keep=locked.pk)
        for name, value in data.items():
            setattr(locked, name, value)
        locked.updated_by = _actor_or_none(actor)
        try:
            with transaction.atomic():
                locked.save()
        except IntegrityError as error:
            raise ValidationError(
                {"name": ["This name, or the default, was changed by someone else just now."]}
            ) from error
        return locked
