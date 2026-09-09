from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import OrganizationBilling


@admin.register(OrganizationBilling)
class OrganizationBillingAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "organization",
        "tier",
        "monthly_base_fee_usd",
        "farm_credits_total",
        "farm_credits_used",
        "storage_quota_tb",
        "storage_used_tb",
        "active_seats_count",
        "max_seats_count",
        "next_billing_date",
    )

    list_filter = ("tier",)

    search_fields = (
        "organization__name",
        "organization__code",
    )

    autocomplete_fields = ("organization",)

    list_select_related = ("organization",)
