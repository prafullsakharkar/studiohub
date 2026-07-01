"""
Event framework exceptions.
"""

from __future__ import annotations


class EventError(Exception):
    """
    Base event exception.
    """


class EventRegistrationError(EventError):
    """
    Raised when registering an invalid event handler.
    """


class EventDispatchError(EventError):
    """
    Raised when event dispatch fails.
    """


class InvalidEventError(EventError):
    """
    Raised when an object is not a valid event.
    """
