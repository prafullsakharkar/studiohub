"""
Global vendor contract model (org-removal B3).

Contract for a platform-global vendor. No organization FK: the contract
number is unique per vendor.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases import PlatformScopedModel


class VendorContract(PlatformScopedModel):
    vendor = models.ForeignKey(
        "masterdata.Vendor",
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
        db_table = "masterdata_vendor_contract"
        ordering = ("contract_number",)
        indexes = [
            models.Index(fields=["vendor"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["vendor", "contract_number"],
                name="uq_masterdata_vendor_contract_number",
            ),
        ]

    def __str__(self):
        return f"{self.contract_number} ({self.vendor})"
