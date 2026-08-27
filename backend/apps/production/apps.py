from django.apps import AppConfig


class ProductionConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"

    name = "apps.production"

    verbose_name = "Production"

    def ready(self):
        # Import signals if any
        try:
            from . import signals  # noqa: F401
        except ImportError:
            pass
