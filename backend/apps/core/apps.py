from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "apps.core"

    def ready(self):
        from apps.core.events.autodiscover import (
            autodiscover_events,
        )
        from apps.core.logging.structlog_config import (
            configure_structlog,
        )

        autodiscover_events()
        configure_structlog()
