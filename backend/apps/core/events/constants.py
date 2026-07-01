"""
Event framework constants.
"""

from __future__ import annotations


class EventVersion:
    """
    Supported event schema versions.
    """

    V1 = 1


class EventSource:
    """
    Event source identifiers.
    """

    SYSTEM = "system"

    API = "api"

    ADMIN = "admin"

    SERVICE = "service"

    SIGNAL = "signal"

    TASK = "task"

    MANAGEMENT_COMMAND = "management_command"
