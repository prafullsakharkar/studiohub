from django.apps import AppConfig


class OrganizationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"

    name = "apps.organization"

    verbose_name = "Organization"

    def ready(self):
        """
        Import signal handlers so receivers are registered.
        """
        from . import signals  # noqa: F401
