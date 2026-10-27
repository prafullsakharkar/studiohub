"""
Deliveries app configuration.
"""
from django.apps import AppConfig


class DeliveriesConfig(AppConfig):
    """Deliveries app configuration."""
    name = "apps.deliveries"
    verbose_name = "Deliveries"

    def ready(self) -> None:
        from apps.deliveries import providers

        providers.register()
