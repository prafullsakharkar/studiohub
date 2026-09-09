"""
Event bus.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.events.dispatcher import EventDispatcher
from apps.core.events.registry import EventRegistry


class EventBus:

    def __init__(self):

        self.registry = EventRegistry()

        self.dispatcher = EventDispatcher(
            self.registry,
        )

    def publish(self, event):
        """
        Publish an event.

        If currently inside a transaction, defer dispatch until after commit to
        ensure handlers observe committed database state. If not in a
        transaction, dispatch immediately.
        """
        # Use the current connection's atomic flag
        conn = transaction.get_connection()
        if getattr(conn, "in_atomic_block", False):
            # Defer dispatch until after successful commit
            transaction.on_commit(lambda: self.dispatcher.dispatch(event))
        else:
            self.dispatcher.dispatch(event)

    def subscribe(
        self,
        event,
        handler,
    ):
        self.registry.register(
            event,
            handler,
        )


default_event_bus = EventBus()
