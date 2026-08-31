from django.test import TestCase
from django.db import transaction

from apps.core.events.base import DomainEvent
from apps.core.events.bus import default_event_bus


class DummyEvent(DomainEvent):
    pass


class TestEventBus(TestCase):
    def tearDown(self) -> None:
        # Clear registry between tests
        default_event_bus.registry.clear()
        return super().tearDown()

    def test_subscribe_and_publish_outside_transaction(self):
        calls = []

        class DummyHandler:
            def handle(self, event):
                calls.append(event)

        default_event_bus.subscribe(DummyEvent, DummyHandler)

        # TestCase wraps tests in an atomic block, so on_commit is deferred;
        # captureOnCommitCallbacks executes the deferred dispatch.
        with self.captureOnCommitCallbacks(execute=True):
            default_event_bus.publish(DummyEvent(foo=1))

        self.assertEqual(len(calls), 1)
        self.assertIsInstance(calls[0], DummyEvent)
        self.assertEqual(calls[0].payload.get("foo"), 1)

    def test_publish_deferred_until_commit(self):
        calls = []

        class DummyHandler:
            def handle(self, event):
                calls.append(event)

        default_event_bus.subscribe(DummyEvent, DummyHandler)

        with self.captureOnCommitCallbacks(execute=True):
            with transaction.atomic():
                default_event_bus.publish(DummyEvent(bar=2))
                # handler should not yet have been called
                self.assertEqual(len(calls), 0)
        # after exiting the transaction, on_commit should fire
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].payload.get("bar"), 2)

    def test_publish_not_called_on_rollback(self):
        calls = []

        class DummyHandler:
            def handle(self, event):
                calls.append(event)

        default_event_bus.subscribe(DummyEvent, DummyHandler)

        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    default_event_bus.publish(DummyEvent(baz=3))
                    raise RuntimeError("force rollback")

        # on rollback, handler should not be called
        self.assertEqual(len(calls), 0)
