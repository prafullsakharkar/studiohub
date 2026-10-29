from django.contrib import admin

from apps.identity.admin.ledger import ReadOnlyLedgerAdminMixin
from apps.identity.models import PasswordHistory


@admin.register(PasswordHistory)
class PasswordHistoryAdmin(ReadOnlyLedgerAdminMixin, admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    list_display = (
        "user",
        "created_at",
    )

    search_fields = ("user__email",)

    # The hashes are what stops a password coming back; nobody needs to read them.
    exclude = ("password_hash",)

    readonly_fields = (
        "id",
        "created_at",
    )
