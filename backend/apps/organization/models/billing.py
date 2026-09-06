from django.db import models

from apps.core.models.bases import EntityModel


class OrganizationBilling(EntityModel):
    """
    Per-organization billing account.

    Holds the subscription tier, farm-credit balance, storage quota, and
    seat entitlement backing ``GET /api/v1/billing/``. Usage counters
    start at zero — real consumption wiring is future work (see ADR).
    """

    organization = models.OneToOneField(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="billing",
        db_index=True,
    )
    tier = models.CharField(max_length=50, default="Enterprise Vanguard")
    monthly_base_fee_usd = models.PositiveIntegerField(default=12500)
    farm_credits_total = models.PositiveBigIntegerField(default=500000)
    farm_credits_used = models.PositiveBigIntegerField(default=0)
    storage_quota_tb = models.PositiveIntegerField(default=500)
    storage_used_tb = models.FloatField(default=0)
    active_seats_count = models.PositiveIntegerField(default=0)
    max_seats_count = models.PositiveIntegerField(default=300)
    next_billing_date = models.DateField(null=True, blank=True, default=None)
    invoice_currency = models.CharField(max_length=20, default="USD ($)")
    payment_method = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "organization_billing"
        ordering = ("organization__code",)

    def __str__(self):
        return f"Billing ({self.organization})"

    @property
    def farm_credits_remaining(self):
        return max(self.farm_credits_total - self.farm_credits_used, 0)
