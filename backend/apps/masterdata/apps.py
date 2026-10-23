from django.apps import AppConfig


class MasterDataConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.masterdata"
    label = "masterdata"
    verbose_name = "Master Data"

    def ready(self) -> None:
        from apps.masterdata.logging_policy import register_query_redaction

        register_query_redaction()

        from apps.masterdata.signals.identity_sync import connect

        connect()
