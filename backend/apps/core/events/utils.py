"""
Utilities for events.
"""

from __future__ import annotations

from apps.core.events.base import BaseEvent


def event_name(event: BaseEvent) -> str:
    """
    Return the event class name.
    """
    return event.__class__.__name__


def event_module(event: BaseEvent) -> str:
    """
    Return the module defining the event.
    """
    return event.__class__.__module__
