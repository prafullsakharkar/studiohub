# publisher.py

from .bus import default_event_bus


def publish(event):
    default_event_bus.publish(event)
