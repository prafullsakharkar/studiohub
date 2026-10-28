"""
Serializer fields for the time policy (docs/scheduling/CONTRACTS.md section 1, decision Q31).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_naive
from rest_framework import serializers


class StrictDateTimeField(serializers.DateTimeField):
    """
    A moment with its time zone.

    ISO 8601 with ``Z`` or an offset (``2026-11-02T09:00:00+01:00``) is accepted and stored in UTC.
    A date-time with no offset used to be taken as UTC without a word; it is now a 400, so a client
    cannot book an hour off by mistake. A date with no time is invalid as before.
    """

    default_error_messages = {
        "naive": "Send the time zone too: end the date-time with Z or add an offset such as +02:00.",
    }

    def to_internal_value(self, value: Any) -> datetime:
        if isinstance(value, datetime) and is_naive(value):
            self.fail("naive")
        if isinstance(value, str):
            try:
                parsed = parse_datetime(value)
            except ValueError:
                parsed = None  # well formed but not a real date-time: the base class says so
            if parsed is not None and is_naive(parsed):
                self.fail("naive")
        return super().to_internal_value(value)
