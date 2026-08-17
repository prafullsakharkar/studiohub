"""
Event dispatcher.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.events.base import DomainEvent
from apps.core.events.exceptions import EventDispatchError
from apps.core.events.registry import EventRegistry


class EventDispatcher:

    def __init__(
        self,
        registry: EventRegistry,
    ) -> None:
        self.registry = registry

    def dispatch(
        self,
        event: DomainEvent,
        *,
        on_commit: bool = False,
    ) -> None:
        """
        Dispatch an event to all registered handlers.

        When ``on_commit`` is True and the caller is inside an atomic block,
        dispatch is deferred until the transaction commits. This prevents
        handlers from observing state that may later be rolled back.

        Handler failures are isolated: a failing handler does not prevent
        other handlers from running. The first failure is re-raised as an
        ``EventDispatchError`` after all handlers have been attempted.
        """
        if on_commit and transaction.get_autocommit() is False:
            transaction.on_commit(
                lambda: self._dispatch_now(event),
            )
            return

        self._dispatch_now(event)

    def _dispatch_now(
        self,
        event: DomainEvent,
    ) -> None:
        """
        Run all handlers for ``event`` immediately.
        """
        handlers = self.registry.handlers_for(event)

        if not handlers:
            return

        first_error: Exception | None = None

        for handler_cls in handlers:
            try:
                handler_cls().handle(event)
            except Exception as exc:  # noqa: BLE001 - isolate handler failures
                if first_error is None:
                    first_error = exc

        if first_error is not None:
            raise EventDispatchError(
                f"One or more handlers failed for event {event.event_type!r}"
            ) from first_error
