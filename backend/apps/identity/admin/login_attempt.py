from django.contrib import admin

from apps.identity.admin.ledger import ReadOnlyLedgerAdminMixin
from apps.identity.models import LoginAttempt


@admin.register(LoginAttempt)
class LoginAttemptAdmin(ReadOnlyLedgerAdminMixin, admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    list_display = (
        "username",
        "ip_address",
        "success",
        "locked_until",
        "attempted_at",
    )

    list_filter = ("success",)

    search_fields = (
        "username",
        "ip_address",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
