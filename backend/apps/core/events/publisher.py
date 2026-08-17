# publisher.py

from .bus import default_event_bus


def publish(event, *, on_commit: bool = False):
    default_event_bus.dispatcher.dispatch(
        event,
        on_commit=on_commit,
    )
