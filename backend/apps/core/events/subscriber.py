# subscriber.py

from .bus import default_event_bus


def subscribe(event, handler):
    default_event_bus.subscribe(event, handler)
