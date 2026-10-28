import contextlib

from django.apps import AppConfig


class ProductionConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"

    name = "apps.production"

    verbose_name = "Production"

    def ready(self):
        from . import providers

        providers.register()

        # Import signals if any
        with contextlib.suppress(ImportError):
            from . import signals  # noqa: F401
