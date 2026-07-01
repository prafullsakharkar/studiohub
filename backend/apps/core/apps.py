from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "apps.core"

    def ready(self):
        from apps.core.events.autodiscover import (
            autodiscover_events,
        )

        autodiscover_events()
