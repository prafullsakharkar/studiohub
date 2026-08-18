"""
Utilities for events.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


def event_name(event: DomainEvent) -> str:
    """
    Return the event class name.
    """
    return event.__class__.__name__


def event_module(event: DomainEvent) -> str:
    """
    Return the module defining the event.
    """
    return event.__class__.__module__
