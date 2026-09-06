from django.db import models

from apps.core.models.bases import EntityModel


class ClientContract(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="client_contracts",
        db_index=True,
    )
    client = models.ForeignKey(
        "organization.Client",
        on_delete=models.CASCADE,
        related_name="contracts",
        db_index=True,
    )
    contract_number = models.CharField(max_length=100, db_index=True)
    title = models.CharField(max_length=255)
    type = models.CharField(max_length=30, default="SOW", db_index=True)
    effective_date = models.DateField(null=True, blank=True, default=None)
    expiry_date = models.DateField(null=True, blank=True, default=None)
    # Whole USD as integer: DRF renders Decimal as string, but the frontend
    # contract declares value_usd as a number (arithmetic/display).
    value_usd = models.PositiveBigIntegerField(default=0)
    status = models.CharField(max_length=30, default="Active", db_index=True)
    nda_signed = models.BooleanField(default=False)
    document_url = models.URLField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "organization_client_contract"
        ordering = ("contract_number",)
        indexes = [
            models.Index(fields=["organization", "client"]),
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self):
        return f"{self.contract_number} ({self.client})"
