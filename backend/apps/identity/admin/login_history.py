from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.admin.ledger import ReadOnlyLedgerAdminMixin
from apps.identity.models import LoginHistory


@admin.register(LoginHistory)
class LoginHistoryAdmin(ReadOnlyLedgerAdminMixin, PlatformScopedModelAdmin):
    list_display = (
        "user",
        "login_type",
        "login_method",
        "status",
        "ip_address",
        "mfa_enabled",
        "created_at",
    )

    list_filter = ("login_type", "login_method", "status", "mfa_enabled")

    search_fields = ("user__email", "user__username", "ip_address", "location")

    readonly_fields = ("user_agent",)

    list_select_related = ("user",)
