from django.contrib import admin

from apps.identity.admin.ledger import ReadOnlyLedgerAdminMixin
from apps.identity.models import DirectoryConfiguration, ExternalIdentity

__all__ = ["DirectoryConfigurationAdmin", "ExternalIdentityAdmin"]


@admin.register(DirectoryConfiguration)
class DirectoryConfigurationAdmin(ReadOnlyLedgerAdminMixin, admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    # Changed only from Settings -> System -> Directory (LDAP): the service checks the connection,
    # encrypts the password and audits the change (ADR-0039).
    list_display = ("__str__", "server_uri", "updated_at")

    exclude = ("bind_password",)


@admin.register(ExternalIdentity)
class ExternalIdentityAdmin(ReadOnlyLedgerAdminMixin, admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    list_display = ("username", "user", "provider", "last_synced_at")

    search_fields = ("username", "user__email")
