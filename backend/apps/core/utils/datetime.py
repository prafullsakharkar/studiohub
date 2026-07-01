"""
Datetime utilities.
"""

from __future__ import annotations

from django.utils import timezone


def now():
    """
    Current timezone-aware datetime.
    """
    return timezone.now()


def today():
    """
    Current date.
    """
    return timezone.localdate()


def is_past(dt):
    return dt < timezone.now()


def is_future(dt):
    return dt > timezone.now()
