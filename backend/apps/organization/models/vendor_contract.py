from django.db import models

from apps.core.models.bases import EntityModel


class VendorContract(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="vendor_contracts",
        db_index=True,
    )
    vendor = models.ForeignKey(
        "organization.Vendor",
        on_delete=models.CASCADE,
        related_name="contracts",
        db_index=True,
    )
    contract_number = models.CharField(max_length=100, db_index=True)
    title = models.CharField(max_length=255)
    type = models.CharField(max_length=30, default="MSA", db_index=True)
    effective_date = models.DateField(null=True, blank=True, default=None)
    expiry_date = models.DateField(null=True, blank=True, default=None)
    # Whole USD as integer: DRF renders Decimal as string, but the frontend
    # contract declares total_value_usd as a number (arithmetic/display).
    total_value_usd = models.PositiveBigIntegerField(default=0)
    nda_signed = models.BooleanField(default=False)
    security_tier = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=30, default="Active", db_index=True)

    class Meta:
        db_table = "organization_vendor_contract"
        ordering = ("contract_number",)
        indexes = [
            models.Index(fields=["organization", "vendor"]),
            models.Index(fields=["organization", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "vendor", "contract_number"],
                name="uq_vendor_contract_org_vendor_number",
            ),
        ]

    def __str__(self):
        return f"{self.contract_number} ({self.vendor})"
