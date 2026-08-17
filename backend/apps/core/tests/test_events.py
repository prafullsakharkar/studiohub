"""
Tests for the Core event framework.

Covers registration, publishing, dispatch, subscription, handler execution,
failure isolation, transaction-safe dispatch, and event typing.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from django.db import transaction

from apps.core.events import (
    DomainEvent,
    DomainEventHandler,
    EventBus,
    EventDispatchError,
    EventRegistry,
    event_type,
    publish,
    subscribe,
)
from apps.core.events.bus import default_event_bus
from apps.core.events.dispatcher import EventDispatcher


@dataclass(frozen=True)
class SampleEvent(DomainEvent):
    value: str = "default"


@dataclass(frozen=True)
class TypedEvent(DomainEvent):
    event_type = "test.typed.event"
    value: str = "typed"


class RecordingHandler(DomainEventHandler):
    """Handler that records every event it handles."""

    received: list = []

    def handle(self, event: DomainEvent) -> None:
        self.received.append(event)


class FailingHandler(DomainEventHandler):
    def handle(self, event: DomainEvent) -> None:
        raise RuntimeError("handler boom")


@pytest.fixture(autouse=True)
def _clear_registry():
    """Ensure a clean registry before and after each test."""
    default_event_bus.registry.clear()
    RecordingHandler.received = []
    yield
    default_event_bus.registry.clear()
    RecordingHandler.received = []


# ============================================================================
# Event typing
# ============================================================================


class TestEventType:
    def test_declared_event_type(self):
        """A subclass event_type attribute is used."""
        assert TypedEvent().event_type == "test.typed.event"

    def test_default_event_type_uses_class_name(self):
        """Without a declared event_type, the class name is used."""
        assert SampleEvent().event_type == "SampleEvent"

    def test_event_type_helper(self):
        """The event_type() helper returns the stable identifier."""
        assert event_type(TypedEvent()) == "test.typed.event"

    def test_event_has_identity_fields(self):
        """Every event carries identity and timing metadata."""
        event = SampleEvent()
        assert event.event_id is not None
        assert event.occurred_at is not None
        assert event.version == 1
        assert event.source == "service"


# ============================================================================
# Registration & subscription
# ============================================================================


class TestRegistration:
    def test_subscribe_registers_handler(self):
        """subscribe() registers a handler for an event type."""
        subscribe(SampleEvent, RecordingHandler)
        assert RecordingHandler in default_event_bus.registry.handlers_for(SampleEvent())

    def test_register_is_idempotent(self):
        """Registering the same handler twice does not duplicate it."""
        registry = EventRegistry()
        registry.register(SampleEvent, RecordingHandler)
        registry.register(SampleEvent, RecordingHandler)
        assert len(registry.handlers_for(SampleEvent())) == 1

    def test_unregister_removes_handler(self):
        """unregister() removes a previously registered handler."""
        registry = EventRegistry()
        registry.register(SampleEvent, RecordingHandler)
        registry.unregister(SampleEvent, RecordingHandler)
        assert registry.handlers_for(SampleEvent()) == []

    def test_clear_removes_all(self):
        """clear() empties the registry."""
        registry = EventRegistry()
        registry.register(SampleEvent, RecordingHandler)
        registry.clear()
        assert registry.handlers_for(SampleEvent()) == []


# ============================================================================
# Publishing & dispatch
# ============================================================================


class TestPublishing:
    def test_publish_dispatches_to_handler(self):
        """publish() runs the registered handler."""
        subscribe(SampleEvent, RecordingHandler)
        publish(SampleEvent(value="hello"))
        assert len(RecordingHandler.received) == 1
        assert RecordingHandler.received[0].value == "hello"

    def test_event_bus_classmethod_publish(self):
        """EventBus.publish works as a classmethod (no instance needed)."""
        subscribe(SampleEvent, RecordingHandler)
        EventBus.publish(SampleEvent())
        assert len(RecordingHandler.received) == 1

    def test_publish_with_no_handlers_is_noop(self):
        """Publishing an event with no handlers does not raise."""
        publish(SampleEvent())

    def test_multiple_handlers_all_run(self):
        """All registered handlers run for a single event."""

        class SecondHandler(DomainEventHandler):
            def handle(self, event: DomainEvent) -> None:
                RecordingHandler.received.append(event)

        subscribe(SampleEvent, RecordingHandler)
        subscribe(SampleEvent, SecondHandler)
        publish(SampleEvent())
        assert len(RecordingHandler.received) == 2

    def test_handlers_only_receive_matching_event_type(self):
        """Handlers are only invoked for their registered event type."""
        subscribe(SampleEvent, RecordingHandler)
        publish(TypedEvent())
        assert RecordingHandler.received == []


# ============================================================================
# Handler failure isolation
# ============================================================================


class TestFailureIsolation:
    def test_failing_handler_does_not_block_others(self):
        """A failing handler does not prevent other handlers from running."""

        class GoodHandler(DomainEventHandler):
            def handle(self, event: DomainEvent) -> None:
                RecordingHandler.received.append(event)

        subscribe(SampleEvent, FailingHandler)
        subscribe(SampleEvent, GoodHandler)

        with pytest.raises(EventDispatchError):
            publish(SampleEvent())

        # The good handler still ran despite the failure.
        assert len(RecordingHandler.received) == 1

    def test_dispatch_error_wraps_handler_failure(self):
        """Handler failures surface as EventDispatchError."""
        subscribe(SampleEvent, FailingHandler)
        with pytest.raises(EventDispatchError):
            publish(SampleEvent())


# ============================================================================
# Transaction-safe dispatch
# ============================================================================


class TestTransactionSafeDispatch:
    def test_on_commit_defers_until_commit(self, db):
        """on_commit=True defers dispatch until the transaction commits."""
        subscribe(SampleEvent, RecordingHandler)

        with transaction.atomic():
            publish(SampleEvent(), on_commit=True)
            # Not yet dispatched inside the atomic block.
            assert RecordingHandler.received == []

        # Dispatched after the block commits.
        assert len(RecordingHandler.received) == 1

    def test_on_commit_skips_dispatch_on_rollback(self, db):
        """Events published with on_commit are dropped on rollback."""
        subscribe(SampleEvent, RecordingHandler)

        with pytest.raises(RuntimeError):
            with transaction.atomic():
                publish(SampleEvent(), on_commit=True)
                raise RuntimeError("rollback")

        assert RecordingHandler.received == []

    def test_immediate_dispatch_outside_transaction(self, db):
        """Without on_commit, dispatch is immediate even in a transaction."""
        subscribe(SampleEvent, RecordingHandler)

        with transaction.atomic():
            publish(SampleEvent())

        assert len(RecordingHandler.received) == 1

    def test_dispatcher_on_commit_flag(self, db):
        """EventDispatcher honors the on_commit flag directly."""
        registry = EventRegistry()
        registry.register(SampleEvent, RecordingHandler)
        dispatcher = EventDispatcher(registry)

        with transaction.atomic():
            dispatcher.dispatch(SampleEvent(), on_commit=True)
            assert RecordingHandler.received == []

        assert len(RecordingHandler.received) == 1
