from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.models import OrganizationBilling


class OrganizationBillingSerializer(BaseReadSerializer[OrganizationBilling]):
    farm_credits_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrganizationBilling
        fields = (
            "id",
            "uuid",
            "tier",
            "monthly_base_fee_usd",
            "farm_credits_total",
            "farm_credits_used",
            "farm_credits_remaining",
            "storage_quota_tb",
            "storage_used_tb",
            "active_seats_count",
            "max_seats_count",
            "next_billing_date",
            "invoice_currency",
            "payment_method",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class OrganizationBillingUpdateSerializer(BaseWriteSerializer[OrganizationBilling]):
    class Meta:
        model = OrganizationBilling
        fields = (
            "tier",
            "monthly_base_fee_usd",
            "farm_credits_total",
            "farm_credits_used",
            "storage_quota_tb",
            "storage_used_tb",
            "active_seats_count",
            "max_seats_count",
            "next_billing_date",
            "invoice_currency",
            "payment_method",
        )
