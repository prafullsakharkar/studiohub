from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"
    label = "audit"
    verbose_name = "Audit"

    def ready(self):
        # Bounded change-tracking receivers (explicit model list only).
        from apps.audit.signals.change_tracking import register_change_tracking

        register_change_tracking()
