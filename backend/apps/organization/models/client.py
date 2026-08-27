from django.db import models
from apps.core.models.bases import EntityModel


class Client(EntityModel):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="clients",
        db_index=True,
    )
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=20, db_index=True)
    contact_name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    studio_type = models.CharField(max_length=50, blank=True, default="Major Studio")
    active_projects = models.JSONField(default=list, blank=True)
    contract_tier = models.CharField(max_length=50, blank=True, default="Standard Producer")
    portal_access = models.BooleanField(default=True)
    status = models.CharField(max_length=30, blank=True, default="Active", db_index=True)
    logo_url = models.URLField(max_length=500, blank=True, default="")
    headquarters = models.CharField(max_length=255, blank=True, default="")
    total_billed_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "organization_client"
        ordering = ("name",)
        unique_together = [("organization", "code")]
        indexes = [
            models.Index(fields=["organization", "code"]),
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
