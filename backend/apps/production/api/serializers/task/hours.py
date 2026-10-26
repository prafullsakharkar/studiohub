"""A task's derived hours in responses (D-15). Never writable; see ``selectors/rollups.py``."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.production.selectors.rollups import ZERO, TaskHoursSelector, hours_text


class TaskHoursMixin(serializers.Serializer[Any]):
    logged_hours = serializers.SerializerMethodField()
    pending_hours = serializers.SerializerMethodField()

    def get_logged_hours(self, obj) -> str:
        return hours_text(TaskHoursSelector.of(obj)[0])

    def get_pending_hours(self, obj) -> str:
        return hours_text(TaskHoursSelector.of(obj)[1])

    def current_value(self, name):
        """What ``LockedFieldsMixin`` compares a sent ``logged_hours`` with: the derived value."""
        if name == "logged_hours":
            instance = getattr(self, "instance", None)
            return TaskHoursSelector.of(instance)[0] if instance is not None else Decimal(ZERO)
        return super().current_value(name)  # pyright: ignore[reportAttributeAccessIssue]
